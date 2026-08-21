import { $, $$, escapeHTML } from './core/dom.js';
import api, { TOKEN_KEY } from './core/httpClient.js';
import { applyTheme } from './core/theme.js';
import { playSound, setSoundEnabled } from './core/sound.js';
import { sanitizePhone } from './utils/phone.js';
import { bindHaciendaTools, loadHaciendaRates, renderHacienda } from './features/hacienda.js';
import { setupGlobalSearch, setupPagination } from './features/search.js';
import { queueToastSound, setupSoundsAndAnimations } from './features/interactions.js';

const qs = $;
const qsa = $$;
const esc = escapeHTML;
const request = api;

let currentUser = null;
let supportTab = 'assistant';

function appToast(text, type = 'success', sound = null) {
  queueToastSound(sound);
  if (window.ZFApp?.toast) window.ZFApp.toast(text, type);
}

function userInitials(name) {
  return String(name||'U').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');
}

function canView(name) {
  if (!currentUser) return false;
  if (currentUser.rol === 'Administrador' || currentUser.rol === 'Analista') return true;
  if (currentUser.rol === 'Empresa') return ['dashboard','solicitudes','nueva','cumplimiento','alertas','historial','detalle','hacienda'].includes(name);
  return false;
}

window.ZFAccess = { canView };

function applyUser() {
  const copy = qs('.topbar-user .user-copy');
  const avatar = qs('.topbar-user .avatar');
  if (copy) copy.innerHTML = `<strong>${esc(currentUser.nombre)}</strong><span>${esc(currentUser.rol)} · ${esc(currentUser.estado)}</span>`;
  if (avatar) {
    avatar.textContent = currentUser.profileImage ? '' : userInitials(currentUser.nombre);
    avatar.style.backgroundImage = currentUser.profileImage ? `url("${currentUser.profileImage}")` : '';
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  }
  setSoundEnabled(currentUser.sonido !== false);
  applyTheme(currentUser.tema || 'claro');

  if (currentUser.rol === 'Empresa') {
    qs('#evaluatePending')?.classList.add('hidden');
    qs('.decision-card')?.classList.add('role-readonly');
    qsa('#decisionForm input,#decisionForm select,#decisionForm textarea,#decisionForm button').forEach(el => el.disabled = true);
  } else {
    qs('#evaluatePending')?.classList.remove('hidden');
    qs('.decision-card')?.classList.remove('role-readonly');
  }
}

function showLogin(show=true) {
  qs('#loginOverlay')?.classList.toggle('hidden', !show);
  document.body.classList.toggle('auth-locked', show);
}

window.addEventListener('zf-session-expired', (event) => {
  currentUser = null;
  showLogin(true);
  const error = qs('#loginError');
  if (error) error.textContent = 'La sesión venció porque el servidor se reinició. Inicie sesión nuevamente.';
  playSound('warning');
});

async function restoreSession() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) { showLogin(true); return; }
  try {
    currentUser = await request('/auth/me');
    applyUser();
    showLogin(false);
    window.dispatchEvent(new CustomEvent('zf-auth-ready'));
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin(true);
  }
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim(), password = form.password.value;
  const error = qs('#loginError');
  error.textContent = '';
  try {
    const data = await request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    sessionStorage.setItem(TOKEN_KEY,data.token);
    currentUser = data.user;
    applyUser();
    showLogin(false);
    playSound('success');
    window.dispatchEvent(new CustomEvent('zf-auth-ready'));
  } catch (e) {
    error.textContent = e.message;
    playSound('error');
  }
}

async function registerCompany(event) {
  event.preventDefault();
  const f = event.currentTarget;
  const payload = {
    nombre:f.nombre.value.trim(),
    empresaNombre:f.empresaNombre.value.trim(),
    email:f.email.value.trim(),
    telefono:sanitizePhone(f.telefono.value),
    provincia:f.provincia.value.trim(),
    password:f.password.value
  };
  const msg = qs('#registerMessage');
  try {
    const result = await request('/auth/register-company',{method:'POST',body:JSON.stringify(payload)});
    msg.textContent = result.message;
    msg.className = 'auth-message success';
    f.reset();
    playSound('success');
  } catch(e) {
    msg.textContent = e.message;
    msg.className = 'auth-message error';
    playSound('error');
  }
}

async function logout() {
  try { await request('/auth/logout',{method:'POST'}); } catch {}
  sessionStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  closeModal();
  showLogin(true);
}

