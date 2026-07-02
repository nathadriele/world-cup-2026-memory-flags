const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, stmts } = require('./db');
const auth = require('./auth');

const router = express.Router();

router.use((req, res, next) => {
  req.user = auth.getSessionUser(req);
  res.locals.user = req.user;
  next();
});

function sendJsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

router.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, displayName, flagCode, adminCode } = req.body;
    const result = auth.register({ username, password, displayName, flagCode, adminCode });
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    res.json({ user: result.user });
  } catch (e) {
    sendJsonError(res, 400, e.message);
  }
});

router.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const result = auth.login(username, password);
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
    res.json({ user: result.user });
  } catch (e) {
    sendJsonError(res, 401, e.message);
  }
});

router.post('/api/auth/logout', (req, res) => {
  const token = req.cookies && req.cookies.auth_token;
  auth.logout(token);
  res.clearCookie('auth_token');
  res.json({ ok: true });
});

router.get('/api/auth/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Não autenticado.' });
  }
});

router.post('/api/auth/become-admin', auth.requireAuth, (req, res) => {
  try {
    const { adminCode } = req.body;
    const updated = auth.becomeAdmin(req.user.id, adminCode);
    res.json({ user: auth.publicUser(updated) });
  } catch (e) {
    sendJsonError(res, 403, e.message);
  }
});

router.get('/api/users/online', (req, res) => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const users = db.prepare(`
    SELECT id, username, display_name, flag_code, role, last_seen FROM users
    WHERE last_seen IS NOT NULL AND last_seen > ?
    ORDER BY display_name
  `).all(fiveMinAgo);
  res.json({ users });
});

router.get('/api/matches', (req, res) => {
  const rows = stmts.allMatches.all();
  const matches = rows.map(r => ({
    id: r.id,
    date: r.date,
    duration: r.duration,
    roomCode: r.room_code,
    players: JSON.parse(r.players_json),
    winnerName: r.winner_name,
    deckCounts: JSON.parse(r.deck_counts_json),
    stats: JSON.parse(r.stats_json),
    quizFirstTry: JSON.parse(r.quiz_first_try_json)
  }));
  res.json(matches);
});

router.get('/api/ranking', (req, res) => {
  const rows = stmts.ranking.all();
  const totalMatches = stmts.totalMatches.get().total;
  const userMap = {};
  db.prepare('SELECT display_name, flag_code FROM users').all().forEach(u => {
    userMap[u.display_name] = u.flag_code;
  });
  const ranking = rows.map((r, i) => ({
    position: i + 1,
    displayName: r.displayName,
    wins: r.wins,
    bestQuizzes: r.bestQuizzes || 0,
    flagCode: userMap[r.displayName] || 'br'
  }));
  res.json({ ranking, totalMatches });
});

router.get('/api/admin/users', auth.requireAdmin, (req, res) => {
  const users = stmts.allUsers.all();
  res.json({ users });
});

router.post('/api/admin/users', auth.requireAdmin, (req, res) => {
  try {
    const { username, password, displayName, flagCode, role } = req.body;
    if (!username || !password || !displayName) {
      return sendJsonError(res, 400, 'Preencha todos os campos obrigatórios.');
    }
    const existing = stmts.getUserByUsername.get(username.toLowerCase());
    if (existing) {
      return sendJsonError(res, 400, 'Este usuário já está cadastrado.');
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = stmts.createUser.run({
      username: username.toLowerCase(),
      password_hash: hash,
      display_name: displayName,
      flag_code: flagCode || 'br',
      role: role || 'player'
    });
    const user = stmts.getUserById.get(result.lastInsertRowid);
    res.json({ user: auth.publicUser(user) });
  } catch (e) {
    sendJsonError(res, 400, e.message);
  }
});

router.put('/api/admin/users/:id', auth.requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = stmts.getUserById.get(id);
    if (!user) return sendJsonError(res, 404, 'Usuário não encontrado.');
    const { displayName, flagCode, role, password } = req.body;
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    stmts.updateUser.run({
      id,
      display_name: displayName || user.display_name,
      flag_code: flagCode || user.flag_code,
      role: role || user.role,
      password_hash: hash
    });
    const updated = stmts.getUserById.get(id);
    res.json({ user: auth.publicUser(updated) });
  } catch (e) {
    sendJsonError(res, 400, e.message);
  }
});

router.delete('/api/admin/users/:id', auth.requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return sendJsonError(res, 400, 'Você não pode excluir sua própria conta.');
    }
    const user = stmts.getUserById.get(id);
    if (!user) return sendJsonError(res, 404, 'Usuário não encontrado.');
    stmts.deleteUser.run(id);
    res.json({ ok: true });
  } catch (e) {
    sendJsonError(res, 400, e.message);
  }
});

function protectPage(req, res, next) {
  if (!req.user) {
    return res.redirect('/');
  }
  next();
}

router.get('/', (req, res) => {
  if (req.user) return res.redirect('/jogar');
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.get('/jogar', protectPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'jogar.html'));
});

router.get('/jogar/sala-:code', (req, res) => {
  // Rota da sala eh publica: o jogador pode acessar pelo link direto
  // Se nao estiver logado, a pagina de jogo redireciona para login
  res.sendFile(path.join(__dirname, '..', 'public', 'jogar.html'));
});

router.get('/dados', protectPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dados.html'));
});

router.get('/ajuda', protectPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'ajuda.html'));
});

router.get('/ranking', protectPage, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'ranking.html'));
});

router.get('/admin', auth.requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

module.exports = router;
