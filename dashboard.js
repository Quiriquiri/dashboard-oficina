// ---------------------------------------------------------------
// Dashboard Oficina — lógica partilhada por todas as páginas
// Config específica deste board (ver claude/trello-dashboard-config.md)
// ---------------------------------------------------------------
const BOARD_ID = 'cARsYBsY';
const CARD_FIELDS = 'name,desc,due,dueComplete,start,dateCompleted,dateLastActivity,closed,idList,idMembers,labels,shortUrl,idShort';
const LIST_FIELDS = 'name,closed';
const BOARD_LABEL_FIELDS = 'all'; // full label palette of the board, for the labels editor
const BOARD_MEMBER_FIELDS = 'fullName,username'; // for the members editor
const CACHE_KEY = 'trello_dash_cache_v2';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min: navegar entre páginas não repete o fetch

// Listas identificadas pelo NOME (não pelo ID) — mais fácil de manter quando o João
// cria/renomeia listas no Trello, só é preciso atualizar este nome.
const LIST_NAME = {
  decorrerExterno: 'Intervenções Externas DECORRER',
  metalomecanica: 'Metalomecanica',
  planeamentoInterno: 'Planeamento Interno',
  concluidos: 'Concluído',
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
const FALTA_DE_PECAS_LABEL = 'Falta de Peças';

const PAGES = [
  { key: 'index', file: 'index.html', label: 'Visão Geral' },
  { key: 'decorrer-externo', file: 'decorrer-externo.html', label: 'A Decorrer Externo' },
  { key: 'decorrer-interno', file: 'decorrer-interno.html', label: 'A Decorrer Interno' },
  { key: 'pedreiras', file: 'pedreiras.html', label: 'Pedreiras' },
  { key: 'metalomecanica', file: 'metalomecanica.html', label: 'Metalomecânica' },
  { key: 'planeamento-interno', file: 'planeamento-interno.html', label: 'Planeamento Interno' },
  { key: 'falta-de-pecas', file: 'falta-de-pecas.html', label: 'Falta de Peças' },
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
function labelsEditableCell(card, boardLabels) {
  const chipsHtml = card.labels.map(labelChip).join('') || '<span class="chips-empty">—</span>';
  if (!boardLabels || !boardLabels.length || !card.trelloId) return chipsHtml;
  const items = boardLabels.map(l => {
    const hexc = LABEL_COLOR_MAP[l.color] || '#c3c2b7';
    const checked = card.labelIds.includes(l.id) ? 'checked' : '';
    return `<label class="labels-popover-item">
      <input type="checkbox" value="${esc(l.id)}" ${checked}>
      <span class="dot" style="--chip:${hexc}"></span>${esc(l.name || '(sem nome)')}
    </label>`;
  }).join('');
  return `
    <span class="chips-display">${chipsHtml}</span>
    <button type="button" class="labels-edit-btn" data-trello-id="${esc(card.trelloId)}" title="Editar etiquetas">+</button>
    <div class="labels-popover" hidden data-trello-id="${esc(card.trelloId)}">
      ${items}
      <div class="labels-popover-footer"><span class="due-status" data-status-for="lbl-${esc(card.trelloId)}"></span></div>
    </div>`;
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
function tableHeader({ showStart, showCreated, showRunning, runningLabel, showLabelAge } = {}) {
  let cols = [['Nº', 'num'], ['Cartão', 'text']];
  if (showCreated) cols.push(['Criado em', 'text']);
  if (showStart) cols.push(['Início', 'text']);
  if (showRunning) cols.push([runningLabel || 'Dias a decorrer', 'num']);
  if (showLabelAge) cols.push(['Com esta etiqueta há', 'num']);
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
    let dueSort = NO_DATE_SORT, dueInputVal = '';
    if (c.due) { dueSort = c.due.substring(0, 10); dueInputVal = dueSort; }
    const overdueBadge = overdue ? '<span class="overdue-badge">atrasado</span>' : '';
    const completeBtn = c.trelloId ? `<button type="button" class="due-complete-btn${c.dueComplete ? ' active' : ''}" data-trello-id="${esc(c.trelloId)}" title="${c.dueComplete ? 'Reabrir (desmarcar concluído)' : 'Marcar prazo como concluído'}">${c.dueComplete ? '✓' : '○'}</button>` : '';
    const dueCellHtml = c.trelloId ? `
      <input type="date" class="due-input" data-trello-id="${esc(c.trelloId)}" value="${dueInputVal}">
      <button type="button" class="due-clear" data-trello-id="${esc(c.trelloId)}" title="Limpar prazo">×</button>
      ${completeBtn}
      <span class="due-status" data-status-for="${esc(c.trelloId)}"></span>
      ${overdueBadge}` : (c.due ? fmtDate(c.due) : '—');
    const startSort = c.start ? c.start.substring(0,10) : NO_DATE_SORT;
    const startInputVal = c.start ? c.start.substring(0,10) : '';
    const startCellHtml = c.trelloId ? `
      <input type="date" class="start-input" data-trello-id="${esc(c.trelloId)}" value="${startInputVal}">
      <button type="button" class="start-clear" data-trello-id="${esc(c.trelloId)}" title="Limpar início">×</button>
      <span class="due-status" data-status-for="start-${esc(c.trelloId)}"></span>` : fmtDate(c.start);
    const startCol = opts.showStart ? `<td class="start-cell" data-sort="${startSort}">${startCellHtml}</td>` : '';
    const createdCol = opts.showCreated ? `<td data-sort="${(c.created||'').substring(0,10) || NO_DATE_SORT}">${fmtDate(c.created)}</td>` : '';
    const runningCol = opts.showRunning ? runningDaysCell(c, now) : '';
    const labelAgeCol = opts.showLabelAge ? `<td class="label-age-cell" data-trello-id="${esc(c.trelloId)}" data-sort="-1">A calcular…</td>` : '';
    const labelsText = c.labels.map(l => l.name).join(', ');
    const labelsCellHtml = labelsEditableCell(c, opts.boardLabels);
    const editBtn = c.trelloId ? `<button type="button" class="card-edit-btn" data-trello-id="${esc(c.trelloId)}" title="Editar cartão (nome, descrição, lista, membros, arquivar)">✎</button>` : '';
    const memberNames = (c.idMembers || []).map(id => {
      const m = (opts.boardMembers || []).find(x => x.id === id);
      return m ? m.fullName : null;
    }).filter(Boolean);
    const membersLine = memberNames.length ? `<div class="card-members">${esc(memberNames.join(', '))}</div>` : '';
    return `<tr>
      <td class="col-id" data-sort="${c.id}">#${c.id}</td>
      <td data-sort="${esc(c.name.toLowerCase())}"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>${editBtn}${membersLine}</td>
      ${createdCol}${startCol}${runningCol}${labelAgeCol}
      <td data-sort="${dueSort}" class="due-cell">${dueCellHtml}</td>
      <td data-sort="${esc(labelsText.toLowerCase())}" class="labels-cell">${labelsCellHtml}</td>
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
    const labelIds = (c.labels || []).map(l => l.id); // unfiltered — includes unnamed labels, for the editor's checked state
    return {
      id: c.idShort, trelloId: c.id, name: c.name, desc: c.desc || '', due: c.due, dueComplete: c.dueComplete,
      start: c.start, created: createdFromId(c.id).toISOString(), idList: c.idList, idMembers: c.idMembers || [],
      url: c.shortUrl, labels, labelIds, supplier: supplierOf(c.name),
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

  // Falta de Peças — cartões ativos com esta etiqueta em QUALQUER lista do board (não só nas
  // listas seguidas nominalmente acima), para a página dedicada "Falta de Peças". Excluídos os
  // cartões já na lista "Concluído" — já foram resolvidos, mesmo que a etiqueta tenha ficado lá.
  const concluidosId = idByName[LIST_NAME.concluidos];
  const faltaDePecas = cards
    .filter(c => !c.closed && !isDivider(c.name) && c.idList !== concluidosId
      && (c.labels || []).some(l => l.name === FALTA_DE_PECAS_LABEL))
    .map(cardBrief);

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

  const boardLabels = (data.labels || []).map(l => ({ id: l.id, name: l.name, color: l.color }));
  const boardMembers = (data.members || []).map(m => ({ id: m.id, fullName: m.fullName || m.username || '(sem nome)' }));
  const allLists = (data.lists || []).filter(l => !l.closed).map(l => ({ id: l.id, name: l.name }));

  // flat index of every card object we produced, keyed by Trello id — used by the
  // "editar cartão" modal to look up full details (desc, idList, idMembers, …) from just an id.
  const cardsById = {};
  [decorrerExterno, metalomecanica, planeamentoInterno, faltaDePecas,
    ...workshops.flatMap(w => [w.decorrer, w.planeamento]),
    ...pedreiras.map(p => p.cards)]
    .flat()
    .forEach(c => { cardsById[c.trelloId] = c; });

  return {
    boardName: data.name,
    decorrerExterno, metalomecanica, planeamentoInterno, workshops, pedreiras, faltaDePecas, boardLabels,
    boardMembers, allLists, cardsById,
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
// Core write path — every editable field (Prazo, Início, Etiquetas, Concluir,
// Nome, Descrição, Lista, Membros, Arquivar) goes through this same pair of
// functions: one PUT to the real Trello card endpoint, then (on success) a
// patch of the locally-cached board JSON followed by a full in-place re-render
// from that cache — no extra network round-trip, and it means every derived
// view (which section a card sits in, sort order, label groupings, "dias a
// decorrer") recomputes correctly instead of drifting out of sync.
// Requires a token with write scope (see openCredsModal). Untested against the
// live Trello API from the environment that built this (no network access there) —
// if a save fails, the error shows inline; the card's own Trello link still works
// as a fallback way to make the same change by hand.
// ---------------------------------------------------------------
async function patchTrelloCard(trelloId, fields, statusEl) {
  const { key, token } = getCreds();
  if (!key || !token) { openCredsModal(); return false; }
  if (statusEl) { statusEl.textContent = 'A gravar…'; statusEl.className = 'due-status saving'; }
  try {
    const params = new URLSearchParams({ key, token });
    Object.keys(fields).forEach(k => {
      let v = fields[k];
      if (v === null || v === undefined) v = 'null';
      else if (Array.isArray(v)) v = v.join(',');
      else if (typeof v === 'boolean') v = v ? 'true' : 'false';
      params.set(k, v);
    });
    const url = `https://api.trello.com/1/cards/${trelloId}?${params.toString()}`;
    const resp = await fetch(url, { method: 'PUT' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return true;
  } catch (err) {
    console.error(err);
    if (statusEl) { statusEl.textContent = 'Falha ao gravar'; statusEl.className = 'due-status err'; }
    return false;
  }
}
function patchCachedCard(trelloId, fields) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const card = (obj.data.cards || []).find(c => c.id === trelloId);
    if (card) Object.assign(card, fields);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) { /* ignore — worst case the next full refresh catches up */ }
}
function rerenderFromCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw || !renderCallback) return;
    const cached = JSON.parse(raw).data;
    const now = new Date();
    renderCallback(processBoard(cached, now), now);
  } catch (e) { /* ignore */ }
}
// putFields: exact query params sent to Trello's PUT /1/cards/{id}.
// cachePatch (optional): how to patch the locally-cached raw card object, when it
// differs in shape from putFields (only "Etiquetas" needs this — Trello's write
// param is idLabels, an id list, but the cached card stores full label objects).
async function saveCardField(trelloId, putFields, statusEl, cachePatch) {
  const ok = await patchTrelloCard(trelloId, putFields, statusEl);
  if (ok) { patchCachedCard(trelloId, cachePatch || putFields); rerenderFromCache(); }
  return ok;
}

