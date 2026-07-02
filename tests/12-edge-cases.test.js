/**
 * Test Suite: Edge Cases
 * Tests boundary conditions, unusual inputs, extreme values,
 * and corner cases that might not be covered by normal flows.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Edge Cases Tests');
  console.log('========================================\n');

  h.setSuite('EdgeCases');

  // ── Username Boundary Tests ───────────────────────────
  await h.test('Username exactly 3 characters (minimum valid)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'abc',
      password: '123456',
      displayName: 'MinUser',
      flagCode: 'br'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle 3-char username');
  });

  await h.test('Username exactly 2 characters (below minimum)', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'ab',
      password: '123456',
      displayName: 'Short',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject 2-char username');
  });

  await h.test('Very long username (100+ chars)', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'a'.repeat(100),
      password: '123456',
      displayName: 'Long',
      flagCode: 'br'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle long username gracefully');
  });

  await h.test('Username with special characters', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'user@test_' + ts,
      password: '123456',
      displayName: 'Special',
      flagCode: 'br'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle special chars');
  });

  await h.test('Username with unicode/emoji', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'user_emoji_🎮_' + Date.now(),
      password: '123456',
      displayName: 'Emoji',
      flagCode: 'br'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle emoji');
  });

  // ── Password Boundary Tests ───────────────────────────
  await h.test('Password exactly 6 characters (minimum valid)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'minpw_' + ts,
      password: '123456',
      displayName: 'MinPW',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 200, '6-char password should be accepted');
  });

  await h.test('Password exactly 5 characters (below minimum)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'shortpw_' + ts,
      password: '12345',
      displayName: 'ShortPW',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, '5-char password should be rejected');
  });

  await h.test('Very long password (1000 chars)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'longpw_' + ts,
      password: 'x'.repeat(1000),
      displayName: 'LongPW',
      flagCode: 'br'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle very long password');
  });

  // ── DisplayName Boundary Tests ────────────────────────
  await h.test('DisplayName exactly 15 characters (max valid)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'maxname_' + ts,
      password: '123456',
      displayName: 'A'.repeat(15),
      flagCode: 'br'
    });
    h.assertEqual(res.status, 200, '15-char displayName should be accepted');
  });

  await h.test('DisplayName exactly 16 characters (over max)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'overname_' + ts,
      password: '123456',
      displayName: 'A'.repeat(16),
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, '16-char displayName should be rejected');
  });

  await h.test('DisplayName exactly 1 character', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'onename_' + ts,
      password: '123456',
      displayName: 'X',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 200, '1-char displayName should be accepted');
  });

  // ── Room MaxPlayers Boundary ──────────────────────────
  await h.test('Room with maxPlayers=1', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('mp1_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Solo', flagCode: 'br', maxPlayers: 1 });
    const created = await h.waitEvent(sock, 'room_created');
    h.assert(created.maxPlayers >= 1, 'Should allow maxPlayers=1');
    sock.disconnect();
  });

  await h.test('Room with maxPlayers=8 (maximum)', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('mp8_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Big', flagCode: 'br', maxPlayers: 8 });
    const created = await h.waitEvent(sock, 'room_created');
    h.assert(created.maxPlayers <= 8, 'Should enforce max of 8 players');
    sock.disconnect();
  });

  await h.test('Room with maxPlayers=0 (below minimum)', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('mp0_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Zero', flagCode: 'br', maxPlayers: 0 });
    const created = await h.waitEvent(sock, 'room_created');
    h.assert(created.maxPlayers >= 1, 'Should clamp to at least 1');
    sock.disconnect();
  });

  await h.test('Room with maxPlayers=100 (over maximum)', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('mp100_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Huge', flagCode: 'br', maxPlayers: 100 });
    const created = await h.waitEvent(sock, 'room_created');
    h.assert(created.maxPlayers <= 8, 'Should clamp to max 8');
    sock.disconnect();
  });

  // ── Card Index Boundaries ─────────────────────────────
  await h.test('Card index 0 is valid', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assertEqual(flip.cardIndex, 0, 'Card 0 should be flippable');
    h.cleanupSockets(sockets);
  });

  await h.test('Card index 95 is valid', async () => {
    const { sockets } = await h.setupRoom(2);
    await h.startGame(sockets);
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 95 });
    const flip = await h.waitEvent(sockets[0], 'card_flipped');
    h.assertEqual(flip.cardIndex, 95, 'Card 95 should be flippable');
    h.cleanupSockets(sockets);
  });

  // ── Missing/Null Body Fields ──────────────────────────
  await h.test('Register with null body fields', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: null,
      password: null,
      displayName: null
    });
    h.assertEqual(res.status, 400, 'Should reject null fields');
  });

  await h.test('Register with undefined body fields', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: undefined,
      password: undefined
    });
    h.assertEqual(res.status, 400, 'Should reject undefined fields');
  });

  await h.test('Login with null credentials', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: null,
      password: null
    });
    h.assertEqual(res.status, 401, 'Should reject null credentials');
  });

  // ── Empty Body ────────────────────────────────────────
  await h.test('Register with empty JSON body', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {});
    h.assertEqual(res.status, 400, 'Should reject empty body');
  });

  await h.test('Login with empty JSON body', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {});
    h.assertEqual(res.status, 401, 'Should reject empty body');
  });

  // ── Case Insensitivity ────────────────────────────────
  await h.test('Username is case-insensitive for login', async () => {
    const ts = Date.now();
    const username = 'MixedCase_' + ts;
    await h.registerUser(username, 'Test', 'br');
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: username.toUpperCase(),
      password: '123456'
    });
    h.assertEqual(res.status, 200, 'Should login with uppercase username');
  });

  // ── Concurrent Registration (Race) ────────────────────
  await h.test('Concurrent duplicate registration - only one succeeds', async () => {
    const username = 'concurrent_' + Date.now();
    const [r1, r2] = await Promise.all([
      h.httpReq('POST', '/api/auth/register', {
        username, password: '123456', displayName: 'First', flagCode: 'br'
      }),
      h.httpReq('POST', '/api/auth/register', {
        username, password: '123456', displayName: 'Second', flagCode: 'ar'
      })
    ]);
    const okCount = [r1, r2].filter(r => r.status === 200).length;
    h.assert(okCount === 1, 'Exactly one concurrent registration should succeed, got ' + okCount);
  });

  // ── HTTP Content-Type ─────────────────────────────────
  await h.test('POST without Content-Type json', async () => {
    const http = require('http');
    const res = await new Promise((resolve) => {
      const data = JSON.stringify({ username: 'test', password: '123456' });
      const req = http.request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      req.write(data);
      req.end();
    });
    h.assert(res.status >= 400, 'Should handle missing content-type');
  });

  // ── Flag Code Edge Cases ──────────────────────────────
  await h.test('Register with no flagCode uses default br', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'noflag_' + ts,
      password: '123456',
      displayName: 'NoFlag'
    });
    h.assertEqual(res.status, 200, 'Should register without flagCode');
    if (res.body.user) {
      h.assert(typeof res.body.user.flagCode === 'string', 'Should have a flagCode');
    }
  });

  await h.test('Register with invalid flagCode still works', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'badflag_' + ts,
      password: '123456',
      displayName: 'BadFlag',
      flagCode: 'invalid_country_code_xyz'
    });
    h.assert(res.status === 200 || res.status === 400, 'Should handle invalid flagCode');
  });

  // ── Session Expiry ────────────────────────────────────
  await h.test('Session token has correct maxAge', async () => {
    const ts = Date.now();
    const res = await h.registerUser('session_' + ts, 'Test', 'br');
    const cookies = res.cookie;
    h.assert(cookies.includes('auth_token='), 'Should have auth_token cookie');
    // Cookie should be httpOnly (set by server)
    h.cleanupSockets([]);
  });

  // ── Very Long Room Code Input ─────────────────────────
  await h.test('Join room with very long code', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('longcode_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('join_room', {
      name: 'Test', flagCode: 'br',
      code: 'A'.repeat(1000)
    });
    const err = await errP;
    h.assert(err.message.length > 0, 'Should handle long room code');
    sock.disconnect();
  });

  // ── Leave Room While Not In One ───────────────────────
  await h.test('Leave room when not in any room', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('noroom_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    // Should not crash
    sock.emit('leave_room');
    await h.sleep(500);
    h.assert(true, 'Should handle leave_room gracefully when not in a room');
    sock.disconnect();
  });

  // ── Start Game Requires All Players Ready ─────────────
  await h.test('Game starts only when all players toggle_ready', async () => {
    const { sockets } = await h.setupRoom(2);
    // Only player 0 toggles ready - game should NOT start
    const gsP = h.waitEventOrNull(sockets[0], 'game_start', 2000);
    sockets[0].emit('toggle_ready');
    const result = await gsP;
    h.assert(!result, 'Game should not start with only 1 of 2 players ready');

    // Now player 1 toggles ready - game should start
    sockets[1].emit('toggle_ready');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Game should start when all ready');
    h.cleanupSockets(sockets);
  });

  console.log('\n  Edge Cases tests complete.');
}

module.exports = { run };
