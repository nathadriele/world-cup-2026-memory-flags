/**
 * Test Suite: Security (Caixa-Preta)
 * Tests SQL injection, XSS, auth bypass, input validation,
 * session manipulation, and other attack vectors.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Security Tests');
  console.log('========================================\n');

  h.setSuite('Security');

  // ── SQL Injection Attempts ────────────────────────────
  await h.test('SQL injection in username (login)', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: "' OR '1'='1",
      password: "' OR '1'='1"
    });
    h.assertEqual(res.status, 401, 'Should reject SQL injection');
  });

  await h.test('SQL injection in username (register)', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: "admin'; DROP TABLE users;--",
      password: '123456',
      displayName: 'Hack',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject malicious username');
  });

  await h.test('SQL injection with UNION SELECT', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: "' UNION SELECT * FROM users--",
      password: 'x'
    });
    h.assertEqual(res.status, 401, 'Should reject UNION injection');
  });

  await h.test('SQL injection with semicolon comment', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: "test; --",
      password: '123456'
    });
    h.assertEqual(res.status, 401, 'Should reject semicolon injection');
  });

  await h.test('SQL injection in admin user lookup', async () => {
    // Register an admin first
    const admin = await h.registerUser('sec_admin_' + Date.now(), 'SecAdmin', 'br');
    await h.httpReq('POST', '/api/auth/become-admin', { adminCode: '' }, { Cookie: admin.cookie });

    // Try SQL injection in admin create user
    const res = await h.httpReq('POST', '/api/admin/users', {
      username: "'; DROP TABLE sessions;--",
      password: '123456',
      displayName: 'Hacker',
      flagCode: 'br'
    }, { Cookie: admin.cookie });
    h.assert(res.status === 400 || res.status === 500, 'Should reject SQL injection in admin');
  });

  // ── XSS Attempts ──────────────────────────────────────
  await h.test('XSS in displayName (register)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'xss_test_' + ts,
      password: '123456',
      displayName: '<script>alert("xss")</script>',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 200, 'Should accept registration');
    h.assert(
      !res.body.user.displayName.includes('<script>'),
      'Script tag should be sanitized or escaped'
    );
  });

  await h.test('XSS in displayName via admin update', async () => {
    const ts = Date.now();
    const admin = await h.registerUser('sec_adm2_' + ts, 'Adm', 'br');

    // Register a normal user
    const user = await h.registerUser('sec_usr_' + ts, 'User', 'br');

    // Try XSS via admin update
    const res = await h.httpReq('PUT', '/api/admin/users/' + (user.body.user.id), {
      displayName: '<img src=x onerror=alert(1)>'
    }, { Cookie: admin.cookie });

    h.assert(res.status === 200 || res.status === 400, 'Should handle XSS attempt');
  });

  await h.test('XSS in room player name', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('xss_room_' + ts, 'Player', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', {
      name: '<script>alert("room")</script>',
      flagCode: 'br',
      maxPlayers: 2
    });
    const data = await h.waitEvent(sock, 'room_created');
    h.assert(data.code.length === 6, 'Room should be created with valid code');
    sock.disconnect();
  });

  // ── Auth Bypass Attempts ──────────────────────────────
  await h.test('Access protected API without cookie', async () => {
    const res = await h.httpReq('GET', '/api/auth/me', null, {});
    h.assertEqual(res.status, 401, 'Should require auth');
  });

  await h.test('Access admin API without cookie', async () => {
    const res = await h.httpReq('GET', '/api/admin/users', null, {});
    h.assert(res.status === 401 || res.status === 403, 'Should block non-authed admin access');
  });

  await h.test('Access admin API with fake cookie', async () => {
    const res = await h.httpReq('GET', '/api/admin/users', null, {
      Cookie: 'auth_token=faketoken123456'
    });
    h.assertEqual(res.status, 401, 'Should reject fake session token');
  });

  await h.test('Access admin API with regular user cookie', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('noadmin_' + ts, 'NoAdmin', 'br');
    const res = await h.httpReq('GET', '/api/admin/users', null, {
      Cookie: reg.cookie
    });
    h.assertEqual(res.status, 403, 'Should block non-admin user');
  });

  await h.test('Access admin page without auth', async () => {
    const res = await h.httpGet('/admin');
    h.assert(res.status === 401 || res.status === 403, 'Should block unauthed admin page');
  });

  await h.test('Access protected pages without auth redirects', async () => {
    const pages = ['/jogar', '/dados', '/ajuda', '/ranking'];
    for (const page of pages) {
      const res = await h.httpGet(page);
      h.assertEqual(res.status, 302, page + ' should redirect when not authed');
    }
  });

  await h.test('Expired/invalid session token rejected', async () => {
    const res = await h.httpReq('GET', '/api/auth/me', null, {
      Cookie: 'auth_token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    h.assertEqual(res.status, 401, 'Invalid token should be rejected');
  });

  // ── Input Validation ──────────────────────────────────
  await h.test('Register with short username (< 3 chars)', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'ab',
      password: '123456',
      displayName: 'Short',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject short username');
  });

  await h.test('Register with short password (< 6 chars)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'shortpw_' + ts,
      password: '12345',
      displayName: 'ShortPW',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject short password');
  });

  await h.test('Register with long displayName (> 15 chars)', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'longname_' + ts,
      password: '123456',
      displayName: 'A'.repeat(20),
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject long displayName');
  });

  await h.test('Register with missing username', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: '',
      password: '123456',
      displayName: 'Test',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject empty username');
  });

  await h.test('Register with missing password', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'nopass_' + Date.now(),
      password: '',
      displayName: 'Test',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject empty password');
  });

  await h.test('Register with missing displayName', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'nodname_' + Date.now(),
      password: '123456',
      displayName: '',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 400, 'Should reject empty displayName');
  });

  await h.test('Duplicate username rejected', async () => {
    const ts = Date.now();
    const username = 'dupuser_' + ts;
    await h.registerUser(username, 'First', 'br');
    const res2 = await h.httpReq('POST', '/api/auth/register', {
      username,
      password: '123456',
      displayName: 'Second',
      flagCode: 'ar'
    });
    h.assertEqual(res2.status, 400, 'Should reject duplicate username');
  });

  await h.test('Login with wrong password', async () => {
    const ts = Date.now();
    await h.registerUser('wrongpw_' + ts, 'Test', 'br');
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: 'wrongpw_' + ts,
      password: 'wrongpassword'
    });
    h.assertEqual(res.status, 401, 'Should reject wrong password');
  });

  await h.test('Login with non-existent user', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: 'ghost_user_' + Date.now(),
      password: '123456'
    });
    h.assertEqual(res.status, 401, 'Should reject non-existent user');
  });

  // ── Session Security ──────────────────────────────────
  await h.test('Logout invalidates session token', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('logout_' + ts, 'Test', 'br');

    // Verify logged in
    const me1 = await h.getMe(reg.cookie);
    h.assertEqual(me1.status, 200, 'Should be logged in');

    // Logout
    await h.logoutUser(reg.cookie);

    // Verify logged out
    const me2 = await h.getMe(reg.cookie);
    h.assertEqual(me2.status, 401, 'Should be logged out after logout');
  });

  await h.test('Become-admin with wrong code rejected', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('badm_' + ts, 'Test', 'br');
    const res = await h.httpReq('POST', '/api/auth/become-admin', {
      adminCode: 'wrongcode'
    }, { Cookie: reg.cookie });
    h.assertEqual(res.status, 403, 'Should reject wrong admin code');
  });

  await h.test('Become-admin requires auth', async () => {
    const res = await h.httpReq('POST', '/api/auth/become-admin', {
      adminCode: 'test'
    }, {});
    h.assertEqual(res.status, 401, 'Should require auth for become-admin');
  });

  // ── Card Index Boundary ───────────────────────────────
  await h.test('Negative card index rejected', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
    sockets[0].emit('flip_card', { cardIndex: -1 });
    const result = await flipP;
    h.assert(!result, 'Negative card index should be rejected');
    h.cleanupSockets(sockets);
  });

  await h.test('Out-of-range card index (>95) rejected', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
    sockets[0].emit('flip_card', { cardIndex: 96 });
    const result = await flipP;
    h.assert(!result, 'Card index > 95 should be rejected');
    h.cleanupSockets(sockets);
  });

  await h.test('Flipping already-flipped card rejected', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(200);

    // Try flipping the same card again
    const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
    sockets[0].emit('flip_card', { cardIndex: 0 });
    const result = await flipP;
    h.assert(!result, 'Should reject flipping already-flipped card');
    h.cleanupSockets(sockets);
  });

  await h.test('Flipping more than 2 cards blocked', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    sockets[0].emit('flip_card', { cardIndex: 1 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(200);

    // Try flipping a third card
    const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
    sockets[0].emit('flip_card', { cardIndex: 2 });
    const result = await flipP;
    h.assert(!result, 'Should block flipping 3rd card');
    h.cleanupSockets(sockets);
  });

  // ── Room Code Validation ──────────────────────────────
  await h.test('Join room with invalid code', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('invcode_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('join_room', { name: 'Test', flagCode: 'br', code: 'ZZZZZZ' });
    const err = await errP;
    h.assert(err.message.includes('não encontrada') || err.message.includes('not found'), 'Should report room not found');
    sock.disconnect();
  });

  await h.test('Create room with missing name', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('noname_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('create_room', { name: '', flagCode: '', maxPlayers: 2 });
    const err = await errP;
    h.assert(err.message.length > 0, 'Should return error for missing fields');
    sock.disconnect();
  });

  await h.test('Join room with missing code', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('nocode_' + ts, 'Test', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    const errP = h.waitEvent(sock, 'room_error');
    sock.emit('join_room', { name: 'Test', flagCode: 'br', code: '' });
    const err = await errP;
    h.assert(err.message.length > 0, 'Should return error for missing code');
    sock.disconnect();
  });

  // ── Flip Card During Validation ───────────────────────
  await h.test('Flipping card during pending validation blocked', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // We need to find a pair by testing - but we can't control card layout
    // So we flip cards until we potentially get a pair_found event
    // For this test we'll just verify the pendingValidation check works
    // by flipping two cards and trying a third
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(100);
    sockets[0].emit('flip_card', { cardIndex: 1 });
    await h.sleep(500);

    // If pair was found, try to flip during validation
    const pairEvent = await h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 3000);
    if (pairEvent) {
      const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
      sockets[0].emit('flip_card', { cardIndex: 5 });
      const result = await flipP;
      h.assert(!result, 'Should block flip during validation');
    } else {
      console.log('    (info: no pair found - deck dependent, skip)');
    }
    h.cleanupSockets(sockets);
  });

  // ── HTTP Method Security ──────────────────────────────
  await h.test('DELETE method on auth endpoint', async () => {
    const res = await h.httpReq('DELETE', '/api/auth/me', null, {});
    h.assert(res.status === 404 || res.status === 405, 'DELETE should not be valid on /api/auth/me');
  });

  await h.test('PUT method on matches endpoint', async () => {
    const res = await h.httpReq('PUT', '/api/matches', { test: true }, {});
    h.assert(res.status === 404 || res.status === 405, 'PUT should not be valid on /api/matches');
  });

  console.log('\n  Security tests complete.');
}

module.exports = { run };
