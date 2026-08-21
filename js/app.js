import { evaluarConIA, clasificar } from './services/iaService.js';
import { $, $$, escapeHTML } from './core/dom.js';
import { money, number, date, dateTime, badge } from './core/formatters.js';
import api from './core/httpClient.js';
import { showLoading, message, toast } from './core/feedback.js';
import { state } from './core/state.js';
import {
  compareReportsNewestFirst,
  latestReportForCompany as findLatestReportForCompany
} from './core/reports.js';

async function loadAll({ quiet = false } = {}) {
  try {
    if (!quiet) showLoading(true);
    const [zonas, solicitudes, empresas, reportes, decisiones] = await Promise.all([
      api('/zonasFrancas'), api('/solicitudes'), api('/empresas'), api('/reportesCumplimiento'), api('/decisiones')
    ]);
    Object.assign(state, { zonas, solicitudes, empresas, reportes, decisiones });
    renderAll();
    message('');
  } catch (error) {
    console.error('[ZoFranca CR - loadAll]', error);
    message('No fue posible cargar los datos. Verifique que el servidor Node esté activo.', 'error');
  } finally {
    if (!quiet) showLoading(false);
  }
}

function showView(name) {
  if (window.ZFAccess && !window.ZFAccess.canView(name)) {
    toast('Su rol no permite acceder a esta sección.', 'error');
    return;
  }
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.section === name));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'dashboard' || name === 'alertas' || name === 'historial' || name === 'cumplimiento') renderAll();
}

function zoneName(id) {
  return state.zonas.find(z => String(z.id) === String(id))?.nombre || 'Zona no disponible';
}


function latestReportForCompany(companyId) {
  return findLatestReportForCompany(state.reportes, companyId);
}

function renderAll() {
  renderSelectors();
  renderDashboard();
  renderRequests();
  renderDetail();
  renderCompliance();
  renderAlerts();
  renderHistory();
}

function renderSelectors() {
  const zoneOptions = state.zonas.map(z => `<option value="${escapeHTML(z.id)}">${escapeHTML(z.nombre)}</option>`).join('');
  const currentRequestZone = $('#requestZone')?.value || '';
  $('#requestZone').innerHTML = `<option value="">Seleccione...</option>${zoneOptions}`;
  $('#requestZone').value = currentRequestZone;

  const currentFilterZone = $('#filterZone')?.value || '';
  $('#filterZone').innerHTML = `<option value="">Todas las zonas</option>${zoneOptions}`;
  $('#filterZone').value = currentFilterZone;

  const sectors = [...new Set(state.solicitudes.map(s => s.sector).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const currentSector = $('#filterSector')?.value || '';
  $('#filterSector').innerHTML = `<option value="">Todos los sectores</option>${sectors.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('')}`;
  $('#filterSector').value = currentSector;

  const activeCompanies = state.empresas.filter(e => e.estado === 'activa');
  const companyOptions = activeCompanies.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.nombre)}</option>`).join('');
  const complianceCurrent = $('#complianceCompany')?.value || '';
  $('#complianceCompany').innerHTML = `<option value="">${activeCompanies.length ? 'Seleccione...' : 'No hay empresas aprobadas'}</option>${companyOptions}`;
  $('#complianceCompany').disabled = !activeCompanies.length;
  if (activeCompanies.some(e => String(e.id) === String(complianceCurrent))) $('#complianceCompany').value = complianceCurrent;

  const allCompanyOptions = state.empresas.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.nombre)} · ${escapeHTML(e.estado)}</option>`).join('');
  const historyCurrent = $('#historyCompany')?.value || state.selectedHistoryCompanyId || '';
  $('#historyCompany').innerHTML = `<option value="">Seleccione una empresa...</option>${allCompanyOptions}`;
  if (state.empresas.some(e => String(e.id) === String(historyCurrent))) $('#historyCompany').value = historyCurrent;
}