function openModal(title, body, {wide=true}={}) {
  const root = qs('#modalRoot');
  root.innerHTML = `
    <div class="zf-modal-backdrop" data-modal-close>
      <section class="zf-modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="zf-modal-head"><div><h2>${esc(title)}</h2></div><button class="modal-x" type="button" data-modal-close aria-label="Cerrar">×</button></header>
        <div class="zf-modal-body">${body}</div>
      </section>
    </div>`;
  root.querySelector('[data-modal-close]')?.addEventListener('click', e => { if (e.target.hasAttribute('data-modal-close')) closeModal(); });
  root.querySelector('.modal-x')?.addEventListener('click',closeModal);
  document.body.classList.add('modal-open');
}
function closeModal() {
  qs('#modalRoot').innerHTML='';
  document.body.classList.remove('modal-open');
}
function openFormDialog(title, html, onSubmit) {
  openModal(title, `<form id="dialogForm" class="stack-form">${html}<div class="dialog-actions"><button class="btn btn-outline" type="button" data-dialog-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div></form>`,{wide:false});
  qs('[data-dialog-cancel]')?.addEventListener('click',closeModal);
  qs('#dialogForm')?.addEventListener('submit', async e => { e.preventDefault(); await onSubmit(e.currentTarget); });
}

async function compressImage(file) {
  if (!file) return '';
  const data = await new Promise((resolve,reject) => {
    const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
  });
  const img = await new Promise((resolve,reject) => {
    const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=data;
  });
  const max=256, scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.76);
}

function openProfile() {
  openModal('Mi perfil', `
    <div class="profile-grid">
      <div class="profile-photo">
        <div class="profile-preview" id="profilePreview">${currentUser.profileImage?`<img src="${currentUser.profileImage}" alt="">`:esc(userInitials(currentUser.nombre))}</div>
        <label class="btn btn-outline profile-upload">Cambiar foto<input id="profileImage" type="file" accept="image/*" hidden></label>
      </div>
      <form id="profileForm" class="form-grid">
        <label class="field"><span>Nombre</span><input name="nombre" value="${esc(currentUser.nombre)}" required></label>
        <label class="field"><span>Correo</span><input value="${esc(currentUser.email)}" disabled></label>
        <label class="field"><span>Teléfono</span><input name="telefono" value="${esc(currentUser.telefono||'')}"></label>
        <label class="field"><span>Provincia</span><input name="provincia" value="${esc(currentUser.provincia||'')}"></label>
        <label class="field full"><span>Dirección</span><input name="direccion" value="${esc(currentUser.direccion||'')}"></label>
        <div class="readonly-info full"><strong>Rol:</strong> ${esc(currentUser.rol)} · <strong>Estado:</strong> ${esc(currentUser.estado)} · <strong>Último acceso:</strong> ${esc(currentUser.ultimoAcceso||'Primera sesión')}</div>
        <div class="form-actions full"><button class="btn btn-primary" type="submit">Guardar perfil</button><button class="btn btn-outline" type="button" id="changePassword">Cambiar contraseña</button><button class="btn btn-danger-soft" type="button" id="logoutBtn">Cerrar sesión</button></div>
      </form>
    </div>`,{wide:true});

  let newImage = currentUser.profileImage || '';
  qs('#profileImage')?.addEventListener('change', async e => {
    const file=e.target.files?.[0]; if(!file)return;
    newImage=await compressImage(file);
    qs('#profilePreview').innerHTML=`<img src="${newImage}" alt="">`;
  });
  qs('#profileForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const f=e.currentTarget;
    try {
      currentUser=await request('/auth/profile',{method:'PATCH',body:JSON.stringify({nombre:f.nombre.value.trim(),telefono:sanitizePhone(f.telefono.value),provincia:f.provincia.value.trim(),direccion:f.direccion.value.trim(),profileImage:newImage})});
      applyUser(); appToast('Perfil actualizado.'); closeModal();
    } catch(err){appToast(err.message,'error');}
  });
  qs('#changePassword')?.addEventListener('click',openPasswordDialog);
  qs('#logoutBtn')?.addEventListener('click',logout);
}

function openPasswordDialog() {
  openFormDialog('Cambiar contraseña',`
    <label class="field"><span>Contraseña actual</span><input name="actual" type="password" required></label>
    <label class="field"><span>Nueva contraseña</span><input name="nueva" type="password" minlength="8" required></label>
    <label class="field"><span>Confirmar nueva contraseña</span><input name="confirmar" type="password" minlength="8" required></label>
  `, async f => {
    if(f.nueva.value!==f.confirmar.value){appToast('Las contraseñas nuevas no coinciden.','error');return;}
    try{await request('/auth/password',{method:'PATCH',body:JSON.stringify({actual:f.actual.value,nueva:f.nueva.value})});appToast('Contraseña actualizada.');closeModal();}catch(e){appToast(e.message,'error');}
  });
}

