const form = document.querySelector('#league-form');
const button = document.querySelector('#load-button');
const status = document.querySelector('#status');
const leagueSummary = document.querySelector('#league-summary');
const results = document.querySelector('#results');
const savedView = document.querySelector('#saved-view');
const tradesView = document.querySelector('#trades-view');
const teamSelect = document.querySelector('#my-team');
const findTradesButton = document.querySelector('#find-trades');
const tradeResults = document.querySelector('#trade-results');
const savedLeagues = document.querySelector('#saved-leagues');
const savedCount = document.querySelector('#saved-count');
const savedKey = 'espn-fantasy-saved-leagues';
const browserImportButton = document.querySelector('#browser-import-button');
let importPoll;

browserImportButton.addEventListener('click', async () => {
  browserImportButton.disabled = true;
  status.className = 'status loading';
  status.textContent = 'Opening ESPN. Sign in, open your league, then click “Use this league” in that browser.';
  try {
    const response = await fetch('/api/browser-import/start', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    importPoll = window.setInterval(checkBrowserImport, 1000);
  } catch (error) {
    browserImportButton.disabled = false;
    status.className = 'status error';
    status.textContent = error.message;
  }
});

async function checkBrowserImport() {
  const response = await fetch('/api/browser-import/status');
  const result = await response.json();
  if (result.output) status.textContent = result.output.split('\n').filter(Boolean).at(-1);
  if (!result.running) {
    window.clearInterval(importPoll);
    browserImportButton.disabled = false;
    if (result.output.includes('Import complete.')) {
      status.className = 'status';
      status.textContent = 'League imported. Trade Lab is ready.';
      await loadImportedLeague();
    } else {
      status.className = 'status error';
    }
  }
}

function getSavedLeagues() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
    const sanitized = saved.filter((item) => item && item.leagueId && item.season).map(({ leagueId, season }) => ({ leagueId, season }));
    localStorage.setItem(savedKey, JSON.stringify(sanitized));
    return sanitized;
  } catch { return []; }
}

function saveLeague(league) {
  const saved = getSavedLeagues().filter((item) => !(item.leagueId === league.leagueId && item.season === league.season));
  saved.unshift(league);
  localStorage.setItem(savedKey, JSON.stringify(saved.slice(0, 10)));
  renderSavedLeagues();
}

function renderSavedLeagues() {
  const saved = getSavedLeagues();
  savedCount.textContent = saved.length;
  savedLeagues.innerHTML = saved.length ? saved.map((league, index) => `<article class="saved-item"><div><strong>League ${escapeHtml(league.leagueId)}</strong><span>${escapeHtml(league.season)} season</span></div><div class="saved-actions"><button type="button" class="use-saved" data-index="${index}">Use details</button><button type="button" class="remove-saved" data-index="${index}" aria-label="Remove league ${escapeHtml(league.leagueId)}">&times;</button></div></article>`).join('') : '<p class="empty-saved">No saved leagues yet. Load a league with “Remember this league” checked.</p>';
}

function showTab(tabName) {
  const isSaved = tabName === 'saved';
  const isTrades = tabName === 'trades';
  form.hidden = isSaved;
  savedView.hidden = !isSaved;
  tradesView.hidden = !isTrades;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active);
  });
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
savedLeagues.addEventListener('click', (event) => {
  const index = Number(event.target.dataset.index);
  if (!Number.isInteger(index)) return;
  const saved = getSavedLeagues();
  if (event.target.classList.contains('remove-saved')) {
    saved.splice(index, 1);
    localStorage.setItem(savedKey, JSON.stringify(saved));
    renderSavedLeagues();
    return;
  }
  if (event.target.classList.contains('use-saved')) {
    const league = saved[index];
    for (const [name, value] of Object.entries(league)) {
      const input = form.elements[name];
      if (input) input.value = value;
    }
    showTab('connect');
    status.className = 'status';
    status.textContent = 'Details filled in. Press “Load league” when ready.';
  }
});
renderSavedLeagues();

