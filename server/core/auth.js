import { sendJson } from './http.js';
import { sameId } from './utils.js';

export const sessions = new Map();

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

export function tokenFrom(req) {
  const authorization = req.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export function authUser(req, db) {
  const userId = sessions.get(tokenFrom(req));
  return db.usuarios.find(user => sameId(user.id, userId)) || null;
}

export function requireUser(req, res, db) {
  const user = authUser(req, db);
  if (!user || user.estado !== 'Activo') {
    sendJson(res, 401, { error: 'Sesión requerida.' });
    return null;
  }
  return user;
}

export function requireAdmin(req, res, db) {
  const user = requireUser(req, res, db);
  if (!user) return null;

  if (user.rol !== 'Administrador') {
    sendJson(res, 403, { error: 'Acceso reservado al Administrador.' });
    return null;
  }

  return user;
}