// ---------------------------------------------------------------
// Editable "Prazo" (due date) + "Concluir" toggle
// ---------------------------------------------------------------
function wireDueEditing(root) {
  const scope = root || document;
  scope.querySelectorAll('input.due-input').forEach(input => {
    input.addEventListener('change', () => {
      const trelloId = input.dataset.trelloId;
      const cell = input.closest('td.due-cell');
      const statusEl = cell ? cell.querySelector('.due-status') : null;
      const iso = input.value ? new Date(input.value + 'T12:00:00Z').toISOString() : null;
      saveCardField(trelloId, { due: iso }, statusEl);
    });
  });
  scope.querySelectorAll('button.due-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const trelloId = btn.dataset.trelloId;
      const cell = btn.closest('td.due-cell');
      const statusEl = cell ? cell.querySelector('.due-status') : null;
      saveCardField(trelloId, { due: null }, statusEl);
    });
  });
  scope.querySelectorAll('button.due-complete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const trelloId = btn.dataset.trelloId;
      const cell = btn.closest('td.due-cell');
      const statusEl = cell ? cell.querySelector('.due-status') : null;
      const newVal = !btn.classList.contains('active');
      saveCardField(trelloId, { dueComplete: newVal }, statusEl);
    });
  });
}

// ---------------------------------------------------------------
// Editable "Início" (start date) — same shape as Prazo, own field on the card.
// ---------------------------------------------------------------
function wireStartEditing(root) {
  const scope = root || document;
  scope.querySelectorAll('input.start-input').forEach(input => {
    input.addEventListener('change', () => {
      const trelloId = input.dataset.trelloId;
      const cell = input.closest('td.start-cell');
      const statusEl = cell ? cell.querySelector('.due-status') : null;
      const iso = input.value ? new Date(input.value + 'T12:00:00Z').toISOString() : null;
      saveCardField(trelloId, { start: iso }, statusEl);
    });
  });
  scope.querySelectorAll('button.start-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const trelloId = btn.dataset.trelloId;
      const cell = btn.closest('td.start-cell');
      const statusEl = cell ? cell.querySelector('.due-status') : null;
      saveCardField(trelloId, { start: null }, statusEl);
    });
  });
}