function renderDashboard() {
  const total = state.solicitudes.length;
  const approved = state.solicitudes.filter(s => s.decisionFinal === 'Recomendada').length;
  const approvedPct = total ? Math.round((approved / total) * 100) : 0;

  const activeCompanies = state.empresas.filter(e => e.estado === 'activa');
  let inRule = 0, withAlert = 0;
  activeCompanies.forEach(e => {
    const report = latestReportForCompany(e.id);
    if (report?.estado === 'en regla') inRule++;
    if (report?.estado === 'con alerta') withAlert++;
  });

  $('#metricSolicitudes').textContent = total;
  $('#metricAprobadas').textContent = `${approvedPct}%`;
  $('#metricRegla').textContent = inRule;
  $('#metricAlerta').textContent = withAlert;

  const recent = state.solicitudes.slice().sort((a,b) => new Date(b.fechaSolicitud || 0)-new Date(a.fechaSolicitud || 0)).slice(0,5);
  $('#recentRequests').innerHTML = recent.length ? recent.map(s => `
    <div class="compact-item">
      <div><strong>${escapeHTML(s.empresa)}</strong><small>${escapeHTML(s.sector)} · ${date(s.fechaSolicitud)}</small></div>
      <div>${badge(s.estado)}</div>
    </div>`).join('') : '<div class="empty-state"><strong>Sin solicitudes</strong><span>Registre el primer expediente.</span></div>';

  $('#complianceSummary').innerHTML = activeCompanies.length ? activeCompanies.slice(0,5).map(e => {
    const r = latestReportForCompany(e.id);
    return `<div class="compact-item"><div><strong>${escapeHTML(e.nombre)}</strong><small>${r ? `Último reporte: ${date(r.fechaReporte)}` : 'Sin reportes todavía'}</small></div><div>${r ? badge(r.estado) : '<span class="badge">Sin reporte</span>'}</div></div>`;
  }).join('') : '<div class="empty-state"><strong>Sin empresas instaladas</strong><span>Una solicitud debe aprobarse para habilitar cumplimiento.</span></div>';
}

function getFilteredRequests() {
  const status = $('#filterStatus').value;
  const zone = $('#filterZone').value;
  const sector = $('#filterSector').value;
  const dateValue = $('#filterDate').value;
  const search = $('#globalSearch').value.trim().toLowerCase();
  return state.solicitudes.filter(s => {
    const haystack = `${s.empresa || ''} ${s.id || ''} ${s.sector || ''}`.toLowerCase();
    return (!status || s.estado === status)
      && (!zone || String(s.zonaFrancaId) === String(zone))
      && (!sector || s.sector === sector)
      && (!dateValue || String(s.fechaSolicitud || '').slice(0,10) === dateValue)
      && (!search || haystack.includes(search));
  });
}

function renderRequests() {
  const rows = getFilteredRequests();
  $('#requestsEmpty').classList.toggle('hidden', rows.length > 0);
  $('#requestsTable').innerHTML = rows.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.empresa)}</strong></td>
      <td>${escapeHTML(s.sector)}</td>
      <td>${escapeHTML(zoneName(s.zonaFrancaId))}</td>
      <td>${date(s.fechaSolicitud)}</td>
      <td><span class="score-pill">${s.puntajeIA ?? '—'}</span></td>
      <td>${s.clasificacionIA ? badge(s.clasificacionIA) : '<span class="badge">Sin evaluar</span>'}</td>
      <td>${s.decisionFinal ? badge(s.decisionFinal) : '<span class="badge">Pendiente</span>'}</td>
      <td>${badge(s.estado)}</td>
      <td><button class="btn btn-outline btn-detail" type="button" data-request-id="${escapeHTML(s.id)}">Ver detalle</button></td>
    </tr>`).join('');
}

function renderDetail() {
  const s = state.solicitudes.find(x => String(x.id) === String(state.selectedSolicitudId));
  $('#detailEmpty').classList.toggle('hidden', Boolean(s));
  $('#detailContent').classList.toggle('hidden', !s);
  if (!s) return;

  $('#detailSubtitle').textContent = `Solicitud de Régimen de Zona Franca · Expediente #${s.id}${s.codigoSeguimiento ? ` · ${s.codigoSeguimiento}` : ''}`;
  $('#detailEmpresa').textContent = s.empresa || '—';
  $('#detailSector').textContent = s.sector || '—';
  $('#detailZona').textContent = zoneName(s.zonaFrancaId);
  $('#detailFecha').textContent = date(s.fechaSolicitud);
  $('#detailInversion').textContent = money(s.inversionProyectada);
  $('#detailEmpleos').textContent = number(s.empleosProyectados);
  $('#detailStatus').outerHTML = badge(s.estado).replace('<span', '<span id="detailStatus"');

  const docs = Array.isArray(s.documentos) ? s.documentos : [];
  $('#detailDocuments').innerHTML = docs.length ? docs.map(d => `<li>${escapeHTML(typeof d === 'string' ? d : d.nombre || 'Documento')}</li>`).join('') : '<li>No se registraron documentos.</li>';

  $('#detailScore').textContent = s.puntajeIA ?? '—';
  $('#detailClassification').outerHTML = (s.clasificacionIA ? badge(s.clasificacionIA) : '<span class="badge">Sin evaluar</span>').replace('<span', '<span id="detailClassification"');
  $('#detailJustification').textContent = s.justificacionIA || 'Esta solicitud todavía no ha sido evaluada. Use “Evaluar pendientes” desde Solicitudes.';

  $('#decisionAnalyst').value = s.analista || '';
  $('#decisionValue').value = s.decisionFinal || s.clasificacionIA || '';
  $('#currentDecision').innerHTML = s.decisionFinal
    ? `<div class="global-message success"><strong>Decisión actual:</strong> ${escapeHTML(s.decisionFinal)} · ${escapeHTML(s.analista || 'Analista')}</div>`
    : '<div class="global-message info">Aún no existe una decisión final registrada.</div>';

  const enabled = Boolean(s.clasificacionIA);
  $$('#decisionForm input, #decisionForm select, #decisionForm textarea, #decisionForm button').forEach(el => el.disabled = !enabled);
}

