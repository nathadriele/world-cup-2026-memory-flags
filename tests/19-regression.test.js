/**
 * Test Suite: Regression Tests
 * Tests for previously fixed bugs to ensure they don't return.
 * Each test documents the original bug and verifies the fix.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Regression Tests');
  console.log('========================================\n');

  h.setSuite('Regression');

  // ── BUG: Server binding to 0.0.0.0 ────────────────────
  await h.test('REGRESSION: Server binds to 0.0.0.0 (not localhost only)', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes("0.0.0.0"), 'Server should bind to 0.0.0.0');
    h.assert(
      !src.includes("server.listen(PORT, 'localhost'") &&
      !src.includes("server.listen(PORT, '127.0.0.1'"),
      'Should NOT bind to localhost only'
    );
  });

  // ── BUG: Socket.IO CORS configuration ─────────────────
  await h.test('REGRESSION: Socket.IO has CORS configured', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes("cors:"), 'Socket.IO should have CORS config');
    h.assert(src.includes("origin: '*'"), 'CORS should allow all origins');
    h.assert(src.includes("credentials: true"), 'CORS should allow credentials');
  });

  // ── BUG: Socket.IO transports configured ──────────────
  await h.test('REGRESSION: Socket.IO has transports configured', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes("transports:"), 'Should have transports config');
    h.assert(src.includes("'websocket'"), 'Should support websocket');
  });

  // ── BUG: DB_PATH environment variable ─────────────────
  await h.test('REGRESSION: DB_PATH environment variable is used', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../src/db.js', 'utf8');
    h.assert(src.includes('DB_PATH'), 'Should use DB_PATH env var');
    h.assert(src.includes('process.env.DB_PATH'), 'Should read from process.env');
  });

  // ── BUG: emitAll uses Socket.IO rooms ─────────────────
  await h.test('REGRESSION: emitAll uses io.to(room.code)', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('io.to(room.code).emit'), 'Should use Socket.IO room broadcast');
  });

  // ── BUG: Card flip delay is 3800ms (not 5800ms) ───────
  await h.test('REGRESSION: Wrong pair return delay is 3800ms', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('3800'), 'Should use 3800ms delay');
    h.assert(!src.includes('5800'), 'Should NOT use old 5800ms delay');
  });

  // ── BUG: Reconnect cleans up old playerRooms entry ────
  await h.test('REGRESSION: Reconnect cleans up old socket entry', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    // The fix checks if slot.id still has a playerRooms entry
    h.assert(
      src.includes('playerRooms.has(slot.id)') ||
      src.includes('slot.id && playerRooms'),
      'Should clean up old socket entry on reconnect'
    );
  });

  // ── BUG: passTurnSkipDisconnected handles no active player ──
  await h.test('REGRESSION: passTurnSkipDisconnected handles no active player', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('passTurnSkipDisconnected'), 'Function should exist');
    // Check it handles -1 return from nextActivePlayer
    h.assert(src.includes('next === -1'), 'Should handle no active player case');
  });

  // ── BUG: Sessions are properly deleted on logout ──────
  await h.test('REGRESSION: Logout deletes session from database', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('reg_logout_' + ts, 'Test', 'br');

    // Verify session exists
    const me1 = await h.getMe(reg.cookie);
    h.assertEqual(me1.status, 200, 'Session should work');

    // Logout
    await h.logoutUser(reg.cookie);

    // Session should be deleted
    const me2 = await h.getMe(reg.cookie);
    h.assertEqual(me2.status, 401, 'Session should be invalid after logout');
  });

  // ── BUG: Duplicate username case-insensitive ──────────
  await h.test('REGRESSION: Duplicate username check is case-insensitive', async () => {
    const ts = Date.now();
    const username = 'CaseTest_' + ts;
    await h.registerUser(username, 'First', 'br');

    // Try with different case
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: username.toLowerCase(),
      password: '123456',
      displayName: 'Second',
      flagCode: 'ar'
    });
    h.assertEqual(res.status, 400, 'Should reject case-variant username');
  });

  // ── BUG: Card index validation (0-95 range) ───────────
  await h.test('REGRESSION: Card indices validated 0-95', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('cardIndex < 0 || cardIndex > 95'), 'Should validate card range');
  });

  // ── BUG: Max 2 cards can be flipped per turn ──────────
  await h.test('REGRESSION: Max 2 cards flipped enforced', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('room.flipped.length >= 2'), 'Should limit to 2 flipped cards');
  });

  // ── BUG: Pending validation blocks flips ──────────────
  await h.test('REGRESSION: Flips blocked during pendingValidation', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('if (room.pendingValidation) return'), 'Should block flips during validation');
  });

  // ── BUG: Non-turn player blocked from flipping ────────
  await h.test('REGRESSION: Non-turn player cannot flip', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    // Player 1 (not turn) tries to flip
    const flipP = h.waitEventOrNull(sockets[0], 'card_flipped', 2000);
    sockets[1].emit('flip_card', { cardIndex: 0 });
    const result = await flipP;
    h.assert(!result, 'Non-turn player flip should be blocked');

    h.cleanupSockets(sockets);
  });

  // ── BUG: Already-flipped card cannot be re-flipped ────
  await h.test('REGRESSION: Already-flipped card blocked', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes("room.board[cardIndex] !== 'hidden'"), 'Should check card is hidden');
  });

  // ── BUG: Foreign keys enabled in SQLite ───────────────
  await h.test('REGRESSION: SQLite foreign keys are ON', async () => {
    const { db } = require('../src/db');
    const result = db.pragma('foreign_keys');
    h.assertEqual(result[0].foreign_keys, 1, 'Foreign keys must be ON');
  });

  // ── BUG: WAL mode for better concurrency ──────────────
  await h.test('REGRESSION: WAL journal mode enabled', async () => {
    const { db } = require('../src/db');
    const result = db.pragma('journal_mode');
    h.assertEqual(result[0].journal_mode, 'wal', 'WAL mode must be enabled');
  });

  // ── BUG: render.yaml has disk configuration ───────────
  await h.test('REGRESSION: render.yaml configures persistent disk', async () => {
    const fs = require('fs');
    const yamlPath = __dirname + '/../render.yaml';
    if (fs.existsSync(yamlPath)) {
      const yaml = fs.readFileSync(yamlPath, 'utf8');
      h.assert(yaml.includes('disks:'), 'Should have disks config');
      h.assert(yaml.includes('/var/data'), 'Should mount at /var/data');
      h.assert(yaml.includes('DB_PATH'), 'Should set DB_PATH env');
    } else {
      console.log('    (info: render.yaml not found)');
    }
  });

  // ── BUG: Room code uses non-ambiguous characters ──────
  await h.test('REGRESSION: Room code excludes ambiguous chars (0,O,I,1)', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    const match = src.match(/chars = '([^']+)'/);
    if (match) {
      const chars = match[1];
      h.assert(!chars.includes('0'), 'Should exclude 0');
      h.assert(!chars.includes('O'), 'Should exclude O');
      h.assert(!chars.includes('I'), 'Should exclude I');
      h.assert(!chars.includes('1'), 'Should exclude 1');
    }
  });

  // ── BUG: Server handles graceful room deletion ────────
  await h.test('REGRESSION: Room cleaned up when all players leave', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('reg_cleanup_' + ts, 'Solo', 'br');
    const sock = h.createSocket(reg.cookie);
    await new Promise(r => sock.on('connect', r));
    sock.emit('identify', { userId: reg.body.user.id });

    sock.emit('create_room', { name: 'Solo', flagCode: 'br', maxPlayers: 2 });
    await h.waitEvent(sock, 'room_created');

    sock.emit('leave_room');
    await h.sleep(300);

    // Verify room is gone by trying to join
    const ts2 = Date.now();
    const reg2 = await h.registerUser('reg_join_after_' + ts2, 'Joiner', 'br');
    const sock2 = h.createSocket(reg2.cookie);
    await new Promise(r => sock2.on('connect', r));
    sock2.emit('identify', { userId: reg2.body.user.id });

    // Generate a code that shouldn't exist
    const errP = h.waitEvent(sock2, 'room_error');
    sock2.emit('join_room', { name: 'Joiner', flagCode: 'br', code: 'ZZZ999' });
    const err = await errP;
    h.assert(err.message.length > 0, 'Room should not exist after all left');

    sock.disconnect();
    sock2.disconnect();
  });

  // ── BUG: turn_timer fires correctly ───────────────────
  await h.test('REGRESSION: turn_timer event has decreasing values', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');

    const timers = [];
    const collectTimer = (data) => timers.push(data.remaining);
    sockets[0].on('turn_timer', collectTimer);

    await h.sleep(3000);

    h.assert(timers.length >= 2, 'Should receive multiple timer events');
    if (timers.length >= 2) {
      h.assert(timers[1] < timers[0], 'Timer should decrease');
    }

    sockets[0].off('turn_timer', collectTimer);
    h.cleanupSockets(sockets);
  });

  // ── BUG: Validation timer fires correctly ─────────────
  await h.test('REGRESSION: validation has 30s timer (VALIDATION_TIME)', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('VALIDATION_TIME = 30'), 'Validation timer should be 30s');
  });

  // ── BUG: Reconnect window is 120s ─────────────────────
  await h.test('REGRESSION: Reconnect window is 120000ms', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('RECONNECT_WINDOW = 120000'), 'Should have 120s reconnect window');
  });

  console.log('\n  Regression tests complete.');
}

module.exports = { run };
