/* =============================================================
   Autodarts League — Popup Script
   Talks to the Spring Boot backend at localhost:8080
   ============================================================= */

const API = 'http://localhost:8080/api';

// ── State ─────────────────────────────────────────────────────
const s = {
  view: 'landing',
  activeTournamentId: null,
  tournament: null,
  fixtures: [],
  standings: [],
  nextFixture: null,
  // setup
  players: [],          // { id, displayName, autodartsUsername }
  selMode: '501',
  selLegs: 3,
  selRounds: 2,
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const views = {
  landing:    $('view-landing'),
  setup:      $('view-setup'),
  tournament: $('view-tournament'),
};

// ── Utils ─────────────────────────────────────────────────────
function showView(name) {
  Object.values(views).forEach(v => v.style.display = 'none');
  if (views[name]) views[name].style.display = 'flex';
  s.view = name;
}

function showLoading(on) {
  $('loading').style.display = on ? 'flex' : 'none';
}

let toastTimer;
function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function pillClass(status) {
  const m = { CREATED: 'pill-created', IN_PROGRESS: 'pill-in_progress', COMPLETED: 'pill-completed' };
  return m[status] || 'pill-created';
}

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function legDiff(entry) {
  const d = entry.legsDifference;
  if (d > 0) return `<span class="leg-diff-pos">+${d}</span>`;
  if (d < 0) return `<span class="leg-diff-neg">${d}</span>`;
  return `<span>${d}</span>`;
}

function rankCell(i) {
  if (i === 0) return `<td class="col-rank rank-gold">🥇</td>`;
  if (i === 1) return `<td class="col-rank rank-silver">🥈</td>`;
  if (i === 2) return `<td class="col-rank rank-bronze">🥉</td>`;
  return `<td class="col-rank">${i + 1}</td>`;
}

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

const api = {
  ping:           ()      => fetch(`${API}/players`, { signal: AbortSignal.timeout(2000) }),
  getPlayers:     ()      => apiFetch('/players'),
  createPlayer:   (d, u)  => apiFetch('/players', { method: 'POST', body: JSON.stringify({ displayName: d, autodartsUsername: u }) }),
  getTournaments: ()      => apiFetch('/tournaments'),
  createTournament:(data) => apiFetch('/tournaments', { method: 'POST', body: JSON.stringify(data) }),
  getTournament:  (id)    => apiFetch(`/tournaments/${id}`),
  deleteTournament:(id)   => apiFetch(`/tournaments/${id}`, { method: 'DELETE' }),
  startTournament:(id)    => apiFetch(`/tournaments/${id}/start`, { method: 'POST' }),
  getFixtures:    (id)    => apiFetch(`/tournaments/${id}/fixtures`),
  getStandings:   (id)    => apiFetch(`/tournaments/${id}/standings`),
  getNext:        (id)    => apiFetch(`/tournaments/${id}/next-fixture`),
  startFixture:   (fid)   => apiFetch(`/fixtures/${fid}/start`, { method: 'POST' }),
  submitResult:   (fid, b)=> apiFetch(`/fixtures/${fid}/result`, { method: 'POST', body: JSON.stringify(b) }),
};

// ── Backend connection check ───────────────────────────────────
async function checkBackend() {
  try {
    await api.ping();
    $('status-dot').className = 'status-dot online';
    $('offline-notice').style.display = 'none';
    return true;
  } catch {
    $('status-dot').className = 'status-dot offline';
    $('offline-notice').style.display = 'block';
    return false;
  }
}

// ── Landing view ──────────────────────────────────────────────
async function loadLanding() {
  showView('landing');
  const ok = await checkBackend();
  if (!ok) return;

  try {
    const tournaments = await api.getTournaments();
    renderTournamentCards(tournaments);
  } catch {
    $('tournaments-list').innerHTML = '<p class="empty-list">Could not load tournaments.</p>';
  }
}

function renderTournamentCards(list) {
  const el = $('tournaments-list');
  if (!list.length) {
    el.innerHTML = '<p class="empty-list">No tournaments yet. Create your first one!</p>';
    return;
  }
  el.innerHTML = list.map(t => `
    <div class="t-card" data-id="${t.id}">
      <div class="t-card-info">
        <div class="t-card-name">${esc(t.name)}</div>
        <div class="t-card-meta">
          ${t.gameMode} · BO${t.legsPerMatch} · ${t.roundsPerPlayer}× rounds ·
          <span class="status-pill ${pillClass(t.status)}">${t.status.replace('_', ' ')}</span>
        </div>
      </div>
      <button class="t-card-delete" data-id="${t.id}" title="Delete">×</button>
    </div>
  `).join('');

  el.querySelectorAll('.t-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('t-card-delete')) return;
      openTournament(Number(card.dataset.id));
    });
  });
  el.querySelectorAll('.t-card-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Delete this tournament and all its fixtures?')) return;
      try {
        await api.deleteTournament(Number(btn.dataset.id));
        // Clear stored id if it was the active one
        const stored = await chrome.storage.local.get(['activeTournamentId']);
        if (stored.activeTournamentId === Number(btn.dataset.id)) {
          await chrome.storage.local.remove(['activeTournamentId', 'activeTournament', 'tournamentPlayers']);
        }
        toast('Tournament deleted');
        await loadLanding();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

// ── Setup view ────────────────────────────────────────────────
function openSetup() {
  s.players = [];
  s.selMode = '501';
  s.selLegs = 3;
  s.selRounds = 2;
  $('inp-name').value = '';
  $('inp-username').value = '';
  $('player-error').style.display = 'none';
  renderPlayerList();
  updateCreateBtn();
  showView('setup');
}

function renderPlayerList() {
  const count = s.players.length;
  $('player-count').textContent = count;
  $('players-list').innerHTML = s.players.map((p, i) => `
    <div class="player-item">
      <div class="player-avatar">${initials(p.displayName)}</div>
      <div class="player-info">
        <div class="player-name">${esc(p.displayName)}</div>
        <div class="player-username">@${esc(p.autodartsUsername)}</div>
      </div>
      <button class="player-remove" data-idx="${i}" title="Remove">×</button>
    </div>
  `).join('');

  $('players-list').querySelectorAll('.player-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      s.players.splice(Number(btn.dataset.idx), 1);
      renderPlayerList();
      updateCreateBtn();
    });
  });
}

