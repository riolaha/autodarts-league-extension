/* =============================================================
   Autodarts League — Background Service Worker

   Uses chrome.webRequest to monitor ALL network requests from
   the browser (main thread, web workers, service workers) and
   detect when the Autodarts match-stats endpoint is called.

   When a finished match is detected, it submits the result to
   the Spring Boot backend and notifies the popup.
   ============================================================= */

const BACKEND    = 'http://localhost:8080/api';
const STATS_PATH = '/as/v0/matches/';          // api.autodarts.io/as/v0/matches/{id}/stats

// ── Watch for Autodarts match-stats requests ──────────────────
// Fires for requests from ANY browser context (main thread, web
// worker, service worker) — more reliable than content-script
// fetch interception.

// Track match IDs we have already fetched so we never re-fetch
// a finished match no matter how many times the app polls it.
const fetchedMatches = new Set();

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const url = details.url;

    if (!url.includes(STATS_PATH) || !url.includes('/stats')) return;

    // Extract the match UUID from the URL path before doing anything else
    const idMatch = url.match(/\/matches\/([0-9a-f-]+)\/stats/i);
    if (!idMatch) return;
    const matchId = idMatch[1];

    // If we already fetched this match (finished or not), stop immediately —
    // no more network calls for this match ID ever again.
    if (fetchedMatches.has(matchId)) return;

    // Mark BEFORE the first await so concurrent listener invocations for
    // the same matchId short-circuit immediately, preventing duplicate POSTs.
    fetchedMatches.add(matchId);

    console.log('[ADLeague BG] Detected stats request:', url);

    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        fetchedMatches.delete(matchId); // allow retry on network error
        return;
      }
      const data = await res.json();

      if (!data.finishedAt) {
        // Match still in progress — remove so we pick it up when it finishes.
        fetchedMatches.delete(matchId);
        return;
      }

      setTimeout(() => fetchedMatches.delete(matchId), 600_000);

      await handleMatchStats(url, data);
    } catch (err) {
      fetchedMatches.delete(matchId); // allow retry on error
      console.error('[ADLeague BG] Failed to re-fetch stats:', err);
    }
  },
  { urls: ['https://api.autodarts.io/*'] }
);

// ── Process the /stats response ───────────────────────────────
async function handleMatchStats(url, data) {
  const matchId = data.id;
  if (!matchId) return;

  console.log('[ADLeague BG] Finished match:', matchId);

  const result = extractResult(data);
  if (!result) {
    console.warn('[ADLeague BG] Could not extract result from:', data);
    return;
  }

  console.log('[ADLeague BG] Extracted:', result);

  // Load active tournament context from storage
  const stored = await chrome.storage.local.get(['activeTournamentId', 'tournamentPlayers']);
  const activeTournamentId = stored.activeTournamentId ?? null;
  const tournamentPlayers  = stored.tournamentPlayers  ?? [];

  if (!activeTournamentId) {
    console.log('[ADLeague BG] No active tournament — skipping.');
    return;
  }

  // Match player names to tournament roster
  const home = matchPlayer(tournamentPlayers, result.homeUsername);
  const away = matchPlayer(tournamentPlayers, result.awayUsername);

  if (!home || !away) {
    console.log(
      `[ADLeague BG] Players "${result.homeUsername}" / "${result.awayUsername}" not in tournament.`,
      `Roster: ${tournamentPlayers.map(p => p.autodartsUsername).join(', ')}`
    );
    return;
  }

  const payload = {
    homePlayerUsername: home.autodartsUsername,
    awayPlayerUsername: away.autodartsUsername,
    homePlayerUserId:   result.homeUserId,   // UUID for real accounts, null for local
    awayPlayerUserId:   result.awayUserId,
    homeLegsWon:        result.homeLegsWon,
    awayLegsWon:        result.awayLegsWon,
    homePlayerAverage:  result.homeAvg  ?? null,
    awayPlayerAverage:  result.awayAvg  ?? null,
    autodartsGameId:    matchId,
  };

  console.log('[ADLeague BG] Submitting to backend:', payload);

  try {
    const res = await fetch(`${BACKEND}/autodarts/game-result`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (responseData.matched === false) {
      console.log('[ADLeague BG] No matching pending fixture found.');
      return;
    }

    console.log('[ADLeague BG] ✅ Fixture updated!', responseData);

    // Notify the popup (if it's open)
    chrome.runtime.sendMessage({ type: 'GAME_DETECTED', fixture: responseData })
      .catch(() => {}); // popup might not be open — that's fine

  } catch (err) {
    console.error('[ADLeague BG] Backend call failed:', err);
  }
}

// ── Extract result from /as/v0/matches/{id}/stats response ────
//
// Confirmed shape from Autodarts API:
// {
//   id, finishedAt,
//   players:    [{ id, index, name, ... }],   ← sorted by index
//   scores:     [{ legs, sets }, ...],         ← indexed by player position
//   matchStats: [{ playerId, average, legsWon, ... }]
// }
function extractResult(data) {
  const players = data.players;
  const scores  = data.scores;
  const stats   = data.matchStats ?? [];

  if (!Array.isArray(players) || players.length < 2) return null;
  if (!Array.isArray(scores)  || scores.length  < 2) return null;

  // Sort by index to get correct player order
  const sorted = [...players].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const p0 = sorted[0];
  const p1 = sorted[1];

  // Map playerId → stats for averages
  const statsById = {};
  stats.forEach(s => { statsById[s.playerId] = s; });
  const s0 = statsById[p0.id] ?? {};
  const s1 = statsById[p1.id] ?? {};

  return {
    homeUsername: p0.name,
    awayUsername: p1.name,
    homeUserId:   p0.userId ?? null,   // Autodarts account UUID (null for local/guest)
    awayUserId:   p1.userId ?? null,
    homeLegsWon:  scores[0]?.legs ?? s0.legsWon ?? 0,
    awayLegsWon:  scores[1]?.legs ?? s1.legsWon ?? 0,
    homeAvg:      s0.average ?? null,
    awayAvg:      s1.average ?? null,
  };
}

function matchPlayer(tournamentPlayers, name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  return tournamentPlayers.find(p =>
    p.autodartsUsername.toLowerCase().trim() === n ||
    p.displayName.toLowerCase().trim() === n
  ) ?? null;
}

// ── Handle messages from popup ────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING_BACKEND') {
    fetch(`${BACKEND}/players`, { signal: AbortSignal.timeout(2000) })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
