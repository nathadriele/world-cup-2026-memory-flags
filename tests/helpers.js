/**
 * Shared Test Helpers for Memory Cup 2026 Test Suite
 * Provides common utilities: HTTP requests, socket connections,
 * user registration, room setup, assertions, and test runner.
 */

const http = require('http');
const io = require('socket.io-client');

const BASE = 'http://localhost:3000';

// ── Test Runner ──────────────────────────────────────────────
let _passCount = 0;
let _failCount = 0;
let _results = [];
let _currentSuite = '';

function setSuite(name) { _currentSuite = name; }

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      _passCount++;
      _results.push({ suite: _currentSuite, name, status: 'PASS' });
      console.log('  PASS: ' + name);
      resolve();
    } catch (e) {
      _failCount++;
      _results.push({ suite: _currentSuite, name, status: 'FAIL', error: e.message });
      console.log('  FAIL: ' + name + ' - ' + e.message);
      resolve();
    }
  });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected} but got ${actual}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getStats() {
  return { passCount: _passCount, failCount: _failCount, results: _results };
}

function printResults(title) {
  console.log('\n========================================');
  console.log('  ' + title.toUpperCase());
  console.log('========================================');
  console.log('  Total: ' + (_passCount + _failCount));
  console.log('  Passed: ' + _passCount);
  console.log('  Failed: ' + _failCount);
  if (_failCount > 0) {
    console.log('\n  Failed tests:');
    _results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log('    - ' + r.name + ': ' + r.error);
    });
  }
  console.log('========================================\n');
}

function resetStats() {
  _passCount = 0;
  _failCount = 0;
  _results = [];
}

// ── HTTP Helpers ─────────────────────────────────────────────
function httpReq(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (extraHeaders) Object.assign(headers, extraHeaders);
    const req = http.request(BASE + path, { method, headers }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(chunks), body: chunks, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, body: chunks, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks, headers: res.headers }));
    }).on('error', reject);
  });
}

function getCookie(headers, name) {
  const cookies = headers['set-cookie'] || [];
  for (const c of cookies) {
    if (c.startsWith(name + '=')) return c.split(';')[0];
  }
  return '';
}

// ── Auth Helpers ─────────────────────────────────────────────
async function registerUser(username, displayName, flagCode) {
  const res = await httpReq('POST', '/api/auth/register', {
    username,
    password: '123456',
    displayName: displayName || username,
    flagCode: flagCode || 'br'
  });
  return {
    cookie: getCookie(res.headers, 'auth_token'),
    status: res.status,
    body: res.json
  };
}

async function loginUser(username) {
  const res = await httpReq('POST', '/api/auth/login', {
    username,
    password: '123456'
  });
  return {
    cookie: getCookie(res.headers, 'auth_token'),
    status: res.status,
    body: res.json
  };
}

async function logoutUser(cookie) {
  return httpReq('POST', '/api/auth/logout', null, { Cookie: cookie });
}

async function getMe(cookie) {
  return httpReq('GET', '/api/auth/me', null, { Cookie: cookie });
}

// ── Socket Helpers ───────────────────────────────────────────
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

function waitEventOrNull(socket, event, timeout) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeout || 8000);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

// ── Room Setup Helper ────────────────────────────────────────
async function setupRoom(numPlayers, opts) {
  const cookies = [];
  const sockets = [];
  const userIds = [];
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  const flags = ['br', 'ar', 'fr', 'de', 'it', 'jp', 'us', 'pt'];
  const ts = Date.now();

  for (let i = 0; i < numPlayers; i++) {
    const uname = 'test_' + numPlayers + 'p_' + i + '_' + ts;
    const reg = await registerUser(uname, names[i], flags[i]);
    cookies.push(reg.cookie);
    userIds.push(reg.body && reg.body.user ? reg.body.user.id : null);
    const s = createSocket(reg.cookie);
    await new Promise(r => s.on('connect', r));
    if (reg.body && reg.body.user) {
      s.emit('identify', { userId: reg.body.user.id });
    }
    sockets.push(s);
  }

  // Host creates room
  const maxP = opts && opts.maxPlayers ? opts.maxPlayers : numPlayers;
  sockets[0].emit('create_room', {
    name: names[0],
    flagCode: flags[0],
    maxPlayers: maxP,
    previewCards: opts && opts.previewCards ? opts.previewCards : false
  });
  const created = await waitEvent(sockets[0], 'room_created');
  const roomCode = created.code;

  // Other players join
  for (let i = 1; i < numPlayers; i++) {
    sockets[i].emit('join_room', { name: names[i], flagCode: flags[i], code: roomCode });
    await waitEvent(sockets[i], 'room_joined');
  }
  await sleep(300);

  return { sockets, roomCode, names, flags, cookies, userIds };
}

function cleanupSockets(sockets) {
  sockets.forEach(s => {
    try { s.disconnect(); } catch (e) {}
  });
}

module.exports = {
  BASE,
  test, assert, assertEqual, sleep,
  setSuite, getStats, printResults, resetStats,
  httpReq, httpGet, getCookie,
  registerUser, loginUser, logoutUser, getMe,
  createSocket, waitEvent, waitEventOrNull,
  setupRoom, cleanupSockets
};