// ---------------------------------------------------------------
// Editable "Etiquetas" (labels) — a popover with every board label as a checkbox;
// each toggle replaces the card's full label set via a single PUT.
// ---------------------------------------------------------------
function wireLabelEditing(root, boardLabels) {
  const scope = root || document;
  scope.querySelectorAll('button.labels-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cell = btn.closest('td.labels-cell');
      const popover = cell ? cell.querySelector('.labels-popover') : null;
      const isHidden = popover.hidden;
      scope.querySelectorAll('.labels-popover').forEach(p => { p.hidden = true; });
      if (popover) popover.hidden = !isHidden;
    });
  });
  scope.querySelectorAll('.labels-popover input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const popover = cb.closest('.labels-popover');
      const trelloId = popover.dataset.trelloId;
      const statusEl = popover.querySelector('.due-status');
      const idLabelsArray = Array.from(popover.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
      const chosenLabelObjs = boardLabels.filter(l => idLabelsArray.includes(l.id));
      saveCardField(trelloId, { idLabels: idLabelsArray }, statusEl, { labels: chosenLabelObjs });
    });
  });
  // close any open popover on an outside click
  if (!wireLabelEditing._outsideBound) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.labels-popover') || e.target.closest('.labels-edit-btn')) return;
      document.querySelectorAll('.labels-popover').forEach(p => { p.hidden = true; });
    });
    wireLabelEditing._outsideBound = true;
  }
}

