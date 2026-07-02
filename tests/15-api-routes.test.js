/**
 * Test Suite: API Routes (HTTP Black-Box)
 * Tests all HTTP endpoints systematically: status codes,
 * response shapes, headers, error handling, and edge cases.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  API Routes Tests');
  console.log('========================================\n');

  h.setSuite('APIRoutes');

  // ── GET / (root) ──────────────────────────────────────
  await h.test('GET / unauthed returns login page (200)', async () => {
    const res = await h.httpGet('/');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.includes('<html') || res.body.includes('<!DOCTYPE'), 'Should be HTML');
  });

  await h.test('GET / authed redirects to /jogar (302)', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_root_' + ts, 'Test', 'br');
    const res = await h.httpGet('/');

    // Need to send cookie manually for httpGet
    const http = require('http');
    const res2 = await new Promise((resolve) => {
      http.get('http://localhost:3000/', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res2.status, 302, 'Authed user should redirect to /jogar');
  });

  // ── Protected Pages ───────────────────────────────────
  await h.test('GET /jogar authed returns 200', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_jogar_' + ts, 'Test', 'br');
    const http = require('http');
    const res = await new Promise((resolve) => {
      http.get('http://localhost:3000/jogar', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res.status, 200, 'Authed /jogar should return 200');
    h.assert(res.body.includes('<html') || res.body.includes('<!DOCTYPE'), 'Should be HTML');
  });

  await h.test('GET /jogar unauthed returns 302', async () => {
    const res = await h.httpGet('/jogar');
    h.assertEqual(res.status, 302, 'Unauthed /jogar should redirect');
  });

  await h.test('GET /dados authed returns 200', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_dados_' + ts, 'Test', 'br');
    const http = require('http');
    const res = await new Promise((resolve) => {
      http.get('http://localhost:3000/dados', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res.status, 200, 'Authed /dados should return 200');
  });

  await h.test('GET /dados unauthed returns 302', async () => {
    const res = await h.httpGet('/dados');
    h.assertEqual(res.status, 302, 'Unauthed /dados should redirect');
  });

  await h.test('GET /ajuda authed returns 200', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_ajuda_' + ts, 'Test', 'br');
    const http = require('http');
    const res = await new Promise((resolve) => {
      http.get('http://localhost:3000/ajuda', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res.status, 200, 'Authed /ajuda should return 200');
  });

  await h.test('GET /ajuda unauthed returns 302', async () => {
    const res = await h.httpGet('/ajuda');
    h.assertEqual(res.status, 302, 'Unauthed /ajuda should redirect');
  });

  await h.test('GET /ranking authed returns 200', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_rank_' + ts, 'Test', 'br');
    const http = require('http');
    const res = await new Promise((resolve) => {
      http.get('http://localhost:3000/ranking', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res.status, 200, 'Authed /ranking should return 200');
  });

  await h.test('GET /ranking unauthed returns 302', async () => {
    const res = await h.httpGet('/ranking');
    h.assertEqual(res.status, 302, 'Unauthed /ranking should redirect');
  });

  await h.test('GET /admin unauthed returns 401/403', async () => {
    const res = await h.httpGet('/admin');
    h.assert(res.status === 401 || res.status === 403, 'Should reject unauthed');
  });

  // ── POST /api/auth/register ───────────────────────────
  await h.test('POST /api/auth/register returns user object', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'api_reg_' + ts,
      password: '123456',
      displayName: 'API',
      flagCode: 'br'
    });
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.user.id, 'Should return user with id');
    h.assert(res.body.user.username, 'Should return username');
    h.assert(res.body.user.displayName, 'Should return displayName');
    h.assert(res.body.user.flagCode, 'Should return flagCode');
    h.assert(res.body.user.role, 'Should return role');
    h.assert(res.body.user.password_hash === undefined, 'Should NOT return password hash');
  });

  await h.test('POST /api/auth/register sets auth_token cookie', async () => {
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'api_cookie_' + ts,
      password: '123456',
      displayName: 'Cookie',
      flagCode: 'br'
    });
    const cookies = res.headers['set-cookie'] || [];
    h.assert(cookies.some(c => c.startsWith('auth_token=')), 'Should set auth_token cookie');
    h.assert(cookies.some(c => c.includes('HttpOnly')), 'Cookie should be HttpOnly');
  });

  // ── POST /api/auth/login ──────────────────────────────
  await h.test('POST /api/auth/login returns user object', async () => {
    const ts = Date.now();
    await h.registerUser('api_login_' + ts, 'Login', 'br');
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: 'api_login_' + ts,
      password: '123456'
    });
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.user.username === 'api_login_' + ts, 'Should return correct user');
  });

  await h.test('POST /api/auth/login sets cookie', async () => {
    const ts = Date.now();
    await h.registerUser('api_login2_' + ts, 'Login', 'br');
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: 'api_login2_' + ts,
      password: '123456'
    });
    const cookies = res.headers['set-cookie'] || [];
    h.assert(cookies.some(c => c.startsWith('auth_token=')), 'Should set auth_token');
  });

  // ── POST /api/auth/logout ─────────────────────────────
  await h.test('POST /api/auth/logout returns ok', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_logout_' + ts, 'Logout', 'br');
    const res = await h.httpReq('POST', '/api/auth/logout', null, { Cookie: reg.cookie });
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.ok === true, 'Should return ok: true');
  });

  await h.test('POST /api/auth/logout clears cookie', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_logout2_' + ts, 'Logout', 'br');
    const res = await h.httpReq('POST', '/api/auth/logout', null, { Cookie: reg.cookie });
    const cookies = res.headers['set-cookie'] || [];
    h.assert(
      cookies.some(c => c.includes('auth_token=;') || c.includes('Expires=') || c.includes('Max-Age=0')),
      'Should clear auth_token cookie'
    );
  });

  // ── GET /api/auth/me ──────────────────────────────────
  await h.test('GET /api/auth/me authed returns user', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_me_' + ts, 'Me', 'br');
    const res = await h.httpReq('GET', '/api/auth/me', null, { Cookie: reg.cookie });
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.user.username === 'api_me_' + ts, 'Should return correct user');
  });

  await h.test('GET /api/auth/me unauthed returns 401', async () => {
    const res = await h.httpReq('GET', '/api/auth/me', null, {});
    h.assertEqual(res.status, 401, 'Should return 401');
    h.assert(res.body.error, 'Should have error message');
  });

  // ── GET /api/matches ──────────────────────────────────
  await h.test('GET /api/matches returns 200 array', async () => {
    const res = await h.httpReq('GET', '/api/matches');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(Array.isArray(res.body), 'Should return array');
  });

  await h.test('GET /api/matches does not require auth', async () => {
    const res = await h.httpReq('GET', '/api/matches');
    h.assertEqual(res.status, 200, 'Should be public endpoint');
  });

  // ── GET /api/ranking ──────────────────────────────────
  await h.test('GET /api/ranking returns 200 with data', async () => {
    const res = await h.httpReq('GET', '/api/ranking');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.ranking !== undefined, 'Should have ranking');
    h.assert(res.body.totalMatches !== undefined, 'Should have totalMatches');
  });

  await h.test('GET /api/ranking does not require auth', async () => {
    const res = await h.httpReq('GET', '/api/ranking');
    h.assertEqual(res.status, 200, 'Should be public');
  });

  // ── GET /api/users/online ─────────────────────────────
  await h.test('GET /api/users/online returns 200', async () => {
    const res = await h.httpReq('GET', '/api/users/online');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(Array.isArray(res.body.users), 'Should have users array');
  });

  // ── Static Files ──────────────────────────────────────
  await h.test('GET /shared.css returns 200', async () => {
    const res = await h.httpGet('/shared.css');
    h.assertEqual(res.status, 200, 'CSS should be served');
    h.assert(res.body.includes('.') || res.body.length > 0, 'Should have CSS content');
  });

  await h.test('GET /shared.js returns 200', async () => {
    const res = await h.httpGet('/shared.js');
    h.assertEqual(res.status, 200, 'JS should be served');
  });

  await h.test('GET /socket.io/socket.io.js returns 200', async () => {
    const res = await h.httpGet('/socket.io/socket.io.js');
    h.assertEqual(res.status, 200, 'Socket.IO client should be served');
  });

  await h.test('GET nonexistent path returns 404', async () => {
    const res = await h.httpGet('/this-does-not-exist');
    h.assertEqual(res.status, 404, 'Should return 404');
  });

  // ── Room URL with code ────────────────────────────────
  await h.test('GET /jogar/sala-XXXXXX authed returns 200', async () => {
    const ts = Date.now();
    const reg = await h.registerUser('api_room_' + ts, 'Test', 'br');
    const http = require('http');
    const res = await new Promise((resolve) => {
      http.get('http://localhost:3000/jogar/sala-ABCDEF', {
        headers: { Cookie: reg.cookie }
      }, (res) => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => resolve({ status: res.statusCode }));
      }).on('error', () => resolve({ status: 0 }));
    });
    h.assertEqual(res.status, 200, 'Room URL should serve jogar page');
  });

  await h.test('GET /jogar/sala-XXXXXX unauthed returns 200 (open route)', async () => {
    const res = await h.httpGet('/jogar/sala-ABCDEF');
    h.assertEqual(res.status, 200, 'Room route should be openly accessible');
  });

  // ── HTTP Method Coverage ──────────────────────────────
  await h.test('PATCH method not allowed on auth endpoints', async () => {
    const res = await h.httpReq('PATCH', '/api/auth/me', { test: true });
    h.assert(res.status === 404 || res.status === 405, 'PATCH should not be supported');
  });

  await h.test('POST to GET-only endpoint', async () => {
    const res = await h.httpReq('POST', '/api/matches', { test: true });
    h.assert(res.status === 404 || res.status === 405, 'POST /api/matches should not be allowed');
  });

  await h.test('DELETE on /api/ranking', async () => {
    const res = await h.httpReq('DELETE', '/api/ranking');
    h.assert(res.status === 404 || res.status === 405, 'DELETE should not be allowed');
  });

  // ── Response Content-Type ─────────────────────────────
  await h.test('API responses have application/json content-type', async () => {
    const res = await h.httpReq('GET', '/api/matches');
    const ct = res.headers['content-type'] || '';
    h.assert(ct.includes('application/json'), 'Should be JSON content-type');
  });

  await h.test('HTML pages have text/html content-type', async () => {
    const res = await h.httpGet('/');
    const ct = res.headers['content-type'] || '';
    h.assert(ct.includes('text/html'), 'Should be HTML content-type');
  });

  console.log('\n  API Routes tests complete.');
}

module.exports = { run };
