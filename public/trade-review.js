// Trade review logic for the Trade Lab tab.
//
// This file is intentionally free of DOM access so it can be unit tested with
// `node --test`. The viewer loads it with a <script> tag and reads window.TradeReview.
//
// ESPN returns trade proposals from `view=mPendingTransactions` (and history from
// `view=mTransactions2`). A transaction looks like:
//   { id, teamId, type: 'TRADE_PROPOSAL', status: 'PENDING', proposedDate, items: [...] }
// and each trade item looks like:
//   { type: 'TRADE', playerId, fromTeamId, toTeamId }
// `teamId` is the team that proposed the offer, `fromTeamId` gives the player away,
// and `toTeamId` receives that player.
(function (global) {
  'use strict';

  const corePositions = [1, 2, 3, 4];
  const injuredStatuses = ['OUT', 'IR', 'QUESTIONABLE'];
  const closedStatuses = ['CANCELED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'REVOKED'];
  const defaultRequirements = { 1: 1, 2: 2, 3: 2, 4: 1 };

// Starting-lineup requirements per core position (QB/RB/WR/TE as 1/2/3/4).
// Callers can pass their own via settings.requirements; this returns the copy
// used by default so shared objects are never mutated by accident.
function lineupRequirements() {
  return { ...defaultRequirements };
}

  const scheduleLabels = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };

  // ESPN fantasy team IDs are 1-32 (0 = free agent). The table covers the
  // standard NFL rotation; if ESPN adds/renumbers teams the lookup simply
  // misses and the bye-week part of the review is skipped, never wrong.
  const proTeamByeWeeks = {
    1: 14, 2: 14, 3: 11, 4: 11, 5: 14, 6: 11, 7: 5, 8: 5, 9: 11, 10: 10,
    11: 6, 12: 6, 13: 7, 14: 9, 15: 12, 16: 7, 17: 10, 18: 8, 19: 8,
    20: 12, 21: 9, 22: 9, 23: 14, 24: 12, 25: 5, 26: 10, 27: 7,
    28: 6, 29: 8, 30: 12, 33: 9, 34: 9,
  };

  // Bye-week + schedule context ------------------------------------------------
  //
  // playoffStartWeek reads the regular-season length out of mSettings
  // (scheduleSettings.matchupPeriodCount) so playoff "win now vs later"
  // notes never rely on a hardcoded week. currentWeek reads
  // status.currentMatchupPeriod with fallbacks for older payloads.
  function playoffStartWeek(data) {
    const count = Number(data && data.settings && data.settings.scheduleSettings
      && data.settings.scheduleSettings.matchupPeriodCount);
    if (Number.isFinite(count) && count > 0) return count + 1;
    const finalWeek = Number(data && data.status && data.status.finalScoringPeriod);
    if (Number.isFinite(finalWeek) && finalWeek > 0) return finalWeek - 2;
    return 15;
  }

  function currentWeek(data) {
    const week = Number(data && data.status && (data.status.currentMatchupPeriod || data.status.scoringPeriodId))
      || Number(data && data.scoringPeriodId);
    return Number.isFinite(week) && week > 0 ? week : 1;
  }

  function byeWeekOf(player) {
    const id = Number(player && player.proTeamId);
    if (!Number.isFinite(id)) return null;
    const week = proTeamByeWeeks[id];
    return Number.isFinite(week) ? week : null;
  }

  function teamPointsFor(data, teamId) {
    const teams = (data && data.teams) || [];
    for (const team of teams) {
      if (Number(team.id) !== Number(teamId)) continue;
      const points = Number(team.record && team.record.overall && team.record.overall.pointsFor);
      return Number.isFinite(points) ? points : 0;
    }
    return 0;
  }
  function teamName(team) {
    return [team && team.location, team && team.nickname].filter(Boolean).join(' ') || (team && team.name) || 'Unnamed team';
  }


  // Average opponent season points-for across the fantasy schedule
  // (mMatchup view). 0 games means "no schedule data", not "easy schedule".
  function scheduleDifficulty(data, teamId) {
    const schedule = (data && data.schedule) || [];
    let total = 0;
    let games = 0;
    for (const matchup of schedule) {
      if (!matchup || typeof matchup !== 'object') continue;
      const homeId = Number(matchup.home && matchup.home.teamId);
      const awayId = Number(matchup.away && matchup.away.teamId);
      let opponentId = null;
      if (homeId === Number(teamId) && Number.isFinite(awayId)) opponentId = awayId;
      else if (awayId === Number(teamId) && Number.isFinite(homeId)) opponentId = homeId;
      else continue;
      total += teamPointsFor(data, opponentId);
      games += 1;
    }
    return { average: games ? total / games : 0, games };
  }

  // Near-term context: opponents in the next two matchup periods plus any
  // traded players whose NFL bye lands in that window.
  function upcomingContext(data, teamId, players) {
    const week = currentWeek(data);
    const playoffsAt = playoffStartWeek(data);
    const schedule = (data && data.schedule) || [];
    const opponents = [];
    for (const matchup of schedule) {
      const period = Number(matchup && matchup.matchupPeriodId);
      if (period !== week && period !== week + 1) continue;
      const homeId = Number(matchup.home && matchup.home.teamId);
      const awayId = Number(matchup.away && matchup.away.teamId);
      if (homeId === Number(teamId) && Number.isFinite(awayId)) opponents.push({ week: period, opponentId: awayId });
      else if (awayId === Number(teamId) && Number.isFinite(homeId)) opponents.push({ week: period, opponentId: homeId });
    }
    const byeHits = (players || [])
      .map((player) => ({ player, bye: byeWeekOf(player) }))
      .filter((entry) => entry.bye !== null && (entry.bye === week || entry.bye === week + 1));
    return { week, playoffsAt, opponents, byeHits };
  }

  // Builds a paste-ready offer message for the trade cards ("Offer X for Y").
  // Pure function (no clipboard access) so node --test can cover it; app.js
  // wires it to navigator.clipboard with an execCommand fallback.
  function buildOfferText({ myTeamName, partnerName, giveNames, receiveNames, score, verdict }) {
    const give = (giveNames || []).join(', ') || '—';
    const receive = (receiveNames || []).join(', ') || '—';
    const scoreText = Number.isFinite(Number(score)) ? ` (fit ${Math.round(Number(score))})` : '';
    const lines = [
      `Trade offer${partnerName ? ` to ${partnerName}` : ''}:`,
      `• I give: ${give}`,
      `• I receive: ${receive}`,
    ];
    if (verdict) lines.push(`• My read: ${verdict}${scoreText}`);
    if (myTeamName) lines.push(`— ${myTeamName}`);
    return lines.join('\n');
  }

  function isTradeTransaction(transaction) {
    return Boolean(transaction) && typeof transaction.type === 'string' && transaction.type.indexOf('TRADE') === 0;
  }

  function isPendingTransaction(transaction) {
    const status = String(transaction.status || '').toUpperCase();
    if (closedStatuses.indexOf(status) >= 0) return false;
    if (transaction.isPending === true) return true;
    if (transaction.type === 'TRADE_PROPOSAL') return status !== 'EXECUTED';
    return status === 'PENDING';
  }

  function tradeItems(transaction) {
    return (transaction.items || []).filter((item) => item && item.type === 'TRADE' && item.playerId !== undefined);
  }

  function owningTeamId(transaction) {
    const raw = transaction.teamId;
    return raw === undefined || raw === null || raw === '' ? null : Number(raw);
  }

  function buildTrade(transaction, myTeamId) {
    const items = tradeItems(transaction);
    const proposerId = owningTeamId(transaction);
    const receivedIds = items.filter((item) => Number(item.toTeamId) === myTeamId).map((item) => item.playerId);
    const gaveIds = items.filter((item) => Number(item.fromTeamId) === myTeamId).map((item) => item.playerId);
    // The other manager in the deal, whether you proposed it or they did.
    const counterpartyId = items
      .map((item) => Number(item.fromTeamId) === myTeamId ? Number(item.toTeamId) : Number(item.fromTeamId))
      .find((teamId) => Number.isFinite(teamId) && teamId !== myTeamId);
    const fallbackId = `${proposerId}-${receivedIds.join('.')}-${gaveIds.join('.')}`;
    return {
      id: transaction.id === undefined || transaction.id === null ? fallbackId : String(transaction.id),
      proposerId,
      counterpartyId: counterpartyId === undefined ? null : counterpartyId,
      type: transaction.type,
      status: transaction.status || '',
      proposedDate: Number(transaction.proposedDate || transaction.processDate || transaction.acceptedDate || 0),
      receivedIds,
      gaveIds,
    };
  }

  function transactionFeed(data) {
    if (!data) return [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const pendingTransactions = Array.isArray(data.pendingTransactions) ? data.pendingTransactions : [];
    return transactions.concat(pendingTransactions);
  }

  // Splits pending trades into the ones waiting on your answer and the ones you sent.
  // Offers you sent are returned separately so the viewer never scores your own proposal.
  function collectPendingTrades(data, myTeamId) {
    const teamId = Number(myTeamId);
    const seen = new Set();
    const received = [];
    const sent = [];

    for (const transaction of transactionFeed(data)) {
      if (!isTradeTransaction(transaction) || !isPendingTransaction(transaction)) continue;
      const trade = buildTrade(transaction, teamId);
      if (!trade.gaveIds.length && !trade.receivedIds.length) continue;
      if (seen.has(trade.id)) continue;
      seen.add(trade.id);
      if (trade.proposerId === teamId) sent.push(trade);
      else if (trade.receivedIds.length) received.push(trade);
    }

    const newestFirst = (left, right) => Number(right.proposedDate || 0) - Number(left.proposedDate || 0);
    received.sort(newestFirst);
    sent.sort(newestFirst);
    return { received, sent };
  }

  function countByPosition(players) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const player of players) {
      if (counts[player.position] !== undefined) counts[player.position] += 1;
    }
    return counts;
  }

  function placeholderPlayer(playerId) {
    return {
      id: playerId,
      name: `Player ${playerId}`,
      position: 0,
      projectedPoints: 0,
      lastSeasonPoints: null,
      rank: 150,
      injury: 'ACTIVE',
      unknown: true,
    };
  }

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function totalRank(players) {
    return players.reduce((total, player) => total + (Number.isFinite(player.rank) ? player.rank : 150), 0);
  }

  // Scores an offer someone else sent you. context must provide:
  //   playerById(playerId) -> player | null
  //   myPlayers / theirPlayers -> arrays of lineup players
  //   lineupValue(players) -> projected starting total
  //   scheduleRank, requirements, labels, avoidInjured (all optional)
  function evaluateIncomingTrade(trade, context) {
    const settings = context || {};
    const lookup = settings.playerById || (() => null);
    const lineupValue = settings.lineupValue || (() => 0);
    const labels = settings.labels || {};
    const requirements = settings.requirements || defaultRequirements;

    const received = (trade.receivedIds || []).map((playerId) => lookup(playerId) || placeholderPlayer(playerId));
    const gave = (trade.gaveIds || []).map((playerId) => lookup(playerId) || placeholderPlayer(playerId));
    const myPlayers = settings.myPlayers || [];
    const theirPlayers = settings.theirPlayers || [];
    // Optional league payload (imported data) powers the bye-week and schedule
    // context; without it every schedule note degrades to "no note".
    const data = settings.league || null;
    const teamId = Number(settings.teamId);
    const partnerName = settings.partnerName || '';
    const receivedIds = new Set(received.map((player) => player.id));
    const gaveIds = new Set(gave.map((player) => player.id));

    const lineupBefore = lineupValue(myPlayers);
    const afterPlayers = myPlayers.filter((player) => !gaveIds.has(player.id)).concat(received);
    const lineupAfter = lineupValue(afterPlayers);
    const lineupGain = lineupAfter - lineupBefore;

    const theirLineupBefore = lineupValue(theirPlayers);
    const theirAfterPlayers = theirPlayers.filter((player) => !receivedIds.has(player.id)).concat(gave);
    const theirLineupGain = lineupValue(theirAfterPlayers) - theirLineupBefore;

    const gaveRank = totalRank(gave);
    const receivedRank = totalRank(received);
    const valueGap = Math.abs(gaveRank - receivedRank);
    const valueGain = gaveRank - receivedRank;

    const beforeCounts = countByPosition(myPlayers);
    const afterCounts = countByPosition(afterPlayers);
    const startingHoles = corePositions.filter((position) => afterCounts[position] < (requirements[position] || 1));
    const filledNeeds = corePositions.filter((position) => beforeCounts[position] < (requirements[position] || 1) && afterCounts[position] >= (requirements[position] || 1));

    const riskyIncoming = received.filter((player) => injuredStatuses.indexOf(player.injury) >= 0);
    const relievedIncoming = gave.filter((player) => injuredStatuses.indexOf(player.injury) >= 0);
    const unknownCount = received.concat(gave).filter((player) => player.unknown).length;

    // An offer someone else sent you is accepted or rejected on lineup impact first,
    // so the lineup gain carries more weight here than in the Trade Lab generator.
    const lineupComponent = Math.round(clamp(lineupGain * 3, -30, 60));
    const valueComponent = Math.round(clamp(valueGain * 0.2 - valueGap * 0.05, -15, 15));
    const needComponent = Math.round(clamp(filledNeeds.length * 12 - startingHoles.length * 18, -28, 24));
    const healthComponent = -riskyIncoming.length * 10 + relievedIncoming.length * 4;

    // Bye-week + schedule context: traded players whose NFL bye lands in the
    // next two weeks, upcoming fantasy opponents, and full-season difficulty
    // from the mMatchup schedule + mSettings playoff start. Everything
    // degrades to "no note" when the payload lacks schedule data.
    const tradedPlayers = received.concat(gave);
    const timing = upcomingContext(data, teamId, tradedPlayers);
    const difficulty = scheduleDifficulty(data, teamId);
    const theirDifficulty = scheduleDifficulty(data, trade.counterpartyId);
    let scheduleComponent = 0;
    let scheduleRank = 0;
    let playoffNote = null;
    if (difficulty.games > 0) {
      scheduleComponent = difficulty.average > theirDifficulty.average ? 6 : 3;
      scheduleRank = difficulty.average;
      const weeksToPlayoffs = timing.playoffsAt - timing.week;
      if (weeksToPlayoffs >= 0 && weeksToPlayoffs <= 4) {
        playoffNote = `Playoffs start around Week ${timing.playoffsAt}; favor players who help now.`;
      } else if (weeksToPlayoffs < 0) {
        playoffNote = `You are in the playoff weeks (started around Week ${timing.playoffsAt}); every point counts now.`;
      }
    }

    const bothSidesGain = lineupGain > 0.5 && theirLineupGain > 0.5;
    const oneSided = lineupGain <= 0.5 && theirLineupGain > 0.5;
    const partnerComponent = bothSidesGain ? 8 : oneSided ? -Math.round(clamp(theirLineupGain * 0.8, 6, 20)) : 0;

    const score = Math.round(lineupComponent + valueComponent + needComponent + scheduleComponent + healthComponent + partnerComponent);
    const verdict = score >= 35 ? 'Accept' : score >= 22 ? 'Lean accept' : score >= 10 ? 'Consider a counter' : score >= 0 ? 'Lean decline' : 'Decline';
    const tone = score >= 22 ? 'accept' : score >= 10 ? 'consider' : 'decline';

    const reasons = [];
    if (lineupGain >= 1) {
      reasons.push({ tone: 'up', text: `Your best starting lineup gains ${lineupGain.toFixed(1)} points (${lineupBefore.toFixed(1)} to ${lineupAfter.toFixed(1)}), so this improves the lineup you would actually start.` });
    } else if (lineupGain <= -1) {
      reasons.push({ tone: 'down', text: `Your best starting lineup drops ${Math.abs(lineupGain).toFixed(1)} points (${lineupBefore.toFixed(1)} to ${lineupAfter.toFixed(1)}), so you would start a weaker team.` });
    } else {
      reasons.push({ tone: 'even', text: `Your starting lineup barely moves (${lineupBefore.toFixed(1)} to ${lineupAfter.toFixed(1)}), so the value here is depth and flexibility rather than this week's points.` });
    }

    if (valueGain >= 8) {
      reasons.push({ tone: 'up', text: `You gain about ${Math.round(valueGain)} draft-rank spots of player value, receiving ${received.map((player) => player.name).join(', ')} for ${gave.map((player) => player.name).join(', ')}.` });
    } else if (valueGain <= -8) {
      reasons.push({ tone: 'down', text: `You give up about ${Math.round(Math.abs(valueGain))} draft-rank spots of player value, which is a steep price for what comes back.` });
    } else {
      reasons.push({ tone: 'even', text: 'The two sides are close in player value, which makes this a fair starting point to negotiate from.' });
    }

    for (const position of filledNeeds) reasons.push({ tone: 'up', text: `It fills a starting need at ${labels[position] || position}, where you were short.` });
    for (const position of startingHoles) reasons.push({ tone: 'down', text: `It leaves you below a starting requirement at ${labels[position] || position}, which you would have to fix on the waiver wire.` });

    for (const player of riskyIncoming) reasons.push({ tone: 'alert', text: `${player.name} is listed ${player.injury}, so you may not get immediate production from that piece.` });
    for (const player of relievedIncoming) reasons.push({ tone: 'up', text: `You move on from ${player.name} (${player.injury}), clearing a roster spot that was giving you nothing.` });

    if (bothSidesGain) reasons.push({ tone: 'up', text: `Both sides improve: their best lineup gains ${theirLineupGain.toFixed(1)} points too, which is why this offer is realistic.` });
    else if (oneSided) reasons.push({ tone: 'down', text: `They gain ${theirLineupGain.toFixed(1)} lineup points while you do not, so this offer is one-sided and worth countering.` });

    if (scheduleComponent) reasons.push({ tone: 'up', text: `Your remaining opponents average ${scheduleRank.toFixed(1)} season points, a difficult schedule, so extra depth matters more than usual.` });
    for (const hit of timing.byeHits) {
      const side = received.indexOf(hit.player) >= 0 ? 'You would receive' : 'You would give up';
      reasons.push({ tone: 'alert', text: `${side} ${hit.player.name}, whose NFL team is on bye in Week ${hit.bye} — plan a fill-in for that week.` });
    }
    for (const game of timing.opponents.slice(0, 2)) {
      const opponent = teamName(((data && data.teams) || []).find((candidate) => Number(candidate.id) === Number(game.opponentId)) || { location: `Team ${game.opponentId}`, nickname: '' });
      reasons.push({ tone: 'even', text: `Week ${game.week} matchup: ${opponent}.` });
    }
    if (playoffNote) reasons.push({ tone: 'even', text: playoffNote });

    if (received.length !== gave.length) reasons.push({ tone: 'even', text: `This is a ${gave.length}-for-${received.length} offer, so an uneven amount of depth on one side is expected.` });
    if (settings.avoidInjured && riskyIncoming.length) reasons.push({ tone: 'alert', text: 'Your Trade Lab is set to avoid injured players, and this offer includes at least one.' });
    if (unknownCount) reasons.push({ tone: 'alert', text: `${unknownCount} player${unknownCount === 1 ? '' : 's'} in this offer were not in the imported league data. Refresh the league for a complete review.` });

    return {
      verdict,
      tone,
      score,
      lineupBefore,
      lineupAfter,
      lineupGain,
      theirLineupGain,
      valueGain,
      valueGap,
      received,
      gave,
      reasons,
      schedule: { week: timing.week, playoffsAt: timing.playoffsAt, opponents: timing.opponents, byeHits: timing.byeHits.map((hit) => ({ name: hit.player.name, bye: hit.bye })), difficulty },
      offerText: buildOfferText({
        partnerName,
        giveNames: gave.map((player) => player.name),
        receiveNames: received.map((player) => player.name),
        score,
        verdict,
      }),
      components: [
        ['Lineup gain', lineupComponent],
        ['Player value', valueComponent],
        ['Roster need', needComponent],
        ['Schedule', scheduleComponent],
        ['Health', healthComponent],
        ['Partner benefit', partnerComponent],
      ],
    };
  }

  const api = {
    corePositions,
    injuredStatuses,
    proTeamByeWeeks,
    isPendingTransaction,
    collectPendingTrades,
    countByPosition,
    evaluateIncomingTrade,
    lineupRequirements,
    currentWeek,
    playoffStartWeek,
    byeWeekOf,
    scheduleDifficulty,
    upcomingContext,
    buildOfferText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.TradeReview = api;
})(typeof window !== 'undefined' ? window : globalThis);