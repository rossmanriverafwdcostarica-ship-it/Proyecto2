const haciendaCache = new Map();

function cacheEntry(key, maxAgeMs) {
  const entry = haciendaCache.get(key);
  if (!entry) return null;
  return Date.now() - entry.cachedAt <= maxAgeMs ? entry : null;
}

export async function fetchHacienda(pathname, params = {}, maxAgeMs = 15 * 60 * 1000) {
  const target = new URL(`https://api.hacienda.go.cr${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') {
      target.searchParams.set(key, String(value));
    }
  }

  const key = target.toString();
  const cached = cacheEntry(key, maxAgeMs);
  if (cached) return { data: cached.data, cached: true, cachedAt: cached.cachedAt };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(target, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ZoFrancaCR-Academic/1.0'
      },
      signal: controller.signal
    });

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      console.error('[Hacienda - JSON]', error);
    }

    if (!response.ok) {
      const error = new Error(body?.message || body?.error || `Hacienda respondió HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    const entry = { data: body, cachedAt: Date.now() };
    haciendaCache.set(key, entry);
    return { data: body, cached: false, cachedAt: entry.cachedAt };
  } finally {
    clearTimeout(timer);
  }
}

export function validateIdentification(value) {
  return /^\d{9,12}$/.test(String(value || '').trim());
}

export function haciendaMeta(result) {
  return {
    fuente: 'Ministerio de Hacienda de Costa Rica',
    cached: result.cached,
    cachedAt: new Date(result.cachedAt).toISOString()
  };
}
