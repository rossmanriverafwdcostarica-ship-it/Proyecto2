import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import {
  ROOT,
  PORT,
  HOST,
  COLLECTIONS,
  TRASHABLE,
  MIME_TYPES
} from './server/core/config.js';
import { sendJson, sendText, readBody } from './server/core/http.js';
import { readDb, writeDb } from './server/core/database.js';
import {
  sessions,
  publicUser,
  tokenFrom,
  authUser,
  requireUser,
  requireAdmin
} from './server/core/auth.js';
import {
  hashPassword,
  now,
  sameId,
  nextId
} from './server/core/utils.js';
import {
  audit,
  scopeCollection,
  canMutate,
  trackingEvent,
  prepareRequest,
  prepareComplianceReport,
  validateDelete
} from './server/domain/business.js';
import {
  fetchHacienda,
  validateIdentification,
  haciendaMeta
} from './server/integrations/hacienda.js';

let fxCache = null;

async function handleSpecial(req,res,url) {
  const db = await readDb();

  if (url.pathname === '/auth/login' && req.method === 'POST') {
    const {email,password} = await readBody(req);
    const user = db.usuarios.find(u => String(u.email).toLowerCase() === String(email||'').trim().toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password||'')) { sendJson(res,401,{error:'Correo o contraseña incorrectos.'}); return true; }
    if (user.estado !== 'Activo') { sendJson(res,403,{error:`La cuenta se encuentra en estado ${user.estado}.`}); return true; }
    const token = randomBytes(24).toString('hex');
    sessions.set(token,user.id);
    user.ultimoAcceso = now();
    await audit(db,user,'LOGIN','sesion',user.id,'Inicio de sesión');
    await writeDb(db);
    sendJson(res,200,{token,user:publicUser(user)}); return true;
  }
  if (url.pathname === '/auth/me' && req.method === 'GET') {
    const user = requireUser(req,res,db); if (!user) return true;
    sendJson(res,200,publicUser(user)); return true;
  }
  if (url.pathname === '/auth/logout' && req.method === 'POST') {
    const token = tokenFrom(req); const user = authUser(req,db);
    if (user) { await audit(db,user,'LOGOUT','sesion',user.id,'Cierre de sesión'); await writeDb(db); }
    sessions.delete(token); sendJson(res,200,{ok:true}); return true;
  }
  if (url.pathname === '/auth/register-company' && req.method === 'POST') {
    const p = await readBody(req);
    const email = String(p.email||'').trim().toLowerCase();
    if (!email || !p.password || !p.nombre || !p.empresaNombre) { sendJson(res,400,{error:'Nombre, empresa, correo y contraseña son obligatorios.'}); return true; }
    if (db.usuarios.some(u=>String(u.email).toLowerCase()===email)) { sendJson(res,409,{error:'El correo ya está registrado.'}); return true; }
    const item = { id:nextId(db.usuarios), nombre:String(p.nombre).trim(), email, passwordHash:hashPassword(p.password), rol:'Empresa', estado:'Pendiente', telefono:String(p.telefono||''), provincia:String(p.provincia||''), direccion:String(p.direccion||''), empresaNombre:String(p.empresaNombre).trim(), fechaRegistro:now(), tema:'claro', sonido:true };
    db.usuarios.push(item); await audit(db,null,'REGISTRO','usuarios',item.id,`Solicitud de acceso de ${item.empresaNombre}`); await writeDb(db);
    sendJson(res,201,{message:'Solicitud registrada. Un Administrador debe aprobar la cuenta.',user:publicUser(item)}); return true;
  }
  if (url.pathname === '/auth/profile' && req.method === 'PATCH') {
    const user = requireUser(req,res,db); if (!user) return true;
    const p = await readBody(req);
    const allowed = ['nombre','telefono','provincia','direccion','profileImage','tema','sonido'];
    for (const k of allowed) if (k in p) user[k] = p[k];
    await audit(db,user,'ACTUALIZAR','perfil',user.id,'Perfil actualizado'); await writeDb(db);
    sendJson(res,200,publicUser(user)); return true;
  }
  if (url.pathname === '/auth/password' && req.method === 'PATCH') {
    const user = requireUser(req,res,db); if (!user) return true;
    const p = await readBody(req);
    if (user.passwordHash !== hashPassword(p.actual||'')) { sendJson(res,400,{error:'La contraseña actual no coincide.'}); return true; }
    if (String(p.nueva||'').length < 8) { sendJson(res,400,{error:'La nueva contraseña debe tener al menos 8 caracteres.'}); return true; }
    user.passwordHash = hashPassword(p.nueva); await audit(db,user,'ACTUALIZAR','password',user.id,'Contraseña actualizada'); await writeDb(db);
    sendJson(res,200,{ok:true}); return true;
  }

  if (url.pathname === '/admin/usuarios' && req.method === 'GET') {
    if (!requireAdmin(req,res,db)) return true;
    sendJson(res,200,db.usuarios.map(publicUser)); return true;
  }
  if (url.pathname === '/admin/usuarios' && req.method === 'POST') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const p = await readBody(req); const email = String(p.email||'').trim().toLowerCase();
    if (!p.nombre || !email || !p.password) { sendJson(res,400,{error:'Nombre, correo y contraseña son obligatorios.'}); return true; }
    if (db.usuarios.some(u=>String(u.email).toLowerCase()===email)) { sendJson(res,409,{error:'El correo ya existe.'}); return true; }
    const item = { id:nextId(db.usuarios), nombre:p.nombre.trim(), email, passwordHash:hashPassword(p.password), rol:p.rol||'Analista', estado:p.estado||'Activo', telefono:p.telefono||'', provincia:p.provincia||'', direccion:p.direccion||'', empresaNombre:p.empresaNombre||'', fechaRegistro:now(), tema:'claro', sonido:true };
    db.usuarios.push(item); await audit(db,admin,'CREAR','usuarios',item.id,item.email); await writeDb(db);
    sendJson(res,201,publicUser(item)); return true;
  }
  const adminUserMatch = url.pathname.match(/^\/admin\/usuarios\/([^/]+)$/);
  if (adminUserMatch && req.method === 'PATCH') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const item = db.usuarios.find(u=>sameId(u.id,adminUserMatch[1])); if (!item) { sendJson(res,404,{error:'Usuario no encontrado.'}); return true; }
    const p = await readBody(req);
    for (const k of ['nombre','email','rol','estado','telefono','provincia','direccion','empresaNombre']) if (k in p) item[k]=p[k];
    if (p.password) item.passwordHash=hashPassword(p.password);
    await audit(db,admin,'ACTUALIZAR','usuarios',item.id,item.email); await writeDb(db); sendJson(res,200,publicUser(item)); return true;
  }
  const reviewMatch = url.pathname.match(/^\/admin\/usuarios\/([^/]+)\/review$/);
  if (reviewMatch && req.method === 'POST') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const item = db.usuarios.find(u=>sameId(u.id,reviewMatch[1])); if (!item) { sendJson(res,404,{error:'Usuario no encontrado.'}); return true; }
    const p = await readBody(req); const decision = p.decision === 'aprobar' ? 'Activo' : 'Rechazado';
    if (String(p.motivo||'').trim().length < 10) { sendJson(res,400,{error:'El motivo debe tener al menos 10 caracteres.'}); return true; }
    item.estado=decision; item.revision={decision:p.decision,motivo:p.motivo,revisor:admin.nombre,fecha:now()};
    await audit(db,admin,p.decision==='aprobar'?'APROBAR':'RECHAZAR','usuarios',item.id,p.motivo); await writeDb(db);
    sendJson(res,200,publicUser(item)); return true;
  }

  const adminDeleteMatch = url.pathname.match(/^\/admin\/delete\/([^/]+)\/([^/]+)$/);
  if (adminDeleteMatch && req.method === 'DELETE') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const [,collection,id] = adminDeleteMatch;
    if (!TRASHABLE.has(collection) || !Array.isArray(db[collection])) { sendJson(res,400,{error:'Entidad no compatible con Papelera.'}); return true; }
    const index = db[collection].findIndex(x=>sameId(x.id,id)); if (index<0) { sendJson(res,404,{error:'Registro no encontrado.'}); return true; }
    const item = db[collection][index];
    if (collection==='usuarios' && sameId(item.id,admin.id)) { sendJson(res,400,{error:'No puede enviarse a Papelera la cuenta actualmente autenticada.'}); return true; }
    const integrity = validateDelete(db,collection,item); if (integrity) { sendJson(res,409,{error:integrity}); return true; }
    db[collection].splice(index,1);
    const trash = { id:nextId(db.papelera), coleccion:collection, originalId:item.id, nombre:item.nombre||item.empresa||item.email||`${collection} #${item.id}`, datos:item, eliminadoPor:admin.nombre, fecha:now() };
    db.papelera.push(trash); await audit(db,admin,'PAPELERA',collection,item.id,trash.nombre); await writeDb(db);
    sendJson(res,200,trash); return true;
  }
  if (url.pathname === '/papelera' && req.method === 'GET') {
    if (!requireAdmin(req,res,db)) return true;
    sendJson(res,200,db.papelera); return true;
  }
  const restoreMatch = url.pathname.match(/^\/papelera\/([^/]+)\/restore$/);
  if (restoreMatch && req.method === 'POST') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const index=db.papelera.findIndex(x=>sameId(x.id,restoreMatch[1])); if(index<0){sendJson(res,404,{error:'Elemento no encontrado.'});return true;}
    const trash=db.papelera[index]; const target=db[trash.coleccion];
    if (!Array.isArray(target)) { sendJson(res,400,{error:'Colección original no disponible.'}); return true; }
    if (target.some(x=>sameId(x.id,trash.originalId))) { sendJson(res,409,{error:'Ya existe un registro con el ID original.'}); return true; }
    target.push(trash.datos); db.papelera.splice(index,1); await audit(db,admin,'RESTAURAR',trash.coleccion,trash.originalId,trash.nombre); await writeDb(db);
    sendJson(res,200,trash.datos); return true;
  }
  const trashDeleteMatch = url.pathname.match(/^\/papelera\/([^/]+)$/);
  if (trashDeleteMatch && req.method === 'DELETE') {
    const admin=requireAdmin(req,res,db); if(!admin)return true;
    const index=db.papelera.findIndex(x=>sameId(x.id,trashDeleteMatch[1])); if(index<0){sendJson(res,404,{error:'Elemento no encontrado.'});return true;}
    const [trash]=db.papelera.splice(index,1); await audit(db,admin,'ELIMINAR_DEFINITIVO',trash.coleccion,trash.originalId,trash.nombre); await writeDb(db); sendJson(res,200,trash); return true;
  }


  const directCompanyDeleteMatch = url.pathname.match(/^\/admin\/purge\/empresas\/([^/]+)$/);
  if (directCompanyDeleteMatch && req.method === 'DELETE') {
    const admin = requireAdmin(req,res,db); if (!admin) return true;
    const companyId = directCompanyDeleteMatch[1];
    const index = db.empresas.findIndex(e => sameId(e.id, companyId));
    if (index < 0) { sendJson(res,404,{error:'Empresa no encontrada.'}); return true; }
    const [company] = db.empresas.splice(index,1);
    const reportesEliminados = db.reportesCumplimiento.filter(r => sameId(r.empresaId, company.id));
    db.reportesCumplimiento = db.reportesCumplimiento.filter(r => !sameId(r.empresaId, company.id));
    db.papelera = db.papelera.filter(t => !(t.coleccion === 'empresas' && sameId(t.originalId, company.id)));
    await audit(db,admin,'ELIMINAR_BD','empresas',company.id,`${company.nombre}; reportes eliminados: ${reportesEliminados.length}. Se conserva solicitud y decisión para trazabilidad.`);
    await writeDb(db);
    sendJson(res,200,{empresa:company,reportesEliminados:reportesEliminados.length,solicitudConservada:company.solicitudId});
    return true;
  }

  if (url.pathname === '/support/tickets' && req.method === 'GET') {
    const user=requireUser(req,res,db); if(!user)return true;
    const items=user.rol==='Administrador' ? db.soporteTickets : db.soporteTickets.filter(t=>sameId(t.usuarioId,user.id));
    sendJson(res,200,items); return true;
  }
  if (url.pathname === '/support/tickets' && req.method === 'POST') {
    const user=requireUser(req,res,db); if(!user)return true;
    const p=await readBody(req);
    if (!String(p.asunto||'').trim() || !String(p.mensaje||'').trim()) { sendJson(res,400,{error:'Asunto y mensaje son obligatorios.'}); return true; }
    const item={id:nextId(db.soporteTickets),usuarioId:user.id,usuario:user.nombre,email:user.email,asunto:String(p.asunto).trim(),mensaje:String(p.mensaje).trim(),estado:'Pendiente',respuestas:[],fecha:now()};
    db.soporteTickets.push(item); await audit(db,user,'CREAR','soporteTickets',item.id,item.asunto); await writeDb(db); sendJson(res,201,item); return true;
  }
  const ticketMatch=url.pathname.match(/^\/support\/tickets\/([^/]+)$/);
  if(ticketMatch && req.method==='PATCH'){
    const admin=requireAdmin(req,res,db); if(!admin)return true;
    const item=db.soporteTickets.find(t=>sameId(t.id,ticketMatch[1])); if(!item){sendJson(res,404,{error:'Ticket no encontrado.'});return true;}
    const p=await readBody(req); if(p.estado)item.estado=p.estado;
    if(p.respuesta){ item.respuestas.push({usuario:admin.nombre,mensaje:String(p.respuesta),fecha:now()}); }
    await audit(db,admin,'ACTUALIZAR','soporteTickets',item.id,item.estado); await writeDb(db); sendJson(res,200,item); return true;
  }

  if (url.pathname === '/activity' && req.method === 'GET') {
    const user=requireUser(req,res,db); if(!user)return true;
    const items=user.rol==='Administrador'?db.actividad:db.actividad.filter(a=>sameId(a.usuarioId,user.id));
    sendJson(res,200,items.slice().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,100)); return true;
  }


  if (url.pathname.startsWith('/hacienda/') && req.method === 'GET') {
    const user=requireUser(req,res,db); if(!user)return true;
    try {
      let result;
      if (url.pathname === '/hacienda/tc') {
        result = await fetchHacienda('/indicadores/tc', {}, 30 * 60 * 1000);
      } else if (url.pathname === '/hacienda/tc/dolar') {
        result = await fetchHacienda('/indicadores/tc/dolar', {}, 30 * 60 * 1000);
      } else if (url.pathname === '/hacienda/tc/euro') {
        result = await fetchHacienda('/indicadores/tc/euro', {}, 30 * 60 * 1000);
      } else if (url.pathname === '/hacienda/tc/dolar/historico') {
        const d=url.searchParams.get('d'), h=url.searchParams.get('h');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d||'') || !/^\d{4}-\d{2}-\d{2}$/.test(h||'')) { sendJson(res,400,{error:'Indique las fechas desde y hasta en formato YYYY-MM-DD.'}); return true; }
        if (new Date(d) > new Date(h)) { sendJson(res,400,{error:'La fecha desde no puede ser posterior a la fecha hasta.'}); return true; }
        result = await fetchHacienda('/indicadores/tc/dolar/historico', {d,h}, 30 * 60 * 1000);
      } else if (url.pathname === '/hacienda/contribuyente') {
        const identificacion=url.searchParams.get('identificacion');
        if (!validateIdentification(identificacion)) { sendJson(res,400,{error:'La identificación debe contener entre 9 y 12 dígitos.'}); return true; }
        result = await fetchHacienda('/fe/ae', {identificacion}, 60 * 60 * 1000);
      } else if (url.pathname === '/hacienda/exoneracion') {
        const autorizacion=String(url.searchParams.get('autorizacion')||'').trim();
        if (!/^AL-\d{8}-\d{2}$/i.test(autorizacion)) { sendJson(res,400,{error:'La autorización debe usar el formato AL-XXXXXXXX-XX.'}); return true; }
        result = await fetchHacienda('/fe/ex', {autorizacion}, 60 * 60 * 1000);
      } else if (url.pathname === '/hacienda/agropecuario' || url.pathname === '/hacienda/pesca') {
        const identificacion=url.searchParams.get('identificacion');
        if (!validateIdentification(identificacion)) { sendJson(res,400,{error:'La identificación debe contener entre 9 y 12 dígitos.'}); return true; }
        const external = url.pathname.endsWith('agropecuario') ? '/fe/agropecuario' : '/fe/pesca';
        result = await fetchHacienda(external, {identificacion}, 60 * 60 * 1000);
      } else if (url.pathname === '/hacienda/cabys') {
        const codigo=String(url.searchParams.get('codigo')||'').trim();
        const q=String(url.searchParams.get('q')||'').trim();
        if (codigo && !/^\d{13}$/.test(codigo)) { sendJson(res,400,{error:'El código CABYS debe contener 13 dígitos.'}); return true; }
        if (!codigo && q.length < 3) { sendJson(res,400,{error:'Escriba un código CABYS de 13 dígitos o una descripción de al menos 3 caracteres.'}); return true; }
        result = await fetchHacienda('/fe/cabys', codigo ? {codigo} : {q,top:10}, 30 * 60 * 1000);
      } else {
        sendJson(res,404,{error:'Servicio de Hacienda no encontrado.'}); return true;
      }
      sendJson(res,200,{data:result.data,meta:haciendaMeta(result)});
    } catch(error) {
      console.error('[Hacienda API]', error);
      if (error?.status === 429) sendJson(res,429,{error:'Hacienda alcanzó temporalmente el límite de consultas. Espere unos minutos e intente nuevamente.'});
      else if (error?.name === 'AbortError') sendJson(res,504,{error:'La consulta a Hacienda tardó demasiado. Intente nuevamente.'});
      else sendJson(res,error?.status && error.status < 500 ? error.status : 503,{error:'No fue posible conectar con la API pública del Ministerio de Hacienda. Verifique su conexión a Internet e intente nuevamente.'});
    }
    return true;
  }

  if (url.pathname === '/fx/usd-crc' && req.method === 'GET') {
    const user=requireUser(req,res,db); if(!user)return true;
    try {
      const result = await fetchHacienda('/indicadores/tc/dolar', {}, 30 * 60 * 1000);
      const data = result.data || {};
      const venta = Number(data?.venta?.valor);
      const compra = Number(data?.compra?.valor);
      if (!Number.isFinite(venta)) throw new Error('Hacienda no devolvió una tasa de venta válida.');
      fxCache={rate:venta,compra,date:data?.venta?.fecha||data?.compra?.fecha||new Date().toISOString().slice(0,10),provider:'Ministerio de Hacienda de Costa Rica',cachedAt:result.cachedAt};
      sendJson(res,200,{...fxCache,cached:result.cached});
    } catch(error) {
      console.error('[FX Hacienda]',error);
      if(fxCache) sendJson(res,200,{...fxCache,stale:true});
      else sendJson(res,503,{error:'No fue posible consultar el tipo de cambio del Ministerio de Hacienda en este momento.'});
    }
    return true;
  }

  if (url.pathname === '/backup' && req.method === 'GET') {
    if(!requireAdmin(req,res,db))return true;
    const safe={...db,usuarios:db.usuarios.map(publicUser)};
    sendJson(res,200,{exportadoEn:now(),app:'ZoFranca CR',data:safe}); return true;
  }

  return false;
}

