import { $, $$, escapeHTML } from '../core/dom.js';
import api from '../core/httpClient.js';

function apiMeta(meta) {
  if (!meta) return '';
  const source = escapeHTML(meta.fuente || 'Ministerio de Hacienda');
  const cacheLabel = meta.cached ? 'respuesta en caché' : 'consulta actual';
  const cachedAt = meta.cachedAt
    ? ` · ${new Date(meta.cachedAt).toLocaleString('es-CR')}`
    : '';

  return `<div class="api-meta">Fuente: ${source} · ${cacheLabel}${cachedAt}</div>`;
}

function genericResult(data) {
  if (data === null || data === undefined) {
    return '<div class="api-empty">Sin información disponible.</div>';
  }

  if (Array.isArray(data)) {
    return data.length
      ? `<div class="api-list">${data.slice(0, 25).map(item => `<div class="api-list-item"><pre>${escapeHTML(JSON.stringify(item, null, 2))}</pre></div>`).join('')}</div>`
      : '<div class="api-empty">Sin registros.</div>';
  }

  if (typeof data === 'object') {
    return `<div class="api-kv">${Object.entries(data).map(([key, value]) => `
      <div>
        <span>${escapeHTML(key)}</span>
        <strong>${typeof value === 'object'
          ? `<pre>${escapeHTML(JSON.stringify(value, null, 2))}</pre>`
          : escapeHTML(value)}</strong>
      </div>`).join('')}</div>`;
  }

  return `<strong>${escapeHTML(data)}</strong>`;
}

function setApiResult(selector, html, type = '') {
  const element = $(selector);
  if (!element) return;
  element.className = `api-result ${type}`;
  element.innerHTML = html;
}

function setApiLoading(selector) {
  setApiResult(selector, '<div class="mini-loading">Consultando servicio oficial...</div>', 'loading-result');
}

function setApiError(selector, error) {
  setApiResult(
    selector,
    `<div class="api-error"><strong>No fue posible completar la consulta.</strong><span>${escapeHTML(error.message || error)}</span></div>`,
    'error-result'
  );
}

export async function loadHaciendaRates() {
  const board = $('#haciendaRates');
  const mini = $('#dashboardHaciendaRates');
  if (board) board.classList.add('is-loading');

  try {
    const result = await api('/hacienda/tc');
    const data = result.data || {};
    const compra = Number(data?.dolar?.compra?.valor);
    const venta = Number(data?.dolar?.venta?.valor);
    const euro = Number(data?.euro?.colones);

    if (board) {
      const cards = $$('.hacienda-rate-card', board);
      const values = [compra, venta, euro];
      cards.forEach((card, index) => {
        const strong = card.querySelector('strong');
        if (strong) {
          strong.textContent = Number.isFinite(values[index])
            ? values[index].toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—';
        }
      });
      board.dataset.source = result.meta?.cached ? 'caché' : 'Hacienda';
    }

    if (mini) {
      mini.innerHTML = `<strong>USD ₡${Number.isFinite(venta) ? venta.toLocaleString('es-CR', { minimumFractionDigits: 2 }) : '—'}</strong><span>venta · EUR ₡${Number.isFinite(euro) ? euro.toLocaleString('es-CR', { minimumFractionDigits: 2 }) : '—'}</span>`;
    }
  } catch (error) {
    console.error('[ZoFranca CR - Hacienda tasas]', error);
    if (board) {
      board.innerHTML = '<div class="api-error"><strong>Indicadores no disponibles</strong><span>Verifique la conexión a Internet o intente más tarde.</span></div>';
    }
    if (mini) mini.innerHTML = '<span>Indicadores temporalmente no disponibles.</span>';
  } finally {
    if (board) board.classList.remove('is-loading');
  }
}

export async function renderHacienda() {
  await loadHaciendaRates();
}