function renderCompliance() {
  const companyId = $('#complianceCompany').value;
  const company = state.empresas.find(e => String(e.id) === String(companyId));
  const request = company ? state.solicitudes.find(s => String(s.id) === String(company.solicitudId)) : null;
  $('#committedJobs').textContent = request ? number(request.empleosProyectados) : '0';
  $('#committedInvestment').textContent = request ? money(request.inversionProyectada) : money(0);

  const reports = state.reportes
    .filter(r => !company || String(r.empresaId) === String(company.id))
    .slice()
    .sort(compareReportsNewestFirst)
    .slice(0,5);

  $('#latestReports').innerHTML = reports.length ? reports.map(r => {
    const e = state.empresas.find(x => String(x.id) === String(r.empresaId));
    const reasons = Array.isArray(r.alertas) && r.alertas.length
      ? r.alertas.map(a => a.mensaje || `Incumplimiento de ${a.tipo || 'compromiso'}`).join(' · ')
      : '';
    return `<div class="compact-item report-item"><div><strong>${escapeHTML(e?.nombre || 'Empresa')}</strong><small>${dateTime(r.fechaReporte)} · Empleos ${number(r.empleosReales)} · Inversión ${money(r.inversionEjecutada)}</small>${reasons ? `<small class="report-reason"><strong>Motivo:</strong> ${escapeHTML(reasons)}</small>` : ''}</div><div>${badge(r.estado)}</div></div>`;
  }).join('') : '<div class="empty-state"><strong>Sin reportes</strong><span>Aún no se ha registrado cumplimiento.</span></div>';
}

function flattenAlerts() {
  const result = [];
  state.empresas.forEach(company => {
    const report = latestReportForCompany(company.id);
    if (!report) return;
    (Array.isArray(report.alertas) ? report.alertas : []).forEach(alert => {
      result.push({ ...alert, report, company });
    });
  });
  return result;
}

function renderAlerts() {
  const alerts = flattenAlerts();
  $('#alertsEmpty').classList.toggle('hidden', alerts.length > 0);
  $('#alertsContainer').innerHTML = alerts.map(a => {
    const difference = Number(a.diferencia);
    const differenceText = Number.isFinite(difference)
      ? (a.tipo === 'inversion' ? money(Math.abs(difference)) : number(Math.abs(difference)))
      : '';
    return `
    <article class="alert-card">
      <div class="alert-content">
        <h3>${escapeHTML(a.company?.nombre || 'Empresa')} · ${escapeHTML(a.tipo || 'Alerta')}</h3>
        <p><strong>Motivo del incumplimiento:</strong> ${escapeHTML(a.mensaje || 'Incumplimiento detectado')}</p>
        ${differenceText ? `<p class="alert-difference"><strong>Diferencia:</strong> ${escapeHTML(differenceText)} por debajo del compromiso.</p>` : ''}
      </div>
      <div class="alert-meta"><strong>${dateTime(a.report.fechaReporte)}</strong>${badge(a.report.estado)}</div>
    </article>`;
  }).join('');
}

