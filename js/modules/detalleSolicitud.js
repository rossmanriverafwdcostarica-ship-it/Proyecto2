import {
    actualizarSolicitud,
    crearDecision,
    obtenerSolicitud,
    obtenerSolicitudes,
    obtenerZonas
} from "../services/solicitudesService.js";
import { empresasService } from "../services/empresasService.js";
import {
    claseEstado,
    escapeHTML,
    formatearFecha,
    formatearNumero,
    mostrarMensaje,
    ocultarMensaje,
    setLoading
} from "../utils/ui.js";

let solicitudActual = null;
let zonaActual = null;

document.addEventListener("DOMContentLoaded", () => {
    configurarNavegacion();
    configurarAccionesDecision();
    configurarImpresion();
    cargarDetalle();
});

function configurarNavegacion() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector("#main-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
    });
}

function configurarImpresion() {
    document.querySelector("[data-print]")?.addEventListener("click", () => window.print());
}

async function resolverSolicitud() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) return obtenerSolicitud(id);

    const solicitudes = await obtenerSolicitudes();
    if (!solicitudes.length) return null;

    const ultima = solicitudes
        .slice()
        .sort((a, b) => new Date(b.fechaSolicitud || 0) - new Date(a.fechaSolicitud || 0))[0];

    window.history.replaceState({}, "", `./detalle-solicitud.html?id=${encodeURIComponent(ultima.id)}`);
    return ultima;
}

async function cargarDetalle() {
    const mensaje = document.querySelector("#mensaje-detalle");
    const contenido = document.querySelector("#contenido-detalle");

    try {
        mostrarMensaje(mensaje, "Cargando detalle de la solicitud...", "info");

        const [solicitud, zonas] = await Promise.all([
            resolverSolicitud(),
            obtenerZonas()
        ]);

        if (!solicitud) {
            mostrarMensaje(mensaje, "No existen solicitudes registradas todavía.", "warning");
            return;
        }

        solicitudActual = solicitud;
        zonaActual = zonas.find(zona => String(zona.id) === String(solicitud.zonaFrancaId)) || null;

        renderDetalle();
        contenido?.classList.remove("hidden");
        ocultarMensaje(mensaje);
    } catch (error) {
        console.error("Error al cargar el detalle.", error);
        mostrarMensaje(mensaje, "No fue posible cargar esta solicitud. Verifique que el servidor Node esté activo.", "error");
    } finally {
        document.querySelector("#estado-carga-detalle")?.classList.add("hidden");
    }
}

function renderDetalle() {
    if (!solicitudActual) return;

    setTexto("#detalle-empresa", solicitudActual.empresa);
    setTexto("#detalle-sector", solicitudActual.sector);
    setTexto("#detalle-zona", zonaActual?.nombre || "Zona no disponible");
    setTexto("#detalle-inversion", `$${formatearNumero(solicitudActual.inversionProyectada)}`);
    setTexto("#detalle-empleos", formatearNumero(solicitudActual.empleosProyectados));
    setTexto("#detalle-fecha", formatearFecha(solicitudActual.fechaSolicitud));

    const estado = document.querySelector("#detalle-estado");
    if (estado) {
        estado.textContent = solicitudActual.estado || "Sin estado";
        estado.className = `status-badge status-${claseEstado(solicitudActual.estado)}`;
    }

    renderDocumentos();
    renderIA();
    renderDecisionActual();
}

function renderDocumentos() {
    const lista = document.querySelector("#detalle-documentos");
    if (!lista) return;

    const documentos = Array.isArray(solicitudActual.documentos) ? solicitudActual.documentos : [];
    if (!documentos.length) {
        lista.innerHTML = "<li>No se registraron documentos de respaldo.</li>";
        return;
    }

    lista.innerHTML = documentos.map(documento => {
        const nombre = typeof documento === "string" ? documento : documento.nombre;
        return `<li>${escapeHTML(nombre || "Documento sin nombre")}</li>`;
    }).join("");
}

function renderIA() {
    const puntaje = document.querySelector("#ia-puntaje");
    const clasificacion = document.querySelector("#ia-clasificacion");
    const justificacion = document.querySelector("#ia-justificacion");
    const selectDecision = document.querySelector("#decision");

    const tieneEvaluacion = solicitudActual.puntajeIA !== null
        && solicitudActual.puntajeIA !== undefined
        && solicitudActual.clasificacionIA;

    if (!tieneEvaluacion) {
        puntaje.textContent = "—";
        clasificacion.textContent = "Sin evaluar";
        clasificacion.className = "status-badge";
        justificacion.textContent = "Esta solicitud todavía no ha sido evaluada. Use 'Evaluar pendientes' desde Solicitudes.";
        habilitarControlesDecision(false);
        return;
    }

    puntaje.textContent = solicitudActual.puntajeIA;
    clasificacion.textContent = solicitudActual.clasificacionIA;
    clasificacion.className = `status-badge status-${claseEstado(solicitudActual.clasificacionIA)}`;
    justificacion.textContent = solicitudActual.justificacionIA || "Sin justificación disponible.";

    if (selectDecision && !selectDecision.value) selectDecision.value = solicitudActual.clasificacionIA;
    habilitarControlesDecision(true);
}

