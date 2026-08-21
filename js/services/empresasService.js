import { API_BASE_URL } from '../config/config.js';

async function procesar(res, mensaje) {
  if (!res.ok) throw new Error(`${mensaje} HTTP ${res.status}.`);
  return res.json();
}

export const empresasService = {
  async getAll() {
    const res = await fetch(`${API_BASE_URL}/empresas`);
    return procesar(res, 'No se pudieron obtener las empresas.');
  },

  async getById(id) {
    const res = await fetch(`${API_BASE_URL}/empresas/${encodeURIComponent(id)}`);
    return procesar(res, 'No se encontró la empresa solicitada.');
  },

  async getBySolicitudId(solicitudId) {
    const res = await fetch(`${API_BASE_URL}/empresas?solicitudId=${encodeURIComponent(solicitudId)}`);
    const empresas = await procesar(res, 'No se pudo consultar la empresa asociada.');
    return empresas[0] || null;
  },

  async crear(empresa) {
    const res = await fetch(`${API_BASE_URL}/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(empresa)
    });
    return procesar(res, 'No se pudo crear la empresa instalada.');
  },

  async actualizar(id, cambios) {
    const res = await fetch(`${API_BASE_URL}/empresas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios)
    });
    return procesar(res, 'No se pudo actualizar la empresa instalada.');
  }
};
