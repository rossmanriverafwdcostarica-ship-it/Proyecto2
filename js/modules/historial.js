import { API_BASE_URL } from '../config/config.js';
import { escapeHTML, formatearFecha, showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarHistorial);

async function cargarHistorial() {
  const contenedor = document.getElementById('contenedorHistorial');
  if (!contenedor) return;

  try {
    showLoading();
    const respuestas = await Promise.all([
      fetch(`${API_BASE_URL}/solicitudes`),
      fetch(`${API_BASE_URL}/empresas`),
      fetch(`${API_BASE_URL}/reportesCumplimiento`),
      fetch(`${API_BASE_URL}/decisiones`)
    ]);

    if (respuestas.some(res => !res.ok)) throw new Error('Fallo en una o más peticiones al servidor.');
    const [solicitudes, empresas, reportes, decisiones] = await Promise.all(respuestas.map(res => res.json()));

    if (!empresas.length) {
      contenedor.innerHTML = `
        <div class="empty-state module-empty">
          <span class="material-symbols-outlined">history</span>
          <div><strong>No hay empresas instaladas todavía</strong><p>Cuando una solicitud sea aprobada como Recomendada, su trazabilidad aparecerá aquí.</p></div>
        </div>`;
      return;
    }

    contenedor.innerHTML = empresas.map(empresa => {
      const solicitud = solicitudes.find(s => String(s.id) === String(empresa.solicitudId)) || {};
      const decision = decisiones
        .filter(d => String(d.solicitudId) === String(solicitud.id))
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))[0] || {};
      const reportesEmpresa = reportes
        .filter(r => String(r.empresaId) === String(empresa.id))
        .sort((a, b) => new Date(b.fechaReporte || 0) - new Date(a.fechaReporte || 0));

      return `
        <article class="historial-card">
          <header class="historial-header">
            <div><span class="module-kicker">Expediente empresarial</span><h2>${escapeHTML(empresa.nombre || 'Empresa sin nombre')}</h2><small class="text-muted">Empresa #${escapeHTML(empresa.id)} · Zona #${escapeHTML(solicitud.zonaFrancaId || empresa.zonaFrancaId || 'N/A')}</small></div>
            <span class="status-badge ${empresa.estado === 'activa' ? 'status-recomendada' : 'status-pendiente'}">${escapeHTML(String(empresa.estado || 'desconocido').toUpperCase())}</span>
          </header>
          <div class="timeline">
            ${timelineItem(1, 'Solicitud inicial', `Fecha: ${formatearFecha(solicitud.fechaSolicitud)} · Inversión: $${Number(solicitud.inversionProyectada || 0).toLocaleString('es-CR')} · Empleos: ${Number(solicitud.empleosProyectados || 0).toLocaleString('es-CR')}`)}
            ${timelineItem(2, 'Evaluación IA', `Puntaje: ${solicitud.puntajeIA ?? '—'}/100 · Clasificación: ${escapeHTML(solicitud.clasificacionIA || 'Sin clasificar')}`)}
            ${timelineItem(3, 'Decisión humana', `Resolución: ${escapeHTML(decision.decision || solicitud.decisionFinal || 'Pendiente')} · Responsable: ${escapeHTML(decision.usuario || solicitud.analista || 'No registrado')} · Fecha: ${formatearFecha(decision.fecha)}`)}
            ${timelineReportes(reportesEmpresa)}
            ${timelineItem(5, 'Estado actual', `La empresa se encuentra ${escapeHTML(empresa.estado || 'sin estado')} y acumula ${reportesEmpresa.length} reporte(s) de cumplimiento.`)}
          </div>
        </article>`;
    }).join('');
  } catch (err) {
    console.error('[Historial Error]:', err);
    showError('No se pudo cargar el historial. Inicie el servidor con npm start y vuelva a intentar.');
    contenedor.innerHTML = '<div class="empty-state"><p>No fue posible consultar la trazabilidad.</p></div>';
  } finally {
    hideLoading();
  }
}

function timelineItem(step, title, text) {
  return `<section class="timeline-item"><span class="timeline-step">${step}</span><div class="timeline-content"><h4>${title}</h4><p>${text}</p></div></section>`;
}

function timelineReportes(reportes) {
  const body = reportes.length
    ? reportes.map(rep => `<div class="history-report ${rep.estado === 'con alerta' ? 'has-alert' : ''}"><strong>${escapeHTML(rep.fechaReporte || 'Sin fecha')}</strong><span>${escapeHTML(rep.estado || '')}</span><p>Empleos: ${rep.empleosReales} · Inversión: $${Number(rep.inversionEjecutada || 0).toLocaleString('es-CR')} · Exportaciones: $${Number(rep.exportaciones || 0).toLocaleString('es-CR')}</p></div>`).join('')
    : '<p class="text-muted">No existen reportes de cumplimiento.</p>';

  return `<section class="timeline-item"><span class="timeline-step">4</span><div class="timeline-content"><h4>Reportes y alertas</h4>${body}</div></section>`;
}