function supportTabs() {
  const common=[['assistant','Asistente IA'],['tickets','Soporte'],['export','Reportes'],['settings','Configuración']];
  const admin=[['users','Usuarios'],['zones','Zonas'],['companies','Empresas'],['trash','Papelera'],['activity','Actividad']];
  return currentUser?.rol==='Administrador' ? [common[0],...admin,...common.slice(1)] : common;
}
async function openSupport(tab='assistant') {
  supportTab=tab;
  const tabs=supportTabs();
  openModal('Centro ZoFranca CR',`
    <div class="tool-tabs">${tabs.map(([id,label])=>`<button class="tool-tab ${id===tab?'active':''}" type="button" data-tool="${id}">${esc(label)}</button>`).join('')}</div>
    <div id="toolContent" class="tool-content"><div class="mini-loading">Cargando...</div></div>`,{wide:true});
  qsa('[data-tool]').forEach(b=>b.addEventListener('click',()=>renderSupportTab(b.dataset.tool)));
  await renderSupportTab(tab);
}
async function renderSupportTab(tab) {
  supportTab=tab;
  qsa('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tab));
  const content=qs('#toolContent'); if(!content)return;
  content.innerHTML='<div class="mini-loading">Cargando...</div>';
  try{
    if(tab==='assistant') await renderAssistant(content);
    else if(tab==='users') await renderUsers(content);
    else if(tab==='zones') await renderZones(content);
    else if(tab==='companies') await renderCompanies(content);
    else if(tab==='trash') await renderTrash(content);
    else if(tab==='tickets') await renderTickets(content);
    else if(tab==='export') await renderExports(content);
    else if(tab==='settings') await renderSettings(content);
    else if(tab==='activity') await renderActivity(content);
  }catch(e){content.innerHTML=`<div class="global-message error">${esc(e.message)}</div>`;}
}

async function renderAssistant(content) {
  content.innerHTML=`
    <div class="assistant-shell">
      <div id="assistantMessages" class="assistant-messages"><div class="ai-bubble">Hola ${esc(currentUser.nombre)}. Puedo consultar solicitudes, alertas, empresas, seguimiento, soporte, perfil y métricas usando los datos reales de ZoFranca CR.</div></div>
      <form id="assistantForm" class="assistant-input"><input name="q" autocomplete="off" placeholder="Ej. solicitudes pendientes, alertas, ZF-2026-00001..."><button class="btn btn-primary" type="submit">Enviar</button></form>
    </div>`;
  qs('#assistantForm')?.addEventListener('submit',async e=>{
    e.preventDefault(); const q=e.currentTarget.q.value.trim(); if(!q)return;
    const box=qs('#assistantMessages'); box.insertAdjacentHTML('beforeend',`<div class="user-bubble">${esc(q)}</div>`); e.currentTarget.reset();
    const answer=await assistantAnswer(q).catch(err=>`No pude completar la consulta: ${err.message}`);
    box.insertAdjacentHTML('beforeend',`<div class="ai-bubble">${answer}</div>`); box.scrollTop=box.scrollHeight;
  });
}
async function assistantAnswer(query) {
  const q=query.toLowerCase();
  if(q.includes('perfil')){setTimeout(openProfile,50);return 'Abrí tu perfil global para que puedas actualizar tus datos.';}
  if(q.includes('contraseña')){setTimeout(openPasswordDialog,50);return 'Abrí el cambio de contraseña.';}
  const [solicitudes,empresas,reportes]=await Promise.all([request('/solicitudes'),request('/empresas'),request('/reportesCumplimiento')]);
  const tracking=query.match(/ZF-\d{4}-\d+/i)?.[0];
  if(tracking){
    const s=solicitudes.find(x=>String(x.codigoSeguimiento||'').toLowerCase()===tracking.toLowerCase());
    if(!s)return `No encontré el código <strong>${esc(tracking)}</strong>.`;
    const stages=(s.seguimiento||[]).map(x=>`${esc(x.estado)} (${new Date(x.fecha).toLocaleString('es-CR')})`).join('<br>');
    return `<strong>${esc(s.empresa)}</strong> · ${esc(s.codigoSeguimiento)}<br>Estado actual: ${esc(s.estado)}<br>${stages||'Sin movimientos adicionales.'}`;
  }
  if(q.includes('pendient')){const n=solicitudes.filter(s=>s.estado==='pendiente').length;return `Hay <strong>${n}</strong> solicitudes pendientes de evaluación.`;}
  if(q.includes('alert')){const alerts=reportes.flatMap(r=>r.alertas||[]);return `Se registran <strong>${alerts.length}</strong> alertas en los reportes disponibles.`;}
  if(q.includes('empresa'))return `Hay <strong>${empresas.length}</strong> empresas visibles para tu sesión; ${empresas.filter(e=>e.estado==='activa').length} están activas.`;
  if(q.includes('solicitud'))return `Tu sesión puede consultar <strong>${solicitudes.length}</strong> solicitudes. ${solicitudes.filter(s=>s.decisionFinal==='Recomendada').length} tienen decisión Recomendada.`;
  if(q.includes('soporte')||q.includes('persona')){setTimeout(()=>renderSupportTab('tickets'),50);return 'Abrí el módulo de Soporte para crear o revisar tickets.';}
  return 'Puedo ayudarte con solicitudes pendientes, empresas, alertas, métricas, seguimiento por código ZF-AAAA-00000, perfil, contraseña o soporte.';
}

async function renderUsers(content) {
  const users=await request('/admin/usuarios');
  const role=qs('#userRoleFilter')?.value||'';
  content.innerHTML=`
    <div class="tool-head"><div><h3>Usuarios y accesos</h3><p>Administradores, analistas y empresas.</p></div><button class="btn btn-primary" id="newUser" type="button">Nuevo usuario</button></div>
    <div class="tool-filters"><input id="userSearch" placeholder="Buscar por nombre o correo"><select id="userRoleFilter"><option value="">Todos los roles</option><option>Administrador</option><option>Analista</option><option>Empresa</option></select></div>
    <div id="usersList" class="admin-list"></div>`;
  const paint=()=>{
    const term=qs('#userSearch').value.toLowerCase(),r=qs('#userRoleFilter').value;
    const filtered=users.filter(u=>(!r||u.rol===r)&&(`${u.nombre} ${u.email} ${u.empresaNombre||''}`.toLowerCase().includes(term)));
    qs('#usersList').innerHTML=filtered.map(u=>`
      <div class="admin-row" data-id="${u.id}"><div><strong>${esc(u.nombre)}</strong><small>${esc(u.email)} · ${esc(u.rol)} · ${esc(u.estado)}${u.empresaNombre?` · ${esc(u.empresaNombre)}`:''}</small></div>
      <div class="admin-actions"><button class="btn btn-outline btn-small" data-user-edit="${u.id}">Editar</button>${u.estado==='Pendiente'?`<button class="btn btn-secondary btn-small" data-user-review="${u.id}" data-decision="aprobar">Aprobar</button><button class="btn btn-danger-soft btn-small" data-user-review="${u.id}" data-decision="rechazar">Rechazar</button>`:''}<button class="btn btn-danger-soft btn-small" data-trash-entity="usuarios" data-trash-id="${u.id}">Papelera</button></div></div>`).join('')||'<div class="empty-state">Sin usuarios.</div>';
    bindAdminRows(users);
  };
  qs('#userSearch').addEventListener('input',paint);qs('#userRoleFilter').addEventListener('change',paint);qs('#newUser').addEventListener('click',()=>userDialog());paint();
}
function bindAdminRows(users=[]) {
  qsa('[data-user-edit]').forEach(b=>b.addEventListener('click',()=>userDialog(users.find(u=>String(u.id)===b.dataset.userEdit))));
  qsa('[data-user-review]').forEach(b=>b.addEventListener('click',()=>reviewUser(b.dataset.userReview,b.dataset.decision)));
  qsa('[data-trash-entity]').forEach(b=>b.addEventListener('click',()=>trashEntity(b.dataset.trashEntity,b.dataset.trashId)));
}
function userDialog(u=null){
  openFormDialog(u?'Editar usuario':'Nuevo usuario',`
    <label class="field"><span>Nombre</span><input name="nombre" value="${esc(u?.nombre||'')}" required></label>
    <label class="field"><span>Correo</span><input name="email" type="email" value="${esc(u?.email||'')}" required></label>
    <label class="field"><span>Rol</span><select name="rol">${['Administrador','Analista','Empresa'].map(r=>`<option ${u?.rol===r?'selected':''}>${r}</option>`).join('')}</select></label>
    <label class="field"><span>Estado</span><select name="estado">${['Activo','Pendiente','Rechazado','Inactivo'].map(r=>`<option ${u?.estado===r?'selected':''}>${r}</option>`).join('')}</select></label>
    <label class="field"><span>Teléfono</span><input name="telefono" value="${esc(u?.telefono||'')}"></label>
    <label class="field"><span>Empresa (si aplica)</span><input name="empresaNombre" value="${esc(u?.empresaNombre||'')}"></label>
    <label class="field"><span>${u?'Nueva contraseña (opcional)':'Contraseña'}</span><input name="password" type="password" ${u?'':'required'}></label>
  `,async f=>{
    const payload={nombre:f.nombre.value.trim(),email:f.email.value.trim(),rol:f.rol.value,estado:f.estado.value,telefono:sanitizePhone(f.telefono.value),empresaNombre:f.empresaNombre.value.trim(),password:f.password.value};
    try{await request(u?`/admin/usuarios/${u.id}`:'/admin/usuarios',{method:u?'PATCH':'POST',body:JSON.stringify(payload)});appToast(u?'Usuario actualizado.':'Usuario creado.','success',u?'notification':'success');closeModal();openSupport('users');}catch(e){appToast(e.message,'error');}
  });
}
function reviewUser(id,decision){
  openFormDialog(`${decision==='aprobar'?'Aprobar':'Rechazar'} solicitud de acceso`,`
    <label class="field"><span>Motivo (mínimo 10 caracteres)</span><textarea name="motivo" rows="5" minlength="10" required></textarea></label>
  `,async f=>{
    try{const u=await request(`/admin/usuarios/${id}/review`,{method:'POST',body:JSON.stringify({decision,motivo:f.motivo.value.trim()})});appToast(`Cuenta ${decision==='aprobar'?'aprobada':'rechazada'}.`,'success',decision==='aprobar'?'success':'warning');closeModal();openSupport('users');
      const subject=encodeURIComponent(`ZoFranca CR - Solicitud de acceso ${decision==='aprobar'?'aprobada':'rechazada'}`),body=encodeURIComponent(`Hola ${u.nombre},\n\nSu solicitud de acceso a ZoFranca CR fue ${decision==='aprobar'?'aprobada':'rechazada'}.\nMotivo: ${f.motivo.value.trim()}\n\nZoFranca CR`);
      window.ZFPreparedMail=`mailto:${u.email}?subject=${subject}&body=${body}`;
    }catch(e){appToast(e.message,'error');}
  });
}

async function renderZones(content) {
  const zones=await request('/zonasFrancas');
  content.innerHTML=`<div class="tool-head"><div><h3>Zonas francas</h3><p>CRUD administrativo con protección de integridad.</p></div></div><div class="admin-list">${zones.map(z=>`<div class="admin-row"><div><strong>${esc(z.nombre)}</strong><small>Inversión ${Number(z.inversionMinima).toLocaleString('es-CR')} · Empleos ${z.empleosMinimos} · ${(z.sectoresPermitidos||[]).join(', ')}</small></div><div class="admin-actions"><button class="btn btn-outline btn-small" data-zone-edit="${z.id}">Editar</button><button class="btn btn-danger-soft btn-small" data-trash-entity="zonasFrancas" data-trash-id="${z.id}">Papelera</button></div></div>`).join('')}</div>`;
  qsa('[data-zone-edit]').forEach(b=>b.addEventListener('click',()=>zoneDialog(zones.find(z=>String(z.id)===b.dataset.zoneEdit))));
  bindAdminRows();
}
function zoneDialog(z){
  openFormDialog('Editar zona franca',`
    <label class="field"><span>Nombre</span><input name="nombre" value="${esc(z.nombre)}" required></label>
    <label class="field"><span>Inversión mínima</span><input name="inversionMinima" type="number" min="0" value="${z.inversionMinima}" required></label>
    <label class="field"><span>Empleos mínimos</span><input name="empleosMinimos" type="number" min="0" value="${z.empleosMinimos}" required></label>
    <label class="field"><span>Sectores</span><input name="sectoresPermitidos" value="${esc((z.sectoresPermitidos||[]).join(', '))}" required></label>
  `,async f=>{try{await request(`/zonasFrancas/${z.id}`,{method:'PATCH',body:JSON.stringify({nombre:f.nombre.value.trim(),inversionMinima:Number(f.inversionMinima.value),empleosMinimos:Number(f.empleosMinimos.value),sectoresPermitidos:f.sectoresPermitidos.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)})});appToast('Zona actualizada.');closeModal();await window.ZFApp.loadAll({quiet:true});openSupport('zones');}catch(e){appToast(e.message,'error');}});
}

