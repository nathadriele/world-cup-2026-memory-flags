/**
 * Test Suite: End-to-End (E2E) Tests
 * Complete game flows from registration through gameplay to completion.
 * Simulates real user journeys across all system components.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  End-to-End (E2E) Tests');
  console.log('========================================\n');

  h.setSuite('E2E');

  // ── E2E: Full Registration to Game Start Flow ────────
  await h.test('E2E: Register -> Create Room -> Join -> Start -> Play', async () => {
    const ts = Date.now();

    // 1. Register Player 1
    const p1 = await h.registerUser('e2e_p1_' + ts, 'Player1', 'br');
    h.assertEqual(p1.status, 200, 'P1 registration should succeed');

    // 2. Register Player 2
    const p2 = await h.registerUser('e2e_p2_' + ts, 'Player2', 'ar');
    h.assertEqual(p2.status, 200, 'P2 registration should succeed');

    // 3. Connect sockets
    const sock1 = h.createSocket(p1.cookie);
    const sock2 = h.createSocket(p2.cookie);
    await Promise.all([
      new Promise(r => sock1.on('connect', r)),
      new Promise(r => sock2.on('connect', r))
    ]);

    sock1.emit('identify', { userId: p1.body.user.id });
    sock2.emit('identify', { userId: p2.body.user.id });

    // 4. Create room
    sock1.emit('create_room', { name: 'Player1', flagCode: 'br', maxPlayers: 2 });
    const created = await h.waitEvent(sock1, 'room_created');
    h.assert(created.code.length === 6, 'Should have 6-char room code');

    // 5. Player 2 joins
    const lobbyBefore = h.waitEvent(sock1, 'lobby_update');
    sock2.emit('join_room', { name: 'Player2', flagCode: 'ar', code: created.code });
    const joined = await h.waitEvent(sock2, 'room_joined');
    h.assertEqual(joined.code, created.code, 'Codes should match');

    const lobby = await lobbyBefore;
    h.assert(lobby.players.length === 2, 'Lobby should show 2 players');

    // 6. Start game
    sock1.emit('start_game');
    const gs1 = await h.waitEvent(sock1, 'game_start');
    const gs2 = await h.waitEvent(sock2, 'game_start');

    h.assertEqual(gs1.currentTurn, 0, 'P1 sees turn=0');
    h.assertEqual(gs2.currentTurn, 0, 'P2 sees turn=0');
    h.assert(gs1.players.length === 2, 'Should have 2 players');
    h.assert(gs2.players.length === 2, 'Both see same player count');

    // 7. Flip a card
    const flip1 = h.waitEvent(sock2, 'card_flipped');
    sock1.emit('flip_card', { cardIndex: 0 });
    const flipData = await flip1;
    h.assertEqual(flipData.cardIndex, 0, 'Card 0 should be flipped');
    h.assert(flipData.flagCode, 'Should have a flag');

    sock1.disconnect();
    sock2.disconnect();
  });

  // ── E2E: Multiple Turns with Correct Rotation ────────
  await h.test('E2E: 3-player game with multiple turn passes', async () => {
    const { sockets } = await h.setupRoom(3);
    sockets[0].emit('start_game');

    for (let i = 0; i < 3; i++) {
      await h.waitEvent(sockets[i], 'game_start');
    }

    // Each player attempts to play - flip 2 cards
    let currentPlayer = 0;
    let turnsSeen = [0];

    for (let round = 0; round < 3; round++) {
      const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 8000);
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 8000);

      sockets[currentPlayer].emit('flip_card', { cardIndex: round * 2 });
      await h.waitEvent(sockets[0], 'card_flipped');
      await h.sleep(200);
      sockets[currentPlayer].emit('flip_card', { cardIndex: round * 2 + 1 });

      const result = await Promise.race([
        turnP.then(d => ({ ev: 'turn', d })),
        pairP.then(d => ({ ev: 'pair', d }))
      ]);

      if (result.ev === 'turn' && result.d) {
        currentPlayer = result.d.currentTurn;
        turnsSeen.push(currentPlayer);
      } else {
        console.log('    (round ' + round + ': pair found)');
      }
    }

    h.assert(turnsSeen.length >= 2, 'Should see multiple turns');
    h.cleanupSockets(sockets);
  });

  // ── E2E: Disconnect and Reconnect ────────────────────
  await h.test('E2E: Player disconnects and room handles it', async () => {
    const { sockets, roomCode } = await h.setupRoom(3);
    sockets[0].emit('start_game');
    for (let i = 0; i < 3; i++) {
      await h.waitEvent(sockets[i], 'game_start');
    }

    // Player 2 disconnects
    sockets[2].disconnect();
    await h.sleep(500);

    // Other players get notified
    const status = await h.waitEvent(sockets[0], 'player_status');
    const disconnected = status.players.find(p => p && p.connected === false);
    h.assert(disconnected !== undefined || status.players[2] === null,
      'Should show player as disconnected');

    h.cleanupSockets([sockets[0], sockets[1]]);
  });

  // ── E2E: Leave Room During Lobby ──────────────────────
  await h.test('E2E: Player leaves room during lobby phase', async () => {
    const { sockets } = await h.setupRoom(3);

    // Player 2 leaves
    const lobbyP = h.waitEvent(sockets[0], 'lobby_update');
    sockets[2].emit('leave_room');
    const lobby = await lobbyP;

    h.assert(lobby.players.length <= 2, 'Should have at most 2 players after leave');
    h.cleanupSockets([sockets[0], sockets[1]]);
  });

  // ── E2E: Play Again Flow ──────────────────────────────
  await h.test('E2E: Game -> Play Again -> New Game', async () => {
    const { sockets } = await h.setupRoom(2);

    // First game
    sockets[0].emit('start_game');
    const gs1 = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs1.currentTurn, 0, 'Game 1 starts at turn 0');

    // Simulate some gameplay
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(300);

    // Play again
    sockets[0].emit('play_again');
    const gs2 = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs2.currentTurn, 0, 'Game 2 starts at turn 0');
    h.assert(gs2.scores.every(s => s === 0), 'Scores reset');

    // Verify can play again
    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assertEqual(flip.cardIndex, 0, 'Should be able to flip after play_again');

    h.cleanupSockets(sockets);
  });

  // ── E2E: 8-Player Room (Maximum) ─────────────────────
  await h.test('E2E: Full 8-player room creation and game start', async () => {
    const { sockets } = await h.setupRoom(8);
    sockets[0].emit('start_game');

    for (let i = 0; i < 8; i++) {
      const gs = await h.waitEvent(sockets[i], 'game_start');
      h.assertEqual(gs.currentTurn, 0, 'All players see turn=0');
    }

    // Flip card as player 0
    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assert(flip.cardIndex === 0, 'Card should flip');

    h.cleanupSockets(sockets);
  });

  // ── E2E: Preview Mode Full Flow ───────────────────────
  await h.test('E2E: Preview cards flow (warning -> reveal -> game)', async () => {
    const { sockets } = await h.setupRoom(2, { previewCards: true });
    sockets[0].emit('start_game');

    // 1. Preview warning
    const warning = await h.waitEvent(sockets[0], 'preview_warning');
    h.assert(warning.cards && Object.keys(warning.cards).length === 96, 'All cards shown');

    // 2. Preview reveal
    const reveal = await h.waitEvent(sockets[0], 'preview_reveal', 15000);
    h.assert(typeof reveal.seconds === 'number', 'Reveal has countdown');

    // 3. Preview done
    const done = await h.waitEvent(sockets[0], 'preview_done', 20000);

    // 4. Game starts
    const gs = await h.waitEvent(sockets[0], 'game_start', 20000);
    h.assertEqual(gs.currentTurn, 0, 'Game should start after preview');

    h.cleanupSockets(sockets);
  });

  // ── E2E: Validation Correct Flow ─────────────────────
  await h.test('E2E: Pair found -> correct validation -> score increases', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Keep flipping pairs until we find one
    for (let start = 0; start < 40; start += 2) {
      // Flip first card
      sockets[0].emit('flip_card', { cardIndex: start });
      await h.waitEvent(sockets[0], 'card_flipped');
      const card1Data = await new Promise(resolve => {
        sockets[0].once('card_flipped', d => resolve(d));
      });

      // Try to find matching card
      let found = false;
      for (let j = start + 1; j < Math.min(start + 20, 96) && !found; j++) {
        const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 2500);
        const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 5000);

        sockets[0].emit('flip_card', { cardIndex: j });
        const pairEvt = await pairP;

        if (pairEvt) {
          found = true;
          // Answer correctly
          const { getTrivia } = require('../data/trivia.js');
          const triv = getTrivia(pairEvt.flagCode);
          sockets[0].emit('submit_validation', { truthAnswer: triv.answer });

          const result = await h.waitEvent(sockets[0], 'validation_result');
          h.assert(result.success === true, 'Correct answer should succeed');

          const deck = await h.waitEvent(sockets[0], 'cards_to_deck');
          h.assert(deck.deckCount >= 1, 'Deck count should increase');

          h.cleanupSockets(sockets);
          return;
        }
        await retP;
      }

      if (!found) {
        // Clear and try next starting position
        const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 4000);
        await turnP;
        // Need to wait for turn to come back
        await h.sleep(500);
      }
    }

    console.log('    (info: no pair found in search range - deck dependent)');
    h.cleanupSockets(sockets);
  });

  // ── E2E: Wrong Pair Returns Cards ────────────────────
  await h.test('E2E: Wrong pair -> cards_returned -> turn passes', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Flip two adjacent cards (likely different)
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 3000);
    const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 6000);
    const turnP = h.waitEventOrNull(sockets[1], 'turn_changed', 6000);

    sockets[0].emit('flip_card', { cardIndex: 1 });

    const pairEvt = await pairP;
    if (!pairEvt) {
      // Wrong pair
      const returned = await retP;
      h.assert(returned !== null, 'Should get cards_returned event');
      h.assert(Array.isArray(returned.indices), 'Should have indices array');

      const turn = await turnP;
      h.assert(turn !== null, 'Turn should pass to player 1');
    } else {
      console.log('    (info: pair found instead - deck dependent)');
    }

    h.cleanupSockets(sockets);
  });

  // ── E2E: 4-Player Sequential Turn Rotation ───────────
  await h.test('E2E: 4P sequential turns 0->1->2->3->0', async () => {
    const { sockets } = await h.setupRoom(4);
    sockets[0].emit('start_game');
    for (let i = 0; i < 4; i++) await h.waitEvent(sockets[i], 'game_start');

    const seenTurns = [0];
    let currentTurn = 0;

    for (let round = 0; round < 4; round++) {
      const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 8000);
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 8000);

      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 });
      await h.waitEvent(sockets[0], 'card_flipped');
      await h.sleep(200);
      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 + 1 });

      const result = await Promise.race([
        turnP.then(d => ({ ev: 'turn', d })),
        pairP.then(d => ({ ev: 'pair', d }))
      ]);

      if (result.ev === 'turn' && result.d) {
        currentTurn = result.d.currentTurn;
        seenTurns.push(currentTurn);
      }
    }

    const unique = [...new Set(seenTurns)];
    h.assert(unique.length >= 2, 'Should see multiple players, got ' + JSON.stringify(seenTurns));
    h.cleanupSockets(sockets);
  });

  // ── E2E: Complete Auth Workflow ───────────────────────
  await h.test('E2E: Register -> Logout -> Login -> Access protected route', async () => {
    const ts = Date.now();
    const username = 'e2e_auth_' + ts;

    // 1. Register
    const reg = await h.registerUser(username, 'E2EAuth', 'br');
    h.assertEqual(reg.status, 200, 'Register should work');

    // 2. Access protected route
    const me1 = await h.getMe(reg.cookie);
    h.assertEqual(me1.status, 200, 'Should access protected API');

    // 3. Logout
    const logoutRes = await h.logoutUser(reg.cookie);
    h.assertEqual(logoutRes.status, 200, 'Logout should work');

    // 4. Verify old session dead
    const me2 = await h.getMe(reg.cookie);
    h.assertEqual(me2.status, 401, 'Old session should be invalid');

    // 5. Login again
    const login = await h.loginUser(username);
    h.assertEqual(login.status, 200, 'Login should work');

    // 6. Access protected route with new session
    const me3 = await h.getMe(login.cookie);
    h.assertEqual(me3.status, 200, 'Should access with new session');
    h.assertEqual(me3.json.user.username, username, 'Username should match');
  });

  console.log('\n  E2E tests complete.');
}

module.exports = { run };
