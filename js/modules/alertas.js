import { reportesService } from '../services/reportesService.js';
import { empresasService } from '../services/empresasService.js';
import { showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarAlertas);

async function cargarAlertas() {
  const contenedor = document.getElementById('contenedorAlertas');
  try {
    showLoading();
    const [reportes, empresas] = await Promise.all([
      reportesService.getAll(),
      empresasService.getAll()
    ]);

    const empresasMap = new Map(empresas.map(e => [e.id, e.nombre]));
    const reportesConAlerta = reportes.filter(r => r.estado === 'con alerta');

    if (reportesConAlerta.length === 0) {
      contenedor.innerHTML = '<p class="empty-state">Todas las empresas están en regla. No existen alertas registradas.</p>';
      return;
    }

    contenedor.innerHTML = reportesConAlerta.map(reporte => `
      <div class="card card-alerta">
        <div class="alerta-header">
          <h3>${empresasMap.get(reporte.empresaId) || 'Empresa Desconocida'}</h3>
          <span class="badge badge-error">Requiere Atención</span>
        </div>
        <p><strong>Fecha de Reporte:</strong> ${reporte.fechaReporte}</p>
        <div class="alertas-list">
          ${reporte.alertas.map(a => `
            <div class="alerta-item alerta-${a.tipo}">
              <p><strong>Tipo de Incumplimiento:</strong> ${a.tipo.toUpperCase()}</p>
              <p>${a.mensaje}</p>
              <p><strong>Diferencia Negativa:</strong> ${a.diferencia.toLocaleString()}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('[Alertas Error]:', err);
    showError('Error al cargar las alertas de incumplimiento.');
  } finally {
    hideLoading();
  }
}