function teamName(team) {
  return [team.location, team.nickname].filter(Boolean).join(' ') || team.name || 'Unnamed team';
}

let importedLeague;
const positionNames = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const corePositions = [1, 2, 3, 4];
const minimumDepth = { 1: 2, 2: 5, 3: 5, 4: 3 };
const surplusDepth = { 1: 2, 2: 4, 3: 4, 4: 2 };
const lineupRequirements = { 1: 1, 2: 2, 3: 2, 4: 1 };
const flexSpots = 2;

function playerFromEntry(entry) {
  const player = entry.playerPoolEntry?.player || {};
  const rank = player.draftRanksByRankType?.PPR?.rank || player.draftRanksByRankType?.STANDARD?.rank;
  const season = Number(importedLeague?.season || new Date().getFullYear());
  const projectionStats = player.stats?.filter((stat) => stat.statSourceId === 1 && stat.seasonId === season && stat.appliedTotal > 0).sort((left, right) => Number(right.scoringPeriodId === 0) - Number(left.scoringPeriodId === 0));
  const projection = projectionStats?.[0]?.appliedTotal;
  return { id: entry.playerId, name: player.fullName || 'Unknown player', position: player.defaultPositionId, rank: Number.isFinite(rank) ? rank : 150, projectedPoints: Number.isFinite(projection) ? projection : Math.max(2, 32 - (Number.isFinite(rank) ? rank : 150) * 0.16), injury: player.injuryStatus || 'ACTIVE', slot: entry.lineupSlotId };
}

function teamPlayers(team) {
  return (team.roster?.entries || []).map(playerFromEntry).filter((player) => corePositions.includes(player.position));
}

function lineupValue(players) {
  const remaining = [...players];
  const starters = [];
  const takeBest = (eligible, count) => {
    eligible.sort((left, right) => right.projectedPoints - left.projectedPoints);
    const selected = eligible.splice(0, count);
    starters.push(...selected);
    for (const player of selected) remaining.splice(remaining.indexOf(player), 1);
  };

  for (const [position, count] of Object.entries(lineupRequirements)) {
    takeBest(remaining.filter((player) => player.position === Number(position)), count);
  }
  takeBest(remaining.filter((player) => [2, 3, 4].includes(player.position)), flexSpots);
  return starters.reduce((total, player) => total + player.projectedPoints, 0);
}

function lineupRoles(players) {
  const counts = Object.fromEntries(corePositions.map((position) => [position, 0]));
  for (const player of players) counts[player.position] += 1;
  return counts;
}

function scheduleDifficulty(data, teamId) {
  const teamsById = new Map((data.teams || []).map((team) => [team.id, team]));
  const opponents = (data.schedule || []).filter((matchup) => matchup.home?.teamId === teamId || matchup.away?.teamId === teamId).map((matchup) => matchup.home?.teamId === teamId ? matchup.away?.teamId : matchup.home?.teamId).map((id) => teamsById.get(id)?.currentProjectedRank).filter((rank) => Number.isFinite(rank));
  return opponents.length ? opponents.reduce((sum, rank) => sum + rank, 0) / opponents.length : 0;
}

