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
const clearSavedButton = document.querySelector('#clear-saved-button');
const savedKey = 'espn-fantasy-saved-leagues';
const browserImportButton = document.querySelector('#browser-import-button');
const leagueUrlInput = document.querySelector('#league-url');
const leagueTools = document.querySelector('#league-tools');
const standings = document.querySelector('#standings');
const teamSearch = document.querySelector('#team-search');
const positionFilter = document.querySelector('#position-filter');
const refreshButton = document.querySelector('#refresh-button');
const clearDataButton = document.querySelector('#clear-data-button');
const avoidInjured = document.querySelector('#avoid-injured');
const tradeShape = document.querySelector('#trade-shape');
const playerDialog = document.querySelector('#player-dialog');
const playerDetail = document.querySelector('#player-detail');
const closePlayerDialog = document.querySelector('#close-player-dialog');
const aiPanel = document.querySelector('#ai-trade-panel');
const aiState = document.querySelector('#ai-state');
const aiKeyInput = document.querySelector('#ai-key');
const saveAiKey = document.querySelector('#save-ai-key');
const clearAiKey = document.querySelector('#clear-ai-key');
const useAiTrades = document.querySelector('#use-ai-trades');
const runAiTrades = document.querySelector('#run-ai-trades');
const aiResults = document.querySelector('#ai-results');
const waiverResults = document.querySelector('#waiver-results');
const waiverCount = document.querySelector('#waiver-count');
const aiKeyStorage = 'espn-fantasy-openai-key';
let importPoll;