async function handleApi(req,res,url) {
  const parts=url.pathname.split('/').filter(Boolean), collection=parts[0], id=parts[1];
  if(!COLLECTIONS.has(collection))return false;
  const db=await readDb(); const user=requireUser(req,res,db); if(!user)return true;
  if (['usuarios','soporteTickets','papelera','actividad'].includes(collection)) { sendJson(res,403,{error:'Use el endpoint especializado para esta colección.'}); return true; }

  let items=db[collection];
  if(req.method==='GET'){
    items=scopeCollection(collection,items,db,user);
    if(id!==undefined){
      const item=items.find(x=>sameId(x.id,id)); if(!item){sendJson(res,404,{error:'Registro no encontrado.'});return true;}
      sendJson(res,200,item);return true;
    }
    let result=items;
    for(const [k,v] of url.searchParams.entries()) result=result.filter(i=>String(i[k])===v);
    sendJson(res,200,result);return true;
  }

  if(!canMutate(user,collection,req.method)){sendJson(res,403,{error:'Su rol no permite esta operación.'});return true;}

  if(req.method==='POST'&&id===undefined){
    let p=await readBody(req); const assignedId=p.id??nextId(items);
    if(collection==='solicitudes') p=prepareRequest(p,user,assignedId);
    if(collection==='reportesCumplimiento') {
      const prepared = prepareComplianceReport(p,db,user);
      if (prepared.error) { sendJson(res,prepared.status||400,{error:prepared.error}); return true; }
      p = prepared.value;
    }
    const item={...p,id:assignedId}; items.push(item);
    if(collection==='reportesCumplimiento'){
      const company=db.empresas.find(e=>sameId(e.id,item.empresaId));
      const request=company ? db.solicitudes.find(s=>sameId(s.id,company.solicitudId)) : null;
      if(request){
        request.seguimiento=Array.isArray(request.seguimiento)?request.seguimiento:[];
        request.seguimiento.push(trackingEvent(`Reporte de cumplimiento: ${item.estado}`, `Empleos ${item.empleosReales}; inversión ${item.inversionEjecutada}; exportaciones ${item.exportaciones}.`, user));
      }
    }
    if(collection==='decisiones'){
      const s=db.solicitudes.find(x=>sameId(x.id,item.solicitudId));
      if(s){s.seguimiento=Array.isArray(s.seguimiento)?s.seguimiento:[];s.seguimiento.push(trackingEvent(`Decisión: ${item.decision}`,item.observacion||'Decisión humana registrada.',user));}
    }
    await audit(db,user,'CREAR',collection,item.id,item.nombre||item.empresa||''); await writeDb(db); sendJson(res,201,item);return true;
  }
  if(req.method==='PATCH'&&id!==undefined){
    const idx=items.findIndex(x=>sameId(x.id,id)); if(idx<0){sendJson(res,404,{error:'Registro no encontrado.'});return true;}
    const p=await readBody(req); const old=items[idx], originalId=old.id;
    const updated={...old,...p,id:originalId};
    if(collection==='solicitudes'&&p.estado&&p.estado!==old.estado){
      updated.seguimiento=Array.isArray(old.seguimiento)?[...old.seguimiento]:[];
      updated.seguimiento.push(trackingEvent(`Estado: ${p.estado}`,p.clasificacionIA?`Clasificación IA: ${p.clasificacionIA}`:'Expediente actualizado.',user));
    }
    items[idx]=updated; await audit(db,user,'ACTUALIZAR',collection,originalId,p.estado||p.decisionFinal||''); await writeDb(db); sendJson(res,200,updated);return true;
  }
  if(req.method==='DELETE'&&id!==undefined){
    if(user.rol!=='Administrador'){sendJson(res,403,{error:'Solo el Administrador puede eliminar registros.'});return true;}
    const idx=items.findIndex(x=>sameId(x.id,id)); if(idx<0){sendJson(res,404,{error:'Registro no encontrado.'});return true;}
    const integrity=validateDelete(db,collection,items[idx]); if(integrity){sendJson(res,409,{error:integrity});return true;}
    const [deleted]=items.splice(idx,1); await audit(db,user,'ELIMINAR',collection,deleted.id,'Eliminación directa'); await writeDb(db); sendJson(res,200,deleted);return true;
  }
  sendJson(res,405,{error:'Método no permitido.'});return true;
}

