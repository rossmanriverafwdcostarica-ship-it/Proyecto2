import { API_BASE_URL } from '../config/config.js';

export const reportesService = {
  async getAll() {
    const res = await fetch(`${API_BASE_URL}/reportesCumplimiento`);
    if (!res.ok) {
      throw new Error(`Error ${res.status}: No se pudieron obtener los reportes.`);
    }
    return await res.json();
  },

  async crear(reporte) {
    const res = await fetch(`${API_BASE_URL}/reportesCumplimiento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reporte)
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status}: No se pudo guardar el reporte de cumplimiento.`);
    }
    return await res.json();
  }
};