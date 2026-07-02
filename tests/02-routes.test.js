/**
 * Test Suite: Routes & Authorization
 * Tests page routes, protected routes, API routes, admin access
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Routes & Authorization Tests');
  console.log('========================================\n');

  h.setSuite('Routes');

  await h.test('GET / serves login page (200)', async () => {
    const r = await h.httpGet('/');
    h.assertEqual(r.status, 200);
    h.assert(r.body.includes('Memory') || r.body.includes('login') || r.body.includes('Cup'));
  });

  await h.test('GET /jogar without auth redirects (302)', async () => {
    const r = await h.httpGet('/jogar');
    h.assertEqual(r.status, 302);
  });

  await h.test('GET /dados without auth redirects (302)', async () => {
    const r = await h.httpGet('/dados');
    h.assertEqual(r.status, 302);
  });

  await h.test('GET /ranking without auth redirects (302)', async () => {
    const r = await h.httpGet('/ranking');
    h.assertEqual(r.status, 302);
  });

  await h.test('GET /ajuda without auth redirects (302)', async () => {
    const r = await h.httpGet('/ajuda');
    h.assertEqual(r.status, 302);
  });

  await h.test('GET /admin without auth redirects or 401', async () => {
    const r = await h.httpGet('/admin');
    h.assert(r.status === 302 || r.status === 401, 'Admin should be protected');
  });

  await h.test('GET /jogar with auth serves game page (200)', async () => {
    const reg = await h.registerUser('route_jogar_' + Date.now(), 'Jogar', 'br');
    const r = await h.httpReq('GET', '/jogar', null, { Cookie: reg.cookie });
    h.assertEqual(r.status, 200);
    h.assert(r.body.includes('Memory') || r.body.includes('memory'));
  });

  await h.test('GET /jogar/sala-XXXX with auth serves game page', async () => {
    const reg = await h.registerUser('route_sala_' + Date.now(), 'Sala', 'br');
    const r = await h.httpReq('GET', '/jogar/sala-TEST01', null, { Cookie: reg.cookie });
    h.assertEqual(r.status, 200);
  });

  await h.test('GET /jogar/sala-XXXX without auth is accessible (200)', async () => {
    const r = await h.httpGet('/jogar/sala-TEST01');
    h.assertEqual(r.status, 200, 'Room route should be publicly accessible');
  });

  await h.test('GET /api/matches returns 200 with array', async () => {
    const r = await h.httpGet('/api/matches');
    h.assertEqual(r.status, 200);
    h.assert(r.body);
  });

  await h.test('GET /api/ranking returns 200', async () => {
    const r = await h.httpGet('/api/ranking');
    h.assertEqual(r.status, 200);
  });

  await h.test('GET /api/admin/users without admin - forbidden', async () => {
    const reg = await h.registerUser('route_admin_' + Date.now(), 'NotAdmin', 'br');
    const r = await h.httpReq('GET', '/api/admin/users', null, { Cookie: reg.cookie });
    h.assert(r.status === 403 || r.status === 401, 'Non-admin should be forbidden');
  });

  await h.test('GET /api/admin/users without auth - rejected', async () => {
    const r = await h.httpReq('GET', '/api/admin/users');
    h.assert(r.status === 401 || r.status === 302, 'Unauth should be rejected');
  });

  await h.test('GET /socket.io/socket.io.js returns 200', async () => {
    const r = await h.httpGet('/socket.io/socket.io.js');
    h.assertEqual(r.status, 200);
  });

  await h.test('GET /shared.css returns 200', async () => {
    const r = await h.httpGet('/shared.css');
    h.assertEqual(r.status, 200);
  });

  await h.test('GET /shared.js returns 200', async () => {
    const r = await h.httpGet('/shared.js');
    h.assertEqual(r.status, 200);
  });

  await h.test('GET /nonexistent returns 404', async () => {
    const r = await h.httpGet('/this-does-not-exist');
    h.assertEqual(r.status, 404);
  });

  console.log('\n  Routes tests complete.');
}

module.exports = { run };
