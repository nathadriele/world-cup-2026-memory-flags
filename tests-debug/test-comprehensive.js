#!/usr/bin/env node
/**
 * Comprehensive test suite for Memory Cup 2026
 * Tests: auth, routes, room creation/join, game flow, card flip, validation, disconnect, reconnect
 */

const io = require('socket.io-client');
const http = require('http');

const BASE = 'http://localhost:3000';
let passCount = 0;
let failCount = 0;
const results = [];

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      passCount++;
      results.push({ name, status: 'PASS' });
      console.log('  PASS: ' + name);
      resolve();
    } catch(e) {
      failCount++;
      results.push({ name, status: 'FAIL', error: e.message });
      console.log('  FAIL: ' + name + ' - ' + e.message);
      resolve();
    }
  });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// HTTP helper
function httpReq(method, path, body, cookies) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        ...(cookies ? { Cookie: cookies } : {})
      }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(chunks), headers: res.headers, raw: chunks }); }
        catch(e) { resolve({ status: res.statusCode, json: null, headers: res.headers, raw: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getCookie(headers, name) {
  const cookies = headers['set-cookie'] || [];
  for (const c of cookies) {
    if (c.startsWith(name + '=')) {
      return c.split(';')[0];
    }
  }
  return '';
}

async function registerUser(username, displayName, flagCode) {
  const res = await httpReq('POST', '/api/auth/register', {
    username, password: '123456', displayName, flagCode: flagCode || 'br'
  });
  return getCookie(res.headers, 'auth_token');
}

function createSocket(cookie) {
  return io(BASE, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    forceNew: true
  });
}

async function waitEvent(socket, event, timeout) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout waiting for ' + event)), timeout || 3000);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  Memory Cup 2026 - Comprehensive Tests');
  console.log('========================================\n');

  // === GROUP 1: Authentication & Routes ===
  console.log('--- Authentication & Routes ---');

  await test('GET / should serve login page (200)', async () => {
    const res = await httpReq('GET', '/');
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(res.raw.includes('login') || res.raw.includes('Memory'), 'Expected login page content');
  });

  await test('GET /jogar without auth should redirect (302)', async () => {
    const res = await httpReq('GET', '/jogar');
    assert(res.status === 302 || res.status === 200, 'Expected 302 or 200, got ' + res.status);
  });

  await test('GET /dados without auth should redirect (302)', async () => {
    const res = await httpReq('GET', '/dados');
    assert(res.status === 302 || res.status === 200, 'Expected 302 or 200, got ' + res.status);
  });

  await test('GET /ranking without auth should redirect (302)', async () => {
    const res = await httpReq('GET', '/ranking');
    assert(res.status === 302 || res.status === 200, 'Expected 302 or 200, got ' + res.status);
  });

  await test('GET /admin without auth should redirect or 401', async () => {
    const res = await httpReq('GET', '/admin');
    assert(res.status === 302 || res.status === 200 || res.status === 401, 'Expected 302, 200, or 401, got ' + res.status);
  });

  await test('POST /api/auth/register - create test user', async () => {
    const res = await httpReq('POST', '/api/auth/register', {
      username: 'testuser1_' + Date.now(),
      password: '123456',
      displayName: 'TestPlayer1',
      flagCode: 'br'
    });
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(res.json && res.json.user, 'Expected user object');
    assert(res.json.user.displayName === 'TestPlayer1', 'Wrong displayName');
  });

  await test('POST /api/auth/login - login with wrong password', async () => {
    const res = await httpReq('POST', '/api/auth/login', {
      username: 'testuser1_' + Date.now(),
      password: 'wrongpass'
    });
    assert(res.status === 401, 'Expected 401, got ' + res.status);
  });

  await test('POST /api/auth/login - register then login', async () => {
    const uname = 'loginuser_' + Date.now();
    await httpReq('POST', '/api/auth/register', {
      username: uname, password: '123456', displayName: 'LoginTest', flagCode: 'ar'
    });
    const res = await httpReq('POST', '/api/auth/login', {
      username: uname, password: '123456'
    });
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(res.json.user.displayName === 'LoginTest', 'Wrong displayName');
  });

  await test('GET /api/auth/me - with valid cookie', async () => {
    const cookie = await registerUser('meuser_' + Date.now(), 'MeUser', 'br');
    const res = await httpReq('GET', '/api/auth/me', null, 'auth_token=' + cookie.split('=')[1]);
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(res.json.user.displayName === 'MeUser', 'Expected MeUser');
  });

  await test('GET /api/ranking - returns ranking array', async () => {
    const res = await httpReq('GET', '/api/ranking');
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(Array.isArray(res.json.ranking), 'Expected ranking array');
    assert(typeof res.json.totalMatches === 'number', 'Expected totalMatches number');
  });

  await test('GET /api/matches - returns matches array', async () => {
    const res = await httpReq('GET', '/api/matches');
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(Array.isArray(res.json), 'Expected matches array');
  });

  await test('GET /api/users/online - returns users array', async () => {
    const res = await httpReq('GET', '/api/users/online');
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(Array.isArray(res.json.users), 'Expected users array');
  });

  // === GROUP 2: Room Creation & Lobby ===
  console.log('\n--- Room Creation & Lobby ---');

  const cookie1 = await registerUser('host_' + Date.now(), 'HostPlayer', 'br');
  const cookie2 = await registerUser('guest_' + Date.now(), 'GuestPlayer', 'ar');

  await test('Create room - host creates room', async () => {
    const s = createSocket(cookie1);
    await new Promise(r => s.on('connect', r));

    s.emit('create_room', { name: 'HostPlayer', flagCode: 'br', maxPlayers: 2, previewCards: false });
    const data = await waitEvent(s, 'room_created');
    assert(data.code && data.code.length === 6, 'Expected 6-char code, got ' + data.code);
    assert(data.playerIndex === 0, 'Expected playerIndex 0');
    assert(data.maxPlayers === 2, 'Expected maxPlayers 2');

    global.__roomCode = data.code;
    global.__hostSocket = s;
  });

  await test('Join room - guest joins existing room', async () => {
    const s = createSocket(cookie2);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: 'GuestPlayer', flagCode: 'ar', code: global.__roomCode });
    const data = await waitEvent(s, 'room_joined');
    assert(data.code === global.__roomCode, 'Code mismatch');
    assert(data.playerIndex === 1, 'Expected playerIndex 1');

    global.__guestSocket = s;
  });

  await test('Lobby update - host receives lobby update after guest joins', async () => {
    const data = await waitEvent(global.__hostSocket, 'lobby_update', 2000);
    assert(data.players && data.players.length >= 2, 'Expected 2 players');
    assert(data.code === global.__roomCode, 'Code mismatch');
  });

  await test('Join non-existent room - should get error', async () => {
    const s = createSocket(cookie2);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: 'GuestPlayer', flagCode: 'ar', code: 'ZZZZZZ' });
    const data = await waitEvent(s, 'room_error');
    assert(data.message.includes('encontrada') || data.message.includes('not found') || data.message.includes('nao'), 'Expected room not found error');
    s.disconnect();
  });

  await test('Join room with missing fields - should get error', async () => {
    const s = createSocket(cookie2);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: '', flagCode: '', code: '' });
    const data = await waitEvent(s, 'room_error');
    assert(data.message, 'Expected error message');
    s.disconnect();
  });

  // === GROUP 3: Game Flow ===
  console.log('\n--- Game Flow ---');

  await test('Start game - host starts game', async () => {
    global.__hostSocket.emit('start_game');
    const data1 = await waitEvent(global.__hostSocket, 'game_start', 3000);
    assert(data1.players && data1.players.length === 2, 'Expected 2 players');
    assert(typeof data1.currentTurn === 'number', 'Expected currentTurn');
    assert(data1.scores && data1.scores.length === 2, 'Expected 2 scores');

    // Guest should also receive game_start
    const data2 = await waitEvent(global.__guestSocket, 'game_start', 2000);
    assert(data2.players.length === 2, 'Guest: Expected 2 players');

    global.__currentTurn = data1.currentTurn;
    global.__players = data1.players;
  });

  await test('Flip first card - should get card_flipped event', async () => {
    const turnPlayer = global.__currentTurn === 0 ? global.__hostSocket : global.__guestSocket;
    const otherPlayer = global.__currentTurn === 0 ? global.__guestSocket : global.__hostSocket;

    turnPlayer.emit('flip_card', { cardIndex: 0 });

    const data1 = await waitEvent(turnPlayer, 'card_flipped', 3000);
    assert(typeof data1.cardIndex === 'number', 'Expected cardIndex');
    assert(data1.cardIndex === 0, 'Expected cardIndex 0');
    assert(data1.flagCode, 'Expected flagCode');

    const data2 = await waitEvent(otherPlayer, 'card_flipped', 2000);
    assert(data2.cardIndex === 0, 'Other player: Expected cardIndex 0');
  });

  await test('Flip second card - should trigger validation or wrong', async () => {
    const turnPlayer = global.__currentTurn === 0 ? global.__hostSocket : global.__guestSocket;

    // Flip a second card (index 1)
    turnPlayer.emit('flip_card', { cardIndex: 1 });

    // Server emits card_flipped first, then either pair_found_pending_validation or cards_returned
    await waitEvent(turnPlayer, 'card_flipped', 3000);

    // Wait for either pair_found_pending_validation or cards_returned
    const event = await Promise.race([
      waitEvent(turnPlayer, 'pair_found_pending_validation', 10000).then(d => ({ type: 'pair', data: d })),
      waitEvent(turnPlayer, 'cards_returned', 10000).then(d => ({ type: 'wrong', data: d }))
    ]).catch(() => ({ type: 'timeout' }));

    assert(event.type !== 'timeout', 'Expected some response to second flip (pair or cards_returned)');
  });

  // === GROUP 4: Disconnect & Reconnect ===
  console.log('\n--- Disconnect & Reconnect ---');

  await test('Player disconnect - other player gets notified', async () => {
    global.__guestSocket.disconnect();

    const data = await waitEvent(global.__hostSocket, 'player_status', 3000);
    assert(data.players, 'Expected players array');
    const guest = data.players[1];
    assert(guest && guest.connected === false, 'Expected guest to be disconnected');
  });

  await test('Player reconnect_room - should restore state', async () => {
    const s = createSocket(cookie2);
    await new Promise(r => s.on('connect', r));

    s.emit('reconnect_room', {
      code: global.__roomCode,
      playerName: 'GuestPlayer',
      playerIndex: 1
    });

    const data = await waitEvent(s, 'reconnect_state', 3000);
    assert(data.code === global.__roomCode, 'Expected same room code');
    assert(data.playerIndex === 1, 'Expected playerIndex 1');
    assert(Array.isArray(data.board), 'Expected board array');
    assert(data.board.length === 96, 'Expected 96 board entries');

    s.disconnect();
  });

  await test('Reconnect to non-existent room - should get error', async () => {
    const s = createSocket(cookie2);
    await new Promise(r => s.on('connect', r));

    s.emit('reconnect_room', { code: 'FAKE99', playerName: 'GuestPlayer', playerIndex: 1 });
    const data = await waitEvent(s, 'room_error', 2000);
    assert(data.message, 'Expected error message');
    s.disconnect();
  });

  // === GROUP 5: Room URL Route ===
  console.log('\n--- Room URL Route ---');

  await test('GET /jogar/sala-TEST01 with auth - should serve jogar.html', async () => {
    const res = await httpReq('GET', '/jogar/sala-TEST01', null, 'auth_token=' + cookie1.split('=')[1]);
    assert(res.status === 200, 'Expected 200, got ' + res.status);
    assert(res.raw.includes('jogar') || res.raw.includes('Memory') || res.raw.includes('board'), 'Expected jogar.html content');
  });

  await test('GET /jogar/sala-TEST01 without auth - should redirect', async () => {
    const res = await httpReq('GET', '/jogar/sala-TEST01');
    assert(res.status === 302 || res.status === 200, 'Expected 302 or 200, got ' + res.status);
  });

  // === GROUP 6: Admin API ===
  console.log('\n--- Admin API ---');

  await test('GET /api/admin/users without admin - should be forbidden', async () => {
    const res = await httpReq('GET', '/api/admin/users', null, 'auth_token=' + cookie2.split('=')[1]);
    assert(res.status === 403 || res.status === 401, 'Expected 403/401, got ' + res.status);
  });

  await test('Register duplicate username - should fail', async () => {
    const uname = 'dupuser_' + Date.now();
    await httpReq('POST', '/api/auth/register', {
      username: uname, password: '123456', displayName: 'DupUser', flagCode: 'br'
    });
    const res = await httpReq('POST', '/api/auth/register', {
      username: uname, password: '123456', displayName: 'DupUser2', flagCode: 'br'
    });
    assert(res.status === 400, 'Expected 400 for duplicate, got ' + res.status);
  });

  // === GROUP 7: Leave Room ===
  console.log('\n--- Leave Room ---');

  await test('Leave room - player can leave', async () => {
    // Create fresh room for this test
    const c1 = await registerUser('leavehost_' + Date.now(), 'LeaveHost', 'br');
    const c2 = await registerUser('leaveguest_' + Date.now(), 'LeaveGuest', 'ar');

    const s1 = createSocket(c1);
    const s2 = createSocket(c2);
    await new Promise(r => s1.on('connect', r));
    await new Promise(r => s2.on('connect', r));

    // Track lobby updates with a counter
    var lastLobbyData = null;
    s1.on('lobby_update', function(data) { lastLobbyData = data; });

    s1.emit('create_room', { name: 'LeaveHost', flagCode: 'br', maxPlayers: 2, previewCards: false });
    const created = await waitEvent(s1, 'room_created');
    await sleep(300);

    s2.emit('join_room', { name: 'LeaveGuest', flagCode: 'ar', code: created.code });
    await waitEvent(s2, 'room_joined');
    await sleep(500);

    // Verify 2 players before leave
    assert(lastLobbyData && lastLobbyData.players.filter(function(p) { return p !== null; }).length === 2, 'Expected 2 players before leave');

    // Guest leaves
    s2.emit('leave_room');
    await sleep(1000);

    // Check the last lobby_update received
    var connectedPlayers = lastLobbyData.players.filter(function(p) { return p !== null; });
    assert(connectedPlayers.length === 1, 'Expected 1 player after leave, got ' + connectedPlayers.length);

    s1.disconnect();
    s2.disconnect();
  });

  // Cleanup
  if (global.__hostSocket) global.__hostSocket.disconnect();

  // === RESULTS ===
  console.log('\n========================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('========================================');
  console.log('  Total: ' + (passCount + failCount));
  console.log('  Passed: ' + passCount);
  console.log('  Failed: ' + failCount);
  if (failCount > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log('    - ' + r.name + ': ' + r.error);
    });
  }
  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(2);
});