function renderHistory() {
  const companyId = $('#historyCompany').value || state.selectedHistoryCompanyId;
  const company = state.empresas.find(e => String(e.id) === String(companyId));
  $('#historyEmpty').classList.toggle('hidden', Boolean(company));
  if (!company) { $('#historyTimeline').innerHTML = ''; return; }

  const request = state.solicitudes.find(s => String(s.id) === String(company.solicitudId));
  const decisions = state.decisiones.filter(d => String(d.solicitudId) === String(company.solicitudId));
  const reports = state.reportes.filter(r => String(r.empresaId) === String(company.id));
  const events = [];
  if (request) {
    events.push({ when: request.fechaSolicitud, title: 'Solicitud registrada', text: `${request.empresa} · ${request.sector} · ${money(request.inversionProyectada)} · ${number(request.empleosProyectados)} empleos` });
    if (request.clasificacionIA) events.push({ when: request.fechaSolicitud, title: `Evaluación IA: ${request.clasificacionIA}`, text: `Puntaje ${request.puntajeIA}/100. ${request.justificacionIA || ''}` });
  }
  decisions.forEach(d => events.push({ when: d.fecha, title: `Decisión humana: ${d.decision}`, text: `${d.usuario || 'Analista'}${d.observacion ? ` · ${d.observacion}` : ''}` }));
  reports.forEach(r => {
    events.push({ when: r.fechaReporte, title: `Reporte de cumplimiento: ${r.estado}`, text: `Empleos ${number(r.empleosReales)} · Inversión ${money(r.inversionEjecutada)} · Exportaciones ${money(r.exportaciones)}` });
    (r.alertas || []).forEach(a => events.push({ when: r.fechaReporte, title: `Alerta: ${a.tipo}`, text: a.mensaje || 'Incumplimiento detectado' }));
  });
  events.sort((a,b) => new Date(a.when || 0)-new Date(b.when || 0));
  $('#historyTimeline').innerHTML = events.map(e => `<div class="timeline-item"><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.text)}</p><time>${dateTime(e.when)}</time></div>`).join('');
}

async function handleRequestSubmit(event) {
  event.preventDefault();
  const f = event.currentTarget;
  const data = new FormData(f);
  const empresa = String(data.get('empresa') || '').trim();
  const sector = String(data.get('sector') || '').trim().toLowerCase();
  const inversionProyectada = Number(data.get('inversionProyectada'));
  const empleosProyectados = Number(data.get('empleosProyectados'));
  const zonaFrancaId = Number(data.get('zonaFrancaId'));
  if (!empresa || !sector || !zonaFrancaId || !Number.isFinite(inversionProyectada) || inversionProyectada < 0 || !Number.isFinite(empleosProyectados) || empleosProyectados < 0) {
    toast('Complete correctamente los campos obligatorios.', 'error'); return;
  }
  const documentos = [...(f.elements.documentos.files || [])].map(file => ({ nombre:file.name, tipo:file.type, tamano:file.size, ultimaModificacion:file.lastModified }));
  const payload = { empresa, sector, inversionProyectada, empleosProyectados, documentos, zonaFrancaId, estado:'pendiente', puntajeIA:null, justificacionIA:'', clasificacionIA:'', decisionFinal:'', analista:'', fechaSolicitud:new Date().toISOString() };
  try {
    showLoading(true); await api('/solicitudes', { method:'POST', body:JSON.stringify(payload) }); f.reset(); await loadAll({quiet:true}); toast('Solicitud registrada correctamente.'); showView('solicitudes');
  } catch (error) { console.error(error); toast('No fue posible guardar la solicitud.', 'error'); }
  finally { showLoading(false); }
}

