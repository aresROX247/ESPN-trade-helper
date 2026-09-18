const assert = require('node:assert/strict');
const test = require('node:test');

const TradeReview = require('../public/trade-review.js');

const MY_TEAM = 6;
const THEIR_TEAM = 2;

// Independent copy of the viewer's best-lineup algorithm so assertions are explicit.
function lineupValue(players) {
  const remaining = [...players];
  const take = (predicate, count) => {
    const picked = remaining.filter(predicate).sort((left, right) => right.projectedPoints - left.projectedPoints).slice(0, count);
    for (const player of picked) remaining.splice(remaining.indexOf(player), 1);
    return picked.reduce((total, player) => total + player.projectedPoints, 0);
  };
  let total = 0;
  for (const [position, count] of Object.entries({ 1: 1, 2: 2, 3: 2, 4: 1 })) total += take((player) => player.position === Number(position), count);
  total += take((player) => [2, 3, 4].includes(player.position), 2);
  return total;
}

function player(id, position, name, rank, projectedPoints, injury = 'ACTIVE') {
  return { id, position, name, rank, projectedPoints, injury, lastSeasonPoints: null };
}

const MY_PLAYERS = [
  player(1, 1, 'My QB', 20, 20),
  player(2, 2, 'My RB1', 10, 16),
  player(3, 2, 'My RB2', 60, 8),
  player(4, 2, 'My RB3', 90, 6),
  player(5, 3, 'My WR1', 15, 14),
  player(6, 3, 'My WR2', 70, 7),
  player(7, 3, 'My WR3', 110, 5),
  player(8, 4, 'My TE', 40, 9),
];

const THEIR_PLAYERS = [
  player(101, 1, 'Their QB', 100, 12),
  player(102, 2, 'Their RB1', 95, 6),
  player(103, 2, 'Their RB2', 130, 4),
  player(104, 2, 'Their RB3', 200, 3),
  player(105, 3, 'Their Star WR', 12, 13.5),
  player(106, 3, 'Their WR2', 50, 9),
  player(107, 3, 'Their WR3', 120, 6),
  player(108, 4, 'Their TE', 80, 6),
];

const PLAYER_BY_ID = new Map(MY_PLAYERS.concat(THEIR_PLAYERS).map((entry) => [String(entry.id), entry]));