// ---------------------------------------------------------------
// "Editar cartão" modal — Nome, Descrição, Lista (mover cartão), Membros, e
// Arquivar. Opened from the "✎" button next to the card name. All fields save
// together in a single PUT when "Guardar alterações" is clicked.
// ---------------------------------------------------------------
function openCardEditModal(trelloId, P) {
  const card = (P.cardsById || {})[trelloId];
  if (!card) return;
  const lists = P.allLists || [];
  const members = P.boardMembers || [];
  const listOptions = lists.map(l => `<option value="${esc(l.id)}" ${l.id === card.idList ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  const memberItems = members.length ? members.map(m => {
    const checked = (card.idMembers || []).includes(m.id) ? 'checked' : '';
    return `<label><input type="checkbox" value="${esc(m.id)}" ${checked}>${esc(m.fullName)}</label>`;
  }).join('') : '<p class="info-note">Sem membros neste board.</p>';

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" id="cardBackdrop">
      <div class="modal modal-wide">
        <h3>Editar cartão</h3>
        <p><a href="${esc(card.url)}" target="_blank" rel="noopener">Abrir no Trello ↗</a></p>
        <label>Nome</label>
        <input id="editName" type="text" value="${esc(card.name)}">
        <label>Descrição</label>
        <textarea id="editDesc">${esc(card.desc || '')}</textarea>
        <label>Lista (mover cartão)</label>
        <select id="editList">${listOptions}</select>
        <label>Início</label>
        <input id="editStart" type="date" value="${card.start ? card.start.substring(0,10) : ''}">
        <label>Membros</label>
        <div class="modal-checklist">${memberItems}</div>
        <span class="due-status" id="cardEditStatus"></span>
        <div class="row">
          <button class="primary" id="btnSaveCard">Guardar alterações</button>
          <button id="btnCancelCard">Cancelar</button>
        </div>
        <div class="archive-row">
          <button id="btnArchiveCard" class="btn-danger">Arquivar cartão</button>
          <p class="info-note">Deixa de aparecer no dashboard e nas listas ativas do Trello, mas não é apagado — continua acessível e pode ser restaurado a partir do Trello.</p>
        </div>
      </div>
    </div>`;

  const close = () => { document.getElementById('modalRoot').innerHTML = ''; };
  document.getElementById('btnCancelCard').onclick = close;
  document.getElementById('cardBackdrop').addEventListener('click', e => { if (e.target.id === 'cardBackdrop') close(); });

  document.getElementById('btnSaveCard').onclick = async () => {
    const statusEl = document.getElementById('cardEditStatus');
    const name = document.getElementById('editName').value.trim();
    if (!name) { statusEl.textContent = 'O nome não pode ficar vazio.'; statusEl.className = 'due-status err'; return; }
    const desc = document.getElementById('editDesc').value;
    const idList = document.getElementById('editList').value;
    const startVal = document.getElementById('editStart').value;
    const start = startVal ? new Date(startVal + 'T12:00:00Z').toISOString() : null;
    const idMembers = Array.from(document.querySelectorAll('#modalRoot .modal-checklist input:checked')).map(i => i.value);
    const ok = await saveCardField(trelloId, { name, desc, idList, start, idMembers }, statusEl);
    if (ok) close();
  };
  document.getElementById('btnArchiveCard').onclick = async () => {
    if (!confirm('Arquivar este cartão? Deixa de aparecer nas listas ativas (não é apagado — dá para restaurar no Trello).')) return;
    const statusEl = document.getElementById('cardEditStatus');
    const ok = await saveCardField(trelloId, { closed: true }, statusEl);
    if (ok) close();
  };
}

function wireCardEditing(root, P) {
  const scope = root || document;
  scope.querySelectorAll('button.card-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardEditModal(btn.dataset.trelloId, P);
    });
  });
}

