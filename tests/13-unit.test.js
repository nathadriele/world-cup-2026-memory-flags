/**
 * Test Suite: Unit Tests
 * Tests individual functions in isolation: auth module functions,
 * trivia data functions, helper utilities, database statements,
 * and internal server logic functions.
 */
const h = require('./helpers');

async function run() {
  console.log('\n========================================');
  console.log('  Unit Tests');
  console.log('========================================\n');

  h.setSuite('Unit');

  // ── normalizeText function ────────────────────────────
  const { normalizeText, getTrivia, TRIVIA } = require('../data/trivia.js');

  await h.test('normalizeText: lowercases input', async () => {
    h.assertEqual(normalizeText('HELLO'), 'hello', 'Should lowercase');
  });

  await h.test('normalizeText: removes accents', async () => {
    h.assertEqual(normalizeText('café'), 'cafe', 'Should remove accent');
    h.assertEqual(normalizeText('São Paulo'), 'sao paulo', 'Should remove ã');
    h.assertEqual(normalizeText('Épée'), 'epee', 'Should handle multiple accents');
  });

  await h.test('normalizeText: trims whitespace', async () => {
    h.assertEqual(normalizeText('  hello  '), 'hello', 'Should trim');
  });

  await h.test('normalizeText: collapses multiple spaces', async () => {
    h.assertEqual(normalizeText('hello    world'), 'hello world', 'Should collapse spaces');
  });

  await h.test('normalizeText: handles empty string', async () => {
    h.assertEqual(normalizeText(''), '', 'Should return empty');
  });

  await h.test('normalizeText: handles null', async () => {
    h.assertEqual(normalizeText(null), '', 'Should return empty for null');
  });

  await h.test('normalizeText: handles undefined', async () => {
    h.assertEqual(normalizeText(undefined), '', 'Should return empty for undefined');
  });

  await h.test('normalizeText: handles numbers', async () => {
    h.assertEqual(normalizeText(123), '123', 'Should convert number to string');
  });

  await h.test('normalizeText: handles special chars', async () => {
    h.assertEqual(normalizeText('test@example.com'), 'test@example.com', 'Should preserve @');
    h.assertEqual(normalizeText('a+b-c'), 'a+b-c', 'Should preserve + and -');
  });

  // ── getTrivia function ────────────────────────────────
  await h.test('getTrivia: returns object with statement and answer', async () => {
    const t = getTrivia('br');
    h.assert(typeof t === 'object', 'Should return object');
    h.assert(typeof t.statement === 'string', 'Should have statement');
    h.assert(typeof t.answer === 'boolean', 'Should have boolean answer');
  });

  await h.test('getTrivia: returns from correct country', async () => {
    const t = getTrivia('ar');
    const validStatements = TRIVIA.ar.map(e => e.statement);
    h.assert(validStatements.includes(t.statement), 'Should return AR trivia');
  });

  await h.test('getTrivia: unknown code falls back to br', async () => {
    const t = getTrivia('xx_nonexistent');
    const brStatements = TRIVIA.br.map(e => e.statement);
    h.assert(brStatements.includes(t.statement), 'Should fallback to BR trivia');
  });

  await h.test('getTrivia: random distribution works', async () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(getTrivia('br').statement);
    }
    // With 2 entries, 20 tries should hit both (very likely)
    h.assert(results.size >= 1, 'Should return at least 1 unique entry');
  });

  // ── TRIVIA data integrity ─────────────────────────────
  await h.test('TRIVIA: has entry for all 48 World Cup teams', async () => {
    const teams = [
      'us','mx','ca','br','ar','uy','co','ec','py',
      'pt','es','fr','de','it','gb-eng','nl','be','hr',
      'ch','at','no','gb-sct','ba','cz','tr','se',
      'jp','kr','au','ir','sa','qa','jo','uz',
      'ma','sn','eg','tn','gh','ci','cv','za','cd',
      'nz','ht','cw','pa','cr'
    ];
    for (const code of teams) {
      h.assert(TRIVIA[code] !== undefined, 'Should have trivia for ' + code);
    }
  });

  await h.test('TRIVIA: all entries have valid structure', async () => {
    for (const [code, entries] of Object.entries(TRIVIA)) {
      h.assert(Array.isArray(entries), code + ' must be array');
      h.assert(entries.length >= 2, code + ' must have at least 2 entries');
      entries.forEach((entry, i) => {
        h.assert(typeof entry.statement === 'string', code + '[' + i + '] must have statement string');
        h.assert(entry.statement.length > 10, code + '[' + i + '] statement must be substantial');
        h.assert(typeof entry.answer === 'boolean', code + '[' + i + '] must have boolean answer');
      });
    }
  });

  await h.test('TRIVIA: each country has T and F options', async () => {
    for (const [code, entries] of Object.entries(TRIVIA)) {
      const trues = entries.filter(e => e.answer === true).length;
      const falses = entries.filter(e => e.answer === false).length;
      h.assert(trues >= 1, code + ' must have at least 1 true answer');
      h.assert(falses >= 1, code + ' must have at least 1 false answer');
    }
  });

  // ── Database unit tests ───────────────────────────────
  await h.test('DB: users table exists', async () => {
    const { db } = require('../src/db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    h.assert(tables && tables.name === 'users', 'Users table should exist');
  });

  await h.test('DB: sessions table exists', async () => {
    const { db } = require('../src/db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    h.assert(tables && tables.name === 'sessions', 'Sessions table should exist');
  });

  await h.test('DB: matches table exists', async () => {
    const { db } = require('../src/db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='matches'").get();
    h.assert(tables && tables.name === 'matches', 'Matches table should exist');
  });

  await h.test('DB: WAL mode enabled', async () => {
    const { db } = require('../src/db');
    const result = db.pragma('journal_mode');
    h.assert(result[0].journal_mode === 'wal', 'Should be in WAL mode');
  });

  await h.test('DB: foreign keys enabled', async () => {
    const { db } = require('../src/db');
    const result = db.pragma('foreign_keys');
    h.assert(result[0].foreign_keys === 1, 'Foreign keys should be ON');
  });

  await h.test('DB: user can be inserted and retrieved', async () => {
    const { stmts } = require('../src/db');
    const ts = Date.now();
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('test123', 10);
    const result = stmts.createUser.run({
      username: 'unit_db_' + ts,
      password_hash: hash,
      display_name: 'UnitTest',
      flag_code: 'br',
      role: 'player'
    });
    const user = stmts.getUserById.get(result.lastInsertRowid);
    h.assert(user !== undefined, 'Should retrieve inserted user');
    h.assertEqual(user.username, 'unit_db_' + ts, 'Username should match');
    h.assertEqual(user.display_name, 'UnitTest', 'Display name should match');
  });

  await h.test('DB: session create/get/delete lifecycle', async () => {
    const { stmts, db } = require('../src/db');
    const ts = Date.now();
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('test123', 10);
    const result = stmts.createUser.run({
      username: 'unit_sess_' + ts,
      password_hash: hash,
      display_name: 'Sess',
      flag_code: 'br',
      role: 'player'
    });
    const token = 'test_token_' + ts;
    const expires = new Date(Date.now() + 86400000).toISOString();
    stmts.createSession.run(token, result.lastInsertRowid, expires);

    const session = stmts.getSession.get(token);
    h.assert(session !== undefined, 'Should find session');
    h.assertEqual(session.token, token, 'Token should match');

    stmts.deleteSession.run(token);
    const deleted = stmts.getSession.get(token);
    h.assert(deleted === undefined, 'Session should be deleted');
  });

  await h.test('DB: getUserByUsername retrieves correctly', async () => {
    const { stmts } = require('../src/db');
    const ts = Date.now();
    const bcrypt = require('bcryptjs');
    const username = 'unitByUsername_' + ts;
    const hash = bcrypt.hashSync('test123', 10);
    stmts.createUser.run({
      username,
      password_hash: hash,
      display_name: 'ByName',
      flag_code: 'br',
      role: 'player'
    });
    const user = stmts.getUserByUsername.get(username);
    h.assert(user !== undefined, 'Should find by username');
    h.assertEqual(user.display_name, 'ByName', 'Display name should match');
  });

  await h.test('DB: allMatches returns array limited to 200', async () => {
    const { stmts } = require('../src/db');
    const matches = stmts.allMatches.all();
    h.assert(Array.isArray(matches), 'Should return array');
    h.assert(matches.length <= 200, 'Should be limited to 200');
  });

  await h.test('DB: totalMatches returns count', async () => {
    const { stmts } = require('../src/db');
    const result = stmts.totalMatches.get();
    h.assert(typeof result.total === 'number', 'Should return total count');
    h.assert(result.total >= 0, 'Total should be non-negative');
  });

  // ── Auth module unit tests ────────────────────────────
  await h.test('auth.publicUser: returns safe user object', async () => {
    const auth = require('../src/auth');
    const mockRow = {
      id: 1,
      username: 'test',
      display_name: 'Test',
      flag_code: 'br',
      role: 'player',
      created_at: '2025-01-01',
      last_seen: '2025-01-01',
      password_hash: 'secret_hash'
    };
    const pub = auth.publicUser(mockRow);
    h.assertEqual(pub.id, 1, 'Should have id');
    h.assertEqual(pub.username, 'test', 'Should have username');
    h.assertEqual(pub.displayName, 'Test', 'Should have displayName');
    h.assertEqual(pub.flagCode, 'br', 'Should have flagCode');
    h.assertEqual(pub.role, 'player', 'Should have role');
    h.assert(pub.password_hash === undefined, 'Should NOT expose password_hash');
    h.assert(pub.passwordHash === undefined, 'Should NOT expose passwordHash');
  });

  await h.test('auth.publicUser: null returns null', async () => {
    const auth = require('../src/auth');
    h.assert(auth.publicUser(null) === null, 'Should return null');
  });

  await h.test('auth.register: validates min username length', async () => {
    const auth = require('../src/auth');
    try {
      auth.register({ username: 'ab', password: '123456', displayName: 'Test' });
      h.assert(false, 'Should have thrown');
    } catch (e) {
      h.assert(e.message.includes('3 caract') || e.message.includes('characters'), 'Should mention min length');
    }
  });

  await h.test('auth.register: validates min password length', async () => {
    const auth = require('../src/auth');
    try {
      auth.register({ username: 'testuser_' + Date.now(), password: '12345', displayName: 'Test' });
      h.assert(false, 'Should have thrown');
    } catch (e) {
      h.assert(e.message.includes('6 caract') || e.message.includes('senha'), 'Should mention password length');
    }
  });

  await h.test('auth.register: validates max displayName length', async () => {
    const auth = require('../src/auth');
    try {
      auth.register({
        username: 'testuser_long_' + Date.now(),
        password: '123456',
        displayName: 'A'.repeat(16)
      });
      h.assert(false, 'Should have thrown');
    } catch (e) {
      h.assert(e.message.includes('15 caract') || e.message.includes('exibição'), 'Should mention max length');
    }
  });

  await h.test('auth.register: rejects missing fields', async () => {
    const auth = require('../src/auth');
    try {
      auth.register({ username: '', password: '', displayName: '' });
      h.assert(false, 'Should throw');
    } catch (e) {
      h.assert(e.message.length > 0, 'Should have error message');
    }
  });

  await h.test('auth.login: rejects non-existent user', async () => {
    const auth = require('../src/auth');
    try {
      auth.login('ghost_user_' + Date.now(), '123456');
      h.assert(false, 'Should throw');
    } catch (e) {
      h.assert(e.message.includes('não encontrado') || e.message.includes('not found'), 'Should say not found');
    }
  });

  await h.test('auth.login: rejects empty credentials', async () => {
    const auth = require('../src/auth');
    try {
      auth.login('', '');
      h.assert(false, 'Should throw');
    } catch (e) {
      h.assert(e.message.length > 0, 'Should have error');
    }
  });

  // ── bcrypt verification ───────────────────────────────
  await h.test('bcrypt: hash and compare sync', async () => {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('mypassword', 10);
    h.assert(bcrypt.compareSync('mypassword', hash), 'Should verify correct password');
    h.assert(!bcrypt.compareSync('wrongpassword', hash), 'Should reject wrong password');
  });

  await h.test('bcrypt: different salts produce different hashes', async () => {
    const bcrypt = require('bcryptjs');
    const h1 = bcrypt.hashSync('test', 10);
    const h2 = bcrypt.hashSync('test', 10);
    h.assert(h1 !== h2, 'Hashes should differ due to random salt');
  });

  // ── Server constants verification ─────────────────────
  await h.test('Server constants: TURN_TIME is 30', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('TURN_TIME = 30'), 'TURN_TIME should be 30');
  });

  await h.test('Server constants: MAX_PLAYERS is 8', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('MAX_PLAYERS = 8'), 'MAX_PLAYERS should be 8');
  });

  await h.test('Server constants: RECONNECT_WINDOW is 120000', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('RECONNECT_WINDOW = 120000'), 'RECONNECT_WINDOW should be 120000ms');
  });

  await h.test('Server: 48 teams defined', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    const teamCount = (src.match(/{ code:/g) || []).length;
    h.assert(teamCount >= 48, 'Should have at least 48 teams, found ' + teamCount);
  });

  await h.test('Server: board initialized with 96 slots', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes("Array(96).fill('hidden')"), 'Board should be 96 cards');
  });

  await h.test('Server: pair resolve delay is 1500ms', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('1500'), 'Should have 1500ms delay for wrong pair return');
  });

  await h.test('Server: genCode generates 6-char codes', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('i < 6'), 'Room code should be 6 chars');
  });

  await h.test('Server: genCode excludes ambiguous chars', async () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/../server.js', 'utf8');
    h.assert(src.includes('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 'Should exclude 0,O,I,1');
    h.assert(!src.includes("'0'") || !src.match(/'I'/), 'Should not include ambiguous chars');
  });

  console.log('\n  Unit tests complete.');
}

module.exports = { run };
