// ---------------------------------------------------------------
// Dashboard Oficina — lógica partilhada por todas as páginas
// Config específica deste board (ver claude/trello-dashboard-config.md)
// ---------------------------------------------------------------
const BOARD_ID = 'cARsYBsY';
const CARD_FIELDS = 'name,due,dueComplete,start,dateCompleted,dateLastActivity,closed,idList,labels,shortUrl,idShort';
const LIST_FIELDS = 'name,closed';
const CACHE_KEY = 'trello_dash_cache_v2';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min: navegar entre páginas não repete o fetch

// Listas identificadas pelo NOME (não pelo ID) — mais fácil de manter quando o João
// cria/renomeia listas no Trello, só é preciso atualizar este nome.
const LIST_NAME = {
  decorrerExterno: 'Intervenções Externas DECORRER',
  metalomecanica: 'Metalomecanica',
  planeamentoInterno: 'Planeamento Interno',
};
// A Decorrer Interno: cada workshop tem a lista "a decorrer" e, para os Ligeiros, também
// uma lista própria de trabalhos pendentes a aguardar planeamento.
const WORKSHOPS = [
  { key: 'ligeiros', label: 'Ligeiros', decorrerList: '[Simão] Oficina Ligeiros', planeamentoList: 'Planeamento Interno Ligeiros' },
  { key: 'pesados', label: 'Pesados', decorrerList: '[Simão] Oficina Camiões', planeamentoList: null },
  { key: 'maquinas', label: 'Máquinas', decorrerList: '[Simão] Oficina Máquinas', planeamentoList: null },
];
const PEDREIRAS = [
  { key: 'sta-eulalia', label: 'Sta. Eulália', list: 'S.E. Oficina Sta. Eulália' },
  { key: 'sobrissul', label: 'Sobrissul', list: 'S.E. Oficina Sobrissul' },
  { key: 'cano', label: 'Cano', list: 'S.E. Oficina Cano' },
  { key: 'moleanos', label: 'Moleanos', list: 'S.E. Oficina Moleanos' },
  { key: 'moita-do-poco', label: 'Moita do Poço', list: 'S.E. Oficina Moita do Poço' },
];

const CAT_BLUE = '#2a78d6', CAT_AQUA = '#1baf7a', CAT_YELLOW = '#eda100';
const LABEL_COLOR_MAP = {
  lime: '#0ca30c', orange: '#eb6834', orange_dark: '#d95926',
  purple_dark: '#4a3aa7', red: '#d03b3b', yellow: '#eda100',
  blue: '#2a78d6', sky: '#1baf7a', green: '#008300', green_dark: '#008300',
  pink: '#e87ba4', black: '#52514e', grey: '#898781', none: '#c3c2b7',
};
const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const NO_DATE_SORT = '9999-12-31';

const PAGES = [
  { key: 'index', file: 'index.html', label: 'Visão Geral' },
  { key: 'decorrer-externo', file: 'decorrer-externo.html', label: 'A Decorrer Externo' },
  { key: 'decorrer-interno', file: 'decorrer-interno.html', label: 'A Decorrer Interno' },
  { key: 'pedreiras', file: 'pedreiras.html', label: 'Pedreiras' },
  { key: 'metalomecanica', file: 'metalomecanica.html', label: 'Metalomecânica' },
  { key: 'planeamento-interno', file: 'planeamento-interno.html', label: 'Planeamento Interno' },
];

// ---------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------
function getCreds() {
  return { key: localStorage.getItem('trello_dash_key') || '', token: localStorage.getItem('trello_dash_token') || '' };
}
function setCreds(key, token) {
  localStorage.setItem('trello_dash_key', key);
  localStorage.setItem('trello_dash_token', token);
}