async function renderCompanies(content) {
  const companies=await request('/empresas');
  content.innerHTML=`<div class="tool-head"><div><h3>Empresas instaladas</h3><p>Consulta, edición de estado, Papelera y eliminación definitiva de la base de datos.</p></div></div><div class="admin-list">${companies.map(e=>`<div class="admin-row"><div><strong>${esc(e.nombre)}</strong><small>ID ${e.id} · Solicitud ${e.solicitudId} · ${esc(e.estado)}</small></div><div class="admin-actions"><button class="btn btn-outline btn-small" data-company-edit="${e.id}">Editar</button><button class="btn btn-danger-soft btn-small" data-trash-entity="empresas" data-trash-id="${e.id}">Papelera</button><button class="btn btn-danger btn-small" data-company-purge="${e.id}" data-company-name="${esc(e.nombre)}">Eliminar BD</button></div></div>`).join('')||'<div class="empty-state">No hay empresas instaladas.</div>'}</div>`;
  qsa('[data-company-edit]').forEach(b=>b.addEventListener('click',()=>companyDialog(companies.find(x=>String(x.id)===b.dataset.companyEdit))));
  qsa('[data-company-purge]').forEach(b=>b.addEventListener('click',()=>purgeCompany(b.dataset.companyPurge,b.dataset.companyName)));
  bindAdminRows();
}
function purgeCompany(id,name){
  openFormDialog('Eliminar empresa de la base de datos',`
    <div class="danger-confirm"><strong>${esc(name)}</strong><p>Esta acción elimina definitivamente la empresa y sus reportes de cumplimiento. La solicitud y la decisión original se conservan para trazabilidad.</p></div>
    <label class="field"><span>Escriba BORRAR para confirmar</span><input name="confirm" autocomplete="off" required></label>
  `,async f=>{
    if(f.confirm.value!=='BORRAR'){appToast('Confirmación incorrecta.','error');return;}
    try{
      const result=await request(`/admin/purge/empresas/${id}`,{method:'DELETE'});
      appToast(`Empresa eliminada de la base de datos. Reportes eliminados: ${result.reportesEliminados}.`,'success','warning');
      closeModal(); await window.ZFApp.loadAll({quiet:true}); openSupport('companies');
    }catch(err){appToast(err.message,'error');}
  });
}

