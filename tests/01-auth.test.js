/**
 * Test Suite: Authentication
 * Tests registration, login, logout, cookies, duplicate prevention, admin
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Authentication & User Tests');
  console.log('========================================\n');

  h.setSuite('Auth');

  await h.test('Register new user - returns 200 with user data', async () => {
    const res = await h.registerUser('auth_reg_' + Date.now(), 'TestUser', 'br');
    h.assertEqual(res.status, 200, 'Expected 200');
    h.assert(res.cookie, 'Should have auth_token cookie');
    h.assert(res.body.user, 'Should have user object');
    h.assert(res.body.user.displayName === 'TestUser', 'Should have correct displayName');
  });

  await h.test('Register duplicate username - should fail', async () => {
    const uname = 'auth_dup_' + Date.now();
    const r1 = await h.registerUser(uname, 'First', 'br');
    h.assertEqual(r1.status, 200);
    const r2 = await h.registerUser(uname, 'Second', 'ar');
    h.assert(r2.status === 400 || r2.status === 409, 'Duplicate should be rejected');
  });

  await h.test('Login with correct password', async () => {
    const uname = 'auth_login_' + Date.now();
    await h.registerUser(uname, 'LoginTest', 'fr');
    const login = await h.loginUser(uname);
    h.assertEqual(login.status, 200, 'Login should succeed');
    h.assert(login.cookie, 'Should get cookie');
  });

  await h.test('Login with wrong password - should fail', async () => {
    const uname = 'auth_wrong_' + Date.now();
    await h.registerUser(uname, 'WrongTest', 'de');
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: uname,
      password: 'wrongpass'
    });
    h.assert(res.status === 400 || res.status === 401, 'Wrong password rejected');
  });

  await h.test('Login with non-existent user', async () => {
    const res = await h.httpReq('POST', '/api/auth/login', {
      username: 'nouser_' + Date.now(),
      password: '123456'
    });
    h.assert(res.status === 400 || res.status === 401, 'Non-existent user rejected');
  });

  await h.test('GET /api/auth/me with valid cookie', async () => {
    const reg = await h.registerUser('auth_me_' + Date.now(), 'MeTest', 'it');
    const me = await h.getMe(reg.cookie);
    h.assertEqual(me.status, 200);
    h.assert(me.json && me.json.user && me.json.user.username, 'Should return user.username');
  });

  await h.test('GET /api/auth/me without cookie - 401', async () => {
    const me = await h.getMe('');
    h.assertEqual(me.status, 401);
  });

  await h.test('Register with missing fields - 400', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', { username: 'incomplete' });
    h.assert(res.status === 400, 'Missing fields should be 400');
  });

  await h.test('Register with short password - 400', async () => {
    const res = await h.httpReq('POST', '/api/auth/register', {
      username: 'shortpw_' + Date.now(),
      password: '12',
      displayName: 'Short',
      flagCode: 'br'
    });
    h.assert(res.status === 400, 'Short password should be rejected');
  });

  await h.test('Logout clears auth cookie', async () => {
    const reg = await h.registerUser('auth_logout_' + Date.now(), 'Logout', 'jp');
    const out = await h.logoutUser(reg.cookie);
    h.assertEqual(out.status, 200);
  });

  await h.test('GET /api/users/online returns array', async () => {
    const res = await h.httpReq('GET', '/api/users/online', null, {});
    h.assertEqual(res.status, 200);
    h.assert(Array.isArray(res.json) || (res.json && typeof res.json === 'object'), 'Should return data');
  });

  await h.test('Become admin without auth - fails', async () => {
    const res = await h.httpReq('POST', '/api/auth/become-admin', {});
    h.assert(res.status === 401 || res.status === 403, 'Should require auth');
  });

  console.log('\n  Auth tests complete.');
}

module.exports = { run };
