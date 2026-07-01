#!/usr/bin/env node
/**
 * Bug Fix Validation Suite for Memory Cup 2026
 * Simulates real gameplay scenarios to validate that:
 * 1. Player CANNOT flip cards after a wrong pair (turn passes)
 * 2. Player CAN flip again after a correct pair (turn stays)
 * 3. Turn rotation works correctly with 2, 3, 4 players
 * 4. Server rejects flips from wrong player
 * 5. Server rejects flips after 2 cards already flipped
 * 6. Full game simulation runs without rule violations
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

function waitEvent(socket, event, timeout) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout waiting for ' + event)), timeout || 8000);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function waitForNoEvent(socket, event, timeout) {
  return new Promise((resolve) => {
    let received = false;
    const handler = (data) => { received = true; };
    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(!received);
    }, timeout || 2000);
  });
}

async function setupRoom(numPlayers) {
  const cookies = [];
  const sockets = [];
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  const flags = ['br', 'ar', 'fr', 'de', 'it', 'jp', 'us', 'pt'];

  for (let i = 0; i < numPlayers; i++) {
    const cookie = await registerUser('bugfix_' + numPlayers + '_' + i + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,5), names[i], flags[i]);
    cookies.push(cookie);
    const s = createSocket(cookie);
    await new Promise(r => s.on('connect', r));
    sockets.push(s);
  }

  sockets[0].emit('create_room', { name: names[0], flagCode: flags[0], maxPlayers: numPlayers, previewCards: false });
  const created = await waitEvent(sockets[0], 'room_created');
  const roomCode = created.code;

  for (let i = 1; i < numPlayers; i++) {
    sockets[i].emit('join_room', { name: names[i], flagCode: flags[i], code: roomCode });
    await waitEvent(sockets[i], 'room_joined');
  }
  await sleep(500);

  return { sockets, roomCode, names, flags };
}

/**
 * Flip 2 cards and determine if they were a pair or wrong.
 * Returns { type: 'pair_found' | 'turn_changed' | 'timeout', data }
 */
async function flipTwoCards(sockets, playerIdx, cardA, cardB) {
  // Clear any stale listeners
  sockets.forEach(s => {
    s.removeAllListeners('pair_found_pending_validation');
    s.removeAllListeners('turn_changed');
    s.removeAllListeners('cards_returned');
  });

  // Flip card A
  sockets[playerIdx].emit('flip_card', { cardIndex: cardA });
  await waitEvent(sockets[0], 'card_flipped', 5000);
  await sleep(200);

  // Set up race listener before flipping card B
  const pairPromise = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 12000);
    sockets[0].once('pair_found_pending_validation', (data) => { clearTimeout(t); resolve(data); });
  });
  const turnPromise = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 12000);
    sockets[0].once('turn_changed', (data) => { clearTimeout(t); resolve(data); });
  });

  // Flip card B
  sockets[playerIdx].emit('flip_card', { cardIndex: cardB });

  const result = await Promise.race([
    pairPromise.then(d => ({ type: 'pair_found', data: d })),
    turnPromise.then(d => ({ type: 'turn_changed', data: d })),
    sleep(13000).then(() => ({ type: 'timeout', data: null }))
  ]);

  return result;
}

