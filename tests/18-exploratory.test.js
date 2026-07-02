/**
 * Test Suite: Exploratory Tests
 * Tests unusual behaviors, unexpected inputs, fuzzing,
 * race conditions, and edge cases that emerge from exploration.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Exploratory Tests');
  console.log('========================================\n');

  h.setSuite('Exploratory');

  // ── Fuzzing: Random Card Indices ──────────────────────
  await h.test('Fuzz: random card indices do not crash server', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    for (let i = 0; i < 20; i++) {
      const randIdx = Math.floor(Math.random() * 200) - 50; // -50 to 150
      sockets[0].emit('flip_card', { cardIndex: randIdx });
      await h.sleep(50);
    }
    h.assert(sockets[0].connected, 'Server should survive random indices');
    h.cleanupSockets(sockets);
  });

  // ── Fuzzing: Random Event Names ───────────────────────
  await h.test('Fuzz: unknown event names do not crash', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('fuzz_evt_' + ts, 'Fuzz', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', { userId: reg.body.user.id });
    sock.emit('nonexistent_event', { data: 'test' });
    sock.emit('another_fake_event', {});
    sock.emit('hack_attempt', { cmd: 'rm -rf /' });
    await h.sleep(500);

    h.assert(sock.connected, 'Socket should survive unknown events');
    sock.disconnect();
  });

  // ── Fuzzing: Malformed Payloads ───────────────────────
  await h.test('Fuzz: malformed flip_card payloads', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    // Various malformed payloads
    sockets[0].emit('flip_card', {});
    sockets[0].emit('flip_card', { cardIndex: 'abc' });
    sockets[0].emit('flip_card', { cardIndex: null });
    sockets[0].emit('flip_card', { cardIndex: undefined });
    sockets[0].emit('flip_card', { cardIndex: 3.14 });
    sockets[0].emit('flip_card', { cardIndex: {} });
    sockets[0].emit('flip_card', null);
    sockets[0].emit('flip_card', 'string');
    await h.sleep(500);

    h.assert(sockets[0].connected, 'Socket should survive malformed payloads');
    h.cleanupSockets(sockets);
  });

  // ── Fuzzing: Extremely Large Payload ──────────────────
  await h.test('Fuzz: extremely large cardIndex', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 999999999 });
    sockets[0].emit('flip_card', { cardIndex: -999999999 });
    sockets[0].emit('flip_card', { cardIndex: Number.MAX_SAFE_INTEGER });
    await h.sleep(500);

    h.assert(sockets[0].connected, 'Should handle extreme values');
    h.cleanupSockets(sockets);
  });

  // ── Fuzzing: Create Room with Weird Data ──────────────
  await h.test('Fuzz: create_room with unusual maxPlayers values', async () => {
    const ts = Date.now();
    const weirdValues = [-1, 0, 1.5, 'abc', null, true, false, {}, [], 999];

    for (let i = 0; i < weirdValues.length; i++) {
      const reg = await h.registerUser('fuzz_cr_' + i + '_' + ts, 'F' + i, 'br');
      const sock = h.createSocket(reg.cookie);
      await new Promise(r => sock.on('connect', r));
      sock.emit('identify', { userId: reg.body.user.id });

      const resultP = Promise.race([
        h.waitEvent(sock, 'room_created').then(() => 'created'),
        h.waitEvent(sock, 'room_error').then(() => 'error'),
        h.sleep(2000).then(() => 'timeout')
      ]);

      sock.emit('create_room', {
        name: 'Test', flagCode: 'br',
        maxPlayers: weirdValues[i]
      });

      const result = await resultP;
      h.assert(result !== 'timeout', 'Should respond to weird maxPlayers=' + weirdValues[i]);
      sock.disconnect();
    }
  });

  // ── Race: Flip Card Right Before Turn Passes ──────────
  await h.test('Race: flip card just before timeout', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Wait for timer to get low
    const timer = await h.waitEvent(sockets[0], 'turn_timer');
    h.assert(typeof timer.remaining === 'number', 'Timer should be running');

    // Flip card immediately
    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assert(flip.cardIndex === 0, 'Should be able to flip during turn');

    h.cleanupSockets(sockets);
  });

  // ── Race: Submit Validation Twice Quickly ─────────────
  await h.test('Race: double submit_validation', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Find a pair
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    for (let i = 1; i < 20; i++) {
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 2000);
      const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 3000);

      sockets[0].emit('flip_card', { cardIndex: i });
      const pairEvt = await pairP;

      if (pairEvt) {
        // Submit validation twice rapidly
        sockets[0].emit('submit_validation', { truthAnswer: true });
        sockets[0].emit('submit_validation', { truthAnswer: false });
        await h.sleep(500);

        // Server should handle gracefully
        h.assert(sockets[0].connected, 'Should survive double submit');
        h.cleanupSockets(sockets);
        return;
      }
      await retP;
      sockets[0].emit('flip_card', { cardIndex: i + 30 });
      await h.waitEvent(sockets[0], 'card_flipped');
    }

    console.log('    (info: no pair found - deck dependent)');
    h.cleanupSockets(sockets);
  });

  // ── Unexpected: Submit Validation Without Pair ────────
  await h.test('Exploratory: submit_validation without active pair', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    // Submit validation without any pair
    sockets[0].emit('submit_validation', { truthAnswer: true });
    await h.sleep(500);

    h.assert(sockets[0].connected, 'Should handle validation without pair');
    h.cleanupSockets(sockets);
  });

  // ── Unexpected: Play Again During Active Game ─────────
  await h.test('Exploratory: play_again during active game', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    // Flip a card first
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    // Play again mid-game
    sockets[0].emit('play_again');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Should reset game');

    h.cleanupSockets(sockets);
  });

  // ── Unexpected: Start Game with Only 1 Player ─────────
  await h.test('Exploratory: start_game with 1 player in room', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('solo_' + ts, 'Solo', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Solo', flagCode: 'br', maxPlayers: 2 });
    await h.waitEvent(sock, 'room_created');

    sock.emit('start_game');
    const gs = await h.waitEvent(sock, 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Solo game should start');

    sock.disconnect();
  });

  // ── Unexpected: Multiple Identify Events ──────────────
  await h.test('Exploratory: multiple identify events from same socket', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('multi_id_' + ts, 'Multi', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', { userId: reg.body.user.id });
    await h.sleep(100);
    sock.emit('identify', { userId: reg.body.user.id });
    await h.sleep(100);
    sock.emit('identify', { userId: reg.body.user.id });
    await h.sleep(300);

    h.assert(sock.connected, 'Should handle multiple identify');
    sock.disconnect();
  });

  // ── Unexpected: Join Room After Game Started ──────────
  await h.test('Exploratory: join room after game started', async () => {
    const { sockets, roomCode } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    // New player tries to join active game
    const ts = Date.now();
    const reg = await h.registerUser('latejoin_' + ts, 'Late', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('join_room', { name: 'Late', flagCode: 'br', code: roomCode });
    const err = await errP;
    h.assert(err.message.includes('andamento') || err.message.includes('progress'), 'Should reject join during active game');

    sock.disconnect();
    h.cleanupSockets(sockets);
  });

  // ── JSON Edge Cases in HTTP Body ──────────────────────
  await h.test('Exploratory: register with nested objects in body', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: { nested: 'object' },
      password: '123456',
      displayName: 'Test'
    });
    h.assert(res.status === 400 || res.status === 500, 'Should handle nested objects');
  });

  await h.test('Exploratory: register with arrays in body', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: ['array', 'value'],
      password: '123456'
    });
    h.assert(res.status === 400 || res.status === 500, 'Should handle arrays');
  });

  await h.test('Exploratory: register with numeric username', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 12345,
      password: '123456',
      displayName: 'Num'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle numeric username');
  });

  // ── Socket Event with Wrong Data Types ────────────────
  await h.test('Exploratory: identify with string userId', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('id_str_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', { userId: 'not_a_number' });
    await h.sleep(500);
    h.assert(sock.connected, 'Should handle string userId gracefully');
    sock.disconnect();
  });

  await h.test('Exploratory: identify with null userId', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('id_null_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', { userId: null });
    await h.sleep(500);
    h.assert(sock.connected, 'Should handle null userId');
    sock.disconnect();
  });

  await h.test('Exploratory: identify without userId field', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('id_none_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', {});
    await h.sleep(500);
    h.assert(sock.connected, 'Should handle missing userId');
    sock.disconnect();
  });

  // ── Room Code Case Sensitivity ────────────────────────
  await h.test('Exploratory: room code is uppercased', async () => {
    const { sockets, roomCode } = await h.setupRoom(2);

    // Room codes should always be uppercase (genCode uses uppercase charset)
    h.assertEqual(roomCode, roomCode.toUpperCase(), 'Room code should be uppercase');
    h.cleanupSockets(sockets);
  });

  await h.test('Exploratory: join with lowercase room code', async () => {
    const { sockets, roomCode } = await h.setupRoom(2, { maxPlayers: 3 });

    const ts = Date.now();
    const reg = await h.registerUser('lower_code_' + ts, 'Lower', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    // Join with lowercase code - server should uppercase it
    const resultP = Promise.race([
      h.waitEvent(sock, 'room_joined').then(() => 'joined'),
      h.waitEvent(sock, 'room_error').then(() => 'error'),
      h.sleep(3000).then(() => 'timeout')
    ]);

    sock.emit('join_room', {
      name: 'Lower', flagCode: 'br',
      code: roomCode.toLowerCase()
    });

    const result = await resultP;
    h.assert(result === 'joined', 'Should join with lowercase code');
    sock.disconnect();
    h.cleanupSockets(sockets);
  });

  console.log('\n  Exploratory tests complete.');
}

module.exports = { run };
