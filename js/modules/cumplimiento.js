import { empresasService } from '../services/empresasService.js';
import { solicitudesService } from '../services/solicitudesService.js';
import { reportesService } from '../services/reportesService.js';
import { showLoading, hideLoading, showError, showSuccess } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', initCumplimiento);

async function initCumplimiento() {
  const selectEmpresa = document.getElementById('empresaSelect');
  const formReporte = document.getElementById('formReporte');

  try {
    showLoading();
    const empresas = await empresasService.getAll();
    selectEmpresa.innerHTML = '<option value="">Seleccione una empresa...</option>' +
      empresas.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  } catch (err) {
    console.error('[Cumplimiento - Init Error]:', err);
    showError('No se pudo cargar la lista de empresas. Verifique la conexión con el servidor.');
  } finally {
    hideLoading();
  }

  selectEmpresa?.addEventListener('change', async (e) => {
    const empresaId = e.target.value;
    if (!empresaId) return;

    try {
      showLoading();
      const empresa = await empresasService.getById(empresaId);
      const solicitud = await solicitudesService.getById(empresa.solicitudId);
      
      document.getElementById('empleosComprometidos').textContent = solicitud.empleosProyectados;
      document.getElementById('inversionComprometida').textContent = `$${solicitud.inversionProyectada.toLocaleString()}`;
    } catch (err) {
      console.error('[Cumplimiento - Select Empresa Error]:', err);
      showError('Error al consultar los compromisos originales de la empresa.');
    } finally {
      hideLoading();
    }
  });

  formReporte?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const empresaId = parseInt(selectEmpresa.value, 10);
    const empleosReales = parseInt(document.getElementById('empleosReales').value, 10);
    const inversionEjecutada = parseFloat(document.getElementById('inversionEjecutada').value);
    const exportaciones = parseFloat(document.getElementById('exportaciones').value);

    try {
      showLoading();
      const empresa = await empresasService.getById(empresaId);
      const solicitud = await solicitudesService.getById(empresa.solicitudId);

      const alertas = [];
      if (empleosReales < solicitud.empleosProyectados) {
        alertas.push({
          tipo: 'empleos',
          mensaje: `Empleos por debajo de lo comprometido (${empleosReales} de ${solicitud.empleosProyectados})`,
          diferencia: empleosReales - solicitud.empleosProyectados
        });
      }

      if (inversionEjecutada < solicitud.inversionProyectada) {
        alertas.push({
          tipo: 'inversion',
          mensaje: `Inversión por debajo de lo comprometido ($${inversionEjecutada.toLocaleString()} de $${solicitud.inversionProyectada.toLocaleString()})`,
          diferencia: inversionEjecutada - solicitud.inversionProyectada
        });
      }

      const nuevoReporte = {
        empresaId,
        empleosReales,
        inversionEjecutada,
        exportaciones,
        fechaReporte: new Date().toISOString().split('T')[0],
        estado: alertas.length > 0 ? 'con alerta' : 'en regla',
        alertas
      };

      await reportesService.crear(nuevoReporte);
      showSuccess('Reporte registrado exitosamente.');
      formReporte.reset();
      document.getElementById('empleosComprometidos').textContent = '0';
      document.getElementById('inversionComprometida').textContent = '$0';
    } catch (err) {
      console.error('[Cumplimiento - Submit Error]:', err);
      showError('No se pudo guardar el reporte. Intente nuevamente.');
    } finally {
      hideLoading();
    }
  });
}