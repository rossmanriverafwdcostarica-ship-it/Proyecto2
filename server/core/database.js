import { readFile, writeFile } from 'node:fs/promises';
import { DB_PATH, COLLECTIONS } from './config.js';
import { hashPassword, now } from './utils.js';

let dbState = null;
let dbLoadPromise = null;
let dbWriteQueue = Promise.resolve();

function ensureCollections(db) {
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(db[collection])) db[collection] = [];
  }
}

function seedUsers(db) {
  if (db.usuarios.length) return false;

  db.usuarios.push(
    { id: 1, nombre: 'Administrador ZoFranca', email: 'admin@zofranca.cr', passwordHash: hashPassword('Admin123*'), rol: 'Administrador', estado: 'Activo', telefono: '+50688880001', provincia: 'San José', direccion: '', empresaNombre: '', fechaRegistro: now(), tema: 'claro', sonido: true },
    { id: 2, nombre: 'Analista Principal', email: 'analista@zofranca.cr', passwordHash: hashPassword('Analista123*'), rol: 'Analista', estado: 'Activo', telefono: '+50688880002', provincia: 'San José', direccion: '', empresaNombre: '', fechaRegistro: now(), tema: 'claro', sonido: true },
    { id: 3, nombre: 'Empresa Demo', email: 'empresa@demo.cr', passwordHash: hashPassword('Empresa123*'), rol: 'Empresa', estado: 'Activo', telefono: '+50688880003', provincia: 'Alajuela', direccion: '', empresaNombre: 'Tech Demo CR', fechaRegistro: now(), tema: 'claro', sonido: true }
  );
  return true;
}

export async function readDb() {
  if (dbState) return dbState;
  if (dbLoadPromise) return dbLoadPromise;

  dbLoadPromise = (async () => {
    const raw = await readFile(DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    ensureCollections(db);
    dbState = db;

    if (seedUsers(db)) await writeDb(db);
    return dbState;
  })();

  try {
    return await dbLoadPromise;
  } finally {
    dbLoadPromise = null;
  }
}

export async function writeDb(db = dbState) {
  dbState = db;
  const snapshot = `${JSON.stringify(dbState, null, 2)}\n`;

  const persist = async () => {
    await writeFile(DB_PATH, snapshot, 'utf8');
  };

  dbWriteQueue = dbWriteQueue.then(persist, persist);
  return dbWriteQueue;
}
