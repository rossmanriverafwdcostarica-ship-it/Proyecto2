const NODE_SERVER_URL = 'http://localhost:3001';

export const API_BASE_URL =
    window.location.protocol.startsWith('http') && window.location.port === '3001'
        ? window.location.origin
        : NODE_SERVER_URL;

export const ENDPOINTS = Object.freeze({
    zonasFrancas: '/zonasFrancas',
    solicitudes: '/solicitudes',
    empresas: '/empresas',
    reportesCumplimiento: '/reportesCumplimiento',
    decisiones: '/decisiones'
});

export function construirUrl(endpoint, id = null) {
    const base = `${API_BASE_URL}${endpoint}`;

    if (id === null || id === undefined || id === '') {
        return base;
    }

    return `${base}/${encodeURIComponent(id)}`;
}