// ---------------------------------------------------------------
// Utils
// ---------------------------------------------------------------
function esc(s) {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function parseDt(iso) { return iso ? new Date(iso) : null; }
function fmtDate(iso) {
  const dt = parseDt(iso);
  if (!dt) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(dt.getUTCDate())}/${p(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}
function daysUntil(iso, now) {
  const dt = parseDt(iso);
  if (!dt) return null;
  return Math.floor((dt - now) / 86400000);
}
function createdFromId(id) {
  const ts = parseInt(id.substring(0, 8), 16);
  return new Date(ts * 1000);
}
function isDivider(name) {
  return /^[▼▲►◄].*[▼▲►◄]$/.test(name.trim());
}
function supplierOf(name) {
  const m = /^\[([^\]]+)\]/.exec(name.trim());
  return m ? m[1].trim() : null;
}
function daysRunning(card, now) {
  const base = card.start || card.created;
  const dt = parseDt(base);
  if (!dt) return { rd: null, real: false };
  return { rd: Math.floor((now - dt) / 86400000), real: !!card.start };
}
function slug(s) {
  const noAccents = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return noAccents.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sem-etiqueta';
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_PT[parseInt(m,10)-1]}/${y.slice(2)}`;
}

// ---------------------------------------------------------------
// Chart builders (SVG strings). `link` (optional, per-datum) makes that bar clickable.
// ---------------------------------------------------------------
function hbarChart(data, colors, opts) {
  // data: [ [label, value, link|null], ... ] — link may be omitted (2-tuples ok too)
  opts = opts || {};
  const width = opts.width || 560, barH = opts.barH || 20, gap = opts.gap || 14;
  const maxV = Math.max(1, ...data.map(d => d[1]));
  const labelW = opts.labelW || 150, plotW = width - labelW - 46, rowH = barH + gap;
  const height = rowH * data.length + 8;
  let rows = '';
  data.forEach((d, i) => {
    const [label, v, link] = d;
    const y = i * rowH + 8;
    const w = Math.max(2, plotW * v / maxV);
    const color = Array.isArray(colors) ? colors[i] : colors;
    const inner = `
      <text x="${labelW - 10}" y="${y + barH / 2 + 4}" text-anchor="end" class="bar-label">${esc(label)}</text>
      <rect x="${labelW}" y="${y}" width="${plotW}" height="${barH}" class="bar-track"/>
      <rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="4" class="bar-fill" style="fill:${color}"/>
      <text x="${(labelW + w + 8).toFixed(1)}" y="${y + barH / 2 + 4}" class="bar-value">${v}</text>`;
    rows += link ? `<a href="${esc(link)}" class="bar-link"><title>Ver ${esc(label)}</title>${inner}</a>` : inner;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="gráfico de barras">${rows}</svg>`;
}

function lineChart(points, opts) {
  opts = opts || {};
  const width = opts.width || 760, height = opts.height || 220, unit = opts.unit || 'dias';
  const padL = 36, padR = 16, padT = 20, padB = 28;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const vals = points.map(p => p[1]);
  const rawMax = Math.max(...vals) * 1.15;
  const stepUnit = rawMax <= 40 ? 5 : (rawMax <= 100 ? 10 : 25);
  const maxV = (Math.floor(rawMax / stepUnit) + 1) * stepUnit;
  const n = points.length;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const xy = (i, v) => [padL + step * i, padT + plotH - (v / maxV) * plotH];
  const coords = points.map((p, i) => xy(i, p[1]));
  const pathD = 'M ' + coords.map(c => `${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' L ');
  const areaD = pathD + ` L ${coords[n-1][0].toFixed(1)} ${(padT+plotH).toFixed(1)} L ${coords[0][0].toFixed(1)} ${(padT+plotH).toFixed(1)} Z`;
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const gy = padT + plotH - (g / 4) * plotH;
    const gval = Math.round(maxV * g / 4);
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${width - padR}" y2="${gy.toFixed(1)}" class="grid-line"/>`;
    grid += `<text x="${padL - 8}" y="${(gy+3).toFixed(1)}" text-anchor="end" class="axis-label">${gval}</text>`;
  }
  let xlabels = '';
  points.forEach((p, i) => {
    if (i % 2 === 0 || i === n - 1) {
      xlabels += `<text x="${coords[i][0].toFixed(1)}" y="${height - 8}" text-anchor="middle" class="axis-label">${esc(p[0])}</text>`;
    }
  });
  let dots = '';
  coords.forEach((c, i) => {
    const isLast = i === n - 1;
    const r = isLast ? 5 : 4;
    dots += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r}" class="line-dot"><title>${esc(points[i][0])}: ${points[i][1]} ${unit}</title></circle>`;
  });
  const endLabel = `<text x="${coords[n-1][0].toFixed(1)}" y="${(coords[n-1][1]-12).toFixed(1)}" text-anchor="end" class="line-end-label">${points[n-1][1]} ${unit}</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="tendência">
    ${grid}<path d="${areaD}" class="area-fill"/><path d="${pathD}" class="line-path"/>${dots}${endLabel}${xlabels}</svg>`;
}