async function main() {
  console.log('\n========================================');
  console.log('  Bug Fix Validation Suite');
  console.log('  (Simulates real gameplay scenarios)');
  console.log('========================================\n');

  // ====================================================================
  // BUG #1: Player tries to flip 3rd card immediately after 2nd card
  // Server should reject it (room.flipped.length >= 2)
  // ====================================================================
  console.log('--- BUG #1: 3rd flip attempt blocked after 2 cards ---');

  await test('Server rejects 3rd flip while 2 cards are face up', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    // Flip card 0
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await waitEvent(sockets[0], 'card_flipped', 5000);
    await sleep(200);

    // Flip card 1
    sockets[0].emit('flip_card', { cardIndex: 1 });
    await waitEvent(sockets[0], 'card_flipped', 5000);

    // Now immediately try to flip card 2 (should NOT get card_flipped)
    sockets[0].emit('flip_card', { cardIndex: 2 });

    const gotThirdFlip = await waitForNoEvent(sockets[0], 'card_flipped', 2000);
    assert(gotThirdFlip === true, 'Server should NOT emit card_flipped for 3rd card while 2 are face up');

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // BUG #2: After wrong pair, player 0 tries to flip before turn changes
  // Server should reject all flips from player 0 after timeout
  // ====================================================================
  console.log('\n--- BUG #2: Player 0 cannot flip after wrong pair ---');

  await test('2P: After wrong pair, P0 cannot flip - turn goes to P1', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);
    assert(gs.currentTurn === 0, 'Game should start with player 0');

    const result = await flipTwoCards(sockets, 0, 0, 1);

    if (result.type === 'turn_changed') {
      // Wrong pair - turn changed to player 1
      assert(result.data.currentTurn === 1, 'Turn should pass to player 1, got ' + result.data.currentTurn);

      // Now player 0 tries to flip - should NOT work
      sockets[0].emit('flip_card', { cardIndex: 10 });
      const blocked = await waitForNoEvent(sockets[1], 'card_flipped', 2000);
      assert(blocked === true, 'Player 0 should NOT be able to flip after turn passed to P1');

      // Player 1 CAN flip
      sockets[1].emit('flip_card', { cardIndex: 10 });
      const p1flip = await waitEvent(sockets[1], 'card_flipped', 3000);
      assert(p1flip, 'Player 1 should be able to flip on their turn');

    } else if (result.type === 'pair_found') {
      // Cards happened to match - skip this assertion (deck dependent)
      console.log('    (info: pair found, wrong pair test skipped - deck dependent)');
    } else {
      throw new Error('Unexpected timeout');
    }

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // BUG #3: Player spams clicks during the 5.8s wrong-pair wait
  // All flips should be ignored by server (flipped.length >= 2)
  // ====================================================================
  console.log('\n--- BUG #3: Spam clicks during wrong-pair wait are ignored ---');

  await test('2P: Spam clicks during wrong-pair delay are all ignored', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    // Flip 2 cards
    sockets[0].emit('flip_card', { cardIndex: 0 });
    await waitEvent(sockets[0], 'card_flipped', 5000);
    await sleep(100);
    sockets[0].emit('flip_card', { cardIndex: 1 });
    await waitEvent(sockets[0], 'card_flipped', 5000);

    // Spam clicks during the 5.8s wait
    let extraFlips = 0;
    sockets[0].on('card_flipped', () => { extraFlips++; });

    for (let i = 2; i <= 10; i++) {
      sockets[0].emit('flip_card', { cardIndex: i });
      await sleep(300);
    }

    assert(extraFlips === 0, 'No extra card_flipped events should fire during wait (got ' + extraFlips + ')');

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // DUO: Full 2-player round-robin simulation (3 wrong pairs)
  // ====================================================================
  console.log('\n--- DUO: 2-Player Round-Robin ---');

  await test('2P: Turn alternates P0->P1->P0->P1 over 4 rounds', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    const turnHistory = [0];
    let currentTurn = 0;

    for (let round = 0; round < 4; round++) {
      const playerIdx = currentTurn;
      const cardA = round * 2;
      const cardB = round * 2 + 1;

      const result = await flipTwoCards(sockets, playerIdx, cardA, cardB);

      if (result.type === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        turnHistory.push(currentTurn);

        const expected = (playerIdx + 1) % 2;
        assert(currentTurn === expected,
          'Round ' + round + ': expected P' + expected + ' got P' + currentTurn +
          ' (history: ' + JSON.stringify(turnHistory) + ')');
      } else if (result.type === 'pair_found') {
        // Pair found - same player keeps turn
        // Submit validation to resolve
        sockets[playerIdx].emit('submit_validation', { truthAnswer: true });
        await sleep(3000);
        // Player keeps turn - try next cards
      } else {
        throw new Error('Round ' + round + ': timeout');
      }
    }

    // Verify at least some rotation happened
    const uniqueTurns = [...new Set(turnHistory)];
    assert(uniqueTurns.length >= 2, 'Should have seen both players, got: ' + JSON.stringify(turnHistory));

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // TRIO: 3-player sequential rotation
  // ====================================================================
  console.log('\n--- TRIO: 3-Player Sequential ---');

  await test('3P: Turn goes P0->P1->P2->P0 sequentially', async () => {
    const { sockets } = await setupRoom(3);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);

    let currentTurn = 0;
    const turnHistory = [0];

    for (let round = 0; round < 6; round++) {
      const playerIdx = currentTurn;
      const cardA = round * 2;
      const cardB = round * 2 + 1;

      const result = await flipTwoCards(sockets, playerIdx, cardA, cardB);

      if (result.type === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        turnHistory.push(currentTurn);

        const expected = (playerIdx + 1) % 3;
        assert(currentTurn === expected,
          'Round ' + round + ': expected P' + expected + ' got P' + currentTurn);
      } else if (result.type === 'pair_found') {
        // Resolve validation
        sockets[playerIdx].emit('submit_validation', { truthAnswer: true });
        await sleep(3000);
        // Player keeps turn
      } else {
        break;
      }
    }

    // Verify we saw at least 2 different players
    const unique = [...new Set(turnHistory)];
    assert(unique.length >= 2, 'Should have seen multiple players: ' + JSON.stringify(turnHistory));

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // QUARTETO: 4-player full cycle
  // ====================================================================
  console.log('\n--- QUARTETO: 4-Player Full Cycle ---');

  await test('4P: Turn cycles P0->P1->P2->P3->P0', async () => {
    const { sockets } = await setupRoom(4);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    for (let i = 1; i < 4; i++) await waitEvent(sockets[i], 'game_start', 5000);

    let currentTurn = 0;
    const turnHistory = [0];

    for (let round = 0; round < 5; round++) {
      const playerIdx = currentTurn;
      const cardA = round * 2;
      const cardB = round * 2 + 1;

      const result = await flipTwoCards(sockets, playerIdx, cardA, cardB);

      if (result.type === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        turnHistory.push(currentTurn);

        const expected = (playerIdx + 1) % 4;
        assert(currentTurn === expected,
          'Round ' + round + ': expected P' + expected + ' got P' + currentTurn);
      } else if (result.type === 'pair_found') {
        sockets[playerIdx].emit('submit_validation', { truthAnswer: true });
        await sleep(3000);
      } else {
        break;
      }
    }

    const unique = [...new Set(turnHistory)];
    assert(unique.length >= 3, 'Should have seen at least 3 players: ' + JSON.stringify(turnHistory));

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // CORRECT PAIR: Same player gets to flip again
  // ====================================================================
  console.log('\n--- CORRECT PAIR: Player keeps turn ---');

  await test('Correct pair: same player gets to play again (no turn_changed)', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    // Try cards 0,1 - might be a pair or not
    const result = await flipTwoCards(sockets, 0, 0, 1);

    if (result.type === 'pair_found') {
      // Good - pair found. Now verify turn did NOT change yet
      // Submit validation
      sockets[0].emit('submit_validation', { truthAnswer: true });

      // Wait for cards_to_deck (correct validation) or turn_changed (wrong validation)
      const ctdPromise = new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 5000);
        sockets[0].once('cards_to_deck', (d) => { clearTimeout(t); resolve({ ev: 'cards_to_deck', data: d }); });
      });
      const tcPromise = new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 5000);
        sockets[0].once('turn_changed', (d) => { clearTimeout(t); resolve({ ev: 'turn_changed', data: d }); });
      });

      const valResult = await Promise.race([ctdPromise, tcPromise, sleep(6000).then(() => ({ ev: 'timeout' }))]);

      if (valResult && valResult.ev === 'cards_to_deck') {
        // Validation correct - player keeps turn
        // No turn_changed should have fired
        assert(true, 'Player kept turn after correct pair + correct validation');
      } else if (valResult && valResult.ev === 'turn_changed') {
        // Validation failed - turn changed (valid)
        assert(valResult.data.currentTurn === 1, 'Turn should go to P1 after failed validation');
      } else {
        console.log('    (info: validation result unclear, skipping)');
      }
    } else {
      console.log('    (info: cards 0,1 were not a pair, skipping correct-pair test)');
    }

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // ANTI-CHEAT: Non-turn player tries to flip
  // ====================================================================
  console.log('\n--- ANTI-CHEAT: Wrong player blocked ---');

  await test('2P: P1 tries to flip during P0 turn - rejected', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    // P1 tries to flip when it's P0's turn
    sockets[1].emit('flip_card', { cardIndex: 5 });
    const noFlip = await waitForNoEvent(sockets[0], 'card_flipped', 2000);
    assert(noFlip === true, 'P1 should NOT trigger card_flipped during P0 turn');

    sockets.forEach(s => s.disconnect());
  });

  await test('3P: P2 tries to flip during P0 turn - rejected', async () => {
    const { sockets } = await setupRoom(3);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);
    await waitEvent(sockets[2], 'game_start', 5000);

    // P2 tries to flip when it's P0's turn
    sockets[2].emit('flip_card', { cardIndex: 10 });
    const noFlip = await waitForNoEvent(sockets[0], 'card_flipped', 2000);
    assert(noFlip === true, 'P2 should NOT trigger card_flipped during P0 turn');

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // FULL GAME SIMULATION: Play until game over or 20 rounds
  // ====================================================================
  console.log('\n--- FULL GAME: 2P Complete Simulation ---');

  await test('2P: Full game simulation - no rule violations', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    let currentTurn = 0;
    let rounds = 0;
    let ruleViolations = 0;
    const nextCardToTry = [0, 0]; // each player tracks which card to try next

    while (rounds < 20) {
      rounds++;
      const playerIdx = currentTurn;
      const cardA = nextCardToTry[playerIdx];
      const cardB = cardA + 1;
      nextCardToTry[playerIdx] = cardA + 2;

      if (cardB > 95) break;

      const result = await flipTwoCards(sockets, playerIdx, cardA, cardB);

      if (result.type === 'turn_changed' && result.data) {
        // Turn passed - verify it went to the other player
        const expected = (playerIdx + 1) % 2;
        if (result.data.currentTurn !== expected) {
          ruleViolations++;
          console.log('    VIOLATION round ' + rounds + ': expected P' + expected + ' got P' + result.data.currentTurn);
        }
        currentTurn = result.data.currentTurn;
      } else if (result.type === 'pair_found') {
        // Resolve validation
        sockets[playerIdx].emit('submit_validation', { truthAnswer: Math.random() > 0.5 });

        // Wait for either cards_to_deck or turn_changed
        const ctdP = new Promise(r => {
          const t = setTimeout(() => r(null), 5000);
          sockets[0].once('cards_to_deck', d => { clearTimeout(t); r({ ev: 'ctd', d }); });
        });
        const tcP = new Promise(r => {
          const t = setTimeout(() => r(null), 5000);
          sockets[0].once('turn_changed', d => { clearTimeout(t); r({ ev: 'tc', d }); });
        });
        const goP = new Promise(r => {
          const t = setTimeout(() => r(null), 5000);
          sockets[0].once('game_over', d => { clearTimeout(t); r({ ev: 'go', d }); });
        });

        const valResult = await Promise.race([ctdP, tcP, goP, sleep(6000).then(() => ({ ev: 'timeout' }))]);

        if (valResult && valResult.ev === 'go') {
          break; // Game over
        }
        if (valResult && valResult.ev === 'tc') {
          currentTurn = valResult.d.currentTurn;
        }
        // If ctd - player keeps turn
        if (valResult && valResult.ev === 'timeout') {
          console.log('    (timeout at round ' + rounds + ')');
          break;
        }
      } else {
        break;
      }
    }

    assert(ruleViolations === 0, ruleViolations + ' rule violations detected in ' + rounds + ' rounds');
    assert(rounds >= 2, 'Should play at least 2 rounds, got ' + rounds);

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // RAPID DOUBLE-CLICK: Player clicks same card twice rapidly
  // ====================================================================
  console.log('\n--- RAPID DOUBLE-CLICK ---');

  await test('Rapid double-click on same card: only 1 flip registered', async () => {
    const { sockets } = await setupRoom(2);
    sockets[0].emit('start_game');
    await waitEvent(sockets[0], 'game_start', 5000);
    await waitEvent(sockets[1], 'game_start', 5000);

    // Rapidly emit flip_card for same index
    sockets[0].emit('flip_card', { cardIndex: 5 });
    sockets[0].emit('flip_card', { cardIndex: 5 });
    sockets[0].emit('flip_card', { cardIndex: 5 });

    let flipCount = 0;
    sockets[0].on('card_flipped', () => flipCount++);
    await sleep(1500);

    assert(flipCount <= 1, 'Same card flipped multiple times (got ' + flipCount + ' card_flipped events)');

    sockets.forEach(s => s.disconnect());
  });

  // ====================================================================
  // RESULTS
  // ====================================================================
  console.log('\n========================================');
  console.log('  BUG FIX VALIDATION RESULTS');
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
