import { $, $$, escapeHTML } from '../core/dom.js';
import api from '../core/httpClient.js';

export function setupGlobalSearch() {
  const wrap = $('.search-wrap');
  const input = $('#globalSearch');
  if (!wrap || !input) return;

  const box = document.createElement('div');
  box.id = 'globalSearchResults';
  box.className = 'search-results hidden';
  wrap.appendChild(box);

  let timer = null;
  input.addEventListener('input', event => {
    clearTimeout(timer);
    const term = event.target.value.trim();
    if (term.length < 2) {
      box.classList.add('hidden');
      return;
    }
    timer = setTimeout(() => searchAll(term, box), 250);
  });

  document.addEventListener('click', event => {
    if (!wrap.contains(event.target)) box.classList.add('hidden');
  });
}

async function searchAll(term, box) {
  try {
    const [solicitudes, empresas, zonas] = await Promise.all([
      api('/solicitudes'),
      api('/empresas'),
      api('/zonasFrancas')
    ]);

    const query = term.toLowerCase();
    const results = [
      ...solicitudes
        .filter(item => `${item.empresa} ${item.id} ${item.codigoSeguimiento || ''} ${item.sector}`.toLowerCase().includes(query))
        .slice(0, 5)
        .map(item => ({ type: 'request', id: item.id, title: item.empresa, sub: `Solicitud #${item.id} · ${item.codigoSeguimiento || item.estado}` })),
      ...empresas
        .filter(item => `${item.nombre} ${item.id}`.toLowerCase().includes(query))
        .slice(0, 3)
        .map(item => ({ type: 'company', id: item.id, title: item.nombre, sub: `Empresa · ${item.estado}` })),
      ...zonas
        .filter(item => item.nombre.toLowerCase().includes(query))
        .slice(0, 3)
        .map(item => ({ type: 'zone', id: item.id, title: item.nombre, sub: 'Zona franca' }))
    ].slice(0, 8);

    box.innerHTML = results.length
      ? results.map(result => `<button type="button" class="search-result" data-search-type="${result.type}" data-search-id="${result.id}"><strong>${escapeHTML(result.title)}</strong><span>${escapeHTML(result.sub)}</span></button>`).join('')
      : '<div class="search-no-result">Sin coincidencias</div>';

    box.classList.remove('hidden');
    $$('[data-search-type]', box).forEach(button => {
      button.addEventListener('click', () => openSearchResult(button.dataset.searchType, button.dataset.searchId, box));
    });
  } catch (error) {
    console.error('[ZoFranca CR - búsqueda global]', error);
    box.classList.add('hidden');
  }
}

async function openSearchResult(type, id, box) {
  box.classList.add('hidden');
  const app = window.ZFApp;
  if (!app) return;

  try {
    if (type === 'request') {
      await app.loadAll({ quiet: true });
      app.state.selectedSolicitudId = id;
      app.renderDetail();
      app.showView('detalle');
      return;
    }

    if (type === 'company') {
      await app.loadAll({ quiet: true });
      $('#historyCompany').value = id;
      app.state.selectedHistoryCompanyId = id;
      app.renderHistory();
      app.showView('historial');
      return;
    }

    app.showView('nueva');
  } catch (error) {
    console.error('[ZoFranca CR - abrir resultado]', error);
    app.toast?.('No fue posible abrir el resultado seleccionado.', 'error');
  }
}

export function setupPagination() {
  const tbody = $('#requestsTable');
  const table = tbody?.closest('.panel-card');
  if (!tbody || !table || $('#pageInfo')) return;

  const pager = document.createElement('div');
  pager.className = 'pagination-bar hidden';
  pager.innerHTML = '<span id="pageInfo"></span><div><button class="btn btn-outline btn-small" id="prevPage" type="button">Anterior</button><button class="btn btn-outline btn-small" id="nextPage" type="button">Siguiente</button></div>';
  table.appendChild(pager);

  let page = 1;
  const pageSize = 10;
  let updating = false;

  const apply = () => {
    if (updating) return;
    updating = true;

    try {
      const rows = [...tbody.querySelectorAll('tr')];
      const total = rows.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, pages);

      rows.forEach((row, index) => {
        const hidden = index < (page - 1) * pageSize || index >= page * pageSize;
        row.classList.toggle('pagination-hidden', hidden);
      });

      pager.classList.toggle('hidden', total <= pageSize);
      $('#pageInfo').textContent = `Página ${page} de ${pages} · ${total} registros`;
      $('#prevPage').disabled = page <= 1;
      $('#nextPage').disabled = page >= pages;
    } finally {
      updating = false;
    }
  };

  new MutationObserver(() => {
    page = 1;
    apply();
  }).observe(tbody, { childList: true });

  $('#prevPage').addEventListener('click', () => {
    page -= 1;
    apply();
  });
  $('#nextPage').addEventListener('click', () => {
    page += 1;
    apply();
  });

  apply();
}
