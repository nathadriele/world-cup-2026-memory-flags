/**
 * Test Suite: Reveal Cards (Peek Mode)
 * Tests individual card reveal, privacy (other players don't see),
 * reveal_cards_request, reveal_all_cards event
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Reveal Cards (Peek Mode) Tests');
  console.log('========================================\n');

  h.setSuite('RevealCards');

  await h.test('Player requests reveal - receives reveal_all_cards', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('reveal_cards_request');
    const data = await h.waitEvent(sockets[0], 'reveal_all_cards');
    h.assert(data.cards, 'Should have cards object');
    h.assert(Object.keys(data.cards).length > 0, 'Should have multiple cards');
    h.cleanupSockets(sockets);
  });

  await h.test('Other player does NOT receive reveal_all_cards', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('reveal_cards_request');
    await h.waitEvent(sockets[0], 'reveal_all_cards');

    // Player 1 should NOT receive reveal_all_cards
    const otherResult = await h.waitEventOrNull(sockets[1], 'reveal_all_cards', 2000);
    h.assert(!otherResult, 'Other player should NOT receive reveal_all_cards');
    h.cleanupSockets(sockets);
  });

  await h.test('Reveal cards has correct data shape (flagCode + countryName)', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('reveal_cards_request');
    const data = await h.waitEvent(sockets[0], 'reveal_all_cards');

    const firstKey = Object.keys(data.cards)[0];
    const card = data.cards[firstKey];
    h.assert(card.flagCode, 'Card should have flagCode');
    h.assert(card.countryName, 'Card should have countryName');
    h.assert(typeof card.flagCode === 'string', 'flagCode should be string');
    h.assert(typeof card.countryName === 'string', 'countryName should be string');
    h.cleanupSockets(sockets);
  });

  await h.test('Reveal returns all hidden cards', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('reveal_cards_request');
    const data = await h.waitEvent(sockets[0], 'reveal_all_cards');

    // Server sends all 96 cards in reveal (48 pairs)
    const cardCount = Object.keys(data.cards).length;
    h.assert(cardCount >= 48, 'Should reveal at least 48 cards (got ' + cardCount + ')');
    h.cleanupSockets(sockets);
  });

  await h.test('Reveal request without game active - ignored', async () => {
    const { sockets, roomCode } = await h.setupRoom(2);

    // Don't start game, just request reveal
    sockets[0].emit('reveal_cards_request');
    const result = await h.waitEventOrNull(sockets[0], 'reveal_all_cards', 2000);
    h.assert(!result, 'Reveal without active game should be ignored');
    h.cleanupSockets(sockets);
  });

  await h.test('Both players reveal independently - no cross-contamination', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Player 0 reveals
    sockets[0].emit('reveal_cards_request');
    const data0 = await h.waitEvent(sockets[0], 'reveal_all_cards');

    // Player 1 should not see P0's reveal, but can request own
    sockets[1].emit('reveal_cards_request');
    const data1 = await h.waitEvent(sockets[1], 'reveal_all_cards');

    // Both should have cards but they were sent independently
    h.assert(data0.cards && data1.cards, 'Both should receive their own reveal data');

    // Ensure P0 did NOT receive P1's second reveal
    const extraReveal = await h.waitEventOrNull(sockets[0], 'reveal_all_cards', 2000);
    h.assert(!extraReveal, 'P0 should not receive P1 reveal event');
    h.cleanupSockets(sockets);
  });

  await h.test('Reveal cards data is consistent (same flag appears twice)', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('reveal_cards_request');
    const data = await h.waitEvent(sockets[0], 'reveal_all_cards');

    // Memory game: each flag appears exactly twice
    const flagCounts = {};
    for (const key in data.cards) {
      const fc = data.cards[key].flagCode;
      flagCounts[fc] = (flagCounts[fc] || 0) + 1;
    }
    const counts = Object.values(flagCounts);
    h.assert(counts.every(c => c === 2), 'Each flag should appear exactly twice');
    h.cleanupSockets(sockets);
  });

  console.log('\n  Reveal Cards tests complete.');
}

module.exports = { run };
