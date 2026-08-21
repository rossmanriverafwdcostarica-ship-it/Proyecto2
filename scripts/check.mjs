import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['server.js', 'js', 'server'];

async function collect(target) {
  const absolute = path.join(ROOT, target);
  if (target.endsWith('.js')) return [absolute];

  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const relative = path.join(target, entry.name);
    if (entry.isDirectory()) return collect(relative);
    return entry.isFile() && entry.name.endsWith('.js') ? [path.join(ROOT, relative)] : [];
  }));
  return nested.flat();
}

function checkFile(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Error de sintaxis en ${file}`)));
    child.on('error', reject);
  });
}

try {
  const files = (await Promise.all(TARGETS.map(collect))).flat();
  for (const file of files) await checkFile(file);
  console.log(`Validación completada: ${files.length} archivos JavaScript sin errores de sintaxis.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