async function serveStatic(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||/^\/pages\/.*\.html$/i.test(pathname))pathname='/index.html';
  const normalized=path.normalize(pathname).replace(/^([/\\])+/,''), filePath=path.resolve(ROOT,normalized);
  if(!filePath.startsWith(ROOT)){sendText(res,403,'Acceso denegado.');return;}
  try{
    const s=await stat(filePath); if(!s.isFile()){sendText(res,404,'Archivo no encontrado.');return;}
    const data=await readFile(filePath), ext=path.extname(filePath).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME_TYPES[ext]||'application/octet-stream','Content-Length':data.length,'Cache-Control':['.html','.js','.css'].includes(ext)?'no-cache':'public, max-age=3600'});
    res.end(data);
  }catch{sendText(res,404,'Archivo no encontrado.');}
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||`localhost:${PORT}`}`);
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'});res.end();return;}
    if(url.pathname==='/health'){sendJson(res,200,{ok:true,app:'ZoFranca CR',port:PORT,database:'db.json',features:['auth','roles','audit','trash','support','hacienda-api','dark-mode','tracking']});return;}
    if(await handleSpecial(req,res,url))return;
    if(await handleApi(req,res,url))return;
    if(req.method!=='GET'&&req.method!=='HEAD'){sendJson(res,404,{error:'Endpoint no encontrado.'});return;}
    await serveStatic(req,res,url);
  }catch(error){console.error('[Node Server Error]',error);sendJson(res,500,{error:'Ocurrió un error interno en el servidor.'});}
});

await readDb();
server.on('error', error => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`No se pudo iniciar ZoFranca CR: el puerto ${PORT} ya está en uso. Cierre el servidor anterior e intente nuevamente.`);
    process.exitCode = 1;
    return;
  }
  console.error('[Node Server Error]', error);
  process.exitCode = 1;
});
server.listen(PORT,HOST,()=>{
  console.log('');
  console.log('===========================================');
  console.log(`  ZoFranca CR: http://localhost:${PORT}`);
  console.log('  Un servidor Node · Funciones integradas');
  console.log('===========================================');
  console.log('');
  console.log('Admin:    admin@zofranca.cr / Admin123*');
  console.log('Analista: analista@zofranca.cr / Analista123*');
  console.log('Empresa:  empresa@demo.cr / Empresa123*');
  console.log('');
});