function updateCreateBtn() {
  $('btn-create').disabled = s.players.length < 2 || !$('inp-name').value.trim();
}

async function addPlayer() {
  const username = $('inp-username').value.trim();
  if (!username) return;

  const errEl = $('player-error');
  errEl.style.display = 'none';

  if (s.players.find(p => p.autodartsUsername.toLowerCase() === username.toLowerCase())) {
    errEl.textContent = 'Player already added.';
    errEl.style.display = 'block';
    return;
  }

  showLoading(true);
  try {
    const player = await api.createPlayer(username, username);
    s.players.push(player);
    $('inp-username').value = '';
    renderPlayerList();
    updateCreateBtn();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    showLoading(false);
  }
}

async function createTournament() {
  const name = $('inp-name').value.trim();
  if (!name || s.players.length < 2) return;

  showLoading(true);
  try {
    const t = await api.createTournament({
      name,
      gameMode: s.selMode,
      legsPerMatch: s.selLegs,
      roundsPerPlayer: s.selRounds,
      playerIds: s.players.map(p => p.id),
    });

    // Auto-start the tournament
    const started = await api.startTournament(t.id);
    await persistActiveTournament(started, s.players);
    toast('Tournament started! 🎯', 'success');
    await openTournament(started.id);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Tournament view ───────────────────────────────────────────
async function openTournament(id) {
  showLoading(true);
  try {
    s.activeTournamentId = id;
    await loadTournamentData(id);
    // Keep storage in sync so the in-app panel can read the tournament name
    await chrome.storage.local.set({
      activeTournamentId: s.tournament.id,
      activeTournament:   s.tournament,
      tournamentPlayers:  s.standings.map(e => e.player),
    });
    showView('tournament');
    renderTournamentView();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function loadTournamentData(id) {
  const [tournament, fixtures, standings, next] = await Promise.all([
    api.getTournament(id),
    api.getFixtures(id),
    api.getStandings(id),
    api.getNext(id).catch(() => null),
  ]);
  s.tournament  = tournament;
  s.fixtures    = fixtures;
  s.standings   = standings;
  s.nextFixture = next;
}

function renderTournamentView() {
  const t = s.tournament;
  $('t-name').textContent = t.name;
  $('t-status').textContent = t.status.replace('_', ' ');
  $('t-status').className = `status-pill ${pillClass(t.status)}`;

  renderStandings();
  renderSchedule();
  renderNextUp();
  renderActions();
}

// ── Standings ─────────────────────────────────────────────────
function renderStandings() {
  const body = $('standings-body');
  const empty = $('standings-empty');

  if (!s.standings.length) {
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = s.standings.map((e, i) => `
    <tr>
      ${rankCell(i)}
      <td class="col-player">${esc(e.player.displayName)}</td>
      <td>${e.played}</td>
      <td>${e.wins}</td>
      <td>${e.draws}</td>
      <td>${e.losses}</td>
      <td>${legDiff(e)}</td>
      <td class="col-pts">${e.points}</td>
    </tr>
  `).join('');
}

// ── Schedule ──────────────────────────────────────────────────
function renderSchedule() {
  const el = $('schedule-body');
  if (!s.fixtures.length) {
    el.innerHTML = '<p class="empty-msg">No fixtures yet.</p>';
    return;
  }

  // Group by round
  const rounds = {};
  s.fixtures.forEach(f => {
    if (!rounds[f.roundNumber]) rounds[f.roundNumber] = [];
    rounds[f.roundNumber].push(f);
  });

  el.innerHTML = Object.entries(rounds).map(([round, fixtures]) => `
    <div class="round-block">
      <div class="round-label">Round ${round}</div>
      ${fixtures.map(f => renderFixtureRow(f)).join('')}
    </div>
  `).join('');
}

function renderFixtureRow(f) {
  const cls   = f.status.toLowerCase();
  const score = f.status === 'COMPLETED'
    ? `<div class="fixture-score">
         <span class="score-num ${f.homeLegsWon > f.awayLegsWon ? 'score-win' : 'score-lose'}">${f.homeLegsWon}</span>
         <span class="score-dash">–</span>
         <span class="score-num ${f.awayLegsWon > f.homeLegsWon ? 'score-win' : 'score-lose'}">${f.awayLegsWon}</span>
       </div>`
    : `<span class="fixture-status-badge badge-${cls}">${f.status.replace('_', ' ')}</span>`;

  const homeWon = f.status === 'COMPLETED' && f.homeLegsWon > f.awayLegsWon;
  const awayWon = f.status === 'COMPLETED' && f.awayLegsWon > f.homeLegsWon;

  const avgLine = f.status === 'COMPLETED' && (f.homePlayerAverage || f.awayPlayerAverage)
    ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-3);padding:0 0 0 0;margin-top:2px">
         <span>${f.homePlayerAverage ? f.homePlayerAverage.toFixed(1) + ' avg' : ''}</span>
         <span>${f.awayPlayerAverage ? f.awayPlayerAverage.toFixed(1) + ' avg' : ''}</span>
       </div>`
    : '';

  return `
    <div class="fixture-row ${cls}">
      <span class="fixture-player ${homeWon ? 'winner' : ''}">${esc(f.homePlayer.displayName)}</span>
      <span class="fixture-vs">vs</span>
      ${score}
      <span class="fixture-vs">vs</span>
      <span class="fixture-player right ${awayWon ? 'winner' : ''}">${esc(f.awayPlayer.displayName)}</span>
    </div>
    ${avgLine}
  `;
}

// ── Next Up ───────────────────────────────────────────────────
function renderNextUp() {
  const el = $('next-body');
  const t  = s.tournament;

  if (t.status === 'COMPLETED') {
    const winner = s.standings[0];
    el.innerHTML = `
      <div class="completed-banner">
        🏆 Tournament Complete!
        <span class="winner-name">${winner ? esc(winner.player.displayName) : ''}</span>
        wins the league!
      </div>
    `;
    return;
  }

  if (!s.nextFixture) {
    el.innerHTML = '<p class="empty-msg">No pending fixtures.</p>';
    return;
  }

  const f = s.nextFixture;
  el.innerHTML = `
    <div class="next-card">
      <div class="next-round-badge">Round ${f.roundNumber} · ${esc(t.gameMode)} BO${t.legsPerMatch}</div>

      <div class="next-vs-row">
        <div class="next-player">
          <div class="next-player-name">${esc(f.homePlayer.displayName)}</div>
          <div class="next-player-username">@${esc(f.homePlayer.autodartsUsername)}</div>
        </div>
        <div class="next-vs-label">VS</div>
        <div class="next-player">
          <div class="next-player-name">${esc(f.awayPlayer.displayName)}</div>
          <div class="next-player-username">@${esc(f.awayPlayer.autodartsUsername)}</div>
        </div>
      </div>

      <div class="detection-notice">
        <span class="detection-notice-icon">🔍</span>
        <span>Play this game on Autodarts — the result will be detected and recorded automatically.</span>
      </div>

      <div class="result-form" id="manual-result-form">
        <div class="result-form-title">Or enter result manually</div>
        <div class="result-inputs">
          <span class="result-player-label">${esc(f.homePlayer.displayName)}</span>
          <input class="result-input" id="inp-home-legs" type="number" min="0" max="${t.legsPerMatch}" value="0">
          <span class="result-dash">–</span>
          <input class="result-input" id="inp-away-legs" type="number" min="0" max="${t.legsPerMatch}" value="0">
          <span class="result-player-label">${esc(f.awayPlayer.displayName)}</span>
        </div>
        <div class="avg-inputs">
          <div class="avg-input-wrap">
            <div class="avg-label">${esc(f.homePlayer.displayName)} avg</div>
            <input class="avg-input" id="inp-home-avg" type="number" min="0" max="180" step="0.1" placeholder="0.0">
          </div>
          <div class="avg-input-wrap">
            <div class="avg-label">${esc(f.awayPlayer.displayName)} avg</div>
            <input class="avg-input" id="inp-away-avg" type="number" min="0" max="180" step="0.1" placeholder="0.0">
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="btn-submit-result">Save Result</button>
      </div>
    </div>
  `;

  $('btn-submit-result').addEventListener('click', submitManualResult);
}

async function submitManualResult() {
  const f = s.nextFixture;
  const homeLegs = parseInt($('inp-home-legs').value) || 0;
  const awayLegs = parseInt($('inp-away-legs').value) || 0;
  const homeAvg  = parseFloat($('inp-home-avg').value) || null;
  const awayAvg  = parseFloat($('inp-away-avg').value) || null;

  if (homeLegs === 0 && awayLegs === 0) {
    toast('Enter at least one score', 'error');
    return;
  }

  showLoading(true);
  try {
    await api.submitResult(f.id, { homeLegsWon: homeLegs, awayLegsWon: awayLegs, homePlayerAverage: homeAvg, awayPlayerAverage: awayAvg });
    toast('Result saved!', 'success');
    await loadTournamentData(s.activeTournamentId);
    renderTournamentView();
    switchTab('standings');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Actions bar ───────────────────────────────────────────────
function renderActions() {
  const el = $('t-actions');
  const t  = s.tournament;
  el.innerHTML = '';

  if (t.status === 'COMPLETED') {
    el.innerHTML = `<button class="btn btn-ghost btn-full" id="btn-back-to-all">‹ Back to All Tournaments</button>`;
    $('btn-back-to-all').addEventListener('click', () => loadLanding());
    return;
  }

  // Show delete button
  const del = document.createElement('button');
  del.className = 'btn btn-danger btn-full';
  del.textContent = 'Delete Tournament';
  del.addEventListener('click', async () => {
    if (!confirm('Delete this tournament?')) return;
    showLoading(true);
    try {
      await api.deleteTournament(s.activeTournamentId);
      await chrome.storage.local.remove(['activeTournamentId', 'activeTournament', 'tournamentPlayers']);
      toast('Deleted');
      await loadLanding();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      showLoading(false);
    }
  });
  el.appendChild(del);
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  ['standings', 'schedule', 'next'].forEach(n => {
    const el = $(`tab-${n}`);
    el.style.display = n === name ? 'block' : 'none';
    el.classList.toggle('active', n === name);
  });
}

// ── Chrome storage helpers ────────────────────────────────────
async function persistActiveTournament(tournament, players) {
  await chrome.storage.local.set({
    activeTournamentId: tournament.id,
    activeTournament:   tournament,
    tournamentPlayers:  players,
  });
}

// ── Listen for game-detected messages from background ─────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GAME_DETECTED' && s.view === 'tournament') {
    toast('🎯 Game detected — updating tournament...', 'success');
    setTimeout(async () => {
      await loadTournamentData(s.activeTournamentId);
      renderTournamentView();
    }, 1500);
  }
});

// ── Escape HTML ───────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Wire up chip selectors ────────────────────────────────────
function initChips(groupId, key) {
  document.getElementById(groupId).querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById(groupId).querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      s[key] = isNaN(chip.dataset.val) ? chip.dataset.val : Number(chip.dataset.val);
    });
  });
}

// ── Wire up back buttons ──────────────────────────────────────
document.querySelectorAll('.back-btn[data-to]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.to === 'landing') loadLanding();
  });
});

// ── Bind events ───────────────────────────────────────────────
$('btn-new').addEventListener('click', openSetup);

$('btn-add-player').addEventListener('click', addPlayer);
$('inp-username').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
$('inp-name').addEventListener('input', updateCreateBtn);
$('btn-create').addEventListener('click', createTournament);

$('btn-refresh').addEventListener('click', async () => {
  showLoading(true);
  try {
    await loadTournamentData(s.activeTournamentId);
    renderTournamentView();
  } catch(err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ── Init ──────────────────────────────────────────────────────
(async () => {
  initChips('chips-mode',   'selMode');
  initChips('chips-legs',   'selLegs');
  initChips('chips-rounds', 'selRounds');

  const stored = await chrome.storage.local.get(['activeTournamentId']);
  if (stored.activeTournamentId) {
    try {
      await openTournament(stored.activeTournamentId);
      return;
    } catch {
      await chrome.storage.local.remove(['activeTournamentId', 'activeTournament', 'tournamentPlayers']);
    }
  }
  await loadLanding();
})();
