import {
    actualizarSolicitud,
    crearSolicitud,
    crearZona,
    obtenerSolicitudes,
    obtenerZonas
} from "../services/solicitudesService.js";
import { clasificar, evaluarConIA } from "../services/iaService.js";
import {
    claseEstado,
    escapeHTML,
    formatearFecha,
    mostrarMensaje,
    ocultarMensaje,
    setLoading
} from "../utils/ui.js";
import {
    tieneErrores,
    validarSolicitud,
    validarZona
} from "../utils/validators.js";

let zonas = [];
let solicitudes = [];

document.addEventListener("DOMContentLoaded", () => {
    configurarNavegacion();

    if (document.querySelector("#form-solicitud")) {
        inicializarPaginaNuevaSolicitud();
    }

    if (document.querySelector("#tabla-solicitudes")) {
        inicializarPaginaListado();
    }
});

function configurarNavegacion() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector("#main-nav");

    if (!toggle || !nav) {
        return;
    }

    toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
    });
}

async function inicializarPaginaNuevaSolicitud() {
    const mensaje = document.querySelector("#mensaje-solicitud");

    try {
        mostrarMensaje(mensaje, "Cargando zonas francas...", "info");
        zonas = await obtenerZonas();
        renderOpcionesZona();
        ocultarMensaje(mensaje);
    } catch (error) {
        console.error("Error al cargar zonas francas.", error);
        mostrarMensaje(
            mensaje,
            "No pudimos cargar las zonas francas. Verifique que el servicio esté disponible e intente nuevamente.",
            "error"
        );
    } finally {
        const selectZona = document.querySelector("#zonaFrancaId");

        if (selectZona) {
            selectZona.disabled = false;
        }
    }

    document.querySelector("#form-solicitud")?.addEventListener("submit", manejarEnvioSolicitud);
    document.querySelector("#form-zona")?.addEventListener("submit", manejarRegistroZona);
}

async function manejarEnvioSolicitud(event) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const boton = formulario.querySelector('button[type="submit"]');
    const mensaje = document.querySelector("#mensaje-solicitud");

    limpiarErroresFormulario(formulario);
    ocultarMensaje(mensaje);

    const datos = construirDatosSolicitud(formulario);
    const errores = validarSolicitud(datos);

    if (tieneErrores(errores)) {
        aplicarErroresFormulario(formulario, errores);
        mostrarMensaje(mensaje, "Revise los campos indicados antes de enviar la solicitud.", "warning");
        return;
    }

    const solicitud = {
        empresa: datos.empresa,
        sector: datos.sector,
        inversionProyectada: Number(datos.inversionProyectada),
        empleosProyectados: Number(datos.empleosProyectados),
        documentos: datos.documentos,
        zonaFrancaId: normalizarId(datos.zonaFrancaId),
        estado: "pendiente",
        puntajeIA: null,
        justificacionIA: "",
        clasificacionIA: "",
        decisionFinal: "",
        analista: "",
        fechaSolicitud: new Date().toISOString()
    };

    try {
        setLoading(boton, true, "Enviando...");
        mostrarMensaje(mensaje, "Guardando la solicitud...", "info");

        await crearSolicitud(solicitud);

        formulario.reset();
        mostrarMensaje(
            mensaje,
            "La solicitud se registró correctamente y quedó pendiente de evaluación.",
            "success"
        );
    } catch (error) {
        console.error("Error al crear la solicitud.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible guardar la solicitud. Intente nuevamente en unos momentos.",
            "error"
        );
    } finally {
        setLoading(boton, false);
    }
}

async function manejarRegistroZona(event) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const boton = formulario.querySelector('button[type="submit"]');
    const mensaje = document.querySelector("#mensaje-zona");

    limpiarErroresFormulario(formulario);
    ocultarMensaje(mensaje);

    const sectoresPermitidos = String(formulario.sectoresPermitidos.value || "")
        .split(",")
        .map((sector) => sector.trim().toLowerCase())
        .filter(Boolean);

    const zona = {
        nombre: formulario.nombre.value.trim(),
        inversionMinima: formulario.inversionMinima.value,
        empleosMinimos: formulario.empleosMinimos.value,
        sectoresPermitidos
    };

    const errores = validarZona(zona);

    if (tieneErrores(errores)) {
        aplicarErroresFormulario(formulario, errores);
        mostrarMensaje(mensaje, "Revise los datos de la zona franca.", "warning");
        return;
    }

    const payload = {
        nombre: zona.nombre,
        inversionMinima: Number(zona.inversionMinima),
        empleosMinimos: Number(zona.empleosMinimos),
        sectoresPermitidos: zona.sectoresPermitidos
    };

    try {
        setLoading(boton, true, "Registrando...");
        mostrarMensaje(mensaje, "Registrando zona franca...", "info");

        const nuevaZona = await crearZona(payload);
        zonas.push(nuevaZona);
        renderOpcionesZona(nuevaZona.id);

        formulario.reset();
        mostrarMensaje(mensaje, "La zona franca se registró correctamente.", "success");
    } catch (error) {
        console.error("Error al registrar la zona franca.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible registrar la zona franca. Intente nuevamente.",
            "error"
        );
    } finally {
        setLoading(boton, false);
    }
}