// ---------------------------------------------------------------
// "Com esta etiqueta há" (label ageing) — só usado na página Falta de Peças.
// O Trello não devolve "desde quando um cartão tem uma etiqueta" no fetch normal do
// board; para isso é preciso ir ao histórico de atividade de CADA cartão
// (GET /1/cards/{id}/actions?filter=addLabelToCard,removeLabelToCard), um pedido por
// cartão. Como esta página só lista cartões com a etiqueta "Falta de Peças" (um
// subconjunto pequeno do board, não todos os milhares de cartões), isto é viável — os
// pedidos correm com um limite de concorrência para não sobrecarregar a API do Trello.
// Resultado: para cada cartão, a data do "addLabelToCard" mais recente para essa
// etiqueta específica. Se o histórico não tiver esse evento (por exemplo, fora da
// janela de retenção de atividade do Trello), usa a data de criação do cartão como
// limite inferior aproximado, assinalado com "*" — o mesmo padrão já usado em "Dias a
// decorrer" quando falta a data de início real.
// ---------------------------------------------------------------
function labelAgeingCacheKey(labelId) { return `trello_label_age_v1_${labelId}`; }
function readLabelAgeingCache(labelId) {
  try {
    const raw = sessionStorage.getItem(labelAgeingCacheKey(labelId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.data;
  } catch (e) { return null; }
}
function writeLabelAgeingCache(labelId, data) {
  try { sessionStorage.setItem(labelAgeingCacheKey(labelId), JSON.stringify({ ts: Date.now(), data })); }
  catch (e) { /* ignore */ }
}
async function fetchLabelAgeing(cards, labelId, key, token) {
  const results = {};
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (idx < cards.length) {
      const card = cards[idx++];
      try {
        const params = new URLSearchParams({ key, token, filter: 'addLabelToCard,removeLabelToCard', limit: '30' });
        const resp = await fetch(`https://api.trello.com/1/cards/${card.trelloId}/actions?${params.toString()}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const actions = await resp.json();
        // Trello devolve as ações mais recentes primeiro — a primeira que bate certo com
        // esta etiqueta é o estado mais recente (adicionada ou removida).
        const latest = actions.find(a => a.data && a.data.label && a.data.label.id === labelId);
        if (latest && latest.type === 'addLabelToCard') {
          results[card.trelloId] = { since: latest.date, approx: false };
        } else {
          results[card.trelloId] = { since: card.created, approx: true };
        }
      } catch (err) {
        console.error('falha ao ir buscar o histórico da etiqueta para', card.trelloId, err);
        results[card.trelloId] = { since: card.created, approx: true };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cards.length) }, worker));
  return results;
}
function applyLabelAgeing(cells, results, now) {
  cells.forEach(td => {
    const r = results[td.dataset.trelloId];
    if (!r || !r.since) { td.textContent = '—'; td.dataset.sort = -1; return; }
    const days = Math.floor((now - new Date(r.since)) / 86400000);
    let cls = 'label-age-cell';
    if (days >= 60) cls += ' days-critical'; else if (days >= 30) cls += ' days-warning';
    td.className = cls;
    td.dataset.sort = days;
    td.innerHTML = `${days}d${r.approx ? '<span class="approx">*</span>' : ''}`;
  });
}
// Chamado pela própria página falta-de-pecas.html depois de render(). Não faz parte do
// pipeline genérico de initPage() porque só esta página tem a coluna "Com esta etiqueta há".
async function wireLabelAgeing(P, now) {
  const cells = document.querySelectorAll('td.label-age-cell');
  if (!cells.length) return;
  const statusEl = document.getElementById('ageingStatus');
  const { key, token } = getCreds();
  if (!key || !token) {
    if (statusEl) statusEl.textContent = 'Sem key/token configurados — não é possível calcular há quanto tempo cada cartão tem a etiqueta (os restantes dados vieram do JSON carregado manualmente).';
    return;
  }
  const targetLabel = (P.boardLabels || []).find(l => l.name === FALTA_DE_PECAS_LABEL);
  if (!targetLabel) { if (statusEl) statusEl.remove(); return; }

  const cached = readLabelAgeingCache(targetLabel.id);
  if (cached) {
    applyLabelAgeing(cells, cached, now);
    if (statusEl) statusEl.remove();
    return;
  }
  try {
    const results = await fetchLabelAgeing(P.faltaDePecas || [], targetLabel.id, key, token);
    writeLabelAgeingCache(targetLabel.id, results);
    applyLabelAgeing(document.querySelectorAll('td.label-age-cell'), results, now);
    if (statusEl) statusEl.remove();
    // ordena por "há mais tempo com a etiqueta" por omissão, assim que os dados chegam
    const table = document.querySelector('td.label-age-cell') ? document.querySelector('td.label-age-cell').closest('table') : null;
    const th = table ? Array.from(table.querySelectorAll('thead th')).find(h => h.textContent.trim().startsWith('Com esta etiqueta')) : null;
    if (th) { th.click(); th.click(); }
  } catch (err) {
    console.error(err);
    if (statusEl) { statusEl.textContent = 'Não foi possível calcular há quanto tempo cada cartão tem a etiqueta (falha ao consultar o histórico do Trello).'; }
  }
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
    const url = `https://api.trello.com/1/boards/${BOARD_ID}?fields=name,url&lists=all&list_fields=${LIST_FIELDS}&cards=all&card_fields=${CARD_FIELDS}&labels=all&label_fields=${BOARD_LABEL_FIELDS}&members=all&member_fields=${BOARD_MEMBER_FIELDS}&key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
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
        <p>A key e o token ficam guardados só neste browser (localStorage), partilhados entre todas as páginas deste site, nunca enviados para mais lado nenhum além da API do Trello. Obtém a key em <a href="https://trello.com/power-ups/admin/api-key" target="_blank" rel="noopener">trello.com/power-ups/admin/api-key</a>.</p>
        <p><strong>Para poder editar cartões</strong> (Prazo, Início, Concluir, Etiquetas, Nome, Descrição, mover de lista, Membros, Arquivar), o token precisa de permissão de escrita — gera-o com este link (substitui SUA_API_KEY pela key acima): <br>
        <code style="font-size:10px; word-break:break-all;">https://trello.com/1/authorize?expiration=30days&scope=read,write&response_type=token&key=SUA_API_KEY</code><br>
        Um token só de leitura (scope=read) continua a mostrar os dados, mas qualquer alteração falha.</p>
        <label>API Key</label>
        <input id="inpKey" type="text" value="${esc(key)}" placeholder="a tua API key">
        <label>Token</label>
        <input id="inpToken" type="text" value="${esc(token)}" placeholder="o teu token (com permissão de escrita)">
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
  renderCallback = (P, now) => {
    render(P, now);
    const contentEl = document.getElementById('content');
    wireSorting(contentEl);
    wireDueEditing(contentEl);
    wireStartEditing(contentEl);
    wireLabelEditing(contentEl, P.boardLabels || []);
    wireCardEditing(contentEl, P);
  };
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