async function startBrowserImport(refresh = false) {
  browserImportButton.disabled = true;
  refreshButton.disabled = true;
  status.className = 'status loading';
  status.textContent = refresh ? 'Opening the saved ESPN league and refreshing data...' : 'Opening ESPN. Sign in, open your league, then click “Use this league” in that browser.';
  try {
    const params = new URLSearchParams();
    if (refresh) params.set('mode', 'refresh');
    if (!refresh && leagueUrlInput.value.trim()) params.set('url', leagueUrlInput.value.trim());
    const query = params.toString();
    const response = await fetch(`/api/browser-import/start${query ? `?${query}` : ''}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    importPoll = window.setInterval(checkBrowserImport, 1000);
  } catch (error) {
    browserImportButton.disabled = false;
    refreshButton.disabled = false;
    status.className = 'status error';
    status.textContent = error.message;
  }
}

browserImportButton.addEventListener('click', () => startBrowserImport(false));
refreshButton.addEventListener('click', () => startBrowserImport(true));

async function checkBrowserImport() {
  try {
    const response = await fetch('/api/browser-import/status');
    const result = await response.json();
    if (result.output) status.textContent = result.output.split('\n').filter(Boolean).at(-1);
    if (!result.running) {
      window.clearInterval(importPoll);
      browserImportButton.disabled = false;
      refreshButton.disabled = false;
      if (result.status === 'complete' || result.output.includes('Import complete.')) {
        status.className = 'status';
        status.textContent = 'League imported. Trade Lab is ready.';
        await loadImportedLeague();
      } else {
        status.className = 'status error';
        status.textContent = result.output.split('\n').filter(Boolean).at(-1) || 'The import stopped. Try again.';
      }
    }
  } catch (error) {
    window.clearInterval(importPoll);
    browserImportButton.disabled = false;
    refreshButton.disabled = false;
    status.className = 'status error';
    status.textContent = `Could not read importer status: ${error.message}`;
  }
}

function getSavedLeagues() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
    const sanitized = saved.filter((item) => item && item.leagueUrl).map(({ leagueUrl, leagueId, season, name }) => ({ leagueUrl, leagueId, season, name: name || 'ESPN Fantasy League' }));
    localStorage.setItem(savedKey, JSON.stringify(sanitized));
    return sanitized;
  } catch { return []; }
}

function saveLeague(league) {
  const saved = getSavedLeagues().filter((item) => item.leagueUrl !== league.leagueUrl);
  saved.unshift(league);
  localStorage.setItem(savedKey, JSON.stringify(saved.slice(0, 10)));
  renderSavedLeagues();
}

function renderSavedLeagues() {
  const saved = getSavedLeagues();
  savedCount.textContent = saved.length;
  savedLeagues.innerHTML = saved.length ? saved.map((league, index) => `<article class="saved-item"><div><strong>${escapeHtml(league.name)}</strong><span>${escapeHtml(league.season || 'Season unavailable')} season</span></div><div class="saved-actions"><button type="button" class="use-saved" data-index="${index}">Use URL</button><button type="button" class="remove-saved" data-index="${index}" aria-label="Remove ${escapeHtml(league.name)}">&times;</button></div></article>`).join('') : '<p class="empty-saved">No saved league URLs yet.</p>';
}

function showTab(tabName) {
  const isSaved = tabName === 'saved';
  const isTrades = tabName === 'trades';
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
    leagueUrlInput.value = league.leagueUrl;
    showTab('connect');
    status.className = 'status';
    status.textContent = 'League URL filled in. Click “Import league URL” when ready.';
  }
});
renderSavedLeagues();
clearSavedButton.addEventListener('click', () => {
  localStorage.removeItem(savedKey);
  renderSavedLeagues();
  status.className = 'status';
  status.textContent = 'Saved league profiles cleared from this browser.';
});

function teamName(team) {
  return [team.location, team.nickname].filter(Boolean).join(' ') || team.name || 'Unnamed team';
}

let importedLeague;
const positionNames = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const lineupSlotNames = { 0: 'QB', 2: 'RB', 3: 'RB/WR', 4: 'WR', 5: 'TE', 6: 'OP', 7: 'DT', 8: 'DE', 9: 'LB', 10: 'DL', 11: 'DB', 12: 'DP', 13: 'D/ST', 14: 'K', 15: 'P', 16: 'HC', 17: 'BENCH', 18: 'IR', 19: 'FLEX', 20: 'FLEX' };
const lineupSlotOrder = { 0: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 19: 17, 20: 18, 17: 90, 18: 100 };
const corePositions = [1, 2, 3, 4];
const minimumDepth = { 1: 2, 2: 5, 3: 5, 4: 3 };
const surplusDepth = { 1: 2, 2: 4, 3: 4, 4: 2 };
const lineupRequirements = { 1: 1, 2: 2, 3: 2, 4: 1 };
const flexSpots = 2;

function playerFromEntry(entry) {
  const player = entry.playerPoolEntry?.player || {};
  const rank = player.draftRanksByRankType?.PPR?.rank || player.draftRanksByRankType?.STANDARD?.rank;
  const season = Number(importedLeague?.season || new Date().getFullYear());
  const projection = player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === season && stat.scoringPeriodId === 0)?.appliedTotal || player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === season)?.appliedTotal;
  const lastSeasonPoints = player.stats?.find((stat) => stat.statSourceId === 0 && stat.seasonId === season - 1 && stat.scoringPeriodId === 0)?.appliedTotal;
  const normalizedRank = Number.isFinite(rank) ? rank : 150;
  return { id: entry.playerId, name: player.fullName || 'Unknown player', position: player.defaultPositionId, rank: normalizedRank, projectedPoints: Number.isFinite(projection) ? projection : Math.max(2, 32 - normalizedRank * 0.16), lastSeasonPoints: Number.isFinite(lastSeasonPoints) ? lastSeasonPoints : null, injury: player.injuryStatus || 'ACTIVE', slot: entry.lineupSlotId };
}

function teamPlayers(team) {
  return (team.roster?.entries || []).map(playerFromEntry).filter((player) => corePositions.includes(player.position));
}

function tradePlayers(team) {
  const injuredStatuses = ['OUT', 'IR', 'QUESTIONABLE'];
  return teamPlayers(team).filter((player) => !avoidInjured.checked || !injuredStatuses.includes(player.injury));
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
  renderWaiverWire(data);
}

function availablePlayers(data) {
  const entries = data.players || data.availablePlayers || data.freeAgents || [];
  return entries.map((entry) => entry.playerPoolEntry?.player || entry.player || entry).filter((player) => player && player.fullName);
}

function waiverPlayer(player, data) {
  const season = Number(importedLeague?.season || data.seasonId || new Date().getFullYear());
  const projection = player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === season && stat.scoringPeriodId === 0)?.appliedTotal || player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === season)?.appliedTotal || 0;
  const lastSeasonPoints = player.stats?.find((stat) => stat.statSourceId === 0 && stat.seasonId === season - 1 && stat.scoringPeriodId === 0)?.appliedTotal || null;
  const rank = player.draftRanksByRankType?.PPR?.rank || player.draftRanksByRankType?.STANDARD?.rank || 250;
  return { id: player.id, name: player.fullName, position: positionNames[player.defaultPositionId] || 'UTIL', positionId: player.defaultPositionId, projectedPoints: Number(projection), lastSeasonPoints: Number.isFinite(lastSeasonPoints) ? lastSeasonPoints : null, rank: Number(rank), injury: player.injuryStatus || 'ACTIVE' };
}

function renderWaiverWire(data) {
  const mine = data.teams?.find((team) => String(team.id) === teamSelect.value) || data.teams?.[0];
  if (!mine) return;
  const rosterIds = new Set((data.teams || []).flatMap((team) => (team.roster?.entries || []).map((entry) => String(entry.playerId))));
  const counts = Object.fromEntries(corePositions.map((position) => [position, teamPlayers(mine).filter((player) => player.position === position).length]));
  const waiver = availablePlayers(data).map((player) => waiverPlayer(player, data)).filter((player) => !rosterIds.has(String(player.id)) && corePositions.includes(player.positionId));
  const targets = waiver.map((player) => {
    const need = counts[player.positionId] < (lineupRequirements[player.positionId] || 1) ? 24 : 0;
    const score = Math.round(need + Math.max(0, player.projectedPoints) * 0.35 + Math.max(0, (player.lastSeasonPoints || 0) - 80) * 0.05 - Math.max(0, player.rank - 100) * 0.04);
    return { ...player, score, action: score >= 28 ? 'TARGET' : score >= 16 ? 'WATCH' : 'PASS', reason: need ? `You are thin at ${player.position}; this player can help cover that spot.` : `Useful depth at ${player.position} if the projection holds.` };
  }).sort((left, right) => right.score - left.score).slice(0, 8);
  waiverCount.textContent = String(waiver.length);
  waiverResults.innerHTML = targets.length ? targets.map((player) => `<article class="waiver-card"><div class="waiver-card-heading"><strong>${escapeHtml(player.name)}</strong><span class="waiver-action ${player.action.toLowerCase()}">${player.action}</span></div><p>${escapeHtml(player.reason)}</p><div class="waiver-metrics"><span>${player.position}</span><span>Proj ${player.projectedPoints.toFixed(1)}</span><span>Last ${player.lastSeasonPoints !== null ? player.lastSeasonPoints.toFixed(1) : '—'}</span></div></article>`).join('') : '<p class="empty-saved">ESPN did not include available players. Refresh the league to load the waiver wire.</p>';
}

function updateAiState() {
  const enabled = Boolean(localStorage.getItem(aiKeyStorage));
  aiPanel.classList.toggle('enabled', enabled);
  aiState.textContent = enabled ? 'Ready' : 'Locked';
  aiState.classList.toggle('ready', enabled);
  useAiTrades.disabled = !enabled;
  runAiTrades.disabled = !enabled || !useAiTrades.checked;
  clearAiKey.hidden = !enabled;
  saveAiKey.textContent = enabled ? 'Update key' : 'Enable AI';
}

function aiPayload() {
  const data = importedLeague.data;
  const mine = data.teams.find((team) => String(team.id) === teamSelect.value);
  return { league: data.settings?.name || 'ESPN Fantasy League', myTeam: { name: teamName(mine), roster: teamPlayers(mine).map((player) => ({ name: player.name, position: positionNames[player.position], projectedPoints: player.projectedPoints, lastSeasonPoints: player.lastSeasonPoints, rank: player.rank, injury: player.injury })) }, teams: data.teams.filter((team) => team.id !== mine.id).map((team) => ({ name: teamName(team), roster: teamPlayers(team).map((player) => ({ name: player.name, position: positionNames[player.position], projectedPoints: player.projectedPoints, lastSeasonPoints: player.lastSeasonPoints, rank: player.rank, injury: player.injury })) })), waiverPlayers: availablePlayers(data).slice(0, 100).map((player) => waiverPlayer(player, data)) };
}

async function runAiAnalysis() {
  aiResults.innerHTML = '<p class="ai-loading">Analyzing roster fit and waiver options...</p>';
  runAiTrades.disabled = true;
  try {
    const response = await fetch('/api/ai/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: localStorage.getItem(aiKeyStorage), payload: aiPayload() }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'AI analysis failed.');
    aiResults.innerHTML = `<div class="ai-summary"><strong>AI read</strong><p>${escapeHtml(result.summary || 'No summary returned.')}</p></div>${(result.tradeIdeas || []).map((idea) => `<article class="ai-result-card"><strong>${escapeHtml(idea.offer || 'Trade offer')}</strong><span>for ${escapeHtml(idea.receive || 'target')}</span><b>${escapeHtml(idea.fit || 'Fit not rated')}</b><p>${escapeHtml(idea.whyItHelps || '')}</p><small>${escapeHtml(idea.whyTheyAccept || '')} Risk: ${escapeHtml(idea.risk || 'Review before acting.')}</small></article>`).join('')}${(result.waiverTargets || []).map((idea) => `<article class="ai-result-card"><strong>${escapeHtml(idea.action || 'WAIVER')}</strong><span>${escapeHtml(idea.player || '')}</span><p>${escapeHtml(idea.reason || '')}</p></article>`).join('')}`;
  } catch (error) { aiResults.innerHTML = `<p class="status error">${escapeHtml(error.message)}</p>`; }
  updateAiState();
}

saveAiKey.addEventListener('click', () => { const key = aiKeyInput.value.trim(); if (!key) return; localStorage.setItem(aiKeyStorage, key); aiKeyInput.value = ''; updateAiState(); });
clearAiKey.addEventListener('click', () => { localStorage.removeItem(aiKeyStorage); useAiTrades.checked = false; updateAiState(); });
useAiTrades.addEventListener('change', updateAiState);
runAiTrades.addEventListener('click', runAiAnalysis);
updateAiState();

function findTradeIdeas() {
  const data = importedLeague.data;
  const mine = data.teams.find((team) => String(team.id) === teamSelect.value);
  if (!mine) return;
  const minePlayers = tradePlayers(mine);
  const myCounts = Object.fromEntries(corePositions.map((position) => [position, minePlayers.filter((player) => player.position === position).length]));
  const currentLineup = lineupValue(minePlayers);
  const scheduleRank = scheduleDifficulty(data, mine.id);
  const ideas = [];

  for (const other of data.teams.filter((team) => team.id !== mine.id)) {
    const otherPlayers = tradePlayers(other);
    const otherCounts = Object.fromEntries(corePositions.map((position) => [position, otherPlayers.filter((player) => player.position === position).length]));
    const otherLineup = lineupValue(otherPlayers);
    const tradeCandidates = minePlayers.filter((player) => player.rank <= 150);
    const outgoingOptions = tradeShape.value === 'two'
      ? tradeCandidates.flatMap((player, index) => tradeCandidates.slice(index + 1).map((partner) => [player, partner]))
      : tradeCandidates.map((player) => [player]);
    for (const outgoing of outgoingOptions) {
      for (const incoming of otherPlayers.filter((player) => player.rank <= 150)) {
        const outgoingIds = new Set(outgoing.map((player) => player.id));
        const myAfter = lineupValue(minePlayers.filter((player) => !outgoingIds.has(player.id)).concat(incoming));
        const otherAfter = lineupValue(otherPlayers.filter((player) => player.id !== incoming.id).concat(outgoing));
        const myGain = myAfter - currentLineup;
        const otherGain = otherAfter - otherLineup;
        const myBeforeRoles = lineupRoles(minePlayers);
        const myAfterRoles = lineupRoles(minePlayers.filter((player) => !outgoingIds.has(player.id)).concat(incoming));
        const outgoingRank = outgoing.reduce((total, player) => total + player.rank, 0);
        const valueGap = Math.abs(outgoingRank - incoming.rank);
        const valueGain = outgoingRank - incoming.rank;
        const injuryPenalty = incoming.injury === 'OUT' || incoming.injury === 'IR' ? 12 : incoming.injury === 'QUESTIONABLE' ? 5 : 0;
        const scheduleBonus = scheduleRank && scheduleRank < 6 ? 5 : 0;
        const otherRosterBenefit = outgoing.some((player) => otherCounts[player.position] < minimumDepth[player.position] || otherCounts[player.position] <= surplusDepth[player.position]);
        const lineupComponent = Math.round(myGain * 5);
        const partnerComponent = Math.round(otherGain * 3);
        const needComponent = otherRosterBenefit ? 12 : 0;
        const valueComponent = Math.round(Math.max(-8, Math.min(8, valueGain * 0.25)) - valueGap * 0.1);
        const scheduleComponent = scheduleBonus;
        const healthComponent = -injuryPenalty;
        const score = Math.round(lineupComponent + partnerComponent + needComponent + valueComponent + scheduleComponent + healthComponent);
        const fitTier = score >= 35 ? 'Excellent fit' : score >= 22 ? 'Good fit' : score >= 10 ? 'Workable fit' : 'Thin fit';
        const fitMeaning = score >= 35 ? 'Strong lineup improvement for you and a clear reason for the other team to say yes.' : score >= 22 ? 'A sensible two-sided offer with useful lineup or roster help.' : score >= 10 ? 'There is a path to agreement, but the gain is modest or depends on context.' : 'This needs a specific roster or negotiation reason before it is worth pursuing.';
        const roleImprovement = myGain >= 0.5 && myAfter > currentLineup;
        if (myGain >= 0.5 && otherGain >= -3 && otherRosterBenefit && valueGap <= 80 && score >= 5 && roleImprovement) ideas.push({ score, fitTier, fitMeaning, lineupComponent, partnerComponent, needComponent, valueComponent, scheduleComponent, healthComponent, other, outgoing, incoming, scheduleRank, myCounts, otherCounts, valueGain, myGain, otherGain, currentLineup, myAfter, otherLineup, otherAfter, myBeforeRoles, myAfterRoles });
      }
    }
  }

  ideas.sort((left, right) => right.score - left.score);
  tradeResults.innerHTML = ideas.slice(0, 8).map((idea, index) => {
    const valueText = idea.valueGain > 3 ? `ESPN draft rank improves by about ${Math.round(idea.valueGain)} spots.` : idea.valueGain < -3 ? `You give up about ${Math.round(Math.abs(idea.valueGain))} rank spots, but the lineup gain makes up for it.` : 'The player values are close, making this easier to negotiate.';
    const scheduleText = idea.scheduleRank ? (idea.scheduleRank < 6 ? `Your opponents average projected rank is ${idea.scheduleRank.toFixed(1)}, a difficult schedule, so adding depth matters more.` : `Your opponents average projected rank is ${idea.scheduleRank.toFixed(1)}, so this adds useful depth without relying on an easy schedule.`) : 'No matchup schedule was available for this league.';
    const roleChanges = corePositions.filter((position) => idea.myAfterRoles[position] !== idea.myBeforeRoles[position]).map((position) => `${positionNames[position]} ${idea.myBeforeRoles[position]} &rarr; ${idea.myAfterRoles[position]}`).join(', ');
    const outgoingText = idea.outgoing.map((player) => escapeHtml(player.name)).join(' + ');
    const outgoingPosition = positionNames[idea.outgoing[0].position];
    const acceptanceText = idea.otherGain >= 0 ? `Their best lineup improves by <strong>+${idea.otherGain.toFixed(1)}</strong> points (${idea.otherLineup.toFixed(1)} &rarr; ${idea.otherAfter.toFixed(1)}).` : `This favors you by ${Math.abs(idea.otherGain).toFixed(1)} projected points, but they fill a roster gap at ${outgoingPosition} and stay within a reasonable value range.`;
    const scoreBreakdown = [['Lineup gain', idea.lineupComponent], ['Partner benefit', idea.partnerComponent], ['Roster need', idea.needComponent], ['Player value', idea.valueComponent], ['Schedule', idea.scheduleComponent], ['Health', idea.healthComponent]].map(([label, value]) => `<span><b>${escapeHtml(label)}</b><em>${value > 0 ? '+' : ''}${value}</em></span>`).join('');
    return `<details class="trade-card" ${index === 0 ? 'open' : ''}><summary><div class="trade-score">${idea.score}<span>fit points</span></div><div class="trade-content"><p class="fit-tier">${idea.fitTier}</p><p class="trade-offer">Offer <strong>${outgoingText}</strong> to <strong>${escapeHtml(idea.other.name || `Team ${idea.other.id}`)}</strong></p><p class="trade-receive">Receive <strong>${escapeHtml(idea.incoming.name)}</strong> <span class="role-chip">${positionNames[idea.incoming.position]}</span></p></div><span class="trade-toggle" aria-hidden="true">+</span></summary><div class="trade-detail"><p class="fit-meaning"><strong>What this means:</strong> ${idea.fitMeaning}</p><div class="fit-breakdown">${scoreBreakdown}</div><div class="trade-benefit-grid"><div class="trade-benefit"><b>Why it helps you</b><span>Your best lineup improves by <strong>+${idea.myGain.toFixed(1)}</strong> projected points (${idea.currentLineup.toFixed(1)} &rarr; ${idea.myAfter.toFixed(1)}). Role depth changes: ${roleChanges || 'flex coverage improves'}. ${valueText}</span></div><div class="trade-benefit"><b>Why they may accept</b><span>${acceptanceText}</span></div></div><p class="trade-reason">${scheduleText}</p></div></details>`;
  }).join('') || '<p class="empty-saved">No mutually sensible offers found from the current rosters. Try selecting another team or update the league after new trades.</p>';
}

function otherPositionCount(team, position) {
  return teamPlayers(team).filter((player) => player.position === position).length;
}

findTradesButton.addEventListener('click', findTradeIdeas);
avoidInjured.addEventListener('change', () => {
  if (importedLeague) findTradeIdeas();
});
tradeShape.addEventListener('change', () => {
  if (importedLeague) findTradeIdeas();
});

async function loadImportedLeague() {
  try {
    const response = await fetch('/api/imported');
    if (!response.ok) {
      refreshButton.disabled = true;
      return;
    }
    importedLeague = await response.json();
    fillTradeTeams(importedLeague.data);
    renderTeams(importedLeague.data);
    renderStandings(importedLeague.data);
    leagueTools.hidden = false;
    refreshButton.disabled = !importedLeague.leagueUrl;
    if (importedLeague.leagueUrl) saveLeague({ leagueUrl: importedLeague.leagueUrl, leagueId: importedLeague.leagueId, season: importedLeague.season, name: importedLeague.data.settings?.name || 'ESPN Fantasy League' });
    status.className = 'status';
    status.textContent = importedLeague.leagueUrl ? `Imported ${importedLeague.data.teams.length} teams from league ${importedLeague.leagueId}.` : `Imported ${importedLeague.data.teams.length} teams. Run the browser importer once to enable automatic refresh.`;
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Could not load saved league data: ${error.message}`;
  }
}

loadImportedLeague();

function renderTeams(data) {
  const teams = data.teams || [];
  if (!teams.length) throw new Error('No teams were found. Confirm the league ID and season.');

  leagueSummary.hidden = false;
  const pulledAt = importedLeague?.pulledAt ? new Date(importedLeague.pulledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
  leagueSummary.innerHTML = `<div><span class="summary-label">LEAGUE</span><strong>${escapeHtml(data.settings?.name || 'ESPN Fantasy League')}</strong></div><div><span class="summary-label">TEAMS</span><strong>${teams.length}</strong></div><div><span class="summary-label">UPDATED</span><strong>${escapeHtml(pulledAt)}</strong></div>`;
  const memberNames = new Map((data.members || []).map((member) => [member.id, [member.firstName, member.lastName].filter(Boolean).join(' ') || member.displayName]));
  const search = teamSearch.value.trim().toLowerCase();
  const selectedPosition = positionFilter.value;
  const visibleTeams = teams.filter((team) => {
    const owner = (team.owners || []).map((id) => memberNames.get(id) || '').join(' ');
    const matchesSearch = !search || `${teamName(team)} ${owner}`.toLowerCase().includes(search);
    const matchesPosition = selectedPosition === 'all' || (team.roster?.entries || []).some((entry) => String(entry.playerPoolEntry?.player?.defaultPositionId) === selectedPosition);
    return matchesSearch && matchesPosition;
  });
  results.innerHTML = visibleTeams.map((team) => {
    const roster = team.roster?.entries || [];
    const players = roster.map((entry, index) => {
      const player = entry.playerPoolEntry?.player || {};
      const slotId = Number(entry.lineupSlotId);
      const slot = lineupSlotNames[slotId] || positionNames[player.defaultPositionId] || 'ROSTER';
      const section = slot === 'IR' ? 'ir' : slot === 'BENCH' ? 'bench' : 'starters';
      const rank = player.draftRanksByRankType?.PPR?.rank || player.draftRanksByRankType?.STANDARD?.rank;
      const stats = player.stats?.filter((stat) => stat.appliedTotal !== undefined).sort((left, right) => Number(right.scoringPeriodId || 0) - Number(left.scoringPeriodId || 0));
      const currentSeason = Number(importedLeague?.season || new Date().getFullYear());
      const projectedPoints = player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === currentSeason && stat.scoringPeriodId === 0)?.appliedTotal || player.stats?.find((stat) => stat.statSourceId === 1 && stat.seasonId === currentSeason)?.appliedTotal;
      const lastSeasonPoints = player.stats?.find((stat) => stat.statSourceId === 0 && stat.seasonId === currentSeason - 1 && stat.scoringPeriodId === 0)?.appliedTotal;
      return { id: entry.playerId, name: player.fullName || 'Unknown player', position: positionNames[player.defaultPositionId] || 'UTIL', slot, section, injury: player.injuryStatus || 'ACTIVE', rank: Number.isFinite(rank) ? rank : null, projectedPoints, lastSeasonPoints: Number.isFinite(lastSeasonPoints) ? lastSeasonPoints : null, stats: stats?.[0], order: lineupSlotOrder[slotId] ?? 50, sourceOrder: index };
    }).sort((left, right) => left.order - right.order || left.sourceOrder - right.sourceOrder);
    const record = team.record?.overall || {};
    const recordText = record.wins !== undefined ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : 'Record unavailable';
    const points = Number.isFinite(record.pointsFor) ? record.pointsFor.toFixed(1) : '—';
    const owner = (team.owners || []).map((id) => memberNames.get(id)).filter(Boolean).join(', ');
    const logo = team.logo ? `<img src="${escapeHtml(team.logo)}" alt="" loading="lazy" />` : '';
    const rosterSection = (section, title, sectionPlayers) => sectionPlayers.length ? `<section class="roster-section"><div class="roster-section-heading"><h4>${title}</h4><span>${sectionPlayers.length} player${sectionPlayers.length === 1 ? '' : 's'}</span></div><ol class="roster-list">${sectionPlayers.map((player, index) => `<li><button class="player-row" type="button" data-player-id="${escapeHtml(player.id)}" data-team-id="${escapeHtml(team.id)}"><span class="roster-number">${index + 1}</span><span class="roster-player"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.injury)}</small></span><span class="roster-metrics"><span>Proj <b>${player.projectedPoints !== undefined ? Number(player.projectedPoints).toFixed(1) : '—'}</b></span><span>Last <b>${player.lastSeasonPoints !== null ? Number(player.lastSeasonPoints).toFixed(1) : '—'}</b></span></span><span class="roster-tags"><b>${escapeHtml(player.slot)}</b><em>${escapeHtml(player.position)}</em></span></button></li>`).join('')}</ol></section>` : '';
    return `<article class="team-card"><div class="team-heading">${logo}<div class="team-title"><h3>${escapeHtml(teamName(team))}</h3>${owner ? `<span class="team-owner">${escapeHtml(owner)}</span>` : ''}</div><span class="team-record">${escapeHtml(recordText)}</span></div><p class="points">${points} <span>points for</span></p><div class="roster-label">Roster order</div>${rosterSection('starters', 'Starting lineup', players.filter((player) => player.section === 'starters'))}${rosterSection('bench', 'Bench', players.filter((player) => player.section === 'bench'))}${rosterSection('ir', 'Injured reserve', players.filter((player) => player.section === 'ir'))}</article>`;
  }).join('') || '<p class="empty-saved">No teams match these filters.</p>';
}