export function bindHaciendaTools() {
  $('#refreshHaciendaRates')?.addEventListener('click', loadHaciendaRates);

  $('#taxpayerForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    setApiLoading('#taxpayerResult');

    try {
      const response = await api(`/hacienda/contribuyente?identificacion=${encodeURIComponent(form.identificacion.value.trim())}`);
      const data = response.data || {};
      setApiResult('#taxpayerResult', `
        <div class="taxpayer-summary">
          <h3>${escapeHTML(data.nombre || 'Contribuyente')}</h3>
          <div class="api-kv compact">
            <div><span>Estado</span><strong>${escapeHTML(data.situacion?.estado || '—')}</strong></div>
            <div><span>Moroso</span><strong>${escapeHTML(data.situacion?.moroso || '—')}</strong></div>
            <div><span>Omiso</span><strong>${escapeHTML(data.situacion?.omiso || '—')}</strong></div>
            <div><span>Régimen</span><strong>${escapeHTML(data.regimen?.descripcion || '—')}</strong></div>
          </div>
          ${Array.isArray(data.actividades) && data.actividades.length
            ? `<div class="api-activities">${data.actividades.map(activity => `<span>${escapeHTML(activity.descripcion || activity.actividad || JSON.stringify(activity))}</span>`).join('')}</div>`
            : ''}
        </div>${apiMeta(response.meta)}`);
    } catch (error) {
      console.error('[ZoFranca CR - contribuyente]', error);
      setApiError('#taxpayerResult', error);
    }
  });

  $('#exonerationForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    setApiLoading('#exonerationResult');

    try {
      const response = await api(`/hacienda/exoneracion?autorizacion=${encodeURIComponent(form.autorizacion.value.trim())}`);
      setApiResult('#exonerationResult', genericResult(response.data) + apiMeta(response.meta));
    } catch (error) {
      console.error('[ZoFranca CR - exoneración]', error);
      setApiError('#exonerationResult', error);
    }
  });

  $('#sectorRegistryForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    setApiLoading('#sectorRegistryResult');

    try {
      const response = await api(`/hacienda/${encodeURIComponent(form.tipo.value)}?identificacion=${encodeURIComponent(form.identificacion.value.trim())}`);
      setApiResult('#sectorRegistryResult', genericResult(response.data) + apiMeta(response.meta));
    } catch (error) {
      console.error('[ZoFranca CR - registro sectorial]', error);
      setApiError('#sectorRegistryResult', error);
    }
  });

  $('#cabysForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.codigo.value.trim();
    const query = form.q.value.trim();
    setApiLoading('#cabysResult');

    try {
      const path = code
        ? `/hacienda/cabys?codigo=${encodeURIComponent(code)}`
        : `/hacienda/cabys?q=${encodeURIComponent(query)}`;
      const response = await api(path);
      const data = response.data || {};
      const items = Array.isArray(data.cabys) ? data.cabys : (data.codigo ? [data] : []);

      setApiResult(
        '#cabysResult',
        items.length
          ? `<div class="cabys-list">${items.map(item => `<article><strong>${escapeHTML(item.codigo)}</strong><span>${escapeHTML(item.descripcion)}</span><small>Impuesto: ${escapeHTML(item.impuesto ?? '—')}%</small></article>`).join('')}</div>${apiMeta(response.meta)}`
          : genericResult(data) + apiMeta(response.meta)
      );
    } catch (error) {
      console.error('[ZoFranca CR - CABYS]', error);
      setApiError('#cabysResult', error);
    }
  });

  $('#fxHistoryForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    setApiLoading('#fxHistoryResult');

    try {
      const response = await api(`/hacienda/tc/dolar/historico?d=${encodeURIComponent(form.desde.value)}&h=${encodeURIComponent(form.hasta.value)}`);
      setApiResult('#fxHistoryResult', genericResult(response.data) + apiMeta(response.meta));
    } catch (error) {
      console.error('[ZoFranca CR - histórico dólar]', error);
      setApiError('#fxHistoryResult', error);
    }
  });
}
