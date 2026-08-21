import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(currentDir, '../..');
export const DB_PATH = path.join(ROOT, 'db.json');
export const PORT = Number(process.env.PORT || 3001);
export const HOST = process.env.HOST || '0.0.0.0';

export const COLLECTIONS = new Set([
  'zonasFrancas',
  'solicitudes',
  'empresas',
  'reportesCumplimiento',
  'decisiones',
  'usuarios',
  'soporteTickets',
  'papelera',
  'actividad'
]);

export const ORIGINAL_COLLECTIONS = new Set([
  'zonasFrancas',
  'solicitudes',
  'empresas',
  'reportesCumplimiento',
  'decisiones'
]);

export const TRASHABLE = new Set(['zonasFrancas', 'solicitudes', 'empresas', 'usuarios']);

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
  '.wav': 'audio/wav'
};
