import { API_BASE_URL } from '../config/config.js';
import { showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarDashboard);

async function cargarDashboard() {
  try {
    showLoading();

    const respuestas = await Promise.all([
      fetch(`${API_BASE_URL}/solicitudes`),
      fetch(`${API_BASE_URL}/empresas`),
      fetch(`${API_BASE_URL}/reportesCumplimiento`),
      fetch(`${API_BASE_URL}/decisiones`)
    ]);

    if (respuestas.some(res => !res.ok)) throw new Error('Una o más colecciones no pudieron consultarse.');

    const [solicitudes, empresas, reportes, decisiones] = await Promise.all(respuestas.map(res => res.json()));

    const totalSolicitudes = solicitudes.length;
    const solicitudesAprobadas = solicitudes.filter(sol => {
      const dec = decisiones.find(d => String(d.solicitudId) === String(sol.id));
      return dec?.decision === 'Recomendada' || sol.decisionFinal === 'Recomendada' || sol.estado === 'aprobada';
    }).length;

    const pctAprobadas = totalSolicitudes ? ((solicitudesAprobadas / totalSolicitudes) * 100).toFixed(1) : '0.0';
    const empresasConAlerta = new Set(reportes.filter(r => r.estado === 'con alerta').map(r => String(r.empresaId)));
    const empresasConReporteEnRegla = new Set(reportes.filter(r => r.estado === 'en regla').map(r => String(r.empresaId)));
    const cantidadEnRegla = [...empresasConReporteEnRegla].filter(id => !empresasConAlerta.has(id)).length;

    setMetric('metricTotalSolicitudes', totalSolicitudes);
    setMetric('metricPctAprobadas', `${pctAprobadas}%`);
    setMetric('metricEmpresasRegla', cantidadEnRegla);
    setMetric('metricEmpresasAlerta', empresasConAlerta.size);

    const resumenElem = document.getElementById('resumenProcomer');
    if (!resumenElem) return;

    if (!empresas.length && !reportes.length) {
      resumenElem.innerHTML = `
        <div class="empty-state module-empty">
          <span class="material-symbols-outlined">insights</span>
          <div><strong>Aún no hay datos de cumplimiento</strong><p>Apruebe una solicitud y registre un reporte para completar el consolidado.</p></div>
        </div>`;
      return;
    }

    const totalInversion = reportes.reduce((sum, r) => sum + Number(r.inversionEjecutada || 0), 0);
    const totalExportaciones = reportes.reduce((sum, r) => sum + Number(r.exportaciones || 0), 0);
    const zonasFrancasActivas = new Set(solicitudes.map(s => s.zonaFrancaId).filter(Boolean)).size;

    resumenElem.innerHTML = `
      <div class="consolidated-card">
        <div class="consolidated-head">
          <div><span class="module-kicker">Resumen consolidado</span><h2>Impacto económico registrado</h2></div>
          <span class="material-symbols-outlined">monitoring</span>
        </div>
        <div class="consolidated-grid">
          <div><small>Empresas instaladas</small><strong>${empresas.filter(e => e.estado === 'activa').length}</strong></div>
          <div><small>Zonas involucradas</small><strong>${zonasFrancasActivas}</strong></div>
          <div><small>Inversión ejecutada</small><strong>$${totalInversion.toLocaleString('es-CR')}</strong></div>
          <div><small>Exportaciones</small><strong>$${totalExportaciones.toLocaleString('es-CR')}</strong></div>
        </div>
      </div>`;
  } catch (err) {
    console.error('[Dashboard Error]:', err);
    showError('Error al consolidar las métricas. Inicie el servidor con npm start y recargue la página.');
  } finally {
    hideLoading();
  }
}

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