// ---------------------------------------------------------------
// Table builders
// ---------------------------------------------------------------
function labelChip(l) {
  if (!l.name) return '';
  const hexc = LABEL_COLOR_MAP[l.color] || '#c3c2b7';
  return `<span class="chip" style="--chip:${hexc}">${esc(l.name)}</span>`;
}
function runningDaysCell(card, now) {
  const { rd, real } = daysRunning(card, now);
  if (rd === null) return '<td data-sort="-1">—</td>';
  let cls = '';
  if (rd >= 60) cls = ' class="days-critical"';
  else if (rd >= 30) cls = ' class="days-warning"';
  const tag = real ? '' : '<span class="approx">*</span>';
  return `<td data-sort="${rd}"${cls}>${rd}d${tag}</td>`;
}
function tableHeader({ showStart, showCreated, showRunning } = {}) {
  let cols = [['Nº', 'num'], ['Cartão', 'text']];
  if (showCreated) cols.push(['Criado em', 'text']);
  if (showStart) cols.push(['Início', 'text']);
  if (showRunning) cols.push(['Dias a decorrer', 'num']);
  cols.push(['Prazo', 'text'], ['Etiquetas', 'text']);
  return '<tr>' + cols.map(([c, t]) => `<th data-type="${t}">${c}</th>`).join('') + '</tr>';
}
function cardRows(cards, opts) {
  opts = opts || {};
  const now = opts.now;
  let items = cards.slice();
  if (opts.sortByDue !== false) {
    items.sort((a, b) => {
      const av = a.due === null ? 1 : 0, bv = b.due === null ? 1 : 0;
      if (av !== bv) return av - bv;
      return (a.due || '').localeCompare(b.due || '');
    });
  }
  return items.map(c => {
    let overdue = false;
    if (c.due && !c.dueComplete) {
      const dleft = daysUntil(c.due, now);
      overdue = dleft !== null && dleft < 0;
    }
    let dueHtml = '—', dueSort = NO_DATE_SORT;
    if (c.due) {
      const d = fmtDate(c.due);
      dueHtml = overdue ? `<span class="overdue">${d} · atrasado</span>` : d;
      dueSort = c.due.substring(0, 10);
    }
    const startCol = opts.showStart ? `<td data-sort="${c.start ? c.start.substring(0,10) : NO_DATE_SORT}">${fmtDate(c.start)}</td>` : '';
    const createdCol = opts.showCreated ? `<td data-sort="${(c.created||'').substring(0,10) || NO_DATE_SORT}">${fmtDate(c.created)}</td>` : '';
    const runningCol = opts.showRunning ? runningDaysCell(c, now) : '';
    const labelsText = c.labels.map(l => l.name).join(', ');
    const labelsHtml = c.labels.map(labelChip).join('');
    return `<tr>
      <td class="col-id" data-sort="${c.id}">#${c.id}</td>
      <td data-sort="${esc(c.name.toLowerCase())}"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a></td>
      ${createdCol}${startCol}${runningCol}
      <td data-sort="${dueSort}">${dueHtml}</td>
      <td data-sort="${esc(labelsText.toLowerCase())}">${labelsHtml}</td>
    </tr>`;
  }).join('\n');
}
function cardTable(cards, opts) {
  if (!cards.length) return '<p class="info-note">Sem cartões nesta lista de momento.</p>';
  return `<table><thead>${tableHeader(opts)}</thead><tbody>${cardRows(cards, opts)}</tbody></table>`;
}