function construirDatosSolicitud(formulario) {
    const archivos = Array.from(formulario.documentos.files || []).map((archivo) => ({
        nombre: archivo.name,
        tipo: archivo.type,
        tamano: archivo.size,
        ultimaModificacion: archivo.lastModified
    }));

    return {
        empresa: formulario.empresa.value.trim(),
        sector: formulario.sector.value.trim().toLowerCase(),
        inversionProyectada: formulario.inversionProyectada.value,
        empleosProyectados: formulario.empleosProyectados.value,
        documentos: archivos,
        zonaFrancaId: formulario.zonaFrancaId.value
    };
}

function renderOpcionesZona(valorSeleccionado = "") {
    const selectSolicitud = document.querySelector("#zonaFrancaId");

    if (!selectSolicitud) {
        return;
    }

    selectSolicitud.innerHTML = '<option value="">Seleccione una zona franca</option>';

    zonas
        .slice()
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"))
        .forEach((zona) => {
            const option = document.createElement("option");
            option.value = zona.id;
            option.textContent = zona.nombre;

            if (String(zona.id) === String(valorSeleccionado)) {
                option.selected = true;
            }

            selectSolicitud.appendChild(option);
        });
}

async function inicializarPaginaListado() {
    configurarFiltros();
    document.querySelector("#btn-evaluar-pendientes")?.addEventListener("click", procesarSolicitudes);
    await cargarListado();
}

async function cargarListado() {
    const mensaje = document.querySelector("#mensaje-listado");
    const indicador = document.querySelector("#estado-carga-listado");

    try {
        indicador?.classList.remove("hidden");
        mostrarMensaje(mensaje, "Consultando solicitudes...", "info");

        const resultados = await Promise.all([
            obtenerSolicitudes(),
            obtenerZonas()
        ]);

        solicitudes = resultados[0];
        zonas = resultados[1];

        llenarFiltrosDinamicos();
        aplicarFiltros();
        ocultarMensaje(mensaje);
    } catch (error) {
        console.error("Error al cargar el listado.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible cargar las solicitudes. Revise la conexión con el servicio e intente de nuevo.",
            "error"
        );
        renderTabla([]);
    } finally {
        indicador?.classList.add("hidden");
    }
}

function configurarFiltros() {
    ["filtro-estado", "filtro-zona", "filtro-sector", "filtro-fecha"].forEach((id) => {
        document.querySelector(`#${id}`)?.addEventListener("input", aplicarFiltros);
    });

    document.querySelector("#btn-limpiar-filtros")?.addEventListener("click", () => {
        ["filtro-estado", "filtro-zona", "filtro-sector", "filtro-fecha"].forEach((id) => {
            const campo = document.querySelector(`#${id}`);

            if (campo) {
                campo.value = "";
            }
        });

        aplicarFiltros();
    });
}