function companyDialog(c){
  openFormDialog('Editar empresa',`
    <label class="field"><span>Nombre</span><input name="nombre" value="${esc(c.nombre)}" required></label>
    <label class="field"><span>Estado</span><select name="estado">${['activa','inactiva','suspendida'].map(x=>`<option ${c.estado===x?'selected':''}>${x}</option>`).join('')}</select></label>
  `,async f=>{try{await request(`/empresas/${c.id}`,{method:'PATCH',body:JSON.stringify({nombre:f.nombre.value.trim(),estado:f.estado.value})});appToast('Empresa actualizada.');closeModal();await window.ZFApp.loadAll({quiet:true});openSupport('companies');}catch(e){appToast(e.message,'error');}});
}
function trashEntity(collection,id){
  openFormDialog('Mover a Papelera',`<p>El registro dejará de aparecer en el módulo original y podrá restaurarse desde Papelera.</p><label class="field"><span>Escriba ELIMINAR para confirmar</span><input name="confirm" required></label>`,async f=>{
    if(f.confirm.value!=='ELIMINAR'){appToast('Confirmación incorrecta.','error');return;}
    try{await request(`/admin/delete/${collection}/${id}`,{method:'DELETE'});appToast('Registro movido a Papelera.','success','warning');closeModal();await window.ZFApp.loadAll({quiet:true});openSupport(supportTab);}catch(e){appToast(e.message,'error');}
  });
}