function fillTradeTeams(data) {
  teamSelect.innerHTML = data.teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name || `Team ${team.id}`)}</option>`).join('');
  teamSelect.disabled = false;
  findTradesButton.disabled = false;
}

function findTradeIdeas() {
  const data = importedLeague.data;
  const mine = data.teams.find((team) => String(team.id) === teamSelect.value);
  if (!mine) return;
  const minePlayers = teamPlayers(mine);
  const myCounts = Object.fromEntries(corePositions.map((position) => [position, minePlayers.filter((player) => player.position === position).length]));
  const currentLineup = lineupValue(minePlayers);
  const scheduleRank = scheduleDifficulty(data, mine.id);
  const ideas = [];

  for (const other of data.teams.filter((team) => team.id !== mine.id)) {
    const otherPlayers = teamPlayers(other);
    const otherCounts = Object.fromEntries(corePositions.map((position) => [position, otherPlayers.filter((player) => player.position === position).length]));
    const otherLineup = lineupValue(otherPlayers);
    for (const outgoing of minePlayers.filter((player) => player.rank <= 150)) {
      for (const incoming of otherPlayers.filter((player) => player.rank <= 150)) {
        const myAfter = lineupValue(minePlayers.filter((player) => player.id !== outgoing.id).concat(incoming));
        const otherAfter = lineupValue(otherPlayers.filter((player) => player.id !== incoming.id).concat(outgoing));
        const myGain = myAfter - currentLineup;
        const otherGain = otherAfter - otherLineup;
        const myBeforeRoles = lineupRoles(minePlayers);
        const myAfterRoles = lineupRoles(minePlayers.filter((player) => player.id !== outgoing.id).concat(incoming));
        const valueGap = Math.abs(outgoing.rank - incoming.rank);
        const valueGain = outgoing.rank - incoming.rank;
        const injuryPenalty = incoming.injury === 'OUT' || incoming.injury === 'IR' ? 12 : incoming.injury === 'QUESTIONABLE' ? 5 : 0;
        const scheduleBonus = scheduleRank && scheduleRank < 6 ? 5 : 0;
        const otherRosterBenefit = otherCounts[outgoing.position] < minimumDepth[outgoing.position] || otherCounts[outgoing.position] <= surplusDepth[outgoing.position];
        const score = Math.round(myGain * 5 + otherGain * 3 + (otherRosterBenefit ? 12 : 0) + scheduleBonus + Math.max(-8, Math.min(8, valueGain * 0.25)) - valueGap * 0.1 - injuryPenalty);
        const roleImprovement = myGain >= 0.5 && myAfter > currentLineup;
        if (myGain >= 0.5 && otherGain >= -3 && otherRosterBenefit && valueGap <= 80 && score >= 5 && roleImprovement) ideas.push({ score, other, outgoing, incoming, scheduleRank, myCounts, otherCounts, valueGain, myGain, otherGain, currentLineup, myAfter, otherLineup, otherAfter, myBeforeRoles, myAfterRoles });
      }
    }
  }

  ideas.sort((left, right) => right.score - left.score);
  tradeResults.innerHTML = ideas.slice(0, 8).map((idea, index) => {
    const valueText = idea.valueGain > 3 ? `ESPN draft rank improves by about ${Math.round(idea.valueGain)} spots.` : idea.valueGain < -3 ? `You give up about ${Math.round(Math.abs(idea.valueGain))} rank spots, but the lineup gain makes up for it.` : 'The player values are close, making this easier to negotiate.';
    const scheduleText = idea.scheduleRank ? (idea.scheduleRank < 6 ? `Your opponents average projected rank is ${idea.scheduleRank.toFixed(1)}, a difficult schedule, so adding depth matters more.` : `Your opponents average projected rank is ${idea.scheduleRank.toFixed(1)}, so this adds useful depth without relying on an easy schedule.`) : 'No matchup schedule was available for this league.';
    const roleChanges = corePositions.filter((position) => idea.myAfterRoles[position] !== idea.myBeforeRoles[position]).map((position) => `${positionNames[position]} ${idea.myBeforeRoles[position]} &rarr; ${idea.myAfterRoles[position]}`).join(', ');
    const acceptanceText = idea.otherGain >= 0 ? `Their best lineup improves by <strong>+${idea.otherGain.toFixed(1)}</strong> points (${idea.otherLineup.toFixed(1)} &rarr; ${idea.otherAfter.toFixed(1)}).` : `This favors you by ${Math.abs(idea.otherGain).toFixed(1)} projected points, but they fill a roster gap at ${positionNames[idea.outgoing.position]} and stay within a reasonable value range.`;
    return `<details class="trade-card" ${index === 0 ? 'open' : ''}><summary><div class="trade-score">${idea.score}<span>fit</span></div><div class="trade-content"><p class="trade-offer">Offer <strong>${escapeHtml(idea.outgoing.name)}</strong> to <strong>${escapeHtml(idea.other.name || `Team ${idea.other.id}`)}</strong></p><p class="trade-receive">Receive <strong>${escapeHtml(idea.incoming.name)}</strong> <span class="role-chip">${positionNames[idea.incoming.position]}</span></p></div><span class="trade-toggle" aria-hidden="true">+</span></summary><div class="trade-detail"><div class="trade-benefit-grid"><div class="trade-benefit"><b>Why it helps you</b><span>Your best lineup improves by <strong>+${idea.myGain.toFixed(1)}</strong> projected points (${idea.currentLineup.toFixed(1)} &rarr; ${idea.myAfter.toFixed(1)}). Role depth changes: ${roleChanges || 'flex coverage improves'}. ${valueText}</span></div><div class="trade-benefit"><b>Why they may accept</b><span>${acceptanceText}</span></div></div><p class="trade-reason">${scheduleText}</p></div></details>`;
  }).join('') || '<p class="empty-saved">No mutually sensible offers found from the current rosters. Try selecting another team or update the league after new trades.</p>';
}

function otherPositionCount(team, position) {
  return teamPlayers(team).filter((player) => player.position === position).length;
}

findTradesButton.addEventListener('click', findTradeIdeas);

async function loadImportedLeague() {
  try {
    const response = await fetch('/api/imported');
    if (!response.ok) return;
    importedLeague = await response.json();
    fillTradeTeams(importedLeague.data);
    renderTeams(importedLeague.data);
    status.className = 'status';
    status.textContent = `Imported ${importedLeague.data.teams.length} teams from league ${importedLeague.leagueId}.`;
  } catch { /* The manual form remains available when the server is offline. */ }
}

loadImportedLeague();

function renderTeams(data) {
  const teams = data.teams || [];
  if (!teams.length) throw new Error('No teams were found. Confirm the league ID and season.');

  leagueSummary.hidden = false;
  leagueSummary.innerHTML = `<div><span class="summary-label">LEAGUE</span><strong>${escapeHtml(data.settings?.name || 'ESPN Fantasy League')}</strong></div><div><span class="summary-label">TEAMS</span><strong>${teams.length}</strong></div><div><span class="summary-label">PULLED</span><strong>${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong></div>`;
  results.innerHTML = teams.map((team) => {
    const roster = team.roster?.entries || [];
    const players = roster.map((entry) => ({
      name: entry.playerPoolEntry?.player?.fullName || 'Unknown player',
      position: positionNames[entry.playerPoolEntry?.player?.defaultPositionId] || 'UTIL',
    }));
    const record = team.record?.overall || {};
    const recordText = record.wins !== undefined ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : 'Record unavailable';
    const points = Number.isFinite(record.pointsFor) ? record.pointsFor.toFixed(1) : '—';
    return `<article class="team-card"><div class="team-heading"><h3>${escapeHtml(teamName(team))}</h3><span class="team-record">${escapeHtml(recordText)}</span></div><p class="points">${points} <span>points for</span></p><ul>${players.map((player) => `<li>${escapeHtml(player.name || player)}${player.position ? `<span>${escapeHtml(player.position)}</span>` : ''}</li>`).join('')}</ul></article>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  results.innerHTML = '';
  leagueSummary.hidden = true;
  status.className = 'status loading';
  status.textContent = 'Connecting to ESPN...';

  try {
    const formData = new FormData(form);
    const details = Object.fromEntries(formData);
    const response = await fetch('/api/league', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The league could not be loaded.');
    renderTeams(data);
    if (form.elements.remember.checked) saveLeague({ leagueId: details.leagueId, season: details.season });
    status.className = 'status';
    status.textContent = `Loaded ${data.teams.length} teams.`;
  } catch (error) {
    status.className = 'status error';
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});