async function handleZoneSubmit(event) {
  event.preventDefault();
  const f = event.currentTarget; const d = new FormData(f);
  const sectors = String(d.get('sectoresPermitidos') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const payload = { nombre:String(d.get('nombre') || '').trim(), inversionMinima:Number(d.get('inversionMinima')), empleosMinimos:Number(d.get('empleosMinimos')), sectoresPermitidos:sectors };
  if (!payload.nombre || payload.inversionMinima < 0 || payload.empleosMinimos < 0 || !sectors.length) { toast('Complete correctamente los datos de la zona.', 'error'); return; }
  try { showLoading(true); await api('/zonasFrancas', { method:'POST', body:JSON.stringify(payload) }); f.reset(); await loadAll({quiet:true}); toast('Zona franca registrada.'); }
  catch (error) { console.error(error); toast('No fue posible registrar la zona.', 'error'); }
  finally { showLoading(false); }
}

async function evaluatePending() {
  try {
    showLoading(true);
    const [requests, zones] = await Promise.all([api('/solicitudes'), api('/zonasFrancas')]);
    const pending = requests.filter(s => s.estado === 'pendiente');
    if (!pending.length) { toast('No hay solicitudes pendientes.', 'success'); return; }
    const evaluations = await Promise.all(pending.map(async s => {
      const z = zones.find(x => String(x.id) === String(s.zonaFrancaId));
      const result = await evaluarConIA(s, z);
      return { s, result };
    }));
    await Promise.all(evaluations.map(({s,result}) => api(`/solicitudes/${encodeURIComponent(s.id)}`, { method:'PATCH', body:JSON.stringify({ puntajeIA:result.puntaje, justificacionIA:result.justificacion, clasificacionIA:clasificar(result.puntaje), estado:'evaluada' }) })));
    await loadAll({quiet:true}); toast(`${pending.length} solicitud${pending.length===1?'':'es'} evaluada${pending.length===1?'':'s'}.`);
  } catch (error) { console.error(error); toast('No fue posible completar la evaluación.', 'error'); }
  finally { showLoading(false); }
}

async function syncInstalledCompany(request, decision) {
  const existing = state.empresas.find(e => String(e.solicitudId) === String(request.id));
  if (decision === 'Recomendada') {
    const payload = { nombre:request.empresa, solicitudId:request.id, zonaFrancaId:request.zonaFrancaId, estado:'activa' };
    if (existing) await api(`/empresas/${encodeURIComponent(existing.id)}`, { method:'PATCH', body:JSON.stringify(payload) });
    else await api('/empresas', { method:'POST', body:JSON.stringify(payload) });
  } else if (existing) {
    await api(`/empresas/${encodeURIComponent(existing.id)}`, { method:'PATCH', body:JSON.stringify({ estado:'inactiva' }) });
  }
}

async function handleDecision(event) {
  event.preventDefault();
  const request = state.solicitudes.find(s => String(s.id) === String(state.selectedSolicitudId));
  const analyst = $('#decisionAnalyst').value.trim(), decision = $('#decisionValue').value, observation = $('#decisionObservation').value.trim();
  if (!request?.clasificacionIA) { toast('La solicitud debe evaluarse antes de decidir.', 'error'); return; }
  if (!analyst || !['Recomendada','Revisar','Rechazada'].includes(decision)) { toast('Indique analista y decisión.', 'error'); return; }
  try {
    showLoading(true);
    const decisionRecord = { solicitudId:request.id, decision, usuario:analyst, fecha:new Date().toISOString(), observacion:observation };
    await api('/decisiones', { method:'POST', body:JSON.stringify(decisionRecord) });
    await api(`/solicitudes/${encodeURIComponent(request.id)}`, { method:'PATCH', body:JSON.stringify({ decisionFinal:decision, analista:analyst, estado:'decidida' }) });
    await syncInstalledCompany(request, decision);
    await loadAll({quiet:true}); toast('Decisión guardada sin borrar la clasificación de IA.');
  } catch (error) { console.error(error); toast('No fue posible guardar la decisión.', 'error'); }
  finally { showLoading(false); }
}

async function handleCompliance(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const companyId = Number($('#complianceCompany').value);
  const company = state.empresas.find(e => String(e.id) === String(companyId));
  const request = company ? state.solicitudes.find(s => String(s.id) === String(company.solicitudId)) : null;
  const empleosReales = Number($('#realJobs').value), inversionEjecutada = Number($('#executedInvestment').value), exportaciones = Number($('#exportsValue').value);
  if (!company || !request || [empleosReales,inversionEjecutada,exportaciones].some(v => !Number.isFinite(v) || v < 0)) { toast('Complete correctamente el reporte.', 'error'); return; }
  const alertas = [];
  if (empleosReales < Number(request.empleosProyectados || 0)) alertas.push({ tipo:'empleos', mensaje:`Empleos por debajo de lo comprometido (${empleosReales} de ${request.empleosProyectados})`, diferencia:empleosReales-Number(request.empleosProyectados||0) });
  if (inversionEjecutada < Number(request.inversionProyectada || 0)) alertas.push({ tipo:'inversion', mensaje:`Inversión por debajo de lo comprometido (${money(inversionEjecutada)} de ${money(request.inversionProyectada)})`, diferencia:inversionEjecutada-Number(request.inversionProyectada||0) });
  const report = { empresaId:company.id, empleosReales, inversionEjecutada, exportaciones, fechaReporte:new Date().toISOString(), estado:alertas.length?'con alerta':'en regla', alertas };
  try {
    showLoading(true);
    const savedReport = await api('/reportesCumplimiento', { method:'POST', body:JSON.stringify(report) });
    form?.reset();
    await loadAll({quiet:true});
    toast(`Reporte guardado: ${savedReport?.estado || report.estado}.`);
  } catch (error) {
    console.error('[ZoFranca CR - guardar reporte]', error);
    if (error.status === 401) {
      toast('La sesión venció al reiniciar el servidor. Inicie sesión nuevamente y vuelva a guardar el reporte.', 'error');
    } else if (error.code === 'NETWORK_ERROR') {
      toast('No hay conexión con el servidor Node. Confirme que npm start siga activo.', 'error');
    } else {
      toast(`No fue posible guardar el reporte: ${error.message || 'intente nuevamente.'}`, 'error');
    }
  } finally {
    showLoading(false);
  }
}

function bindEvents() {
  $$('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $$('[data-view-target]').forEach(b => b.addEventListener('click', () => showView(b.dataset.viewTarget)));
  $$('[data-refresh]').forEach(b => b.addEventListener('click', () => loadAll()));
  $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#requestForm').addEventListener('submit', handleRequestSubmit);
  $('#zoneForm').addEventListener('submit', handleZoneSubmit);
  $('#evaluatePending').addEventListener('click', evaluatePending);
  $('#decisionForm').addEventListener('submit', handleDecision);
  $('#complianceForm').addEventListener('submit', handleCompliance);
  $('#confirmAI').addEventListener('click', () => { const s = state.solicitudes.find(x => String(x.id)===String(state.selectedSolicitudId)); if (s?.clasificacionIA) $('#decisionValue').value = s.clasificacionIA; });
  $('#rejectAI').addEventListener('click', () => $('#decisionValue').value = 'Rechazada');

  $('#requestsTable').addEventListener('click', e => {
    const btn = e.target.closest('[data-request-id]'); if (!btn) return;
    state.selectedSolicitudId = btn.dataset.requestId; renderDetail(); showView('detalle');
  });
  ['filterStatus','filterZone','filterSector','filterDate'].forEach(id => $(`#${id}`).addEventListener('input', renderRequests));
  $('#clearFilters').addEventListener('click', () => { ['filterStatus','filterZone','filterSector','filterDate'].forEach(id => $(`#${id}`).value=''); renderRequests(); });
  $('#globalSearch').addEventListener('input', renderRequests);
  $('#globalSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); showView('solicitudes'); renderRequests(); } });
  $('#complianceCompany').addEventListener('change', renderCompliance);
  $('#historyCompany').addEventListener('change', e => { state.selectedHistoryCompanyId = e.target.value; renderHistory(); });
}

bindEvents();

window.ZFApp = {
  state,
  api,
  loadAll,
  showView,
  renderAll,
  renderRequests,
  renderDetail,
  renderHistory,
  renderAlerts,
  renderCompliance,
  toast,
  message,
  showLoading
};

window.addEventListener('zf-auth-ready', () => loadAll());