function showPlayerDetails(player, team) {
  const statValues = player.stats ? Object.entries(player.stats).filter(([key, value]) => !['id', 'seasonId', 'scoringPeriodId', 'statSourceId', 'appliedTotal'].includes(key) && (typeof value === 'number' || typeof value === 'string')).slice(0, 8) : [];
  const statsMarkup = statValues.length ? `<div class="player-stats">${statValues.map(([key, value]) => `<div><span>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : '<p class="player-muted">No additional statistics were included in this ESPN response.</p>';
  playerDetail.innerHTML = `<p class="section-label">Player details</p><h2>${escapeHtml(player.name)}</h2><p class="player-subtitle">${escapeHtml(teamName(team))}</p><div class="player-facts"><div><span>Position</span><strong>${escapeHtml(player.position)}</strong></div><div><span>Lineup slot</span><strong>${escapeHtml(player.slot)}</strong></div><div><span>Status</span><strong>${escapeHtml(player.injury)}</strong></div><div><span>Draft rank</span><strong>${player.rank ?? 'Unavailable'}</strong></div><div><span>Projected points</span><strong>${player.projectedPoints !== undefined ? Number(player.projectedPoints).toFixed(1) : 'Unavailable'}</strong></div><div><span>Last-season points</span><strong>${player.lastSeasonPoints !== null && player.lastSeasonPoints !== undefined ? Number(player.lastSeasonPoints).toFixed(1) : 'Unavailable'}</strong></div></div><h3>Available stats</h3>${statsMarkup}`;
  playerDialog.showModal();
}

