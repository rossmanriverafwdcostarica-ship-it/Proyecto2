export const TOKEN_KEY = 'zf_token';
const API_BASE = '';

function buildHeaders(options, token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  try {
    return contentType.includes('application/json')
      ? await response.json()
      : await response.text();
  } catch (error) {
    console.error('[ZoFranca CR - parseResponse]', error);
    return null;
  }
}

function createHttpError(response, body) {
  const serverMessage = typeof body === 'object' && body?.error
    ? body.error
    : (typeof body === 'string' && body.trim()
      ? body.trim()
      : `${response.status} ${response.statusText}`);

  const error = new Error(serverMessage);
  error.status = response.status;
  error.body = body;
  return error;
}

async function api(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY) || '';
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(options, token)
    });
  } catch (networkError) {
    const error = new Error('No se pudo conectar con el servidor Node. Verifique que npm start siga ejecutándose.');
    error.cause = networkError;
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  const body = await parseResponse(response);

  if (!response.ok) {
    const error = createHttpError(response, body);

    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('zf-session-expired', {
        detail: { message: error.message }
      }));
    }

    throw error;
  }

  return body;
}

export { api };
export default api;
