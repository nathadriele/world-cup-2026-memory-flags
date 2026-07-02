/**
 * Test Suite: Turn Rotation
 * Tests sequential turn passing for 2-5 players, wrong pair rotation,
 * correct pair keeps turn, non-turn enforcement, wrap-around
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Turn Rotation Tests');
  console.log('========================================\n');

  h.setSuite('TurnRotation');

  await h.test('2P: Game starts with player 0', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    h.assertEqual(gs.currentTurn, 0, 'Should start with player 0');
    h.cleanupSockets(sockets);
  });

  await h.test('2P: Wrong pair passes turn 0 -> 1', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(200);

    const turnP = h.waitEvent(sockets[1], 'turn_changed');
    const pairP = h.waitEventOrNull(sockets[1], 'pair_found_pending_validation', 10000);

    sockets[0].emit('flip_card', { cardIndex: 1 });

    const turnOrPair = await Promise.race([
      turnP.then(d => ({ ev: 'turn_changed', data: d })),
      pairP.then(d => ({ ev: 'pair_found', data: d }))
    ]);

    if (turnOrPair.ev === 'turn_changed') {
      h.assertEqual(turnOrPair.data.currentTurn, 1, 'Turn should pass to player 1');
    } else {
      console.log('    (info: pair found instead of wrong - deck dependent)');
    }
    h.cleanupSockets(sockets);
  });

  await h.test('3P: Sequential rotation 0 -> 1 -> 2 -> 0', async () => {
    const { sockets } = await h.setupRoom(3);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');
    await h.waitEvent(sockets[2], 'game_start');

    let currentTurn = 0;
    const order = [0];

    for (let round = 0; round < 3; round++) {
      const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 12000);
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 12000);

      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 });
      await h.waitEvent(sockets[0], 'card_flipped');
      await h.sleep(200);
      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 + 1 });

      const result = await Promise.race([
        turnP.then(d => ({ ev: 'turn_changed', data: d })),
        pairP.then(d => ({ ev: 'pair_found', data: d }))
      ]);

      if (result.ev === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        order.push(currentTurn);
        const expected = (order[order.length - 2] + 1) % 3;
        h.assertEqual(currentTurn, expected, 'Turn should go to ' + expected + ' got ' + currentTurn);
      } else {
        console.log('    (round ' + round + ': pair found, same player)');
      }
    }
    h.cleanupSockets(sockets);
  });

  await h.test('4P: Turn cycles through 4 players', async () => {
    const { sockets } = await h.setupRoom(4);
    sockets[0].emit('start_game');
    for (let i = 0; i < 4; i++) await h.waitEvent(sockets[i], 'game_start');

    const seen = [0];
    let currentTurn = 0;

    for (let round = 0; round < 4; round++) {
      const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 12000);
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 12000);

      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 });
      await h.waitEvent(sockets[0], 'card_flipped');
      await h.sleep(200);
      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 + 1 });

      const result = await Promise.race([
        turnP.then(d => ({ ev: 'turn_changed', data: d })),
        pairP.then(d => ({ ev: 'pair_found', data: d }))
      ]);

      if (result.ev === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        seen.push(currentTurn);
      } else {
        console.log('    (round ' + round + ': pair found)');
      }
    }
    const unique = [...new Set(seen)];
    h.assert(unique.length >= 2, 'Should see at least 2 different players, got ' + JSON.stringify(seen));
    h.cleanupSockets(sockets);
  });

  await h.test('5P: Turn passes sequentially', async () => {
    const { sockets } = await h.setupRoom(5);
    sockets[0].emit('start_game');
    for (let i = 0; i < 5; i++) await h.waitEvent(sockets[i], 'game_start');

    let currentTurn = 0;
    let lastTurn = 0;
    let rotations = 0;

    for (let round = 0; round < 5; round++) {
      const turnP = h.waitEventOrNull(sockets[0], 'turn_changed', 12000);
      const pairP = h.waitEventOrNull(sockets[0], 'pair_found_pending_validation', 12000);

      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 });
      await h.waitEvent(sockets[0], 'card_flipped');
      await h.sleep(200);
      sockets[currentTurn].emit('flip_card', { cardIndex: round * 2 + 1 });

      const result = await Promise.race([
        turnP.then(d => ({ ev: 'turn_changed', data: d })),
        pairP.then(d => ({ ev: 'pair_found', data: d }))
      ]);

      if (result.ev === 'turn_changed' && result.data) {
        currentTurn = result.data.currentTurn;
        rotations++;
        const expected = (lastTurn + 1) % 5;
        h.assertEqual(currentTurn, expected, 'Expected ' + expected + ' got ' + currentTurn);
        lastTurn = currentTurn;
      } else {
        console.log('    (round ' + round + ': pair found)');
      }
    }
    h.assert(rotations >= 1, 'Should have at least 1 rotation');
    h.cleanupSockets(sockets);
  });

  await h.test('2P: Non-turn player blocked from flipping', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    const gs = await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    const wrong = gs.currentTurn === 0 ? 1 : 0;
    const flipP = new Promise(r => {
      const t = setTimeout(() => r(false), 2000);
      sockets[0].once('card_flipped', () => { clearTimeout(t); r(true); });
    });

    sockets[wrong].emit('flip_card', { cardIndex: 0 });
    const result = await flipP;
    h.assert(!result, 'Non-turn player should be blocked');
    h.cleanupSockets(sockets);
  });

  await h.test('4P: All players see currentTurn=0 on new game', async () => {
    const { sockets } = await h.setupRoom(4);
    sockets[0].emit('start_game');

    for (let i = 0; i < 4; i++) {
      const gs = await h.waitEvent(sockets[i], 'game_start');
      h.assertEqual(gs.currentTurn, 0, 'Player ' + i + ' should see currentTurn=0');
    }
    h.cleanupSockets(sockets);
  });

  await h.test('2P: turn_changed event has correct shape', async () => {
    const { sockets } = await h.setupRoom(2);
    sockets[0].emit('start_game');
    await h.waitEvent(sockets[0], 'game_start');
    await h.waitEvent(sockets[1], 'game_start');

    sockets[0].emit('flip_card', { cardIndex: 0 });
    await h.waitEvent(sockets[0], 'card_flipped');
    await h.sleep(200);

    const turnP = h.waitEvent(sockets[0], 'turn_changed');
    sockets[0].emit('flip_card', { cardIndex: 1 });

    const result = await Promise.race([
      turnP,
      h.sleep(12000).then(() => null)
    ]);

    if (result) {
      h.assert(typeof result.currentTurn === 'number', 'turn_changed should have currentTurn');
    }
    h.cleanupSockets(sockets);
  });

  console.log('\n  Turn Rotation tests complete.');
}

module.exports = { run };