// ---------------------------------------------------------------
// Process raw Trello board JSON into the shape the renderers need.
// Lists are matched by NAME — a list not found on the board yields an empty array
// (never crashes), so a renamed/missing list just shows 0 cards instead of breaking.
// ---------------------------------------------------------------
function processBoard(data, now) {
  const idByName = {};
  (data.lists || []).forEach(l => { idByName[l.name] = l.id; });
  const cards = data.cards || [];

  function cardBrief(c) {
    const labels = (c.labels || []).filter(l => l.name).map(l => ({ name: l.name, color: l.color }));
    return {
      id: c.idShort, name: c.name, due: c.due, dueComplete: c.dueComplete,
      start: c.start, created: createdFromId(c.id).toISOString(),
      url: c.shortUrl, labels, supplier: supplierOf(c.name),
    };
  }
  function openCardsInName(listName) {
    const id = idByName[listName];
    if (!id) return [];
    return cards.filter(c => c.idList === id && !c.closed && !isDivider(c.name)).map(cardBrief);
  }

  const decorrerExterno = openCardsInName(LIST_NAME.decorrerExterno);
  const metalomecanica = openCardsInName(LIST_NAME.metalomecanica);
  const planeamentoInterno = openCardsInName(LIST_NAME.planeamentoInterno);

  const workshops = WORKSHOPS.map(w => ({
    ...w,
    decorrer: openCardsInName(w.decorrerList),
    planeamento: w.planeamentoList ? openCardsInName(w.planeamentoList) : [],
  }));

  const pedreiras = PEDREIRAS.map(p => ({ ...p, cards: openCardsInName(p.list) }));

  // resolution stats — over ALL cards on the board with both start & dateCompleted
  const durations = [];
  const monthly = {};
  cards.forEach(c => {
    const s = parseDt(c.start), dc = parseDt(c.dateCompleted);
    if (s && dc && dc > s) {
      const d = (dc - s) / 86400000;
      durations.push(d);
      const key = `${dc.getUTCFullYear()}-${String(dc.getUTCMonth()+1).padStart(2,'0')}`;
      (monthly[key] = monthly[key] || []).push(d);
    }
  });
  durations.sort((a, b) => a - b);
  const mean = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
  const mid = Math.floor(durations.length / 2);
  const median = durations.length ? (durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2) : 0;
  const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
  const monthlyAvgAll = Object.keys(monthly).sort().map(k => [k, monthly[k].reduce((a,b)=>a+b,0) / monthly[k].length]);
  const monthlyAvgLast14 = monthlyAvgAll.slice(-14);

  return {
    boardName: data.name,
    decorrerExterno, metalomecanica, planeamentoInterno, workshops, pedreiras,
    resolution: { count: durations.length, mean, median, p90, monthlyAvgLast14 },
    totals: {
      totalOpen: cards.filter(c => !c.closed).length,
      totalClosed: cards.filter(c => c.closed).length,
      totalAll: cards.length,
    },
  };
}

// ---------------------------------------------------------------
// Shared page chrome: header, toolbar, nav
// ---------------------------------------------------------------
function pageChrome(activeKey) {
  const nav = PAGES.map(p => `<a href="${p.file}" class="${p.key === activeKey ? 'active' : ''}">${esc(p.label)}</a>`).join('');
  return `
    <header class="top">
      <h1><a href="index.html">Dashboard Oficina — Trello</a></h1>
      <p>Liga-se diretamente à API do Trello a partir deste browser · atualiza sempre que abrires a página ou clicares em "Atualizar agora"</p>
    </header>
    <div class="toolbar">
      <span class="status" id="status"><span class="dot-live" id="statusDot"></span><span id="statusText">Por configurar</span></span>
      <button id="btnUpdate">Atualizar agora</button>
      <button id="btnCreds">Configurar chave/token</button>
    </div>
    <nav class="pages">${nav}</nav>
    <div id="content"></div>
    <div id="modalRoot"></div>
  `;
}

function wireSorting(root) {
  (root || document).querySelectorAll('table').forEach(table => {
    const thead = table.querySelector('thead'), tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;
    const ths = Array.from(thead.querySelectorAll('th'));
    ths.forEach((th, idx) => {
      th.addEventListener('click', () => {
        const dir = th.classList.contains('sort-asc') ? 'desc' : 'asc';
        ths.forEach(h => h.classList.remove('sort-asc','sort-desc'));
        th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
        const type = th.dataset.type || 'text';
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a,b) => {
          const ca=a.children[idx], cb=b.children[idx];
          const av = ca ? (ca.dataset.sort ?? ca.textContent.trim().toLowerCase()) : '';
          const bv = cb ? (cb.dataset.sort ?? cb.textContent.trim().toLowerCase()) : '';
          let cmp;
          if (type === 'num') cmp = (parseFloat(av)||0) - (parseFloat(bv)||0);
          else cmp = av < bv ? -1 : (av > bv ? 1 : 0);
          return dir === 'asc' ? cmp : -cmp;
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  });
}

// ---------------------------------------------------------------
// Fetch / cache / credentials / bootstrap — shared by every page
// ---------------------------------------------------------------
function setStatus(state, text) {
  const dot = document.getElementById('statusDot'), txt = document.getElementById('statusText');
  if (dot) dot.className = 'dot-live ' + (state || '');
  if (txt) txt.textContent = text;
}
function showEmptyState(msg) {
  const el = document.getElementById('content');
  if (el) el.innerHTML = `<div class="empty-state">${esc(msg)}</div>`;
}
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.data;
  } catch (e) { return null; }
}
function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); }
  catch (e) { /* quota or private mode — ignore, just skip caching */ }
}

