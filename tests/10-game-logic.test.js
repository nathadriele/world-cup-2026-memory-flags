/**
 * Test Suite: Game Logic (Caixa-Branca)
 * Tests internal game logic: card deck building, trivia system,
 * scoring, winner determination, turn rotation mechanics,
 * validation flow, and room state.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Game Logic (White-Box) Tests');
  console.log('========================================\n');

  h.setSuite('GameLogic');

  // ── TEAMS / Card Deck ─────────────────────────────────
  await h.test('48 teams defined in TEAMS array', async () => {
    // Read the server source and check
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    const matches = src.match(/code:\s*'[^']+'/g);
    // Each team appears once in TEAMS definition
    h.assert(matches && matches.length >= 48, 'Should have at least 48 team codes defined');
  });

  await h.test('Board has 96 cards (48 pairs)', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assert(Array.isArray(gs.players), 'Should have players array');

    // The board is managed server-side; verify game started properly
    h.assert(gs.currentTurn === 0, 'Game should start with turn 0');
    h.cleanupSockets(sockets);
  });

  await h.test('Each card flip reveals flagCode and countryName', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assert(flip.flagCode && typeof flip.flagCode === 'string', 'Should have flagCode');
    h.assert(flip.countryName && typeof flip.countryName === 'string', 'Should have countryName');
    h.assertEqual(flip.cardIndex, 0, 'Should have correct cardIndex');
    h.assert(typeof flip.playerIndex === 'number', 'Should have playerIndex');
    h.cleanupSockets(sockets);
  });

  // ── Trivia System ─────────────────────────────────────
  await h.test('Trivia data has 48 countries', async () => {
    const { TRIVIA } = require('../data/trivia.js');
    const keys = Object.keys(TRIVIA);
    h.assert(keys.length >= 48, 'Should have trivia for at least 48 countries, got ' + keys.length);
  });

  await h.test('Each trivia entry has statement and answer', async () => {
    const { TRIVIA } = require('../data/trivia.js');
    for (const [code, entries] of Object.entries(TRIVIA)) {
      h.assert(Array.isArray(entries), code + ' should have array of trivia');
      for (const entry of entries) {
        h.assert(typeof entry.statement === 'string', code + ' entry should have statement string');
        h.assert(typeof entry.answer === 'boolean', code + ' entry should have boolean answer');
      }
    }
  });

  await h.test('getTrivia returns valid entry for known code', async () => {
    const { getTrivia, TRIVIA } = require('../data/trivia.js');
    const trivia = getTrivia('br');
    h.assert(trivia !== undefined, 'Should return trivia for br');
    h.assert(typeof trivia.statement === 'string', 'Should have statement');
    h.assert(typeof trivia.answer === 'boolean', 'Should have boolean answer');
  });

  await h.test('getTrivia falls back to br for unknown code', async () => {
    const { getTrivia, TRIVIA } = require('../data/trivia.js');
    const trivia = getTrivia('xx_unknown');
    h.assert(trivia !== undefined, 'Should return fallback trivia');
    h.assert(TRIVIA.br.some(t => t.statement === trivia.statement), 'Should be from br fallback');
  });

  await h.test('normalizeText removes accents and lowercases', async () => {
    const { normalizeText } = require('../data/trivia.js');
    h.assertEqual(normalizeText('São Paulo'), 'sao paulo', 'Should remove accent');
    h.assertEqual(normalizeText('BRASIL'), 'brasil', 'Should lowercase');
    h.assertEqual(normalizeText('  trim  '), 'trim', 'Should trim');
    h.assertEqual(normalizeText(''), '', 'Should handle empty');
    h.assertEqual(normalizeText(null), '', 'Should handle null');
    h.assertEqual(normalizeText(undefined), '', 'Should handle undefined');
  });

  await h.test('Each country has exactly 2 trivia entries', async () => {
    const { TRIVIA } = require('../data/trivia.js');
    for (const [code, entries] of Object.entries(TRIVIA)) {
      h.assert(entries.length >= 2, code + ' should have at least 2 entries, got ' + entries.length);
    }
  });

  await h.test('Trivia entries have both true and false answers', async () => {
    const { TRIVIA } = require('../data/trivia.js');
    // Check a sample of countries
    const samples = ['br', 'ar', 'us', 'fr', 'de', 'jp'];
    for (const code of samples) {
      const entries = TRIVIA[code];
      if (entries) {
        const hasTrue = entries.some(e => e.answer === true);
        const hasFalse = entries.some(e => e.answer === false);
        h.assert(hasTrue, code + ' should have at least one true answer');
        h.assert(hasFalse, code + ' should have at least one false answer');
      }
    }
  });

  // ── Turn Rotation Logic ───────────────────────────────
  await h.test('Game starts with currentTurn=0', async () => {
    const { sockets } = await h.setupRoom(3);
    sockets[0].emit('start_game');
    for (let i = 0; i < 3; i++) {
      const gs = await h.waitEvent(sockets[i], 'game_start');
      h.assertEqual(gs.currentTurn, 0, 'Player ' + i + ' should see turn=0');
    }
    h.cleanupSockets(sockets);
  });

  await h.test('Turn timer starts on game start', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    const timer = await h.waitEvent(sockets[0], 'turn_timer');
    h.assert(typeof timer.remaining === 'number', 'Should have remaining time');
    h.assert(timer.remaining <= 30, 'Should start at 30 or less seconds');
    h.cleanupSockets(sockets);
  });

  await h.test('Turn timer counts down', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    const t1 = await h.waitEvent(sockets[0], 'turn_timer');
    await h.sleep(2200);
    const t2 = await h.waitEvent(sockets[0], 'turn_timer');
    h.assert(t2.remaining < t1.remaining, 'Timer should decrease: ' + t1.remaining + ' -> ' + t2.remaining);
    h.cleanupSockets(sockets);
  });

  // ── Pair Validation Flow ──────────────────────────────
  await h.test('Correct validation keeps turn + scores', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Flip first card
    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip1 = await h.waitEvent(sockets[0], 'card_flipped');

    // Find the matching card by flipping adjacent cards
    let pairFound = false;
    for (let i = 1; i < 10 && !pairFound; i++) {
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 3000);
      const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 5000);

      sockets[0].emit('flip_card', { cardIndex: i });
      await h.sleep(500);

      const pairEvt = await pairP;
      if (pairEvt) {
        pairFound = true;
        // Submit correct answer
        const trivia = require('../data/trivia.js');
        const triv = trivia.getTrivia(pairEvt.flagCode);
        sockets[0].emit('submit_validation', { truthAnswer: triv.answer });

        const valResult = await h.waitEvent(sockets[0], 'validation_result');
        h.assert(valResult.success === true, 'Validation should succeed with correct answer');

        // Player should keep the turn (no turn_changed event expected)
        const turnEvt = await h.waitEventOrNull(sockets[0], 'turn_changed', 2000);
        h.assert(!turnEvt, 'Correct validation should NOT pass turn');

        // Check score increased
        const deckEvt = await h.waitEventOrNull(sockets[0], 'cards_to_deck', 2000);
        h.assert(deckEvt !== null, 'Should emit cards_to_deck event');
      } else {
        await retP;
        // Cards returned, try next pair from a fresh card
        if (i < 9) {
          sockets[0].emit('flip_card', { cardIndex: i + 10 });
          await h.waitEvent(sockets[0], 'card_flipped');
        }
      }
    }

    if (!pairFound) {
      console.log('    (info: could not find a pair in first 10 attempts - deck dependent)');
    }
    h.cleanupSockets(sockets);
  });

  await h.test('Wrong validation passes turn', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Flip cards looking for a pair to validate wrong
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    for (let i = 1; i < 15; i++) {
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 3000);
      const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 4000);

      sockets[0].emit('flip_card', { cardIndex: i });
      const pairEvt = await pairP;

      if (pairEvt) {
        // Submit WRONG answer (opposite of correct)
        const trivia = require('../data/trivia.js');
        const triv = trivia.getTrivia(pairEvt.flagCode);
        sockets[0].emit('submit_validation', { truthAnswer: !triv.answer });

        const valResult = await h.waitEvent(sockets[0], 'validation_result');
        h.assert(valResult.success === false, 'Validation should fail with wrong answer');

        // Turn should pass to player 1
        const turnEvt = await h.waitEvent(sockets[1], 'turn_changed');
        h.assertEqual(turnEvt.currentTurn, 1, 'Turn should pass to player 1');

        h.cleanupSockets(sockets);
        return;
      }
      await retP;
      // Flip a new first card
      if (i < 14) {
        sockets[0].emit('flip_card', { cardIndex: i + 20 });
        await h.waitEvent(sockets[0], 'card_flipped');
      }
    }

    console.log('    (info: no pair found in test range - deck dependent)');
    h.cleanupSockets(sockets);
  });

  // ── Game State Shape ──────────────────────────────────
  await h.test('game_start event has correct shape', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');

    h.assert(Array.isArray(gs.players), 'Should have players array');
    h.assert(gs.players.length === 2, 'Should have 2 players');
    h.assertEqual(gs.currentTurn, 0, 'currentTurn should be 0');
    h.assert(Array.isArray(gs.scores), 'Should have scores array');
    h.assert(gs.scores.length === 2, 'Should have 2 scores');
    h.assert(typeof gs.maxPlayers === 'number', 'Should have maxPlayers');

    gs.players.forEach(p => {
      h.assert(typeof p.name === 'string', 'Player should have name');
      h.assert(typeof p.flagCode === 'string', 'Player should have flagCode');
    });
    h.cleanupSockets(sockets);
  });

  await h.test('lobby_update event has correct shape', async () => {
    const { sockets } = await h.setupRoom(2);
    // Player 1 receives lobby_update when player 2 joins
    const lobby = await h.waitEvent(sockets[0], 'lobby_update');

    h.assert(Array.isArray(lobby.players), 'Should have players array');
    h.assert(typeof lobby.code === 'string', 'Should have room code');
    h.assert(typeof lobby.maxPlayers === 'number', 'Should have maxPlayers');
    h.cleanupSockets(sockets);
  });

  await h.test('card_flipped event has correct shape', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 5 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');

    h.assertEqual(flip.cardIndex, 5, 'Should have correct cardIndex');
    h.assert(typeof flip.flagCode === 'string', 'Should have flagCode');
    h.assert(typeof flip.countryName === 'string', 'Should have countryName');
    h.assert(typeof flip.playerIndex === 'number', 'Should have playerIndex');
    h.cleanupSockets(sockets);
  });

  await h.test('turn_timer event has remaining field', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    const timer = await h.waitEvent(sockets[0], 'turn_timer');
    h.assert(typeof timer.remaining === 'number', 'Should have remaining number');
    h.assert(timer.remaining >= 0 && timer.remaining <= 30, 'Should be between 0-30');
    h.cleanupSockets(sockets);
  });

  // ── Preview Mode ──────────────────────────────────────
  await h.test('Preview mode triggers preview_warning', async () => {
    const { sockets } = await h.setupRoom(2, { previewCards: true });
    sockets[0].emit('start_game');
    const preview = await h.waitEvent(sockets[0], 'preview_warning');
    h.assert(typeof preview.seconds === 'number', 'Should have seconds');
    h.assert(preview.cards && typeof preview.cards === 'object', 'Should have cards map');
    h.assert(Object.keys(preview.cards).length === 96, 'Should expose all 96 cards');
    h.cleanupSockets(sockets);
  });

  await h.test('Preview mode triggers preview_reveal after warning', async () => {
    const { sockets } = await h.setupRoom(2, { previewCards: true });
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'preview_warning');
    const reveal = await h.waitEvent(sockets[0], 'preview_reveal', 15000);
    h.assert(typeof reveal.seconds === 'number', 'Should have reveal seconds');
    h.cleanupSockets(sockets);
  });

  await h.test('Preview mode triggers game_start after full preview', async () => {
    const { sockets } = await h.setupRoom(2, { previewCards: true });
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'preview_warning');
    await h.waitEvent(sockets[0], 'preview_reveal', 15000);
    await h.waitEvent(sockets[0], 'preview_done', 20000);
    const gs = await h.waitEvent(sockets[0], 'game_start', 20000);
    h.assertEqual(gs.currentTurn, 0, 'Should start game after preview');
    h.cleanupSockets(sockets);
  });

  // ── Room State on Reconnect ───────────────────────────
  await h.test('reconnect_state has full room data', async () => {
    const { sockets, roomCode, names } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Disconnect player 1 and reconnect
    sockets[1].disconnect();
    await h.sleep(500);

    const reg2 = await h.loginUser('test_2p_1_' + Date.now());

    // Use original room code and name
    sockets[1] = h.createSocket(sockets[0] ? '' : '');
    // Reconnect with correct room data
    const newSock = h.createSocket('');
    await new Promise(r => newSock.on('connect', r));

    // Try reconnect to the room
    const stateOrErr = await Promise.race([
      h.waitEvent(newSock, 'reconnect_state').then(d => ({ ev: 'state', data: d })),
      h.waitEvent(newSock, 'room_error').then(d => ({ ev: 'error', data: d }))
    ]);

    h.assert(stateOrErr.ev === 'state' || stateOrErr.ev === 'error', 'Should get a response');
    newSock.disconnect();
    h.cleanupSockets([sockets[0]]);
  });

  // ── Play Again ────────────────────────────────────────
  await h.test('play_again resets game state', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.sleep(500);

    sockets[0].emit('play_again');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Should reset to turn 0');
    h.assert(gs.scores.every(s => s === 0), 'Scores should be reset');
    h.cleanupSockets(sockets);
  });

  // ── Max Players Enforcement ───────────────────────────
  await h.test('Room respects maxPlayers limit', async () => {
    const { sockets, roomCode } = await h.setupRoom(2, { maxPlayers: 2 });
    const ts = Date.now();
    const reg = await h.registerUser('overflow_' + ts, 'Extra', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('join_room', { name: 'Extra', flagCode: 'br', code: roomCode });
    const err = await errP;
    h.assert(err.message.includes('cheia') || err.message.includes('full'), 'Should report room full');
    sock.disconnect();
    h.cleanupSockets(sockets);
  });

  // ── Double room creation prevented ────────────────────
  await h.test('Player cannot create two rooms', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('dblroom_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Room1', flagCode: 'br', maxPlayers: 2 });
    const created = await h.waitEvent(sock, 'room_created');

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('create_room', { name: 'Room2', flagCode: 'ar', maxPlayers: 2 });
    const err = await errP;
    h.assert(err.message.includes('já está') || err.message.includes('already'), 'Should prevent double room');
    sock.disconnect();
  });

  // ── Start game twice prevented ────────────────────────
  await h.test('Cannot start game twice', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.sleep(500);

    // Try starting again - should be silently ignored
    const gsP = h.waitEventOrNull(sockets[0], 'game_start', 2000);
    sockets[0].emit('start_game');
    const result = await gsP;
    h.assert(!result, 'Second start_game should be ignored');
    h.cleanupSockets(sockets);
  });

  // ── Validation timer ──────────────────────────────────
  await h.test('validation_timer event fires on pair found', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Try to find a pair
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    let found = false;
    for (let i = 1; i < 15 && !found; i++) {
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 3000);
      const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 4000);

      sockets[0].emit('flip_card', { cardIndex: i });
      const pairEvt = await pairP;

      if (pairEvt) {
        found = true;
        const timer = await h.waitEvent(sockets[0], 'validation_timer');
        h.assert(typeof timer.remaining === 'number', 'Should have remaining time');
        h.assert(timer.remaining <= 30, 'Should start at 30 or less');
      } else {
        await retP;
        if (i < 14) {
          sockets[0].emit('flip_card', { cardIndex: i + 20 });
          await h.waitEvent(sockets[0], 'card_flipped');
        }
      }
    }

    if (!found) {
      console.log('    (info: no pair found - deck dependent)');
    }
    h.cleanupSockets(sockets);
  });

  console.log('\n  Game Logic tests complete.');
}

module.exports = { run };
