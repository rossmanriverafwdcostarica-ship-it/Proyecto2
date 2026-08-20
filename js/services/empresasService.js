import { API_BASE_URL } from '../config/config.js';

export const empresasService = {
  async getAll() {
    const res = await fetch(`${API_BASE_URL}/empresas`);
    if (!res.ok) {
      throw new Error(`Error ${res.status}: No se pudieron obtener las empresas.`);
    }
    return await res.json();
  },

  async getById(id) {
    const res = await fetch(`${API_BASE_URL}/empresas/${id}`);
    if (!res.ok) {
      throw new Error(`Error ${res.status}: No se encontró la empresa solicitada.`);
    }
    return await res.json();
  }
};