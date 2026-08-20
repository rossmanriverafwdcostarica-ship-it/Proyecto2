export function setLoading(button, loading, loadingText = "Procesando...") {
    if (!button) {
        return;
    }

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${loadingText}`;
        button.setAttribute("aria-busy", "true");
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || "Continuar";
        button.removeAttribute("aria-busy");
    }
}

export function mostrarMensaje(container, mensaje, tipo = "info") {
    if (!container) {
        return;
    }

    const tiposPermitidos = ["info", "success", "error", "warning"];
    const tipoSeguro = tiposPermitidos.includes(tipo) ? tipo : "info";

    container.className = `message message-${tipoSeguro}`;
    container.textContent = mensaje;
    container.classList.remove("hidden");
}

export function ocultarMensaje(container) {
    if (!container) {
        return;
    }

    container.classList.add("hidden");
    container.textContent = "";
}

export function escapeHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function formatearFecha(valor) {
    if (!valor) {
        return "Sin fecha";
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return "Fecha inválida";
    }

    return new Intl.DateTimeFormat("es-CR", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(fecha);
}

export function formatearNumero(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "0";
    }

    return new Intl.NumberFormat("es-CR").format(numero);
}

export function claseEstado(valor) {
    return String(valor || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
}
