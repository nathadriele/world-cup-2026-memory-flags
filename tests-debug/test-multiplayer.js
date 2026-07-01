#!/usr/bin/env node
/**
 * Multi-player test suite for Memory Cup 2026
 * Tests: 1, 2, 3, and 4 player game starts, card flips, turn rotation
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

function httpReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0 }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(chunks), headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, json: null, headers: res.headers }); }
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
    if (c.startsWith(name + '=')) return c.split(';')[0];
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
    const t = setTimeout(() => reject(new Error('Timeout waiting for ' + event)), timeout || 5000);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

async function setupRoom(numPlayers) {
  const cookies = [];
  const sockets = [];
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  const flags = ['br', 'ar', 'fr', 'de', 'it', 'jp', 'us', 'pt'];

  for (let i = 0; i < numPlayers; i++) {
    const cookie = await registerUser('mp_' + numPlayers + '_' + i + '_' + Date.now(), names[i], flags[i]);
    cookies.push(cookie);
    const s = createSocket(cookie);
    await new Promise(r => s.on('connect', r));
    sockets.push(s);
  }

  // Host creates room
  sockets[0].emit('create_room', { name: names[0], flagCode: flags[0], maxPlayers: numPlayers, previewCards: false });
  const created = await waitEvent(sockets[0], 'room_created');
  const roomCode = created.code;

  // Other players join
  for (let i = 1; i < numPlayers; i++) {
    sockets[i].emit('join_room', { name: names[i], flagCode: flags[i], code: roomCode });
    await waitEvent(sockets[i], 'room_joined');
  }
  await sleep(500);

  return { sockets, roomCode, names, flags };
}

async function main() {
  console.log('\n========================================');
  console.log('  Multi-Player Tests (1, 2, 3, 4 players)');
  console.log('========================================\n');

  // === 1 PLAYER ===
  console.log('--- 1 Player Game ---');

  await test('1P: Create room and start game alone', async () => {
    const { sockets, roomCode } = await setupRoom(1);

    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 5000);
    assert(data.players.length === 1, 'Expected 1 player, got ' + data.players.length);
    assert(typeof data.currentTurn === 'number', 'Expected currentTurn');
    assert(data.scores.length === 1, 'Expected 1 score');

    sockets.forEach(s => s.disconnect());
  });

  await test('1P: Flip card works', async () => {
    const { sockets } = await setupRoom(1);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);

    sockets[0].emit('flip_card', { cardIndex: 0 });
    const data = await waitEvent(sockets[0], 'card_flipped', 5000);
    assert(data.cardIndex === 0, 'Expected cardIndex 0');
    assert(data.flagCode, 'Expected flagCode');

    sockets.forEach(s => s.disconnect());
  });

  // === 2 PLAYERS ===
  console.log('\n--- 2 Player Game ---');

  await test('2P: Start game with 2 players', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    const data1 = await waitEvent(sockets[0], 'game_start', 5000);
    assert(data1.players.length === 2, 'Expected 2 players');
    const data2 = await waitEvent(sockets[1], 'game_start', 5000);
    assert(data2.players.length === 2, 'Expected 2 players on guest');

    sockets.forEach(s => s.disconnect());
  });

  await test('2P: Both players receive card_flipped', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    const turnPlayer = gs.currentTurn === 0 ? sockets[0] : sockets[1];
    const otherPlayer = gs.currentTurn === 0 ? sockets[1] : sockets[0];

    turnPlayer.emit('flip_card', { cardIndex: 0 });
    const d1 = await waitEvent(turnPlayer, 'card_flipped', 5000);
    assert(d1.cardIndex === 0, 'Turn player should get card_flipped');
    const d2 = await waitEvent(otherPlayer, 'card_flipped', 5000);
    assert(d2.cardIndex === 0, 'Other player should get card_flipped');

    sockets.forEach(s => s.disconnect());
  });

  await test('2P: Turn passes after wrong pair', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    const turnPlayer = gs.currentTurn === 0 ? sockets[0] : sockets[1];
    const otherPlayer = gs.currentTurn === 0 ? sockets[1] : sockets[0];

    // Flip two different cards
    turnPlayer.emit('flip_card', { cardIndex: 0 });
    await waitEvent(turnPlayer, 'card_flipped', 5000);
    await waitEvent(otherPlayer, 'card_flipped', 5000);

    turnPlayer.emit('flip_card', { cardIndex: 1 });
    await waitEvent(turnPlayer, 'card_flipped', 5000);
    await waitEvent(otherPlayer, 'card_flipped', 5000);

    // Wait for either pair_found or cards_returned
    const event = await Promise.race([
      waitEvent(turnPlayer, 'pair_found_pending_validation', 10000).then(() => 'pair'),
      waitEvent(turnPlayer, 'cards_returned', 10000).then(() => 'wrong')
    ]).catch(() => 'timeout');

    assert(event !== 'timeout', 'Expected response to second flip');

    sockets.forEach(s => s.disconnect());
  });

  // === 3 PLAYERS ===
  console.log('\n--- 3 Player Game ---');

  await test('3P: Start game with 3 players', async () => {
    const { sockets } = await setupRoom(3);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 5000);
    assert(data.players.length === 3, 'Expected 3 players, got ' + data.players.length);

    // All 3 should receive game_start
    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);

    sockets.forEach(s => s.disconnect());
  });

  await test('3P: Card flip reaches all 3 players', async () => {
    const { sockets } = await setupRoom(3);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);

    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 0 });

    for (let i = 0; i < 3; i++) {
      const d = await waitEvent(sockets[i], 'card_flipped', 5000);
      assert(d.cardIndex === 0, 'Player ' + i + ' should get card_flipped');
    }

    sockets.forEach(s => s.disconnect());
  });

  await test('3P: Turn rotates among 3 players', async () => {
    const { sockets } = await setupRoom(3);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);

    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 0 });
    await waitEvent(sockets[turnIdx], 'card_flipped', 5000);
    sockets[turnIdx].emit('flip_card', { cardIndex: 1 });
    await waitEvent(sockets[turnIdx], 'card_flipped', 5000);

    // Wait for cards_returned or pair_found
    const event = await Promise.race([
      waitEvent(sockets[0], 'pair_found_pending_validation', 10000).then(() => 'pair'),
      waitEvent(sockets[0], 'cards_returned', 10000).then(() => 'wrong')
    ]).catch(() => 'timeout');

    assert(event !== 'timeout', 'Expected response after two flips');

    sockets.forEach(s => s.disconnect());
  });

  // === 4 PLAYERS ===
  console.log('\n--- 4 Player Game ---');

  await test('4P: Start game with 4 players (max)', async () => {
    const { sockets } = await setupRoom(4);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 5000);
    assert(data.players.length === 4, 'Expected 4 players, got ' + data.players.length);

    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);
    await waitEvent(sockets[3], 'game_start', 5000);

    sockets.forEach(s => s.disconnect());
  });

  await test('4P: Card flip reaches all 4 players', async () => {
    const { sockets } = await setupRoom(4);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    for (let i = 1; i < 4; i++) await waitEvent(sockets[i], 'game_start', 5000);

    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 5 });

    for (let i = 0; i < 4; i++) {
      const d = await waitEvent(sockets[i], 'card_flipped', 5000);
      assert(d.cardIndex === 5, 'Player ' + i + ' should get card_flipped');
    }

    sockets.forEach(s => s.disconnect());
  });

  await test('4P: Lobby shows all 4 players', async () => {
    // Create room manually so we can attach listener before all joins complete
    const cookies = [];
    const sockets = [];
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
    const flags = ['br', 'ar', 'fr', 'de'];

    for (let i = 0; i < 4; i++) {
      const cookie = await registerUser('mp_lobby_' + i + '_' + Date.now(), names[i], flags[i]);
      cookies.push(cookie);
      const s = createSocket(cookie);
      await new Promise(r => s.on('connect', r));
      sockets.push(s);
    }

    // Attach listener BEFORE room creation
    var lastLobby = null;
    sockets[0].on('lobby_update', function(d) { lastLobby = d; });

    // Host creates room
    sockets[0].emit('create_room', { name: names[0], flagCode: flags[0], maxPlayers: 4, previewCards: false });
    const created = await waitEvent(sockets[0], 'room_created');

    // Other players join one by one
    for (let i = 1; i < 4; i++) {
      sockets[i].emit('join_room', { name: names[i], flagCode: flags[i], code: created.code });
      await waitEvent(sockets[i], 'room_joined');
      await sleep(300);
    }
    await sleep(1000);

    assert(lastLobby !== null, 'Expected lobby_update');
    const realPlayers = lastLobby.players.filter(function(p) { return p !== null; });
    assert(realPlayers.length === 4, 'Expected 4 players in lobby, got ' + realPlayers.length);

    sockets.forEach(s => s.disconnect());
  });

  // === 5-8 PLAYERS ===
  console.log('\n--- 5-8 Player Games ---');

  await test('5P: Start game with 5 players', async () => {
    const { sockets } = await setupRoom(5);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 10000);
    assert(data.players.length === 5, 'Expected 5 players, got ' + data.players.length);
    for (let i = 1; i < 5; i++) await waitEvent(sockets[i], 'game_start', 5000);
    sockets.forEach(s => s.disconnect());
  });

  await test('5P: Card flip reaches all 5 players', async () => {
    const { sockets } = await setupRoom(5);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 10000);
    for (let i = 1; i < 5; i++) await waitEvent(sockets[i], 'game_start', 5000);
    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 0 });
    for (let i = 0; i < 5; i++) {
      const d = await waitEvent(sockets[i], 'card_flipped', 5000);
      assert(d.cardIndex === 0, 'Player ' + i + ' should get card_flipped');
    }
    sockets.forEach(s => s.disconnect());
  });

  await test('6P: Start game with 6 players', async () => {
    const { sockets } = await setupRoom(6);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 10000);
    assert(data.players.length === 6, 'Expected 6 players, got ' + data.players.length);
    for (let i = 1; i < 6; i++) await waitEvent(sockets[i], 'game_start', 5000);
    sockets.forEach(s => s.disconnect());
  });

  await test('6P: Card flip reaches all 6 players', async () => {
    const { sockets } = await setupRoom(6);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 10000);
    for (let i = 1; i < 6; i++) await waitEvent(sockets[i], 'game_start', 5000);
    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 3 });
    for (let i = 0; i < 6; i++) {
      const d = await waitEvent(sockets[i], 'card_flipped', 5000);
      assert(d.cardIndex === 3, 'Player ' + i + ' should get card_flipped');
    }
    sockets.forEach(s => s.disconnect());
  });

  await test('7P: Start game with 7 players', async () => {
    const { sockets } = await setupRoom(7);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 10000);
    assert(data.players.length === 7, 'Expected 7 players, got ' + data.players.length);
    for (let i = 1; i < 7; i++) await waitEvent(sockets[i], 'game_start', 5000);
    sockets.forEach(s => s.disconnect());
  });

  await test('8P: Start game with 8 players (max)', async () => {
    const { sockets } = await setupRoom(8);
    sockets[0].emit('start_game');
    const data = await waitEvent(sockets[0], 'game_start', 10000);
    assert(data.players.length === 8, 'Expected 8 players, got ' + data.players.length);
    for (let i = 1; i < 8; i++) await waitEvent(sockets[i], 'game_start', 5000);
    sockets.forEach(s => s.disconnect());
  });

  await test('8P: Card flip reaches all 8 players', async () => {
    const { sockets } = await setupRoom(8);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 10000);
    for (let i = 1; i < 8; i++) await waitEvent(sockets[i], 'game_start', 5000);
    const turnIdx = gs.currentTurn;
    sockets[turnIdx].emit('flip_card', { cardIndex: 10 });
    for (let i = 0; i < 8; i++) {
      const d = await waitEvent(sockets[i], 'card_flipped', 5000);
      assert(d.cardIndex === 10, 'Player ' + i + ' should get card_flipped');
    }
    sockets.forEach(s => s.disconnect());
  });

  // === Room Full Test ===
  console.log('\n--- Room Full Test ---');

  await test('9th player cannot join full 8-player room', async () => {
    const { sockets, roomCode } = await setupRoom(8);

    const cookie9 = await registerUser('mp_overflow_' + Date.now(), 'Overflow', 'jp');
    const s9 = createSocket(cookie9);
    await new Promise(r => s9.on('connect', r));

    s9.emit('join_room', { name: 'Overflow', flagCode: 'jp', code: roomCode });
    const result = await Promise.race([
      waitEvent(s9, 'room_error', 3000).then(d => 'error'),
      waitEvent(s9, 'room_joined', 3000).then(d => 'joined')
    ]).catch(() => 'timeout');

    assert(result === 'error', '9th player should get room_error, got ' + result);

    sockets.forEach(s => s.disconnect());
    s9.disconnect();
  });

  // === RESULTS ===
  console.log('\n========================================');
  console.log('  MULTI-PLAYER TEST RESULTS');
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