async function renderTrash(content) {
  const trash=await request('/papelera');
  content.innerHTML=`<div class="tool-head"><div><h3>Papelera</h3><p>Restauración o eliminación definitiva.</p></div></div><div class="admin-list">${trash.map(t=>`<div class="admin-row"><div><strong>${esc(t.nombre)}</strong><small>${esc(t.coleccion)} · eliminado por ${esc(t.eliminadoPor)} · ${new Date(t.fecha).toLocaleString('es-CR')}</small></div><div class="admin-actions"><button class="btn btn-secondary btn-small" data-restore="${t.id}">Restaurar</button><button class="btn btn-danger-soft btn-small" data-purge="${t.id}">Eliminar definitivo</button></div></div>`).join('')||'<div class="empty-state">La Papelera está vacía.</div>'}</div>`;
  qsa('[data-restore]').forEach(b=>b.addEventListener('click',async()=>{try{await request(`/papelera/${b.dataset.restore}/restore`,{method:'POST'});appToast('Registro restaurado.');await window.ZFApp.loadAll({quiet:true});renderSupportTab('trash');}catch(e){appToast(e.message,'error');}}));
  qsa('[data-purge]').forEach(b=>b.addEventListener('click',()=>openFormDialog('Eliminar definitivamente',`<p>Esta acción no se puede deshacer.</p><label class="field"><span>Escriba BORRAR</span><input name="confirm" required></label>`,async f=>{if(f.confirm.value!=='BORRAR'){appToast('Confirmación incorrecta.','error');return;}try{await request(`/papelera/${b.dataset.purge}`,{method:'DELETE'});appToast('Registro eliminado definitivamente.','success','error');closeModal();openSupport('trash');}catch(e){appToast(e.message,'error');}})));
}