results.addEventListener('click', (event) => {
  const button = event.target.closest('.player-row');
  if (!button || !importedLeague) return;
  const team = importedLeague.data.teams.find((candidate) => String(candidate.id) === button.dataset.teamId);
  const entry = team?.roster?.entries?.find((candidate) => String(candidate.playerId) === button.dataset.playerId);
  if (!team || !entry) return;
  const player = entry.playerPoolEntry?.player || {};
  const slotId = Number(entry.lineupSlotId);
  const rank = player.draftRanksByRankType?.PPR?.rank || player.draftRanksByRankType?.STANDARD?.rank;
  showPlayerDetails({ ...playerFromEntry(entry), position: positionNames[player.defaultPositionId] || 'UTIL', slot: lineupSlotNames[slotId] || 'ROSTER', stats: player.stats?.[0] }, team);
});

closePlayerDialog.addEventListener('click', () => playerDialog.close());
playerDialog.addEventListener('click', (event) => { if (event.target === playerDialog) playerDialog.close(); });

function renderStandings(data) {
  const memberNames = new Map((data.members || []).map((member) => [member.id, [member.firstName, member.lastName].filter(Boolean).join(' ') || member.displayName]));
  const teams = [...(data.teams || [])].sort((left, right) => {
    const leftRecord = left.record?.overall || {};
    const rightRecord = right.record?.overall || {};
    return Number(rightRecord.wins || 0) - Number(leftRecord.wins || 0) || Number(rightRecord.pointsFor || 0) - Number(leftRecord.pointsFor || 0);
  });
  standings.hidden = false;
  standings.innerHTML = `<div class="section-heading"><div><p class="section-label">Standings</p><h2>League table</h2></div><span class="secure-note">Wins, then points for</span></div><div class="standings-table"><div class="standing-row standing-head"><span>#</span><span>Team</span><span>Record</span><span>Points</span></div>${teams.map((team, index) => { const record = team.record?.overall || {}; const owner = (team.owners || []).map((id) => memberNames.get(id)).filter(Boolean).join(', '); return `<div class="standing-row"><span>${index + 1}</span><strong>${escapeHtml(teamName(team))}<small>${escapeHtml(owner)}</small></strong><span>${record.wins ?? 0}-${record.losses ?? 0}${record.ties ? `-${record.ties}` : ''}</span><span>${Number(record.pointsFor || 0).toFixed(1)}</span></div>`; }).join('')}</div>`;
}

teamSearch.addEventListener('input', () => importedLeague && renderTeams(importedLeague.data));
positionFilter.addEventListener('change', () => importedLeague && renderTeams(importedLeague.data));

clearDataButton.addEventListener('click', async () => {
  clearDataButton.disabled = true;
  try {
    const response = await fetch('/api/imported/clear', { method: 'POST' });
    if (!response.ok) throw new Error((await response.json()).error || 'Clear failed.');
    importedLeague = null;
    results.innerHTML = '';
    standings.hidden = true;
    leagueTools.hidden = true;
    leagueSummary.hidden = true;
    refreshButton.disabled = true;
    status.className = 'status';
    status.textContent = 'Imported league data cleared from this computer.';
  } catch (error) {
    status.className = 'status error';
    status.textContent = error.message;
  } finally {
    clearDataButton.disabled = false;
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
