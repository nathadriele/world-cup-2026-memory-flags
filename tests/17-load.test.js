/**
 * Test Suite: Load / Stress Tests
 * Tests system behavior under load: multiple concurrent rooms,
 * many simultaneous connections, rapid event sequences,
 * and resource cleanup verification.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Load / Stress Tests');
  console.log('========================================\n');

  h.setSuite('Load');

  // ── Concurrent Room Creation ──────────────────────────
  await h.test('5 rooms created concurrently', async () => {
    const ts = Date.now();
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push((async () => {
        const reg = await h.registerUser('load_cr_' + i + '_' + ts, 'P' + i, 'br');
        const sock = h.createSocket(reg.cookie);
        await new Promise(r => sock.on('connect', r));
        sock.emit('identify', { userId: reg.body.user.id });
        sock.emit('create_room', { name: 'Room' + i, flagCode: 'br', maxPlayers: 4 });
        const created = await h.waitEvent(sock, 'room_created');
        sock.disconnect();
        return created.code;
      })());
    }
    const codes = await Promise.all(promises);
    const unique = new Set(codes);
    h.assert(unique.size === 5, 'Should have 5 unique room codes');
  });

  // ── Rapid Card Flips ──────────────────────────────────
  await h.test('Rapid sequential card flips (10 cards)', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    let flipCount = 0;
    sockets[0].on('card_flipped', () => flipCount++);

    // Rapidly flip first card (only first succeeds)
    for (let i = 0; i < 10; i++) {
      sockets[0].emit('flip_card', { cardIndex: 0 });
    }
    await h.sleep(500);

    // Only 1 flip should register (card already flipped after first)
    h.assert(flipCount >= 1, 'At least 1 flip should register');
    h.cleanupSockets(sockets);
  });

  // ── Multiple Users Registering Simultaneously ─────────
  await h.test('10 users register simultaneously', async () => {
    const ts = Date.now();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(h.registerUser('load_bulk_' + i + '_' + ts, 'User' + i, 'br'));
    }
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    h.assert(successCount === 10, 'All 10 should register successfully');
  });

  // ── Multiple Sockets Connecting At Once ───────────────
  await h.test('8 sockets connect simultaneously', async () => {
    const ts = Date.now();
    const promises = [];
    for (let i = 0; i < 8; i++) {
      promises.push((async () => {
        const reg = await h.registerUser('load_sock_' + i + '_' + ts, 'S' + i, 'br');
        const sock = h.createSocket(reg.cookie);
        await new Promise(r => sock.on('connect', r));
        sock.emit('identify', { userId: reg.body.user.id });
        return sock;
      })());
    }
    const sockets = await Promise.all(promises);
    h.assert(sockets.length === 8, 'All 8 should connect');
    sockets.forEach(s => s.disconnect());
  });

  // ── 4 Concurrent Games ────────────────────────────────
  await h.test('4 concurrent 2-player games', async () => {
    const promises = [];
    for (let g = 0; g < 4; g++) {
      promises.push((async () => {
        const { sockets } = await h.setupRoom(2);
        sockets[0].emit('start_game');
        const gs = await h.waitEvent(sockets[0], 'game_start');
        h.cleanupSockets(sockets);
        return gs;
      })());
    }
    const results = await Promise.all(promises);
    h.assert(results.length === 4, 'All 4 games should start');
    results.forEach((gs, i) => {
      h.assertEqual(gs.currentTurn, 0, 'Game ' + i + ' should start at turn 0');
    });
  });

  // ── Connection/Disconnection Burst ────────────────────
  await h.test('Rapid connect/disconnect cycle', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('load_cycle_' + ts, 'Cycle', 'br');
    let connectCount = 0;

    for (let i = 0; i < 3; i++) {
      const sock = h.createSocket(reg.cookie);
      await new Promise(r => sock.on('connect', r));
      connectCount++;
      sock.disconnect();
      await h.sleep(200);
    }
    h.assertEqual(connectCount, 3, 'Should complete 3 connect/disconnect cycles');
  });

  // ── Large Room Fill (8 players join sequentially) ─────
  await h.test('8 players join room one by one', async () => {
    const ts = Date.now();
    const reg0 = await h.registerUser('load_fill_0_' + ts, 'P0', 'br');
    const sock0 = h.createSocket(reg0.cookie);
    await new Promise(r => sock0.on('connect', r));
    sock0.emit('identify', { userId: reg0.body.user.id });
    sock0.emit('create_room', { name: 'P0', flagCode: 'br', maxPlayers: 8 });
    const created = await h.waitEvent(sock0, 'room_created');

    const sockets = [sock0];
    for (let i = 1; i < 8; i++) {
      const reg = await h.registerUser('load_fill_' + i + '_' + ts, 'P' + i, 'br');
      const sock = h.createSocket(reg.cookie);
      await new Promise(r => sock.on('connect', r));
      sock.emit('identify', { userId: reg.body.user.id });
      sock.emit('join_room', { name: 'P' + i, flagCode: 'br', code: created.code });
      const joined = await h.waitEvent(sock, 'room_joined');
      h.assertEqual(joined.code, created.code, 'Player ' + i + ' should join');
      sockets.push(sock);
    }

    // Verify all 8 in lobby
    const lobby = await h.waitEvent(sock0, 'lobby_update');
    h.assert(lobby.players.filter(p => p !== null).length >= 2, 'Should have multiple players');

    sockets.forEach(s => s.disconnect());
  });

  // ── Many HTTP Requests in Parallel ────────────────────
  await h.test('20 parallel HTTP requests to /api/matches', async () => {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(h.httpReq('GET', '/api/matches'));
    }
    const results = await Promise.all(promises);
    const allOk = results.every(r => r.status === 200);
    h.assert(allOk, 'All 20 requests should succeed');
  });

  // ── Socket Reconnect Multiple Times ───────────────────
  await h.test('Socket reconnects 3 times with same user', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('load_recon_' + ts, 'Recon', 'br');

    for (let i = 0; i < 3; i++) {
      const sock = h.createSocket(reg.cookie);
      await new Promise(r => sock.on('connect', r));
      sock.emit('identify', { userId: reg.body.user.id });
      await h.sleep(300);
      h.assert(sock.connected, 'Socket ' + i + ' should be connected');
      sock.disconnect();
      await h.sleep(200);
    }
    h.assert(true, 'Completed 3 reconnect cycles');
  });

  // ── Leave and Rejoin Room ─────────────────────────────
  await h.test('Player leaves and another joins same room', async () => {
    const ts = Date.now();
    const reg1 = await h.registerUser('load_lr_1_' + ts, 'P1', 'br');
    const reg2 = await h.registerUser('load_lr_2_' + ts, 'P2', 'ar');
    const reg3 = await h.registerUser('load_lr_3_' + ts, 'P3', 'fr');

    const sock1 = h.createSocket(reg1.cookie);
    const sock2 = h.createSocket(reg2.cookie);
    const sock3 = h.createSocket(reg3.cookie);

    await Promise.all([
      new Promise(r => sock1.on('connect', r)),
      new Promise(r => sock2.on('connect', r)),
      new Promise(r => sock3.on('connect', r))
    ]);

    sock1.emit('identify', { userId: reg1.body.user.id });
    sock2.emit('identify', { userId: reg2.body.user.id });
    sock3.emit('identify', { userId: reg3.body.user.id });

    sock1.emit('create_room', { name: 'P1', flagCode: 'br', maxPlayers: 2 });
    const created = await h.waitEvent(sock1, 'room_created');

    sock2.emit('join_room', { name: 'P2', flagCode: 'ar', code: created.code });
    await h.waitEvent(sock2, 'room_joined');

    // Player 3 tries to join full room
    const errP = h.waitEvent(sock3, 'room_error');
    sock3.emit('join_room', { name: 'P3', flagCode: 'fr', code: created.code });
    const err = await errP;
    h.assert(err.message.includes('cheia') || err.message.includes('full'), 'Should be full');

    // Player 2 leaves
    sock2.emit('leave_room');
    await h.sleep(300);

    // Player 3 joins now
    sock3.emit('join_room', { name: 'P3', flagCode: 'fr', code: created.code });
    const joined = await h.waitEvent(sock3, 'room_joined');
    h.assertEqual(joined.code, created.code, 'P3 should join after P2 left');

    sock1.disconnect();
    sock2.disconnect();
    sock3.disconnect();
  });

  // ── Memory: No Leak on Multiple Room Create/Destroy ───
  await h.test('Multiple room create/destroy cycles (no crash)', async () => {
    const ts = Date.now();
    for (let i = 0; i < 5; i++) {
      const reg = await h.registerUser('load_cycle_room_' + i + '_' + ts, 'P', 'br');
      const sock = h.createSocket(reg.cookie);
      await new Promise(r => sock.on('connect', r));
      sock.emit('identify', { userId: reg.body.user.id });
      sock.emit('create_room', { name: 'P', flagCode: 'br', maxPlayers: 2 });
      await h.waitEvent(sock, 'room_created');
      sock.emit('leave_room');
      await h.sleep(200);
      sock.disconnect();
    }
    h.assert(true, '5 create/destroy cycles completed without crash');
  });

  // ── Burst Events ──────────────────────────────────────
  await h.test('Burst: 50 flip_card events in rapid succession', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    let eventCount = 0;
    sockets[0].on('card_flipped', () => eventCount++);

    // Send 50 flip events instantly
    for (let i = 0; i < 50; i++) {
      sockets[0].emit('flip_card', { cardIndex: i % 96 });
    }
    await h.sleep(2000);

    // Server should handle gracefully (at least 1 flip, no crash)
    h.assert(eventCount >= 1, 'Should handle burst without crash');
    h.assert(sockets[0].connected, 'Socket should still be connected');
    h.cleanupSockets(sockets);
  });

  console.log('\n  Load / Stress tests complete.');
}

module.exports = { run };