function llenarFiltrosDinamicos() {
    const filtroZona = document.querySelector("#filtro-zona");
    const filtroSector = document.querySelector("#filtro-sector");

    if (filtroZona) {
        filtroZona.innerHTML = '<option value="">Todas las zonas</option>';

        zonas
            .slice()
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"))
            .forEach((zona) => {
                const option = document.createElement("option");
                option.value = zona.id;
                option.textContent = zona.nombre;
                filtroZona.appendChild(option);
            });
    }

    if (filtroSector) {
        const sectores = [...new Set(
            solicitudes
                .map((solicitud) => String(solicitud.sector || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "es"));

        filtroSector.innerHTML = '<option value="">Todos los sectores</option>';

        sectores.forEach((sector) => {
            const option = document.createElement("option");
            option.value = sector;
            option.textContent = sector;
            filtroSector.appendChild(option);
        });
    }
}

function aplicarFiltros() {
    const estado = document.querySelector("#filtro-estado")?.value || "";
    const zona = document.querySelector("#filtro-zona")?.value || "";
    const sector = document.querySelector("#filtro-sector")?.value || "";
    const fecha = document.querySelector("#filtro-fecha")?.value || "";

    const filtradas = solicitudes.filter((solicitud) => {
        const coincideEstado = !estado || String(solicitud.estado) === estado;
        const coincideZona = !zona || String(solicitud.zonaFrancaId) === String(zona);
        const coincideSector = !sector || String(solicitud.sector) === sector;
        const fechaSolicitud = String(solicitud.fechaSolicitud || "").slice(0, 10);
        const coincideFecha = !fecha || fechaSolicitud === fecha;

        return coincideEstado && coincideZona && coincideSector && coincideFecha;
    });

    renderTabla(filtradas);
}

function renderTabla(datos) {
    const tbody = document.querySelector("#tabla-solicitudes tbody");
    const contador = document.querySelector("#contador-resultados");

    if (!tbody) {
        return;
    }

    if (contador) {
        contador.textContent = `Mostrando ${datos.length} solicitud${datos.length === 1 ? "" : "es"}`;
    }

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        No hay solicitudes que coincidan con los filtros seleccionados.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = datos.map((solicitud) => {
        const zona = zonas.find((item) => String(item.id) === String(solicitud.zonaFrancaId));
        const puntajeValor = solicitud.puntajeIA === null || solicitud.puntajeIA === undefined
            ? null
            : Number(solicitud.puntajeIA);
        const puntaje = puntajeValor === null ? "—" : escapeHTML(puntajeValor);
        const scoreClass = puntajeValor !== null && puntajeValor < 50 ? " score-low" : "";

        const clasificacion = solicitud.clasificacionIA
            ? `<span class="status-badge status-${claseEstado(solicitud.clasificacionIA)}">${escapeHTML(solicitud.clasificacionIA)}</span>`
            : `<span class="status-badge status-pendiente">Pendiente IA</span>`;

        const estadoActual = solicitud.decisionFinal || solicitud.estado || "pendiente";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(solicitud.empresa)}</strong>
                    <small class="row-subtext">ID: REQ-${String(solicitud.id).padStart(4, "0")}</small>
                </td>
                <td>
                    ${escapeHTML(solicitud.sector)}
                    <small class="row-subtext">${escapeHTML(zona?.nombre || "Zona no disponible")}</small>
                </td>
                <td>${escapeHTML(formatearFecha(solicitud.fechaSolicitud))}</td>
                <td><span class="score${scoreClass}">${puntaje}</span></td>
                <td>${clasificacion}</td>
                <td><span class="current-state">${escapeHTML(estadoActual)}</span></td>
                <td>
                    <a class="button button-secondary button-small"
                       href="./detalle-solicitud.html?id=${encodeURIComponent(solicitud.id)}"
                       aria-label="Ver detalle de ${escapeHTML(solicitud.empresa)}">
                        Ver detalle
                    </a>
                </td>
            </tr>
        `;
    }).join("");
}

async function procesarSolicitudes() {
    const boton = document.querySelector("#btn-evaluar-pendientes");
    const mensaje = document.querySelector("#mensaje-listado");

    try {
        setLoading(boton, true, "Consultando pendientes...");
        mostrarMensaje(mensaje, "Consultando solicitudes pendientes...", "info");

        const [solicitudesActuales, zonasActuales] = await Promise.all([
            obtenerSolicitudes(),
            obtenerZonas()
        ]);

        solicitudes = solicitudesActuales;
        zonas = zonasActuales;

        const pendientes = solicitudesActuales.filter(
            (solicitud) => solicitud.estado === "pendiente"
        );

        if (pendientes.length === 0) {
            mostrarMensaje(mensaje, "No hay solicitudes pendientes para evaluar.", "info");
            aplicarFiltros();
            return;
        }

        setLoading(boton, true, `Evaluando ${pendientes.length}...`);
        mostrarMensaje(
            mensaje,
            `Evaluando ${pendientes.length} solicitud${pendientes.length === 1 ? "" : "es"} en paralelo...`,
            "info"
        );

        const evaluaciones = await Promise.all(
            pendientes.map((solicitud) => {
                const zona = zonasActuales.find(
                    (item) => String(item.id) === String(solicitud.zonaFrancaId)
                );

                return evaluarConIA(solicitud, zona).then((resultado) => ({
                    solicitud,
                    resultado
                }));
            })
        );

        await Promise.all(
            evaluaciones.map(({ solicitud, resultado }) => {
                const cambios = {
                    puntajeIA: resultado.puntaje,
                    justificacionIA: resultado.justificacion,
                    clasificacionIA: clasificar(resultado.puntaje),
                    estado: "evaluada"
                };

                return actualizarSolicitud(solicitud.id, cambios);
            })
        );

        mostrarMensaje(
            mensaje,
            "Las solicitudes pendientes fueron evaluadas correctamente.",
            "success"
        );

        await cargarListado();
    } catch (error) {
        console.error("Error al procesar solicitudes pendientes.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible completar la evaluación. Ninguna decisión humana fue modificada. Intente nuevamente.",
            "error"
        );
    } finally {
        setLoading(boton, false);
    }
}

function aplicarErroresFormulario(formulario, errores) {
    Object.entries(errores).forEach(([campo, mensaje]) => {
        const input = formulario.elements[campo];
        const error = formulario.querySelector(`[data-error-for="${campo}"]`);

        if (input) {
            input.setAttribute("aria-invalid", "true");
        }

        if (error) {
            error.textContent = mensaje;
        }
    });
}

function limpiarErroresFormulario(formulario) {
    formulario.querySelectorAll("[aria-invalid='true']").forEach((elemento) => {
        elemento.removeAttribute("aria-invalid");
    });

    formulario.querySelectorAll("[data-error-for]").forEach((elemento) => {
        elemento.textContent = "";
    });
}

function normalizarId(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && String(valor).trim() !== "" ? numero : valor;
}
