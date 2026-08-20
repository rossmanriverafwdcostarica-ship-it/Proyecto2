import { ENDPOINTS, construirUrl } from "../config/config.js";

async function procesarRespuesta(response, mensajeError) {
    if (!response.ok) {
        let detalle = "";

        try {
            detalle = await response.text();
        } catch (error) {
            console.error("No se pudo leer el detalle de la respuesta.", error);
        }

        throw new Error(`${mensajeError}. HTTP ${response.status}. ${detalle}`.trim());
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export async function obtenerZonas() {
    const response = await fetch(construirUrl(ENDPOINTS.zonasFrancas));
    return procesarRespuesta(response, "No fue posible consultar las zonas francas");
}

export async function crearZona(zona) {
    const response = await fetch(construirUrl(ENDPOINTS.zonasFrancas), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(zona)
    });

    return procesarRespuesta(response, "No fue posible registrar la zona franca");
}

export async function obtenerSolicitudes() {
    const response = await fetch(construirUrl(ENDPOINTS.solicitudes));
    return procesarRespuesta(response, "No fue posible consultar las solicitudes");
}

export async function obtenerSolicitud(id) {
    const response = await fetch(construirUrl(ENDPOINTS.solicitudes, id));
    return procesarRespuesta(response, "No fue posible consultar la solicitud");
}

export async function crearSolicitud(solicitud) {
    const response = await fetch(construirUrl(ENDPOINTS.solicitudes), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(solicitud)
    });

    return procesarRespuesta(response, "No fue posible guardar la solicitud");
}

export async function actualizarSolicitud(id, cambios) {
    const response = await fetch(construirUrl(ENDPOINTS.solicitudes, id), {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(cambios)
    });

    return procesarRespuesta(response, "No fue posible actualizar la solicitud");
}

export async function crearDecision(decision) {
    const response = await fetch(construirUrl(ENDPOINTS.decisiones), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(decision)
    });

    return procesarRespuesta(response, "No fue posible registrar la decisión");
}
