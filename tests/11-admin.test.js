/**
 * Test Suite: Admin Operations
 * Tests admin CRUD: create/read/update/delete users,
 * role management, become-admin, self-protection.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Admin Tests');
  console.log('========================================\n');

  h.setSuite('Admin');

  // Helper: register a fresh admin
  async function makeAdmin(label) {
    const ts = Date.now();
    const reg = await h.registerUser('adm_' + label + '_' + ts, 'Admin', 'br');
    return reg;
  }

  // Helper: register a fresh regular user
  async function makeUser(label) {
    const ts = Date.now();
    const reg = await h.registerUser('usr_' + label + '_' + ts, 'User', 'br');
    return reg;
  }

  // ── Admin API Access Control ──────────────────────────
  await h.test('GET /api/admin/users requires admin role', async () => {
    const user = await makeUser('noadmin_get');
    const res = await h.httpReq('GET', '/api/admin/users', null, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Non-admin should get 403');
  });

  await h.test('GET /api/admin/users requires auth', async () => {
    const res = await h.httpReq('GET', '/api/admin/users', null, {});
    h.assertEqual(res.status, 401, 'Unauthed should get 401');
  });

  await h.test('Admin page requires admin role (redirect)', async () => {
    const user = await makeUser('noadmin_page');
    const res = await h.httpGet('/admin');
    h.assert(res.status === 401 || res.status === 403, 'Non-admin should be blocked from /admin page');
  });

  // ── Admin Users List ──────────────────────────────────
  await h.test('Admin can list users', async () => {
    const admin = await makeAdmin('list');
    const res = await h.httpReq('GET', '/api/admin/users', null, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Admin should get 200');
    h.assert(Array.isArray(res.body.users), 'Should return users array');
    h.assert(res.body.users.length > 0, 'Should have at least 1 user');
  });

  await h.test('Admin users list includes all fields', async () => {
    const admin = await makeAdmin('fields');
    const res = await h.httpReq('GET', '/api/admin/users', null, { Cookie: admin.cookie });
    if (res.body.users.length > 0) {
      const u = res.body.users[0];
      h.assert(typeof u.id === 'number', 'User should have id');
      h.assert(typeof u.username === 'string', 'User should have username');
      h.assert(typeof u.display_name === 'string', 'User should have display_name');
      h.assert(typeof u.flag_code === 'string', 'User should have flag_code');
      h.assert(typeof u.role === 'string', 'User should have role');
    }
  });

  // ── Admin Create User ─────────────────────────────────
  await h.test('Admin can create user', async () => {
    const admin = await makeAdmin('create');
    const ts = Date.now();
    const res = await h.httpReq('POST', '/api/admin/users', {
      username: 'created_' + ts,
      password: '123456',
      displayName: 'Created',
      flagCode: 'ar',
      role: 'player'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should create user');
    h.assert(res.body.user.username === 'created_' + ts, 'Should return created user');
  });

  await h.test('Admin create user with missing fields fails', async () => {
    const admin = await makeAdmin('createbad');
    const res = await h.httpReq('POST', '/api/admin/users', {
      username: '',
      password: '',
      displayName: ''
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 400, 'Should require all fields');
  });

  await h.test('Admin create duplicate user fails', async () => {
    const admin = await makeAdmin('dupcreate');
    const ts = Date.now();
    const username = 'admindup_' + ts;
    await h.httpReq('POST', '/api/admin/users', {
      username, password: '123456', displayName: 'First', flagCode: 'br'
    }, { Cookie: admin.cookie });
    const res2 = await h.httpReq('POST', '/api/admin/users', {
      username, password: '123456', displayName: 'Second', flagCode: 'ar'
    }, { Cookie: admin.cookie });
    h.assertEqual(res2.status, 400, 'Should reject duplicate');
  });

  await h.test('Non-admin cannot create user via admin API', async () => {
    const user = await makeUser('notadmin_create');
    const res = await h.httpReq('POST', '/api/admin/users', {
      username: 'hacker_' + Date.now(),
      password: '123456',
      displayName: 'Hacker',
      flagCode: 'br'
    }, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Non-admin should be blocked');
  });

  // ── Admin Update User ─────────────────────────────────
  await h.test('Admin can update user displayName', async () => {
    const admin = await makeAdmin('update');
    const ts = Date.now();
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username: 'toupdate_' + ts, password: '123456', displayName: 'OldName', flagCode: 'br'
    }, { Cookie: admin.cookie });
    const userId = createRes.body.user.id;

    const res = await h.httpReq('PUT', '/api/admin/users/' + userId, {
      displayName: 'NewName'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should update user');
    h.assertEqual(res.body.user.display_name, 'NewName', 'Should have new name');
  });

  await h.test('Admin can update user flagCode', async () => {
    const admin = await makeAdmin('updateflag');
    const ts = Date.now();
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username: 'toflag_' + ts, password: '123456', displayName: 'FlagTest', flagCode: 'br'
    }, { Cookie: admin.cookie });
    const userId = createRes.body.user.id;

    const res = await h.httpReq('PUT', '/api/admin/users/' + userId, {
      flagCode: 'ar'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should update flag');
    h.assertEqual(res.body.user.flag_code, 'ar', 'Should have new flag');
  });

  await h.test('Admin can update user password', async () => {
    const admin = await makeAdmin('updatepw');
    const ts = Date.now();
    const username = 'topw_' + ts;
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username, password: '123456', displayName: 'PWTest', flagCode: 'br'
    }, { Cookie: admin.cookie });
    const userId = createRes.body.user.id;

    const res = await h.httpReq('PUT', '/api/admin/users/' + userId, {
      password: 'newpassword'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should update password');

    // Verify new password works
    const loginRes = await h.httpReq('POST', '/api/auth/login', {
      username, password: 'newpassword'
    });
    h.assertEqual(loginRes.status, 200, 'Should login with new password');
  });

  await h.test('Admin can update user role', async () => {
    const admin = await makeAdmin('updaterole');
    const ts = Date.now();
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username: 'torole_' + ts, password: '123456', displayName: 'RoleTest', flagCode: 'br', role: 'player'
    }, { Cookie: admin.cookie });
    const userId = createRes.body.user.id;

    const res = await h.httpReq('PUT', '/api/admin/users/' + userId, {
      role: 'admin'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should update role');
    h.assertEqual(res.body.user.role, 'admin', 'Should be admin now');
  });

  await h.test('Admin update non-existent user returns 404', async () => {
    const admin = await makeAdmin('update404');
    const res = await h.httpReq('PUT', '/api/admin/users/99999', {
      displayName: 'Ghost'
    }, { Cookie: admin.cookie });
    h.assertEqual(res.status, 404, 'Should return 404 for non-existent user');
  });

  await h.test('Non-admin cannot update user', async () => {
    const user = await makeUser('noupdate');
    const res = await h.httpReq('PUT', '/api/admin/users/1', {
      displayName: 'Hacked'
    }, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Non-admin should be blocked');
  });

  // ── Admin Delete User ─────────────────────────────────
  await h.test('Admin can delete user', async () => {
    const admin = await makeAdmin('delete');
    const ts = Date.now();
    const createRes = await h.httpReq('POST', '/api/admin/users', {
      username: 'todelete_' + ts, password: '123456', displayName: 'ToDelete', flagCode: 'br'
    }, { Cookie: admin.cookie });
    const userId = createRes.body.user.id;

    const res = await h.httpReq('DELETE', '/api/admin/users/' + userId, null, { Cookie: admin.cookie });
    h.assertEqual(res.status, 200, 'Should delete user');
    h.assert(res.body.ok === true, 'Should return ok');
  });

  await h.test('Admin cannot delete self', async () => {
    const admin = await makeAdmin('noselfdelete');
    const meRes = await h.getMe(admin.cookie);
    const myId = meRes.json.user.id;

    const res = await h.httpReq('DELETE', '/api/admin/users/' + myId, null, { Cookie: admin.cookie });
    h.assertEqual(res.status, 400, 'Should prevent self-deletion');
    h.assert(res.body.error.includes('própria') || res.body.error.includes('own'), 'Should explain why');
  });

  await h.test('Admin delete non-existent user returns 404', async () => {
    const admin = await makeAdmin('delete404');
    const res = await h.httpReq('DELETE', '/api/admin/users/99999', null, { Cookie: admin.cookie });
    h.assertEqual(res.status, 404, 'Should return 404');
  });

  await h.test('Non-admin cannot delete user', async () => {
    const user = await makeUser('nodelete');
    const res = await h.httpReq('DELETE', '/api/admin/users/1', null, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Non-admin should be blocked');
  });

  // ── Become Admin ──────────────────────────────────────
  await h.test('become-admin endpoint requires auth', async () => {
    const res = await h.httpReq('POST', '/api/auth/become-admin', { adminCode: 'test' });
    h.assertEqual(res.status, 401, 'Should require auth');
  });

  await h.test('become-admin with empty code rejected', async () => {
    const user = await makeUser('becomeno');
    const res = await h.httpReq('POST', '/api/auth/become-admin', { adminCode: '' }, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Empty code should be rejected');
  });

  await h.test('become-admin with wrong code rejected', async () => {
    const user = await makeUser('becomewrong');
    const res = await h.httpReq('POST', '/api/auth/become-admin', { adminCode: 'totallywrong' }, { Cookie: user.cookie });
    h.assertEqual(res.status, 403, 'Wrong code should be rejected');
  });

  // ── API Data Endpoints ────────────────────────────────
  await h.test('GET /api/matches returns array', async () => {
    const res = await h.httpReq('GET', '/api/matches');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(Array.isArray(res.body), 'Should return array');
  });

  await h.test('GET /api/ranking returns ranking data', async () => {
    const res = await h.httpReq('GET', '/api/ranking');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(res.body.ranking !== undefined, 'Should have ranking');
    h.assert(typeof res.body.totalMatches === 'number', 'Should have totalMatches');
  });

  await h.test('GET /api/users/online returns users array', async () => {
    const res = await h.httpReq('GET', '/api/users/online');
    h.assertEqual(res.status, 200, 'Should return 200');
    h.assert(Array.isArray(res.body.users), 'Should have users array');
  });

  await h.test('Ranking entries have correct shape', async () => {
    const res = await h.httpReq('GET', '/api/ranking');
    if (res.body.ranking && res.body.ranking.length > 0) {
      const entry = res.body.ranking[0];
      h.assert(typeof entry.position === 'number', 'Should have position');
      h.assert(typeof entry.displayName === 'string', 'Should have displayName');
      h.assert(typeof entry.wins === 'number', 'Should have wins');
      h.assert(typeof entry.flagCode === 'string', 'Should have flagCode');
    }
  });

  console.log('\n  Admin tests complete.');
}

module.exports = { run };
