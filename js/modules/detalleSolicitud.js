import {
    actualizarSolicitud,
    crearDecision,
    obtenerSolicitud,
    obtenerZonas
} from "../services/solicitudesService.js";
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
    cargarDetalle();
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

async function cargarDetalle() {
    const mensaje = document.querySelector("#mensaje-detalle");
    const contenido = document.querySelector("#contenido-detalle");
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        mostrarMensaje(mensaje, "No se indicó qué solicitud debe mostrarse.", "warning");
        return;
    }

    try {
        mostrarMensaje(mensaje, "Cargando detalle de la solicitud...", "info");

        const [solicitud, zonas] = await Promise.all([
            obtenerSolicitud(id),
            obtenerZonas()
        ]);

        solicitudActual = solicitud;
        zonaActual = zonas.find(
            (zona) => String(zona.id) === String(solicitud.zonaFrancaId)
        ) || null;

        renderDetalle();
        contenido?.classList.remove("hidden");
        ocultarMensaje(mensaje);
    } catch (error) {
        console.error("Error al cargar el detalle.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible cargar esta solicitud. Verifique que el servicio esté disponible.",
            "error"
        );
    } finally {
        document.querySelector("#estado-carga-detalle")?.classList.add("hidden");
    }
}

function renderDetalle() {
    if (!solicitudActual) {
        return;
    }

    setTexto("#detalle-empresa", solicitudActual.empresa);
    setTexto("#detalle-sector", solicitudActual.sector);
    setTexto("#detalle-zona", zonaActual?.nombre || "Zona no disponible");
    setTexto("#detalle-inversion", formatearNumero(solicitudActual.inversionProyectada));
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

    if (!lista) {
        return;
    }

    const documentos = Array.isArray(solicitudActual.documentos)
        ? solicitudActual.documentos
        : [];

    if (documentos.length === 0) {
        lista.innerHTML = "<li>No se registraron documentos de respaldo.</li>";
        return;
    }

    lista.innerHTML = documentos.map((documento) => {
        const nombre = typeof documento === "string"
            ? documento
            : documento.nombre;

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
        justificacion.textContent = "Esta solicitud todavía no ha sido evaluada por la IA simulada.";
        habilitarControlesDecision(false);
        return;
    }

    puntaje.textContent = solicitudActual.puntajeIA;
    clasificacion.textContent = solicitudActual.clasificacionIA;
    clasificacion.className = `status-badge status-${claseEstado(solicitudActual.clasificacionIA)}`;
    justificacion.textContent = solicitudActual.justificacionIA || "Sin justificación disponible.";

    if (selectDecision && !selectDecision.value) {
        selectDecision.value = solicitudActual.clasificacionIA;
    }

    habilitarControlesDecision(true);
}

function renderDecisionActual() {
    const contenedor = document.querySelector("#decision-actual");

    if (!contenedor) {
        return;
    }

    if (!solicitudActual.decisionFinal) {
        contenedor.innerHTML = `
            <div class="message message-info">
                Aún no existe una decisión final registrada por un analista.
            </div>
        `;
        return;
    }

    contenedor.innerHTML = `
        <div class="message message-success">
            <strong>Decisión final:</strong>
            ${escapeHTML(solicitudActual.decisionFinal)}
            <br>
            <strong>Analista:</strong>
            ${escapeHTML(solicitudActual.analista || "No indicado")}
        </div>
    `;

    const inputAnalista = document.querySelector("#analista");

    if (inputAnalista && !inputAnalista.value) {
        inputAnalista.value = solicitudActual.analista || "";
    }
}

function configurarAccionesDecision() {
    document.querySelector("#btn-confirmar-ia")?.addEventListener("click", () => {
        if (!solicitudActual?.clasificacionIA) {
            return;
        }

        document.querySelector("#decision").value = solicitudActual.clasificacionIA;
        guardarDecision(solicitudActual.clasificacionIA, document.querySelector("#btn-confirmar-ia"));
    });

    document.querySelector("#btn-guardar-decision")?.addEventListener("click", () => {
        const decision = document.querySelector("#decision")?.value || "";
        guardarDecision(decision, document.querySelector("#btn-guardar-decision"));
    });

    document.querySelector("#btn-rechazar-ia")?.addEventListener("click", () => {
        document.querySelector("#decision").value = "Rechazada";
        guardarDecision("Rechazada", document.querySelector("#btn-rechazar-ia"));
    });
}

async function guardarDecision(decision, boton) {
    const mensaje = document.querySelector("#mensaje-decision");
    const analista = document.querySelector("#analista")?.value.trim() || "";
    const observacion = document.querySelector("#observacion")?.value.trim() || "";

    ocultarMensaje(mensaje);

    if (!solicitudActual?.clasificacionIA) {
        mostrarMensaje(
            mensaje,
            "La solicitud debe ser evaluada por la IA antes de registrar una decisión.",
            "warning"
        );
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

        const solicitudActualizada = await actualizarSolicitud(solicitudActual.id, {
            decisionFinal: decision,
            analista,
            estado: "decidida"
        });

        solicitudActual = solicitudActualizada;

        mostrarMensaje(
            mensaje,
            "La decisión se guardó correctamente. La clasificación original de IA se conserva.",
            "success"
        );

        renderDetalle();
    } catch (error) {
        console.error("Error al guardar la decisión humana.", error);
        mostrarMensaje(
            mensaje,
            "No fue posible completar el registro de la decisión. Intente nuevamente.",
            "error"
        );
    } finally {
        setLoading(boton, false);
        bloquearBotonesDecision(false);
    }
}

function habilitarControlesDecision(habilitar) {
    document.querySelectorAll("[data-decision-control]").forEach((control) => {
        control.disabled = !habilitar;
    });
}

function bloquearBotonesDecision(bloquear) {
    document.querySelectorAll("[data-decision-button]").forEach((boton) => {
        boton.disabled = bloquear;
    });
}

function setTexto(selector, valor) {
    const elemento = document.querySelector(selector);

    if (elemento) {
        elemento.textContent = valor ?? "—";
    }
}

function normalizarId(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && String(valor).trim() !== "" ? numero : valor;
}
