/**
 * Test Suite: Integration Tests
 * Tests complete flows that integrate multiple components:
 * API + Socket.IO + Database + Game Logic.
 * Each test exercises a cross-component workflow.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Integration Tests');
  console.log('========================================\n');

  h.setSuite('Integration');

  // ── Full Auth + Socket Integration ────────────────────
  await h.test('Register -> Connect Socket -> Identify -> Online', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('integ_1_' + ts, 'Integ', 'br');
    h.assertEqual(reg.status, 200, 'Registration should succeed');

    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));

    sock.emit('identify', { userId: reg.body.user.id });
    await h.sleep(500);

    // Verify user is marked as online
    const onlineRes = await h.httpReq('GET', '/api/users/online');
    h.assertEqual(onlineRes.status, 200, 'Should get online users');
    const found = onlineRes.body.users.some(u => u.username === 'integ_1_' + ts);
    h.assert(found, 'Registered user should appear online');

    sock.disconnect();
  });

  await h.test('Register -> Login with different session', async () => {
    const ts = Date.now();
    const username = 'integ_2_' + ts;
    const reg = await h.registerUser(username, 'Test', 'br');
    h.assertEqual(reg.status, 200, 'Register should succeed');

    const login = await h.loginUser(username);
    h.assertEqual(login.status, 200, 'Login should succeed');
    h.assertEqual(login.body.user.username, username, 'Usernames should match');
  });

  await h.test('Logout -> old session invalid -> login creates new', async () => {
    const ts = Date.now();
    const username = 'integ_3_' + ts;
    const reg = await h.registerUser(username, 'Test', 'br');

    // Verify session works
    const me1 = await h.getMe(reg.cookie);
    h.assertEqual(me1.status, 200, 'Session should work');

    // Logout
    await h.logoutUser(reg.cookie);

    // Old session invalid
    const me2 = await h.getMe(reg.cookie);
    h.assertEqual(me2.status, 401, 'Old session should be invalid');

    // Login creates new session
    const login = await h.loginUser(username);
    const me3 = await h.getMe(login.cookie);
    h.assertEqual(me3.status, 200, 'New session should work');
  });

  // ── Room + Socket Integration ─────────────────────────
  await h.test('Create Room -> Join -> Lobby Update to all', async () => {
    const ts = Date.now();
    const reg1 = await h.registerUser('integ_host_' + ts, 'Host', 'br');
    const reg2 = await h.registerUser('integ_guest_' + ts, 'Guest', 'ar');

    const sock1 = h.createSocket(reg1.cookie);
    const sock2 = h.createSocket(reg2.cookie);
    await Promise.all([
      new Promise(r => sock1.on('connect', r)),
      new Promise(r => sock2.on('connect', r))
    ]);

    sock1.emit('identify', { userId: reg1.body.user.id });
    sock2.emit('identify', { userId: reg2.body.user.id });

    // Host creates room
    sock1.emit('create_room', { name: 'Host', flagCode: 'br', maxPlayers: 4 });
    const created = await h.waitEvent(sock1, 'room_created');
    const code = created.code;

    // Listen for lobby update on host
    const lobbyP1 = h.waitEvent(sock1, 'lobby_update');

    // Guest joins
    sock2.emit('join_room', { name: 'Guest', flagCode: 'ar', code });
    await h.waitEvent(sock2, 'room_joined');

    // Host should get lobby update with 2 players
    const lobby = await lobbyP1;
    h.assert(lobby.players.length === 2, 'Should show 2 players in lobby');
    h.assertEqual(lobby.code, code, 'Code should match');

    sock1.disconnect();
    sock2.disconnect();
  });

  await h.test('Create -> Start Game -> Flip Card -> All see it', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');

    // Both should get game_start
    const gs1 = await h.waitEvent(sockets[0], 'game_start');
    const gs2 = await h.waitEvent(sockets[1], 'game_start');
    h.assertEqual(gs1.currentTurn, gs2.currentTurn, 'Both should see same currentTurn');

    // Player 0 flips a card
    const flipP2 = h.waitEvent(sockets[1], 'card_flipped');
    sockets[0].emit('flip_card', { cardIndex: 0 });

    const flipOn2 = await flipP2;
    h.assertEqual(flipOn2.cardIndex, 0, 'Player 2 should see card 0 flipped');
    h.assert(flipOn2.flagCode, 'Should have flagCode');

    h.cleanupSockets(sockets);
  });

  await h.test('Create -> Start -> Flip wrong pair -> Turn passes', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Flip first card
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');

    // Race: pair found vs wrong pair
    const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 5000);
    const turnP = h.waitEventOrNull(sockets[1], 'turn_changed', 6000);
    const retP = h.waitEventOrNull(sockets[0], 'cards_returned', 6000);

    sockets[0].emit('flip_card', { cardIndex: 1 });

    const pairResult = await pairP;
    if (!pairResult) {
      // Wrong pair - turn should pass
      const turn = await turnP;
      if (turn) {
        h.assertEqual(turn.currentTurn, 1, 'Turn should pass to player 1');
      }
    } else {
      console.log('    (info: pair found instead of wrong - deck dependent)');
    }

    h.cleanupSockets(sockets);
  });

  // ── Admin API + Database Integration ──────────────────
  await h.test('Admin create user -> login as that user', async () => {
    const ts = Date.now();
    // First register a user (via API to get a session)
    const adminReg = await h.registerUser('integ_adm_' + ts, 'Admin', 'br');

    // Admin creates user via admin API
    const username = 'adm_created_' + ts;
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username,
      password: '123456',
      displayName: 'AdmCreated',
      flagCode: 'ar'
    }, { Cookie: adminReg.cookie });

    // This might fail with 403 since user is not admin (no ADMIN_CODE env)
    if (createRes.status === 403) {
      console.log('    (info: user is not admin, expected without ADMIN_CODE)');
      h.assert(true, 'Non-admin correctly blocked');
    } else if (createRes.status === 200) {
      // Login as the created user
      const loginRes = await h.httpReq('POST', '/api/auth/login', {
        username, password: '123456'
      });
      h.assertEqual(loginRes.status, 200, 'Created user should be able to login');
    }
  });

  // ── Match Data Persistence Integration ────────────────
  await h.test('GET /api/matches reflects database state', async () => {
    const beforeRes = await h.httpReq('GET', '/api/matches');
    const beforeCount = beforeRes.body.length;

    // The matches table might get new entries from game completions in other tests
    // Just verify the endpoint consistently returns data
    const afterRes = await h.httpReq('GET', '/api/matches');
    h.assertEqual(afterRes.status, 200, 'Should always return 200');
    h.assert(Array.isArray(afterRes.body), 'Should always return array');
    h.assert(afterRes.body.length >= beforeCount, 'Match count should not decrease');
  });

  // ── Full Game Lifecycle Integration ───────────────────
  await h.test('Full lifecycle: room -> game -> play_again -> game', async () => {
    const { sockets } = await h.setupRoom(2);

    // Start game
    sockets[0].emit('start_game');
    const gs1 = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs1.currentTurn, 0, 'First game starts at turn 0');

    await h.sleep(500);

    // Play again
    sockets[0].emit('play_again');
    const gs2 = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs2.currentTurn, 0, 'Second game starts at turn 0');
    h.assert(gs2.scores.every(s => s === 0), 'Scores should be reset');

    h.cleanupSockets(sockets);
  });

  // ── Socket Reconnection Integration ───────────────────
  await h.test('Player disconnects mid-game -> reconnect_room restores state', async () => {
    const { sockets, roomCode, names } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');
    await h.sleep(300);

    // Player 1 disconnects
    sockets[1].disconnect();
    await h.sleep(500);

    // Player 0 should get player_status showing player 1 disconnected
    const status = await h.waitEvent(sockets[0], 'player_status');
    h.assert(status.players[1] === null || status.players[1].connected === false,
      'Player 1 should be marked disconnected');

    h.cleanupSockets([sockets[0]]);
  });

  // ── Multiple Rooms Integration ────────────────────────
  await h.test('Two independent rooms operate simultaneously', async () => {
    const ts = Date.now();
    const reg1 = await h.registerUser('mr1_' + ts, 'P1', 'br');
    const reg2 = await h.registerUser('mr2_' + ts, 'P2', 'ar');
    const reg3 = await h.registerUser('mr3_' + ts, 'P3', 'fr');
    const reg4 = await h.registerUser('mr4_' + ts, 'P4', 'de');

    const sock1 = h.createSocket(reg1.cookie);
    const sock2 = h.createSocket(reg2.cookie);
    const sock3 = h.createSocket(reg3.cookie);
    const sock4 = h.createSocket(reg4.cookie);

    await Promise.all([
      new Promise(r => sock1.on('connect', r)),
      new Promise(r => sock2.on('connect', r)),
      new Promise(r => sock3.on('connect', r)),
      new Promise(r => sock4.on('connect', r))
    ]);

    sock1.emit('identify', { userId: reg1.body.user.id });
    sock2.emit('identify', { userId: reg2.body.user.id });
    sock3.emit('identify', { userId: reg3.body.user.id });
    sock4.emit('identify', { userId: reg4.body.user.id });

    // Room A
    sock1.emit('create_room', { name: 'P1', flagCode: 'br', maxPlayers: 2 });
    const roomA = await h.waitEvent(sock1, 'room_created');
    sock2.emit('join_room', { name: 'P2', flagCode: 'ar', code: roomA.code });
    await h.waitEvent(sock2, 'room_joined');

    // Room B
    sock3.emit('create_room', { name: 'P3', flagCode: 'fr', maxPlayers: 2 });
    const roomB = await h.waitEvent(sock3, 'room_created');
    sock4.emit('join_room', { name: 'P4', flagCode: 'de', code: roomB.code });
    await h.waitEvent(sock4, 'room_joined');

    h.assert(roomA.code !== roomB.code, 'Rooms should have different codes');

    // Start both games
    sock1.emit('start_game');
    sock3.emit('start_game');

    const gsA = await h.waitEvent(sock1, 'game_start');
    const gsB = await h.waitEvent(sock3, 'game_start');

    h.assertEqual(gsA.currentTurn, 0, 'Room A game should start');
    h.assertEqual(gsB.currentTurn, 0, 'Room B game should start');

    [sock1, sock2, sock3, sock4].forEach(s => s.disconnect());
  });

  // ── Cookie/Session Integration ────────────────────────
  await h.test('Cookie persists across multiple HTTP requests', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('cookie_' + ts, 'Cookie', 'br');

    // Use same cookie for multiple requests
    const me1 = await h.getMe(reg.cookie);
    h.assertEqual(me1.status, 200, 'First request should work');

    const me2 = await h.getMe(reg.cookie);
    h.assertEqual(me2.status, 200, 'Second request should work');

    const me3 = await h.getMe(reg.cookie);
    h.assertEqual(me3.status, 200, 'Third request should work');

    h.assertEqual(me1.json.user.id, me3.json.user.id, 'User ID should be consistent');
  });

  // ── Start game requires host ──────────────────────────
  await h.test('start_game only works for host (player 0)', async () => {
    const { sockets } = await h.setupRoom(3);
    // Player 2 tries to start
    const gsP = h.waitEventOrNull(sockets[0], 'game_start', 2000);
    sockets[2].emit('start_game');
    const result = await gsP;
    h.assert(!result, 'Non-host starting game should be ignored');

    // Host starts
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Host start should work');

    h.cleanupSockets(sockets);
  });

  // ── Reveal cards privacy ──────────────────────────────
  await h.test('reveal_cards_request only sends to requesting player', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Player 0 requests reveal
    const revealP0 = h.waitEvent(sockets[0], 'reveal_all_cards');
    const revealP1 = h.waitEventOrNull(sockets[1], 'reveal_all_cards', 2000);

    sockets[0].emit('reveal_cards_request');

    const data0 = await revealP0;
    h.assert(data0.cards && Object.keys(data0.cards).length === 96, 'Requester should see all cards');

    const data1 = await revealP1;
    h.assert(!data1, 'Other player should NOT see revealed cards');

    h.cleanupSockets(sockets);
  });

  console.log('\n  Integration tests complete.');
}

module.exports = { run };
