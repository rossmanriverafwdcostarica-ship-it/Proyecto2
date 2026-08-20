import { API_BASE_URL } from '../config/config.js';
import { showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarHistorial);

async function cargarHistorial() {
  const contenedor = document.getElementById('contenedorHistorial');
  if (!contenedor) return;

  try {
    showLoading();

    // Consultas independientes en paralelo mediante Promise.all
    const [solicitudesRes, empresasRes, reportesRes, decisionesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/solicitudes`),
      fetch(`${API_BASE_URL}/empresas`),
      fetch(`${API_BASE_URL}/reportesCumplimiento`),
      fetch(`${API_BASE_URL}/decisiones`)
    ]);

    // Validación individual de res.ok
    if (!solicitudesRes.ok || !empresasRes.ok || !reportesRes.ok || !decisionesRes.ok) {
      throw new Error('Fallo en una o más peticiones al servidor.');
    }

    // Extracción de datos en paralelo
    const [solicitudes, empresas, reportes, decisiones] = await Promise.all([
      solicitudesRes.json(),
      empresasRes.json(),
      reportesRes.json(),
      decisionesRes.json()
    ]);

    // Empty State
    if (!empresas || empresas.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <p>No existen empresas ni registros en el historial de trazabilidad actualmente.</p>
        </div>
      `;
      return;
    }

    // Renderizado relacional utilizando empresaId, solicitudId y zonaFrancaId
    contenedor.innerHTML = empresas.map(empresa => {
      const solicitud = solicitudes.find(s => s.id === empresa.solicitudId) || {};
      const decision = decisiones.find(d => d.solicitudId === solicitud.id) || {};
      const reportesEmpresa = reportes.filter(r => r.empresaId === empresa.id);

      const estadoClase = empresa.estado === 'activa' ? 'badge-success' : 'badge-warning';

      return `
        <article class="historial-card">
          <header class="historial-header">
            <div>
              <h2>${empresa.nombre || 'Empresa sin nombre'}</h2>
              <small class="text-muted">Zona Franca ID: ${solicitud.zonaFrancaId || 'N/A'} | Empresa ID: ${empresa.id}</small>
            </div>
            <span class="badge ${estadoClase}">${empresa.estado ? empresa.estado.toUpperCase() : 'DESCONOCIDO'}</span>
          </header>

          <div class="timeline">
            <!-- 1. Solicitud Inicial -->
            <section class="timeline-item">
              <span class="timeline-step">1</span>
              <div class="timeline-content">
                <h4>Solicitud Inicial</h4>
                <p><strong>Fecha de Ingreso:</strong> ${solicitud.fechaSolicitud || 'No registrada'}</p>
                <p><strong>Solicitud ID:</strong> ${solicitud.id || 'N/A'}</p>
                <p><strong>Inversión Proyectada:</strong> $${(solicitud.inversionProyectada || 0).toLocaleString()}</p>
                <p><strong>Empleos Proyectados:</strong> ${solicitud.empleosProyectados || 0} plazas</p>
              </div>
            </section>

            <!-- 2. Evaluación IA -->
            <section class="timeline-item">
              <span class="timeline-step">2</span>
              <div class="timeline-content">
                <h4>Evaluación Asistida por IA</h4>
                <p><strong>Puntaje Asignado:</strong> ${solicitud.puntajeIA ?? 'Sin puntaje'} / 100</p>
                <p><strong>Clasificación:</strong> ${solicitud.clasificacionIA || 'Sin clasificar'}</p>
                <p><strong>Justificación IA:</strong> ${solicitud.justificacionIA || 'Sin justificación registrada.'}</p>
              </div>
            </section>

            <!-- 3. Decisión Humana -->
            <section class="timeline-item">
              <span class="timeline-step">3</span>
              <div class="timeline-content">
                <h4>Decisión Humana y Resolución</h4>
                <p><strong>Resolución:</strong> ${decision.decision || solicitud.decisionFinal || 'Pendiente'}</p>
                <p><strong>Usuario Responsable:</strong> ${decision.usuario || 'N/A'}</p>
                <p><strong>Fecha de Decisión:</strong> ${decision.fecha || 'N/A'}</p>
                <p><strong>Observaciones:</strong> ${decision.observacion || 'Sin observaciones adicionales.'}</p>
              </div>
            </section>

            <!-- 4. Reportes de Cumplimiento y Alertas -->
            <section class="timeline-item">
              <span class="timeline-step">4</span>
              <div class="timeline-content">
                <h4>Historial de Cumplimiento Periódico (${reportesEmpresa.length})</h4>
                ${reportesEmpresa.length === 0 
                  ? '<p class="text-muted">No se han registrado reportes de cumplimiento para esta empresa.</p>'
                  : reportesEmpresa.map(rep => `
                    <div class="sub-reporte ${rep.estado === 'con alerta' ? 'sub-alerta' : 'sub-regla'}">
                      <div class="sub-reporte-header">
                        <strong>Reporte (${rep.fechaReporte})</strong>
                        <span class="badge ${rep.estado === 'con alerta' ? 'badge-error' : 'badge-success'}">${rep.estado.toUpperCase()}</span>
                      </div>
                      <p><strong>Empleos Reales:</strong> ${rep.empleosReales} | <strong>Inversión Ejecutada:</strong> $${rep.inversionEjecutada.toLocaleString()} | <strong>Exportaciones:</strong> $${rep.exportaciones.toLocaleString()}</p>
                      ${rep.alertas && rep.alertas.length > 0 ? `
                        <div class="alertas-detalle">
                          <strong>Alertas Generadas:</strong>
                          <ul>
                            ${rep.alertas.map(a => `<li>[${a.tipo.toUpperCase()}] ${a.mensaje}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                    </div>
                  `).join('')
                }
              </div>
            </section>

            <!-- 5. Estado Actual -->
            <section class="timeline-item">
              <span class="timeline-step">5</span>
              <div class="timeline-content">
                <h4>Estado Operativo Actual</h4>
                <p>La empresa se encuentra registrada como <strong>${empresa.nombre}</strong> bajo el estado operativo <strong>${empresa.estado}</strong>.</p>
              </div>
            </section>
          </div>
        </article>
      `;
    }).join('');

  } catch (err) {
    console.error('[Historial - Carga Optimizada Error]:', err);
    showError('No se pudo cargar el historial de trazabilidad. Intente nuevamente en unos momentos.');
  } finally {
    hideLoading();
  }
}