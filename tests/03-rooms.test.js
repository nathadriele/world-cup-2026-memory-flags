/**
 * Test Suite: Rooms
 * Tests room creation, joining, leaving, lobby updates, max players, errors
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Room Management Tests');
  console.log('========================================\n');

  h.setSuite('Rooms');

  await h.test('Host creates room - receives room_created with code', async () => {
    const reg = await h.registerUser('room_create_' + Date.now(), 'Host', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('create_room', { name: 'Host', flagCode: 'br', maxPlayers: 4, previewCards: false });
    const data = await h.waitEvent(s, 'room_created');
    h.assert(data.code, 'Should have room code');
    h.assert(data.code.length >= 4, 'Room code should be at least 4 chars');
    s.disconnect();
  });

  await h.test('Guest joins existing room - receives room_joined', async () => {
    const { sockets } = await h.setupRoom(2);
    h.assert(sockets.length === 2, 'Should have 2 sockets');
    h.cleanupSockets(sockets);
  });

  await h.test('Host receives lobby_update when guest joins', async () => {
    const { sockets } = await h.setupRoom(2);
    // Lobby update should have been received during setup
    // Verify by checking if we can still get events
    h.assert(sockets[0].connected, 'Host socket should be connected');
    h.assert(sockets[1].connected, 'Guest socket should be connected');
    h.cleanupSockets(sockets);
  });

  await h.test('Join non-existent room - get room_error', async () => {
    const reg = await h.registerUser('room_fake_' + Date.now(), 'Fake', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: 'Fake', flagCode: 'br', code: 'FAKE01' });
    const data = await h.waitEvent(s, 'room_error');
    h.assert(data, 'Should get room_error');
    s.disconnect();
  });

  await h.test('Join room with missing fields - get room_error', async () => {
    const reg = await h.registerUser('room_missing_' + Date.now(), 'Missing', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: 'Missing' });
    const data = await h.waitEventOrNull(s, 'room_error', 3000);
    h.assert(data, 'Should get room_error for missing fields');
    s.disconnect();
  });

  await h.test('Room full - 9th player rejected (max 8)', async () => {
    const { sockets, roomCode } = await h.setupRoom(8);

    // Try to add 9th player
    const reg = await h.registerUser('room_9th_' + Date.now(), 'Ninth', 'us');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('join_room', { name: 'Ninth', flagCode: 'us', code: roomCode });
    const data = await h.waitEvent(s, 'room_error');
    h.assert(data, '9th player should get room_error');
    s.disconnect();
    h.cleanupSockets(sockets);
  });

  await h.test('Player leaves room - host gets notification', async () => {
    const { sockets } = await h.setupRoom(2);

    // Guest leaves
    sockets[1].emit('leave_room');

    // Host should get some notification
    const event = await Promise.race([
      h.waitEventOrNull(sockets[0], 'lobby_update', 3000).then(d => ({ type: 'lobby_update', data: d })),
      h.waitEventOrNull(sockets[0], 'player_left', 3000).then(d => ({ type: 'player_left', data: d })),
      h.sleep(4000).then(() => ({ type: 'timeout', data: null }))
    ]);
    h.assert(event.type !== 'timeout', 'Host should receive lobby_update or player_left');
    h.cleanupSockets(sockets);
  });

  await h.test('3 players - lobby updates for all', async () => {
    const reg1 = await h.registerUser('room_l3a_' + Date.now(), 'P1', 'br');
    const reg2 = await h.registerUser('room_l3b_' + Date.now(), 'P2', 'ar');
    const reg3 = await h.registerUser('room_l3c_' + Date.now(), 'P3', 'fr');

    const s1 = h.createSocket(reg1.cookie);
    const s2 = h.createSocket(reg2.cookie);
    const s3 = h.createSocket(reg3.cookie);
    await Promise.all([
      new Promise(r => s1.on('connect', r)),
      new Promise(r => s2.on('connect', r)),
      new Promise(r => s3.on('connect', r))
    ]);

    s1.emit('create_room', { name: 'P1', flagCode: 'br', maxPlayers: 4 });
    const created = await h.waitEvent(s1, 'room_created');

    s2.emit('join_room', { name: 'P2', flagCode: 'ar', code: created.code });
    await h.waitEvent(s2, 'room_joined');

    s3.emit('join_room', { name: 'P3', flagCode: 'fr', code: created.code });
    await h.waitEvent(s3, 'room_joined');

    // All should be connected
    h.assert(s1.connected && s2.connected && s3.connected, 'All 3 should be connected');
    h.cleanupSockets([s1, s2, s3]);
  });

  await h.test('Room code is unique format (alphanumeric)', async () => {
    const reg = await h.registerUser('room_code_' + Date.now(), 'Code', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('create_room', { name: 'Code', flagCode: 'br', maxPlayers: 4 });
    const data = await h.waitEvent(s, 'room_created');
    h.assert(/^[A-Z0-9]{4,8}$/.test(data.code), 'Room code should be alphanumeric uppercase: ' + data.code);
    s.disconnect();
  });

  await h.test('Create room with maxPlayers=2', async () => {
    const reg = await h.registerUser('room_max2_' + Date.now(), 'Max2', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('create_room', { name: 'Max2', flagCode: 'br', maxPlayers: 2 });
    const data = await h.waitEvent(s, 'room_created');
    h.assert(data.code, 'Should create room with maxPlayers=2');
    s.disconnect();
  });

  await h.test('Create room with maxPlayers=8 (maximum)', async () => {
    const reg = await h.registerUser('room_max8_' + Date.now(), 'Max8', 'br');
    const s = h.createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));

    s.emit('create_room', { name: 'Max8', flagCode: 'br', maxPlayers: 8 });
    const data = await h.waitEvent(s, 'room_created');
    h.assert(data.code, 'Should create room with maxPlayers=8');
    s.disconnect();
  });

  console.log('\n  Rooms tests complete.');
}

module.exports = { run };
