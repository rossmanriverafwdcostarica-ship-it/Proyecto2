export const API_BASE_URL = "http://localhost:3001";

export const ENDPOINTS = Object.freeze({
    zonasFrancas: "/zonasFrancas",
    solicitudes: "/solicitudes",
    empresas: "/empresas",
    reportesCumplimiento: "/reportesCumplimiento",
    decisiones: "/decisiones"
});

export function construirUrl(endpoint, id = null) {
    const base = `${API_BASE_URL}${endpoint}`;

    if (id === null || id === undefined || id === "") {
        return base;
    }

    return `${base}/${encodeURIComponent(id)}`;
}
