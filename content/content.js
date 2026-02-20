/* =============================================================
   Autodarts League — Full In-App Injection

   Flow:
     Click "Local Tournaments" in nav
       → No active tournament  → Create Tournament form
       → Active tournament     → Standings / Schedule / Next Up
   Click any other Autodarts nav link → hide, restore Autodarts
   ============================================================= */

(function adleague() {

  const BACKEND          = 'http://localhost:8080/api';
  const NAV_SELECTOR     = '.css-1kwqbwj';
  const CONTENT_SELECTOR = '.css-nfhdnc';
  const NAV_ID           = 'adl-nav-link';
  const PAGE_ID          = 'adl-page';

  let isVisible   = false;
  let createState = { players: [], mode: '501', legs: 3, rounds: 2 };

  // ── All CSS (scoped to #adl-page) — must be defined before use ─
  const ADL_CSS = `
    #adl-page {
      width: 100%;
      color: #e2e8f0;
      font-family: inherit;
    }

    #adl-page .adl-page-wrap  { padding: 32px 40px; }
    #adl-page .adl-page-header { margin-bottom: 28px; }
    #adl-page .adl-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    #adl-page .adl-title      { font-size: 28px; font-weight: 800; color: #fff; margin: 0 0 4px; }
    #adl-page .adl-title span { color: #00d68f; }
    #adl-page .adl-subtitle   { font-size: 13px; color: #718096; margin: 0; }
    #adl-page .adl-muted      { font-weight: 400; color: #718096; }

    #adl-page .adl-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 28px;
    }

    #adl-page .adl-field   { margin-bottom: 20px; }
    #adl-page .adl-label   { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #a0aec0; margin-bottom: 8px; }
    #adl-page .adl-input   {
      width: 100%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: #e2e8f0;
      font-size: 14px;
      outline: none;
      font-family: inherit;
      transition: border-color .15s;
    }
    #adl-page .adl-input:focus        { border-color: #00d68f; }
    #adl-page .adl-input::placeholder { color: #4a5568; }
    #adl-page .adl-row { display: flex; gap: 8px; align-items: stretch; }
    #adl-page .adl-row .adl-input { flex: 1; }
    #adl-page .adl-error { font-size: 12px; color: #fc8181; margin: 6px 0 0; min-height: 16px; }

    #adl-page .adl-btn {
      padding: 10px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 700;
      cursor: pointer; border: none; font-family: inherit;
      transition: opacity .15s, background .15s;
      white-space: nowrap;
    }
    #adl-page .adl-btn:disabled    { opacity: .4; cursor: not-allowed; }
    #adl-page .adl-btn-primary     { background: #00d68f; color: #0d1117; }
    #adl-page .adl-btn-primary:not(:disabled):hover { background: #00f0a0; }
    #adl-page .adl-btn-sec         { background: rgba(255,255,255,0.08); color: #e2e8f0; }
    #adl-page .adl-btn-sec:hover   { background: rgba(255,255,255,0.14); }
    #adl-page .adl-btn-danger      { background: rgba(229,62,62,0.15); color: #fc8181; border: 1px solid rgba(229,62,62,0.3); }
    #adl-page .adl-btn-danger:hover { background: rgba(229,62,62,0.25); }
    #adl-page .adl-btn-play        { background: rgba(72,187,120,0.15); color: #68d391; border: 1px solid rgba(72,187,120,0.3); font-size: 15px; padding: 10px 32px; }
    #adl-page .adl-btn-play:hover  { background: rgba(72,187,120,0.25); }
    #adl-page .adl-btn-play:disabled { opacity: 0.5; cursor: default; }
    #adl-page .adl-play-row        { display: flex; justify-content: center; margin-top: 20px; }
    #adl-page .adl-btn-full        { width: 100%; margin-top: 8px; }

    #adl-page .adl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    #adl-page .adl-chip  {
      padding: 6px 16px; border-radius: 20px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #a0aec0; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background .15s, border-color .15s, color .15s;
    }
    #adl-page .adl-chip.active { background: rgba(0,214,143,0.15); border-color: rgba(0,214,143,0.5); color: #00d68f; }
    #adl-page .adl-chip:hover:not(.active) { background: rgba(255,255,255,0.1); color: #e2e8f0; }

    #adl-page .adl-player { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    #adl-page .adl-player:last-child { border-bottom: none; }
    #adl-page .adl-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(0,214,143,0.15); color: #00d68f;
      font-size: 13px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #adl-page .adl-player-info { flex: 1; min-width: 0; }
    #adl-page .adl-player-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
    #adl-page .adl-player-user { font-size: 12px; color: #718096; }
    #adl-page .adl-player-rm   { background: none; border: none; color: #4a5568; font-size: 18px; line-height: 1; cursor: pointer; padding: 4px 6px; border-radius: 4px; }
    #adl-page .adl-player-rm:hover { color: #fc8181; background: rgba(229,62,62,0.1); }

    #adl-page .adl-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); margin: 0 0 24px; padding: 0 40px; }
    #adl-page .adl-tab {
      padding: 10px 24px; background: none; border: none;
      border-bottom: 2px solid transparent;
      color: #718096; font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em;
      cursor: pointer; font-family: inherit; margin-bottom: -1px;
      transition: color .15s, border-color .15s;
    }
    #adl-page .adl-tab.active             { color: #00d68f; border-bottom-color: #00d68f; }
    #adl-page .adl-tab:hover:not(.active) { color: #e2e8f0; }
    #adl-page .adl-section        { display: none; padding: 0 40px 40px; }
    #adl-page .adl-section.active { display: block; }
    #adl-page .adl-empty { color: #718096; font-size: 14px; text-align: center; padding: 56px 0; }

    #adl-page .adl-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    #adl-page .adl-table th { text-align: center; color: #718096; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 0 12px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    #adl-page .adl-table td { padding: 13px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #cbd5e0; text-align: center; }
    #adl-page .adl-table tr:hover td { background: rgba(255,255,255,0.02); }
    #adl-page .adl-table .adl-col-name, #adl-page .adl-table th.adl-col-name { text-align: left; }
    #adl-page .adl-table .adl-col-name { font-weight: 600; }
    #adl-page .adl-table .adl-rank  { color: #4a5568; font-size: 12px; }
    #adl-page .adl-table .adl-pts   { color: #00d68f; font-weight: 800; font-size: 16px; }
    #adl-page .adl-table .adl-leader td { color: #fff; }

    #adl-page .adl-round-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #718096; margin: 20px 0 8px; }
    #adl-page .adl-round-label:first-child { margin-top: 0; }
    #adl-page .adl-fixture {
      display: grid; grid-template-columns: 1fr auto 1fr;
      align-items: center; gap: 12px;
      padding: 12px 16px; background: rgba(255,255,255,0.03);
      border-radius: 8px; margin-bottom: 6px; font-size: 14px;
      transition: background .15s;
    }
    #adl-page .adl-fixture:hover { background: rgba(255,255,255,0.06); }
    #adl-page .adl-fp     { color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #adl-page .adl-fp-r   { text-align: right; }
    #adl-page .adl-win    { color: #00d68f; font-weight: 700; }
    #adl-page .adl-avg-row { display: flex; justify-content: space-between; font-size: 12px; color:rgb(244, 245, 248); padding: 2px 16px 4px; margin-top: -4px; }
    #adl-page .adl-badge       { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; white-space: nowrap; }
    #adl-page .adl-badge-vs    { background: rgba(255,255,255,0.06); color: #718096; }
    #adl-page .adl-badge-done  { background: rgba(0,214,143,0.15); color: #00d68f; border: 1px solid rgba(0,214,143,0.3); }
    #adl-page .adl-badge-live  { background: rgba(246,201,14,0.1); color: #f6c90e; border: 1px solid rgba(246,201,14,0.3); }

    #adl-page .adl-next-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 40px 32px; text-align: center; max-width: 480px; margin: 0 auto; }
    #adl-page .adl-next-round { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #00d68f; margin-bottom: 24px; }
    #adl-page .adl-next-vs    { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
    #adl-page .adl-next-name  { font-size: 24px; font-weight: 800; color: #fff; }
    #adl-page .adl-vs-sep     { font-size: 13px; color: #4a5568; font-weight: 600; }
    #adl-page .adl-next-users { font-size: 13px; color: #718096; margin-bottom: 24px; }
  `;

  // ── Inject CSS once into <head> ───────────────────────────────
  if (!document.getElementById('adl-styles')) {
    const el = document.createElement('style');
    el.id = 'adl-styles';
    el.textContent = ADL_CSS;
    document.head.appendChild(el);
  }

  // ── Watch for nav bar to render (React SPA renders async) ─────
  const observer = new MutationObserver(tryInjectNav);
  observer.observe(document.body, { childList: true, subtree: true });
  tryInjectNav();

  // ── Inject "Local Tournaments" into the Autodarts nav ─────────
  function tryInjectNav() {
    if (document.getElementById(NAV_ID)) return;

    const nav = document.querySelector(NAV_SELECTOR);
    if (!nav) return;

    const existingLink = nav.querySelector('a');
    const link = document.createElement('a');
    link.id          = NAV_ID;
    link.textContent = 'Local Tournaments';
    link.href        = '#';
    if (existingLink) link.className = existingLink.className;

    link.addEventListener('click', e => {
      e.preventDefault();
      isVisible ? hidePage() : showPage();
    });

    nav.appendChild(link);

    // Listen for clicks on any OTHER nav link → hide our page
    if (!nav.dataset.adlWired) {
      nav.dataset.adlWired = '1';
      nav.addEventListener('click', e => {
        const clicked = e.target.closest('a');
        if (clicked && clicked.id !== NAV_ID && isVisible) hidePage();
      });
    }
  }

  // ── Show / hide ───────────────────────────────────────────────
  function showPage() {
    document.getElementById(PAGE_ID)?.remove();

    const autodarts = document.querySelector(CONTENT_SELECTOR);
    if (!autodarts) {
      console.warn('[ADLeague] Content div not found:', CONTENT_SELECTOR);
      return;
    }
    autodarts.style.display = 'none';

    const page = document.createElement('div');
    page.id = PAGE_ID;
    autodarts.parentNode.insertBefore(page, autodarts.nextSibling);

    isVisible = true;
    markNavActive(true);
    loadPageState(page);
  }

  function hidePage() {
    document.getElementById(PAGE_ID)?.remove();
    const autodarts = document.querySelector(CONTENT_SELECTOR);
    if (autodarts) autodarts.style.display = '';
    isVisible = false;
    markNavActive(false);
  }

  function markNavActive(on) {
    const link = document.getElementById(NAV_ID);
    if (!link) return;
    if (on) link.setAttribute('aria-current', 'page');
    else    link.removeAttribute('aria-current');
  }

  // ── Decide which view to render ───────────────────────────────
  async function loadPageState(page) {
    if (!chrome?.storage?.local) {
      page.innerHTML = '<p class="adl-empty">Reload this tab to reconnect the extension.</p>';
      return;
    }
    const { activeTournamentId } = await chrome.storage.local.get(['activeTournamentId']);
    if (activeTournamentId) {
      showTournamentView(page, activeTournamentId);
    } else {
      showCreateView(page);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE VIEW
  // ═══════════════════════════════════════════════════════════════

  function showCreateView(page) {
    createState = { players: [], mode: '501', legs: 3, rounds: 2 };
    page.innerHTML = `
      <div class="adl-page-wrap">
        <div class="adl-page-header">
          <h1 class="adl-title">Local <span>Tournaments</span></h1>
          <p class="adl-subtitle">Create a round-robin league for your group</p>
        </div>

        <div class="adl-card" style="max-width:520px">

          <div class="adl-field">
            <label class="adl-label">Tournament Name</label>
            <input class="adl-input" id="adl-tname" placeholder="e.g. Friday Night League" />
          </div>

          <div class="adl-field">
            <label class="adl-label">
              Players
              <span class="adl-muted"> — enter Autodarts username and press Add</span>
            </label>
            <div class="adl-row">
              <input class="adl-input" id="adl-uname" placeholder="autodarts username" />
              <button class="adl-btn adl-btn-sec" id="adl-add-btn">Add</button>
            </div>
            <p class="adl-error" id="adl-padd-err"></p>
            <div id="adl-plist"></div>
          </div>

          <div class="adl-field">
            <label class="adl-label">Game Mode</label>
            <div class="adl-chips" id="adl-chips-mode">
              <button class="adl-chip active" data-val="501">501</button>
              <button class="adl-chip" data-val="Cricket">Cricket</button>
            </div>
          </div>

          <div class="adl-field">
            <label class="adl-label">Legs per Match (Best of)</label>
            <div class="adl-chips" id="adl-chips-legs">
              <button class="adl-chip" data-val="1">1</button>
              <button class="adl-chip active" data-val="3">3</button>
              <button class="adl-chip" data-val="5">5</button>
              <button class="adl-chip" data-val="7">7</button>
            </div>
          </div>

          <div class="adl-field">
            <label class="adl-label">Rounds per Player</label>
            <div class="adl-chips" id="adl-chips-rounds">
              <button class="adl-chip" data-val="1">1×</button>
              <button class="adl-chip active" data-val="2">2×</button>
              <button class="adl-chip" data-val="3">3×</button>
            </div>
          </div>

          <button class="adl-btn adl-btn-primary adl-btn-full" id="adl-create-btn" disabled>
            Create &amp; Start Tournament
          </button>
          <p class="adl-error" id="adl-create-err"></p>
        </div>
      </div>
    `;
    wireCreateView(page);
  }

  function wireCreateView(page) {
    // Chip groups
    ['mode', 'legs', 'rounds'].forEach(key => {
      page.querySelector(`#adl-chips-${key}`).querySelectorAll('.adl-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.parentNode.querySelectorAll('.adl-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const v = chip.dataset.val;
          createState[key] = isNaN(v) ? v : Number(v);
        });
      });
    });

    // Add player
    const uInput   = page.querySelector('#adl-uname');
    const addBtn   = page.querySelector('#adl-add-btn');
    const pErr     = page.querySelector('#adl-padd-err');

    async function doAddPlayer() {
      const username = uInput.value.trim();
      if (!username) return;
      pErr.textContent = '';

      if (createState.players.find(p => p.autodartsUsername.toLowerCase() === username.toLowerCase())) {
        pErr.textContent = 'Player already added.';
        return;
      }

      addBtn.disabled = true;
      addBtn.textContent = '…';
      try {
        const player = await apiFetch('/players', {
          method: 'POST',
          body: JSON.stringify({ displayName: username, autodartsUsername: username }),
        });
        createState.players.push(player);
        uInput.value = '';
        renderPlayerList(page);
        updateCreateBtn(page);
      } catch (err) {
        pErr.textContent = err.message;
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add';
      }
    }

    addBtn.addEventListener('click', doAddPlayer);
    uInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddPlayer(); });
    page.querySelector('#adl-tname').addEventListener('input', () => updateCreateBtn(page));
    page.querySelector('#adl-create-btn').addEventListener('click', () => doCreateTournament(page));
  }

  function renderPlayerList(page) {
    page.querySelector('#adl-plist').innerHTML = createState.players.map((p, i) => `
      <div class="adl-player">
        <div class="adl-avatar">${initials(p.displayName)}</div>
        <div class="adl-player-info">
          <div class="adl-player-name">${esc(p.displayName)}</div>
          <div class="adl-player-user">@${esc(p.autodartsUsername)}</div>
        </div>
        <button class="adl-player-rm" data-idx="${i}">×</button>
      </div>
    `).join('');

    page.querySelectorAll('.adl-player-rm').forEach(btn => {
      btn.addEventListener('click', () => {
        createState.players.splice(Number(btn.dataset.idx), 1);
        renderPlayerList(page);
        updateCreateBtn(page);
      });
    });
  }

  function updateCreateBtn(page) {
    const name = page.querySelector('#adl-tname').value.trim();
    page.querySelector('#adl-create-btn').disabled = createState.players.length < 2 || !name;
  }

  async function doCreateTournament(page) {
    const name   = page.querySelector('#adl-tname').value.trim();
    const errEl  = page.querySelector('#adl-create-err');
    const btn    = page.querySelector('#adl-create-btn');
    errEl.textContent = '';
    btn.disabled    = true;
    btn.textContent = 'Creating…';

    try {
      const t = await apiFetch('/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          gameMode:        createState.mode,
          legsPerMatch:    createState.legs,
          roundsPerPlayer: createState.rounds,
          playerIds:       createState.players.map(p => p.id),
        }),
      });
      const started = await apiFetch(`/tournaments/${t.id}/start`, { method: 'POST' });

      await chrome.storage.local.set({
        activeTournamentId: started.id,
        activeTournament:   started,
        tournamentPlayers:  createState.players,
      });

      await showTournamentView(page, started.id);
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled    = false;
      btn.textContent = 'Create & Start Tournament';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  TOURNAMENT VIEW
  // ═══════════════════════════════════════════════════════════════

  async function showTournamentView(page, tournamentId) {
    page.innerHTML = '<p class="adl-empty">Loading…</p>';

    try {
      const [tournament, fixtures, standings, nextRes] = await Promise.all([
        apiFetch(`/tournaments/${tournamentId}`),
        apiFetch(`/tournaments/${tournamentId}/fixtures`),
        apiFetch(`/tournaments/${tournamentId}/standings`),
        fetch(`${BACKEND}/tournaments/${tournamentId}/next-fixture`),
      ]);
      const next = nextRes.status === 200 ? await nextRes.json() : null;

      page.innerHTML = `
        <div class="adl-page-wrap">
          <div class="adl-page-header">
            <div class="adl-header-row">
              <div>
                <h1 class="adl-title">${esc(tournament.name)}</h1>
                <p class="adl-subtitle">
                  ${esc(tournament.gameMode)} · Best of ${tournament.legsPerMatch} ·
                  ${tournament.roundsPerPlayer}× rounds
                </p>
              </div>
              <button class="adl-btn adl-btn-danger" id="adl-end-btn">End Tournament</button>
            </div>
          </div>

          <div class="adl-tabs">
            <button class="adl-tab active" data-tab="standings">Standings</button>
            <button class="adl-tab"        data-tab="schedule">Schedule</button>
            <button class="adl-tab"        data-tab="next">Next Up</button>
          </div>

          <div class="adl-section active" id="adl-sec-standings"></div>
          <div class="adl-section"        id="adl-sec-schedule"></div>
          <div class="adl-section"        id="adl-sec-next"></div>
        </div>
      `;

      wireTabs(page);

      page.querySelector('#adl-end-btn').addEventListener('click', async () => {
        if (!confirm('End this tournament? All fixtures and standings will be deleted.')) return;
        try {
          await apiFetch(`/tournaments/${tournamentId}`, { method: 'DELETE' });
          await chrome.storage.local.remove(['activeTournamentId', 'activeTournament', 'tournamentPlayers']);
          showCreateView(page);
        } catch (err) {
          alert('Failed to end tournament: ' + err.message);
        }
      });

      renderStandings(page, standings);
      renderSchedule(page, fixtures);
      renderNext(page, next, tournament);

    } catch (err) {
      page.innerHTML = `<p class="adl-empty">Failed to load: ${esc(err.message)}</p>`;
    }
  }

  function wireTabs(page) {
    page.querySelectorAll('.adl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        page.querySelectorAll('.adl-tab').forEach(t => t.classList.toggle('active', t === tab));
        page.querySelectorAll('.adl-section').forEach(s =>
          s.classList.toggle('active', s.id === `adl-sec-${tab.dataset.tab}`)
        );
      });
    });
  }

  // ── Standings ─────────────────────────────────────────────────
  function renderStandings(page, rows) {
    const el = page.querySelector('#adl-sec-standings');
    if (!rows.length) {
      el.innerHTML = '<p class="adl-empty">No results yet — play some fixtures first.</p>';
      return;
    }
    el.innerHTML = `
      <table class="adl-table">
        <thead><tr>
          <th>#</th><th class="adl-col-name">Player</th>
          <th>P</th><th>W</th><th>D</th><th>L</th><th>Legs</th><th>Pts</th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="${i === 0 ? 'adl-leader' : ''}">
              <td class="adl-rank">${i + 1}</td>
              <td class="adl-col-name">${esc(r.player.displayName)}</td>
              <td>${r.played}</td>
              <td>${r.wins}</td>
              <td>${r.draws}</td>
              <td>${r.losses}</td>
              <td>${r.legsFor}–${r.legsAgainst}</td>
              <td class="adl-pts">${r.points}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Schedule ──────────────────────────────────────────────────
  function renderSchedule(page, fixtures) {
    const el = page.querySelector('#adl-sec-schedule');
    if (!fixtures.length) {
      el.innerHTML = '<p class="adl-empty">No fixtures yet.</p>';
      return;
    }

    const rounds = {};
    fixtures.forEach(f => { (rounds[f.roundNumber] ??= []).push(f); });

    el.innerHTML = Object.entries(rounds).map(([rn, fxs]) => `
      <div class="adl-round-label">Round ${rn}</div>
      ${fxs.map(f => {
        const st      = f.status;
        const homeWon = st === 'COMPLETED' && f.homeLegsWon > f.awayLegsWon;
        const awayWon = st === 'COMPLETED' && f.awayLegsWon > f.homeLegsWon;
        const badge   = st === 'COMPLETED'
          ? `<span class="adl-badge adl-badge-done">${f.homeLegsWon} – ${f.awayLegsWon}</span>`
          : st === 'IN_PROGRESS'
          ? `<span class="adl-badge adl-badge-live">LIVE</span>`
          : `<span class="adl-badge adl-badge-vs">vs</span>`;
        const avgRow = st === 'COMPLETED' && (f.homePlayerAverage || f.awayPlayerAverage)
          ? `<div class="adl-avg-row">
               <span>${f.homePlayerAverage ? f.homePlayerAverage.toFixed(1) + ' avg' : ''}</span>
               <span>${f.awayPlayerAverage ? f.awayPlayerAverage.toFixed(1) + ' avg' : ''}</span>
             </div>`
          : '';
        return `
          <div class="adl-fixture">
            <span class="adl-fp ${homeWon ? 'adl-win' : ''}">${esc(f.homePlayer.displayName)}</span>
            ${badge}
            <span class="adl-fp adl-fp-r ${awayWon ? 'adl-win' : ''}">${esc(f.awayPlayer.displayName)}</span>
          </div>
          ${avgRow}`;
      }).join('')}
    `).join('');
  }

  // ── Next Up ───────────────────────────────────────────────────
  function renderNext(page, f, tournament) {
    const el = page.querySelector('#adl-sec-next');
    if (!f) {
      el.innerHTML = '<p class="adl-empty">All fixtures complete!</p>';
      return;
    }
    el.innerHTML = `
      <div class="adl-next-card">
        <div class="adl-next-round">Next Match · Round ${f.roundNumber}</div>
        <div class="adl-next-vs">
          <span class="adl-next-name">${esc(f.homePlayer.displayName)}</span>
          <span class="adl-vs-sep">vs</span>
          <span class="adl-next-name">${esc(f.awayPlayer.displayName)}</span>
        </div>
        <div class="adl-next-users">
          @${esc(f.homePlayer.autodartsUsername)} · @${esc(f.awayPlayer.autodartsUsername)}
        </div>
        <div class="adl-play-row">
          <button class="adl-btn adl-btn-play" id="adl-play-btn">▶ Play</button>
        </div>
      </div>
    `;

    el.querySelector('#adl-play-btn').addEventListener('click', async function () {
      this.disabled = true;
      this.textContent = 'Creating lobby…';
      try {
        await createLobby(tournament);
      } catch (err) {
        alert('Failed to create lobby: ' + err.message);
        this.disabled = false;
        this.textContent = '▶ Play';
      }
    });
  }

  async function createLobby(tournament) {
    const isX01 = /^\d+$/.test(tournament.gameMode);
    const body = {
      bullOffMode: 'Off',
      isPrivate: true,
      legs: tournament.legsPerMatch,
      variant: isX01 ? 'X01' : tournament.gameMode,
      settings: {
        baseScore:  isX01 ? Number(tournament.gameMode) : 501,
        inMode:    'Straight',
        outMode:   'Double',
        bullMode:  '25/50',
        maxRounds: 50,
      },
    };

    const res = await fetch('https://api.autodarts.io/gs/v0/lobbies', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Autodarts returned ${res.status}`);
    const data = await res.json();
    const lobbyId = data.id;
    if (!lobbyId) throw new Error('No lobby ID in response');

    window.location.href = `https://play.autodarts.io/lobbies/${lobbyId}`;
  }

  // ── Background message listener ───────────────────────────────
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type !== 'GAME_DETECTED') return;
      const page = document.getElementById(PAGE_ID);
      if (!page) return;
      // Re-load the tournament view with fresh data
      chrome.storage.local.get(['activeTournamentId']).then(({ activeTournamentId }) => {
        if (activeTournamentId) showTournamentView(page, activeTournamentId);
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  function initials(name) {
    return String(name ?? '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  console.log('[ADLeague] Injector ready on', location.hostname);

})();

