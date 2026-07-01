const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'memorycup.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    flag_code TEXT NOT NULL DEFAULT 'br',
    role TEXT NOT NULL DEFAULT 'player',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    duration INTEGER NOT NULL DEFAULT 0,
    room_code TEXT,
    players_json TEXT NOT NULL,
    winner_name TEXT,
    deck_counts_json TEXT NOT NULL,
    stats_json TEXT NOT NULL,
    quiz_first_try_json TEXT NOT NULL
  );
`);

const stmts = {
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  createUser: db.prepare(`
    INSERT INTO users (username, password_hash, display_name, flag_code, role)
    VALUES (@username, @password_hash, @display_name, @flag_code, @role)
  `),
  updateUser: db.prepare(`
    UPDATE users SET
      display_name = @display_name,
      flag_code = @flag_code,
      password_hash = CASE WHEN @password_hash IS NOT NULL THEN @password_hash ELSE password_hash END,
      role = @role
    WHERE id = @id
  `),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  allUsers: db.prepare('SELECT id, username, display_name, flag_code, role, created_at, last_seen FROM users ORDER BY id'),
  updateLastSeen: db.prepare('UPDATE users SET last_seen = datetime(\'now\') WHERE id = ?'),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),

  createSession: db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
  getSession: db.prepare(`
    SELECT s.token, s.expires_at, u.* FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  cleanExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at < datetime(\'now\')'),

  insertMatch: db.prepare(`
    INSERT INTO matches (date, duration, room_code, players_json, winner_name, deck_counts_json, stats_json, quiz_first_try_json)
    VALUES (@date, @duration, @room_code, @players_json, @winner_name, @deck_counts_json, @stats_json, @quiz_first_try_json)
  `),
  allMatches: db.prepare('SELECT * FROM matches ORDER BY id DESC LIMIT 200'),

  ranking: db.prepare(`
    SELECT
      winner_name AS displayName,
      COUNT(*) AS wins,
      SUM(CASE WHEN stats_json LIKE '%"firstTryCorrect"%' THEN 1 ELSE 0 END) AS bestQuizzes
    FROM matches
    WHERE winner_name IS NOT NULL AND winner_name != ''
    GROUP BY winner_name
    ORDER BY wins DESC, bestQuizzes DESC
    LIMIT 50
  `),

  totalMatches: db.prepare('SELECT COUNT(*) AS total FROM matches')
};

module.exports = { db, stmts };