let renderCallback = null; // set by each page via initPage()

async function fetchAndRender(force) {
  const { key, token } = getCreds();
  if (!key || !token) { openCredsModal(); return; }
  if (!force) {
    const cached = readCache();
    if (cached) {
      const now = new Date();
      renderCallback(processBoard(cached, now), now);
      setStatus('ok', 'Dados em cache (< 3 min) — clica "Atualizar agora" para forçar');
      return;
    }
  }
  setStatus('', 'A atualizar…');
  try {
    const url = `https://api.trello.com/1/boards/${BOARD_ID}?fields=name,url&lists=all&list_fields=${LIST_FIELDS}&cards=all&card_fields=${CARD_FIELDS}&key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    writeCache(data);
    const now = new Date();
    renderCallback(processBoard(data, now), now);
    setStatus('ok', 'Atualizado às ' + now.toLocaleString('pt-PT'));
  } catch (err) {
    console.error(err);
    setStatus('err', 'Falha ao ligar à API do Trello (' + err.message + ')');
    showEmptyState('Não foi possível ir buscar os dados diretamente (pode ser um bloqueio de CORS do browser, ou a key/token estarem inválidos). Podes tentar "Configurar chave/token" para verificar as credenciais, ou usar a alternativa de colar o JSON exportado manualmente nesse mesmo painel.');
  }
}

function openCredsModal() {
  const { key, token } = getCreds();
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">
        <h3>Ligar ao Trello</h3>
        <p>A key e o token ficam guardados só neste browser (localStorage), partilhados entre todas as páginas deste site, nunca enviados para mais lado nenhum além da API do Trello. Obtém em <a href="https://trello.com/power-ups/admin/api-key" target="_blank" rel="noopener">trello.com/power-ups/admin/api-key</a>.</p>
        <label>API Key</label>
        <input id="inpKey" type="text" value="${esc(key)}" placeholder="a tua API key">
        <label>Token</label>
        <input id="inpToken" type="text" value="${esc(token)}" placeholder="o teu token">
        <div class="row">
          <button class="primary" id="btnSaveCreds">Guardar e atualizar</button>
          <button id="btnCancelCreds">Cancelar</button>
        </div>
        <div class="hint">
          Se a ligação direta falhar (bloqueio de CORS do browser), cola aqui o JSON exportado manualmente:
          <textarea id="inpJson" placeholder="cola aqui o JSON do export, se necessário"></textarea>
          <div class="row"><button id="btnLoadJson">Carregar deste JSON</button></div>
        </div>
      </div>
    </div>`;
  document.getElementById('btnCancelCreds').onclick = () => { document.getElementById('modalRoot').innerHTML = ''; };
  document.getElementById('backdrop').addEventListener('click', e => { if (e.target.id === 'backdrop') document.getElementById('modalRoot').innerHTML = ''; });
  document.getElementById('btnSaveCreds').onclick = () => {
    const k = document.getElementById('inpKey').value.trim();
    const t = document.getElementById('inpToken').value.trim();
    setCreds(k, t);
    document.getElementById('modalRoot').innerHTML = '';
    fetchAndRender(true);
  };
  document.getElementById('btnLoadJson').onclick = () => {
    const txt = document.getElementById('inpJson').value.trim();
    if (!txt) return;
    try {
      const data = JSON.parse(txt);
      writeCache(data);
      const now = new Date();
      renderCallback(processBoard(data, now), now);
      setStatus('ok', 'Carregado manualmente às ' + now.toLocaleString('pt-PT'));
      document.getElementById('modalRoot').innerHTML = '';
    } catch (err) {
      alert('JSON inválido: ' + err.message);
    }
  };
}

// Every page calls this once, passing its own render(P, now) function.
function initPage(activeKey, render) {
  document.getElementById('app').innerHTML = pageChrome(activeKey);
  renderCallback = (P, now) => { render(P, now); wireSorting(document.getElementById('content')); };
  document.getElementById('btnUpdate').addEventListener('click', () => fetchAndRender(true));
  document.getElementById('btnCreds').addEventListener('click', openCredsModal);

  const initial = getCreds();
  if (initial.key && initial.token) {
    fetchAndRender(false);
  } else {
    setStatus('', 'Por configurar');
    showEmptyState('Ainda sem dados. Clica em "Configurar chave/token" para ligar ao teu board do Trello.');
  }
}
