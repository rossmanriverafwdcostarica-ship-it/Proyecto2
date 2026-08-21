import { empresasService } from '../services/empresasService.js';
import { solicitudesService } from '../services/solicitudesService.js';
import { reportesService } from '../services/reportesService.js';
import { showLoading, hideLoading, showError, showSuccess } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', initCumplimiento);

async function initCumplimiento() {
  const selectEmpresa = document.getElementById('empresaSelect');
  const formReporte = document.getElementById('formReporte');
  if (!selectEmpresa || !formReporte) return;

  try {
    showLoading();
    const empresas = (await empresasService.getAll()).filter(e => e.estado === 'activa');
    selectEmpresa.innerHTML = empresas.length
      ? '<option value="">Seleccione una empresa...</option>' + empresas.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')
      : '<option value="">No hay empresas aprobadas todavía</option>';
    selectEmpresa.disabled = !empresas.length;
  } catch (err) {
    console.error('[Cumplimiento - Init Error]:', err);
    showError('No se pudo cargar la lista de empresas. Inicie el servidor con npm start.');
  } finally {
    hideLoading();
  }

  selectEmpresa.addEventListener('change', () => cargarCompromisos(selectEmpresa.value));

  formReporte.addEventListener('submit', async (e) => {
    e.preventDefault();
    const empresaId = Number(selectEmpresa.value);
    const empleosReales = Number(document.getElementById('empleosReales').value);
    const inversionEjecutada = Number(document.getElementById('inversionEjecutada').value);
    const exportaciones = Number(document.getElementById('exportaciones').value);

    if (!empresaId || [empleosReales, inversionEjecutada, exportaciones].some(v => !Number.isFinite(v) || v < 0)) {
      showError('Complete correctamente todos los campos del reporte.');
      return;
    }

    try {
      showLoading();
      const [empresa, reportesExistentes] = await Promise.all([
        empresasService.getById(empresaId),
        reportesService.getAll()
      ]);
      const solicitud = await solicitudesService.getById(empresa.solicitudId);

      const alertas = [];
      if (empleosReales < Number(solicitud.empleosProyectados || 0)) {
        alertas.push({
          tipo: 'empleos',
          mensaje: `Empleos por debajo de lo comprometido (${empleosReales} de ${solicitud.empleosProyectados})`,
          diferencia: empleosReales - Number(solicitud.empleosProyectados || 0)
        });
      }

      if (inversionEjecutada < Number(solicitud.inversionProyectada || 0)) {
        alertas.push({
          tipo: 'inversion',
          mensaje: `Inversión por debajo de lo comprometido ($${inversionEjecutada.toLocaleString('es-CR')} de $${Number(solicitud.inversionProyectada || 0).toLocaleString('es-CR')})`,
          diferencia: inversionEjecutada - Number(solicitud.inversionProyectada || 0)
        });
      }

      const nuevoReporte = {
        empresaId,
        empleosReales,
        inversionEjecutada,
        exportaciones,
        fechaReporte: new Date().toISOString().split('T')[0],
        estado: alertas.length ? 'con alerta' : 'en regla',
        alertas
      };

      await reportesService.crear(nuevoReporte);
      showSuccess(`Reporte registrado. Estado: ${nuevoReporte.estado}. Total histórico previo: ${reportesExistentes.filter(r => String(r.empresaId) === String(empresaId)).length}.`);
      formReporte.reset();
      resetCompromisos();
    } catch (err) {
      console.error('[Cumplimiento - Submit Error]:', err);
      showError('No se pudo guardar el reporte. Intente nuevamente.');
    } finally {
      hideLoading();
    }
  });
}

async function cargarCompromisos(empresaId) {
  if (!empresaId) {
    resetCompromisos();
    return;
  }

  try {
    showLoading();
    const empresa = await empresasService.getById(empresaId);
    const solicitud = await solicitudesService.getById(empresa.solicitudId);
    document.getElementById('empleosComprometidos').textContent = Number(solicitud.empleosProyectados || 0).toLocaleString('es-CR');
    document.getElementById('inversionComprometida').textContent = `$${Number(solicitud.inversionProyectada || 0).toLocaleString('es-CR')}`;
  } catch (err) {
    console.error('[Cumplimiento - Compromisos Error]:', err);
    showError('Error al consultar los compromisos originales de la empresa.');
  } finally {
    hideLoading();
  }
}

function resetCompromisos() {
  document.getElementById('empleosComprometidos').textContent = '0';
  document.getElementById('inversionComprometida').textContent = '$0';
}