function renderDecisionActual() {
    const contenedor = document.querySelector("#decision-actual");
    if (!contenedor) return;

    if (!solicitudActual.decisionFinal) {
        contenedor.innerHTML = '<div class="message message-info">Aún no existe una decisión final registrada por un analista.</div>';
        return;
    }

    contenedor.innerHTML = `
        <div class="message message-success">
            <strong>Decisión final:</strong> ${escapeHTML(solicitudActual.decisionFinal)}<br>
            <strong>Analista:</strong> ${escapeHTML(solicitudActual.analista || "No indicado")}
        </div>
    `;

    const inputAnalista = document.querySelector("#analista");
    if (inputAnalista && !inputAnalista.value) inputAnalista.value = solicitudActual.analista || "";
}

function configurarAccionesDecision() {
    document.querySelector("#btn-confirmar-ia")?.addEventListener("click", () => {
        if (!solicitudActual?.clasificacionIA) return;
        document.querySelector("#decision").value = solicitudActual.clasificacionIA;
        guardarDecision(solicitudActual.clasificacionIA, document.querySelector("#btn-confirmar-ia"));
    });

    document.querySelector("#btn-guardar-decision")?.addEventListener("click", () => {
        guardarDecision(document.querySelector("#decision")?.value || "", document.querySelector("#btn-guardar-decision"));
    });

    document.querySelector("#btn-rechazar-ia")?.addEventListener("click", () => {
        document.querySelector("#decision").value = "Rechazada";
        guardarDecision("Rechazada", document.querySelector("#btn-rechazar-ia"));
    });
}

async function sincronizarEmpresaInstalada(decision) {
    const existente = await empresasService.getBySolicitudId(solicitudActual.id);

    if (decision === "Recomendada") {
        const datosEmpresa = {
            nombre: solicitudActual.empresa,
            solicitudId: normalizarId(solicitudActual.id),
            zonaFrancaId: normalizarId(solicitudActual.zonaFrancaId),
            estado: "activa"
        };

        if (existente) {
            await empresasService.actualizar(existente.id, datosEmpresa);
        } else {
            await empresasService.crear(datosEmpresa);
        }
        return;
    }

    if (existente) {
        await empresasService.actualizar(existente.id, { estado: "inactiva" });
    }
}

async function guardarDecision(decision, boton) {
    const mensaje = document.querySelector("#mensaje-decision");
    const analista = document.querySelector("#analista")?.value.trim() || "";
    const observacion = document.querySelector("#observacion")?.value.trim() || "";

    ocultarMensaje(mensaje);

    if (!solicitudActual?.clasificacionIA) {
        mostrarMensaje(mensaje, "La solicitud debe ser evaluada antes de registrar una decisión.", "warning");
        return;
    }

    if (!analista) {
        mostrarMensaje(mensaje, "Indique el nombre del analista responsable.", "warning");
        document.querySelector("#analista")?.focus();
        return;
    }

    if (!["Recomendada", "Revisar", "Rechazada"].includes(decision)) {
        mostrarMensaje(mensaje, "Seleccione una decisión válida.", "warning");
        return;
    }

    const fecha = new Date().toISOString();
    const registroDecision = {
        solicitudId: normalizarId(solicitudActual.id),
        decision,
        usuario: analista,
        fecha,
        observacion
    };

    try {
        bloquearBotonesDecision(true);
        setLoading(boton, true, "Guardando...");
        mostrarMensaje(mensaje, "Registrando la decisión del analista...", "info");

        await crearDecision(registroDecision);
        solicitudActual = await actualizarSolicitud(solicitudActual.id, {
            decisionFinal: decision,
            analista,
            estado: "decidida"
        });
        await sincronizarEmpresaInstalada(decision);

        mostrarMensaje(
            mensaje,
            decision === "Recomendada"
                ? "Decisión guardada. La empresa quedó habilitada para reportes de cumplimiento."
                : "La decisión se guardó correctamente y la clasificación original de IA se conserva.",
            "success"
        );
        renderDetalle();
    } catch (error) {
        console.error("Error al guardar la decisión humana.", error);
        mostrarMensaje(mensaje, "No fue posible completar el registro de la decisión. Intente nuevamente.", "error");
    } finally {
        setLoading(boton, false);
        bloquearBotonesDecision(false);
    }
}

function habilitarControlesDecision(habilitar) {
    document.querySelectorAll("[data-decision-control]").forEach(control => { control.disabled = !habilitar; });
}

function bloquearBotonesDecision(bloquear) {
    document.querySelectorAll("[data-decision-button]").forEach(boton => { boton.disabled = bloquear; });
}

function setTexto(selector, valor) {
    const elemento = document.querySelector(selector);
    if (elemento) elemento.textContent = valor ?? "—";
}

function normalizarId(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && String(valor).trim() !== "" ? numero : valor;
}
