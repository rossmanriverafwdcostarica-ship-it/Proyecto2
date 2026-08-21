import { reportesService } from '../services/reportesService.js';
import { empresasService } from '../services/empresasService.js';
import { escapeHTML, showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarAlertas);

async function cargarAlertas() {
  const contenedor = document.getElementById('contenedorAlertas');
  if (!contenedor) return;

  try {
    showLoading();
    const [reportes, empresas] = await Promise.all([
      reportesService.getAll(),
      empresasService.getAll()
    ]);

    const empresasMap = new Map(empresas.map(e => [String(e.id), e.nombre]));
    const reportesConAlerta = reportes.filter(r => r.estado === 'con alerta');

    if (!reportesConAlerta.length) {
      contenedor.innerHTML = `
        <div class="empty-state module-empty">
          <span class="material-symbols-outlined">verified</span>
          <div><strong>No hay alertas activas</strong><p>Cuando un reporte incumpla un compromiso, aparecerá aquí automáticamente.</p></div>
        </div>`;
      return;
    }

    contenedor.innerHTML = reportesConAlerta.map(reporte => {
      const alertas = Array.isArray(reporte.alertas) ? reporte.alertas : [];
      return `
        <article class="alert-card-modern">
          <div class="alert-card-head">
            <div>
              <span class="module-kicker">Empresa instalada</span>
              <h3>${escapeHTML(empresasMap.get(String(reporte.empresaId)) || 'Empresa desconocida')}</h3>
              <p>Reporte del ${escapeHTML(reporte.fechaReporte || 'sin fecha')}</p>
            </div>
            <span class="status-badge status-rechazada">Requiere atención</span>
          </div>
          <div class="alert-detail-grid">
            ${alertas.map(a => `
              <div class="alert-detail-item">
                <span class="material-symbols-outlined">warning</span>
                <div>
                  <strong>${escapeHTML(String(a.tipo || 'alerta').toUpperCase())}</strong>
                  <p>${escapeHTML(a.mensaje || 'Incumplimiento detectado.')}</p>
                  <small>Diferencia: ${Number(a.diferencia || 0).toLocaleString('es-CR')}</small>
                </div>
              </div>`).join('') || '<p>No hay detalle disponible para esta alerta.</p>'}
          </div>
        </article>`;
    }).join('');
  } catch (err) {
    console.error('[Alertas Error]:', err);
    showError('Error al cargar las alertas. Inicie el servidor con npm start y vuelva a intentar.');
    contenedor.innerHTML = '<div class="empty-state"><p>No fue posible consultar las alertas.</p></div>';
  } finally {
    hideLoading();
  }
}