function context(overrides = {}) {
  return {
    playerById: (playerId) => PLAYER_BY_ID.get(String(playerId)) || null,
    myPlayers: MY_PLAYERS,
    theirPlayers: THEIR_PLAYERS,
    lineupValue,
    scheduleRank: 0,
    requirements: { 1: 1, 2: 2, 3: 2, 4: 1 },
    labels: { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE' },
    avoidInjured: false,
    ...overrides,
  };
}

function proposal(id, proposerId, items, extra = {}) {
  return { id, teamId: proposerId, type: 'TRADE_PROPOSAL', status: 'PENDING', proposedDate: 1788807017000, items, ...extra };
}

function tradeItem(playerId, fromTeamId, toTeamId) {
  return { type: 'TRADE', playerId, fromTeamId, toTeamId };
}

test('collectPendingTrades separates offers sent to you from offers you sent', () => {
  const data = {
    transactions: [
      proposal('incoming-1', THEIR_TEAM, [tradeItem(105, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)]),
      proposal('sent-1', MY_TEAM, [tradeItem(4, MY_TEAM, THEIR_TEAM), tradeItem(107, THEIR_TEAM, MY_TEAM)]),
    ],
  };

  const collected = TradeReview.collectPendingTrades(data, MY_TEAM);
  assert.equal(collected.received.length, 1);
  assert.equal(collected.sent.length, 1);
  assert.equal(collected.received[0].id, 'incoming-1');
  assert.deepEqual(collected.received[0].receivedIds, [105]);
  assert.deepEqual(collected.received[0].gaveIds, [3]);
  assert.deepEqual(collected.sent[0].gaveIds, [4]);
  // The counterparty is the other manager, whether the offer came in or went out.
  assert.equal(collected.received[0].counterpartyId, THEIR_TEAM);
  assert.equal(collected.sent[0].counterpartyId, THEIR_TEAM);
});

test('collectPendingTrades ignores non-trade and closed transactions', () => {
  const data = {
    transactions: [
      { id: 'waiver-1', teamId: MY_TEAM, type: 'WAIVER', status: 'EXECUTED', items: [tradeItem(101, THEIR_TEAM, MY_TEAM)] },
      proposal('declined-1', THEIR_TEAM, [tradeItem(105, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)], { status: 'DECLINED' }),
      proposal('canceled-1', THEIR_TEAM, [tradeItem(105, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)], { status: 'CANCELED' }),
      proposal('unrelated-1', 9, [tradeItem(105, 9, 4), tradeItem(3, 4, 9)]),
    ],
  };

  const collected = TradeReview.collectPendingTrades(data, MY_TEAM);
  assert.equal(collected.received.length, 0);
  assert.equal(collected.sent.length, 0);
});

test('collectPendingTrades reads pendingTransactions and de-duplicates', () => {
  const trade = proposal('dup-1', THEIR_TEAM, [tradeItem(105, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)]);
  const collected = TradeReview.collectPendingTrades({ transactions: [trade], pendingTransactions: [trade] }, MY_TEAM);
  assert.equal(collected.received.length, 1);
});

test('a trade that upgrades the lineup and value reads as a clear accept', () => {
  const collected = TradeReview.collectPendingTrades({
    transactions: [proposal('incoming-1', THEIR_TEAM, [tradeItem(105, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)])],
  }, MY_TEAM);
  const result = TradeReview.evaluateIncomingTrade(collected.received[0], context());

  assert.equal(result.lineupGain.toFixed(1), '5.5');
  assert.equal(result.valueGain, 48);
  assert.equal(result.tone, 'accept');
  assert.ok(result.score >= 22, `expected a positive score, received ${result.score}`);
  assert.equal(result.received[0].name, 'Their Star WR');
  assert.equal(result.gave[0].name, 'My RB2');

  const lineupReason = result.reasons.find((reason) => reason.text.includes('Your best starting lineup gains'));
  assert.ok(lineupReason, 'expected a lineup improvement reason');
  assert.equal(lineupReason.tone, 'up');
  assert.equal(result.reasons.filter((reason) => reason.tone === 'down').length, 0);
});

test('a lowball offer reads as a decline with negative reasons', () => {
  const collected = TradeReview.collectPendingTrades({
    transactions: [proposal('lowball-1', THEIR_TEAM, [tradeItem(104, THEIR_TEAM, MY_TEAM), tradeItem(2, MY_TEAM, THEIR_TEAM)])],
  }, MY_TEAM);
  const result = TradeReview.evaluateIncomingTrade(collected.received[0], context());

  assert.ok(result.lineupGain < 0, `expected a lineup drop, received ${result.lineupGain}`);
  assert.equal(result.tone, 'decline');
  assert.ok(result.score < 0, `expected a negative score, received ${result.score}`);
  assert.ok(result.reasons.some((reason) => reason.tone === 'down' && reason.text.includes('one-sided')));
  assert.ok(result.reasons.some((reason) => reason.tone === 'down' && reason.text.includes('starting lineup drops')));
});

test('an injured incoming player is flagged', () => {
  const injured = player(109, 3, 'Hurt WR', 30, 11, 'OUT');
  const lookup = new Map(PLAYER_BY_ID);
  lookup.set('109', injured);
  const collected = TradeReview.collectPendingTrades({
    pendingTransactions: [proposal('injured-1', THEIR_TEAM, [tradeItem(109, THEIR_TEAM, MY_TEAM), tradeItem(7, MY_TEAM, THEIR_TEAM)])],
  }, MY_TEAM);

  const result = TradeReview.evaluateIncomingTrade(collected.received[0], context({
    playerById: (playerId) => lookup.get(String(playerId)) || null,
    avoidInjured: true,
  }));

  assert.ok(result.reasons.some((reason) => reason.tone === 'alert' && reason.text.includes('Hurt WR is listed OUT')));
  assert.ok(result.reasons.some((reason) => reason.text.includes('set to avoid injured players')));
  const health = result.components.find(([label]) => label === 'Health');
  assert.ok(health[1] < 0, `expected a health penalty, received ${health[1]}`);
});

test('players missing from the import are reported instead of breaking the review', () => {
  const collected = TradeReview.collectPendingTrades({
    transactions: [proposal('unknown-1', THEIR_TEAM, [tradeItem(9999, THEIR_TEAM, MY_TEAM), tradeItem(3, MY_TEAM, THEIR_TEAM)])],
  }, MY_TEAM);
  const result = TradeReview.evaluateIncomingTrade(collected.received[0], context());

  assert.equal(result.received[0].name, 'Player 9999');
  assert.ok(result.reasons.some((reason) => reason.text.includes('were not in the imported league data')));
});

test('a two-for-one offer is described as such', () => {
  const collected = TradeReview.collectPendingTrades({
    transactions: [proposal('two-for-one', THEIR_TEAM, [
      tradeItem(105, THEIR_TEAM, MY_TEAM),
      tradeItem(106, THEIR_TEAM, MY_TEAM),
      tradeItem(3, MY_TEAM, THEIR_TEAM),
    ])],
  }, MY_TEAM);
  const result = TradeReview.evaluateIncomingTrade(collected.received[0], context());

  assert.equal(result.received.length, 2);
  assert.equal(result.gave.length, 1);
  assert.ok(result.reasons.some((reason) => reason.text.includes('1-for-2 offer')));
});