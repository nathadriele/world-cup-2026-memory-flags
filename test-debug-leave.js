#!/usr/bin/env node
const io = require('socket.io-client');
const http = require('http');
const BASE = 'http://localhost:3000';

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  const c1 = await registerUser('dbg_ht2_' + Date.now(), 'DbgHost', 'br');
  const c2 = await registerUser('dbg_gt2_' + Date.now(), 'DbgGuest', 'ar');

  const s1 = createSocket(c1);
  const s2 = createSocket(c2);
  await new Promise(r => s1.on('connect', r));
  await new Promise(r => s2.on('connect', r));

  let lobbyCount = 0;
  s1.on('lobby_update', (data) => {
    lobbyCount++;
    const pc = data.players.filter(function(p) { return p !== null; }).length;
    console.log('[HOST] lobby_update #' + lobbyCount + ': ' + pc + ' players');
  });

  console.log('=== Step 1: Create room ===');
  s1.emit('create_room', { name: 'DbgHost', flagCode: 'br', maxPlayers: 2, previewCards: false });
  const roomData = await new Promise(function(r) { s1.once('room_created', r); });
  console.log('Room: ' + roomData.code);
  await sleep(500);

  console.log('=== Step 2: Guest joins ===');
  s2.emit('join_room', { name: 'DbgGuest', flagCode: 'ar', code: roomData.code });
  await new Promise(function(r) { s2.once('room_joined', r); });
  console.log('Guest joined');
  await sleep(500);

  console.log('=== Step 3: Guest leaves ===');
  s2.emit('leave_room');
  console.log('leave_room emitted');
  await sleep(2000);

  console.log('=== Results ===');
  console.log('Total lobby_update events on host: ' + lobbyCount);

  s1.disconnect();
  s2.disconnect();
  process.exit(0);
}

test().catch(function(e) { console.error('Error:', e); process.exit(1); });