async function renderTickets(content) {
  const tickets=await request('/support/tickets');
  content.innerHTML=`
    <div class="tool-head"><div><h3>Soporte Técnico</h3><p>Tickets y solicitudes para hablar con una persona.</p></div></div>
    <form id="ticketForm" class="form-grid support-form"><label class="field"><span>Asunto</span><input name="asunto" required></label><label class="field full"><span>Mensaje</span><textarea name="mensaje" rows="4" required></textarea></label><button class="btn btn-primary full" type="submit">Crear ticket</button></form>
    <div class="admin-list ticket-list">${tickets.slice().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(t=>`<div class="admin-row ticket-row"><div><strong>#${t.id} · ${esc(t.asunto)}</strong><small>${esc(t.usuario)} · ${esc(t.estado)} · ${new Date(t.fecha).toLocaleString('es-CR')}<br>${esc(t.mensaje)}${(t.respuestas||[]).length?`<br><b>Última respuesta:</b> ${esc(t.respuestas.at(-1).mensaje)}`:''}</small></div>${currentUser.rol==='Administrador'?`<div class="admin-actions"><button class="btn btn-outline btn-small" data-ticket="${t.id}">Responder</button></div>`:''}</div>`).join('')||'<div class="empty-state">No hay tickets.</div>'}</div>`;
  qs('#ticketForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await request('/support/tickets',{method:'POST',body:JSON.stringify({asunto:f.asunto.value.trim(),mensaje:f.mensaje.value.trim()})});appToast('Ticket creado.');renderSupportTab('tickets');}catch(err){appToast(err.message,'error');}});
  qsa('[data-ticket]').forEach(b=>b.addEventListener('click',()=>ticketDialog(b.dataset.ticket)));
}
function ticketDialog(id){
  openFormDialog('Responder ticket',`<label class="field"><span>Estado</span><select name="estado"><option>Pendiente</option><option>En revisión</option><option>Resuelto</option><option>Cerrado</option></select></label><label class="field"><span>Respuesta</span><textarea name="respuesta" rows="5" required></textarea></label>`,async f=>{try{await request(`/support/tickets/${id}`,{method:'PATCH',body:JSON.stringify({estado:f.estado.value,respuesta:f.respuesta.value.trim()})});appToast('Ticket actualizado.');closeModal();openSupport('tickets');}catch(e){appToast(e.message,'error');}});
}

function download(name,content,type='application/json'){
  const blob=new Blob([content],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function renderExports(content) {
  content.innerHTML=`
    <div class="tool-head"><div><h3>Reportes y utilidades</h3><p>Impresión/PDF, exportación, respaldo y conversión CRC/USD.</p></div></div>
    <div class="utility-grid">
      <button class="utility-card" data-print="solicitudes"><strong>Imprimir Solicitudes</strong><span>Abre una vista preparada para Guardar como PDF.</span></button>
      <button class="utility-card" data-csv><strong>Exportar CSV</strong><span>Descarga el listado de solicitudes.</span></button>
      <button class="utility-card" data-json><strong>Exportar JSON</strong><span>Descarga los datos visibles de la sesión.</span></button>
      ${currentUser.rol==='Administrador'?'<button class="utility-card" data-backup><strong>Respaldo administrativo</strong><span>Descarga una copia segura de las colecciones.</span></button>':''}
      <a class="utility-card utility-link" href="./data/datos_prueba_205_zofranca.json" download><strong>Set de 205 registros</strong><span>Datos sintéticos separados para pruebas de volumen.</span></a>
    </div>
    <div class="divider"></div>
    <form id="fxForm" class="inline-tool"><label class="field"><span>Inversión en CRC</span><input name="crc" type="number" min="0" value="1000000"></label><button class="btn btn-outline" type="submit">Convertir a USD</button><div id="fxResult"></div></form>`;
  qsa('[data-print]').forEach(b=>b.addEventListener('click',()=>printRequests()));
  qs('[data-csv]')?.addEventListener('click',exportCsv);
  qs('[data-json]')?.addEventListener('click',exportJson);
  qs('[data-backup]')?.addEventListener('click',async()=>{try{const data=await request('/backup');download(`zofranca-backup-${Date.now()}.json`,JSON.stringify(data,null,2));}catch(e){appToast(e.message,'error');}});
  qs('#fxForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const fx=await request('/fx/usd-crc');const crc=Number(e.currentTarget.crc.value),usd=crc/Number(fx.rate);qs('#fxResult').innerHTML=`<strong>USD ${usd.toFixed(2)}</strong><small>Tasa ${fx.rate} CRC/USD · ${esc(fx.date)}${fx.stale?' · caché':''}</small>`;}catch(err){qs('#fxResult').textContent=err.message;}});
}
async function printRequests(){
  const requests=await request('/solicitudes');
  const w=window.open('','_blank'); if(!w)return;
  w.document.write(`<html><head><title>ZoFranca CR - Solicitudes</title><style>body{font-family:Arial;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}h1{color:#0f5d50}</style></head><body><h1>ZoFranca CR · Solicitudes</h1><p>Generado ${new Date().toLocaleString('es-CR')}</p><table><thead><tr><th>ID</th><th>Empresa</th><th>Sector</th><th>Estado</th><th>IA</th><th>Decisión</th></tr></thead><tbody>${requests.map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.empresa)}</td><td>${esc(s.sector)}</td><td>${esc(s.estado)}</td><td>${esc(s.puntajeIA??'—')} · ${esc(s.clasificacionIA||'')}</td><td>${esc(s.decisionFinal||'Pendiente')}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);w.document.close();
}
async function exportCsv(){
  const items=await request('/solicitudes');const headers=['id','codigoSeguimiento','empresa','sector','inversionProyectada','empleosProyectados','estado','puntajeIA','clasificacionIA','decisionFinal','fechaSolicitud'];
  const csv=[headers.join(','),...items.map(x=>headers.map(h=>`"${String(x[h]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  download('solicitudes-zofranca.csv',csv,'text/csv;charset=utf-8');
}
async function exportJson(){
  const [z,s,e,r,d]=await Promise.all([request('/zonasFrancas'),request('/solicitudes'),request('/empresas'),request('/reportesCumplimiento'),request('/decisiones')]);
  download('zofranca-datos.json',JSON.stringify({zonasFrancas:z,solicitudes:s,empresas:e,reportesCumplimiento:r,decisiones:d},null,2));
}


async function toggleTheme(){
  if(!currentUser)return;
  const previous=currentUser.tema||'claro', next=previous==='oscuro'?'claro':'oscuro';
  currentUser={...currentUser,tema:next}; applyTheme(next);
  try{ currentUser=await request('/auth/profile',{method:'PATCH',body:JSON.stringify({tema:next})}); applyUser(); }
  catch(err){ currentUser={...currentUser,tema:previous}; applyTheme(previous); appToast('No fue posible guardar el tema.','error'); }
}

async function renderSettings(content) {
  content.innerHTML=`
    <div class="tool-head"><div><h3>Configuración</h3><p>Preferencias del perfil sin alterar los datos del proyecto.</p></div></div>
    <form id="settingsForm" class="stack-form settings-form">
      <label class="field"><span>Tema</span><select name="tema"><option value="claro" ${currentUser.tema!=='oscuro'?'selected':''}>Claro (diseño actual)</option><option value="oscuro" ${currentUser.tema==='oscuro'?'selected':''}>Oscuro</option></select></label>
      <label class="check-row"><input name="sonido" type="checkbox" ${currentUser.sonido!==false?'checked':''}><span>Sonidos de interacción</span></label>
      <button class="btn btn-primary" type="submit">Guardar preferencias</button>
    </form>`;
  qs('#settingsForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{currentUser=await request('/auth/profile',{method:'PATCH',body:JSON.stringify({tema:f.tema.value,sonido:f.sonido.checked})});applyUser();appToast('Preferencias guardadas.');}catch(err){appToast(err.message,'error');}});
}
async function renderActivity(content){
  const items=await request('/activity');
  content.innerHTML=`<div class="tool-head"><div><h3>Actividad y auditoría</h3><p>Acciones recientes registradas por el servidor.</p></div></div><div class="activity-list">${items.map(a=>`<div class="activity-item"><strong>${esc(a.accion)} · ${esc(a.entidad)}</strong><span>${esc(a.usuario)} · ${new Date(a.fecha).toLocaleString('es-CR')} · ${esc(a.detalle||'')}</span></div>`).join('')||'<div class="empty-state">Sin actividad.</div>'}</div>`;
}

function bindStatic() {
  qs('#loginForm')?.addEventListener('submit',login);
  qs('#registerCompanyForm')?.addEventListener('submit',registerCompany);
  qs('#showRegister')?.addEventListener('click',()=>{qs('#loginPanel').classList.add('hidden');qs('#registerPanel').classList.remove('hidden');});
  qs('#showLogin')?.addEventListener('click',()=>{qs('#registerPanel').classList.add('hidden');qs('#loginPanel').classList.remove('hidden');});
  qs('#mobileLoginPreview')?.addEventListener('click',()=>qs('#loginOverlay').classList.toggle('mobile-preview'));
  qs('.support-card')?.addEventListener('click',()=>openSupport());
  qs('.support-card')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSupport();}});
  qs('.topbar-user')?.addEventListener('click',openProfile);
  qs('#themeToggle')?.addEventListener('click',toggleTheme);
  qs('[data-view="hacienda"]')?.addEventListener('click',renderHacienda);
  qs('[data-view-target="hacienda"]')?.addEventListener('click',renderHacienda);
  qs('.topbar-user')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile();}});
  document.addEventListener('input',e=>{if(e.target.matches('input[name="telefono"]'))e.target.value=sanitizePhone(e.target.value);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  bindHaciendaTools();setupGlobalSearch();setupPagination();setupSoundsAndAnimations();
}

bindStatic();
window.addEventListener('zf-auth-ready',()=>{loadHaciendaRates();});
restoreSession();
