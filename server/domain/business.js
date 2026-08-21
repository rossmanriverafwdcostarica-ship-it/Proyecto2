import { ORIGINAL_COLLECTIONS } from '../core/config.js';
import { nextId, normalizeId, now, sameId } from '../core/utils.js';

export async function audit(db, user, action, entity, entityId, detail = '') {
  db.actividad.push({
    id: nextId(db.actividad),
    usuarioId: user?.id ?? null,
    usuario: user?.nombre || 'Sistema',
    accion: action,
    entidad: entity,
    entidadId: normalizeId(entityId),
    detalle: detail,
    fecha: now()
  });

  if (db.actividad.length > 500) db.actividad = db.actividad.slice(-500);
}

export function scopeCollection(collection, items, db, user) {
  if (!user || user.rol !== 'Empresa') return items;

  const companyName = String(user.empresaNombre || '').trim().toLowerCase();
  if (collection === 'zonasFrancas') return items;
  if (collection === 'solicitudes') {
    return items.filter(request => String(request.empresa || '').trim().toLowerCase() === companyName || sameId(request.creadoPor, user.id));
  }
  if (collection === 'empresas') {
    return items.filter(company => String(company.nombre || '').trim().toLowerCase() === companyName);
  }

  const ownRequests = db.solicitudes.filter(request => String(request.empresa || '').trim().toLowerCase() === companyName || sameId(request.creadoPor, user.id));
  const requestIds = new Set(ownRequests.map(request => String(request.id)));
  const ownCompanies = db.empresas.filter(company => requestIds.has(String(company.solicitudId)));
  const companyIds = new Set(ownCompanies.map(company => String(company.id)));

  if (collection === 'decisiones') return items.filter(decision => requestIds.has(String(decision.solicitudId)));
  if (collection === 'reportesCumplimiento') return items.filter(report => companyIds.has(String(report.empresaId)));
  return [];
}

export function canMutate(user, collection, method) {
  if (!user) return false;
  if (user.rol === 'Administrador') return true;
  if (user.rol === 'Analista') return ORIGINAL_COLLECTIONS.has(collection);
  if (user.rol === 'Empresa') {
    return (collection === 'solicitudes' || collection === 'reportesCumplimiento') && method === 'POST';
  }
  return false;
}

export function trackingEvent(status, detail, user) {
  return {
    estado: status,
    detalle: detail,
    usuario: user?.nombre || 'Sistema',
    fecha: now()
  };
}

export function prepareRequest(payload, user, id) {
  const result = { ...payload };

  if (user?.rol === 'Empresa') {
    if (user.empresaNombre) result.empresa = user.empresaNombre;
    result.estado = 'pendiente';
    result.puntajeIA = null;
    result.justificacionIA = '';
    result.clasificacionIA = '';
    result.decisionFinal = '';
    result.analista = '';
  }

  result.creadoPor = result.creadoPor ?? user?.id ?? null;
  result.codigoSeguimiento = result.codigoSeguimiento || `ZF-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
  result.seguimiento = Array.isArray(result.seguimiento)
    ? result.seguimiento
    : [trackingEvent('Solicitud recibida', 'Expediente registrado en ZoFranca CR.', user)];

  return result;
}

export function prepareComplianceReport(payload, db, user) {
  const result = { ...payload };
  const company = db.empresas.find(item => sameId(item.id, result.empresaId));
  if (!company) return { status: 404, error: 'La empresa indicada no existe.' };

  if (user?.rol === 'Empresa') {
    const ownCompanies = scopeCollection('empresas', db.empresas, db, user);
    if (!ownCompanies.some(item => sameId(item.id, company.id))) {
      return { status: 403, error: 'No puede registrar reportes para otra empresa.' };
    }
  }

  const request = db.solicitudes.find(item => sameId(item.id, company.solicitudId));
  if (!request) return { status: 400, error: 'No se encontró la solicitud aprobada asociada a la empresa.' };

  const empleosReales = Number(result.empleosReales);
  const inversionEjecutada = Number(result.inversionEjecutada);
  const exportaciones = Number(result.exportaciones);
  const values = [empleosReales, inversionEjecutada, exportaciones];

  if (values.some(value => !Number.isFinite(value) || value < 0)) {
    return { status: 400, error: 'Los valores del reporte deben ser números válidos mayores o iguales a cero.' };
  }

  const alertas = [];
  const empleosComprometidos = Number(request.empleosProyectados || 0);
  const inversionComprometida = Number(request.inversionProyectada || 0);

  if (empleosReales < empleosComprometidos) {
    alertas.push({
      tipo: 'empleos',
      mensaje: `Empleos por debajo de lo comprometido (${empleosReales} de ${empleosComprometidos})`,
      diferencia: empleosReales - empleosComprometidos
    });
  }

  if (inversionEjecutada < inversionComprometida) {
    alertas.push({
      tipo: 'inversion',
      mensaje: `Inversión por debajo de lo comprometido (${inversionEjecutada} de ${inversionComprometida})`,
      diferencia: inversionEjecutada - inversionComprometida
    });
  }

  result.empresaId = company.id;
  result.empleosReales = empleosReales;
  result.inversionEjecutada = inversionEjecutada;
  result.exportaciones = exportaciones;
  result.fechaReporte = result.fechaReporte || now();
  result.alertas = alertas;
  result.estado = alertas.length ? 'con alerta' : 'en regla';

  return { value: result };
}

export function validateDelete(db, collection, item) {
  if (collection === 'zonasFrancas') {
    if (db.solicitudes.some(request => sameId(request.zonaFrancaId, item.id)) || db.empresas.some(company => sameId(company.zonaFrancaId, item.id))) {
      return 'La zona tiene solicitudes o empresas asociadas.';
    }
  }

  if (collection === 'solicitudes') {
    if (db.decisiones.some(decision => sameId(decision.solicitudId, item.id)) || db.empresas.some(company => sameId(company.solicitudId, item.id))) {
      return 'La solicitud tiene decisiones o una empresa asociada.';
    }
  }

  if (collection === 'empresas') {
    if (db.reportesCumplimiento.some(report => sameId(report.empresaId, item.id))) {
      return 'La empresa tiene reportes de cumplimiento asociados.';
    }
  }

  return '';
}
