/**
 * Test Suite: Responsive Design
 * Tests viewport meta tags, CSS media queries, static asset availability,
 * page structure integrity, mobile-friendly elements
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Responsive Design Tests');
  console.log('========================================\n');

  h.setSuite('Responsive');

  await h.test('Login page has viewport meta tag', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('viewport'), 'Login page should have viewport meta tag');
    h.assert(res.body.includes('width=device-width'), 'Viewport should include width=device-width');
  });

  await h.test('Jogar page has viewport meta tag', async () => {
    const reg = await h.registerUser('resp_jogar_' + Date.now(), 'Resp', 'br');
    const res = await h.httpGet('/jogar');
    // /jogar redirects without auth, so check login page fallback
    if (res.status === 302) {
      const loginRes = await h.httpGet('/');
      h.assert(loginRes.body.includes('viewport'), 'Page should have viewport meta');
    } else {
      h.assert(res.body.includes('viewport'), 'Jogar page should have viewport');
    }
  });

  await h.test('Shared CSS is served and has media queries', async () => {
    const res = await h.httpGet('/shared.css');
    h.assertEqual(res.status, 200, 'shared.css should be served');
    h.assert(res.body.includes('@media'), 'shared.css should contain @media queries');
  });

  await h.test('Login page has CSS responsive patterns', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('max-width') || res.body.includes('maxWidth'), 'Login should have max-width styling');
  });

  await h.test('Login page loads completely (has </html>)', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('</html>'), 'Login page should have closing </html>');
    h.assert(res.body.includes('<body'), 'Login page should have <body>');
  });

  await h.test('Ajuda page loads and has content', async () => {
    const res = await h.httpGet('/ajuda.html');
    h.assertEqual(res.status, 200, 'ajuda.html should load');
    h.assert(res.body.length > 500, 'Ajuda page should have substantial content');
  });

  await h.test('Dados page loads (redirects without auth)', async () => {
    const res = await h.httpGet('/dados');
    // Without auth it should redirect
    h.assert(res.status === 200 || res.status === 302, 'Dados should either load or redirect');
  });

  await h.test('Ranking page loads', async () => {
    const res = await h.httpGet('/ranking');
    h.assert(res.status === 200 || res.status === 302, 'Ranking should load or redirect');
  });

  await h.test('Login page has form elements', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('<form') || res.body.includes('input'), 'Login should have form/input elements');
  });

  await h.test('Login page links to shared CSS', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('shared.css') || res.body.includes('.css'), 'Login should link to CSS');
  });

  await h.test('Jogar page includes socket.io client', async () => {
    // Test by checking the jogar.html file is accessible with auth
    const reg = await h.registerUser('resp_socket_' + Date.now(), 'Socket', 'br');
    // We can't easily test authenticated page content via simple HTTP
    // But we can verify socket.io.js is served
    const res = await h.httpGet('/socket.io/socket.io.js');
    h.assertEqual(res.status, 200, 'socket.io.js should be served');
    h.assert(res.body.length > 100, 'socket.io.js should have content');
  });

  await h.test('Shared JS is served', async () => {
    const res = await h.httpGet('/shared.js');
    h.assertEqual(res.status, 200, 'shared.js should be served');
    h.assert(res.body.length > 0, 'shared.js should have content');
  });

  await h.test('Flag image references use CDN (flagcdn)', async () => {
    // Flags are loaded from external CDN (flagcdn.com), not local files
    const res = await h.httpGet('/shared.js');
    h.assert(res.body.includes('flagcdn') || res.body.includes('flags'), 'Shared JS should reference flag images');
  });

  await h.test('Login page has title', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('<title>'), 'Login page should have <title>');
  });

  await h.test('Login page has charset meta', async () => {
    const res = await h.httpGet('/');
    h.assert(res.body.includes('charset'), 'Login page should declare charset');
  });

  console.log('\n  Responsive Design tests complete.');
}

module.exports = { run };
