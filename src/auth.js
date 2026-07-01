const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { stmts } = require('./db');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    flagCode: row.flag_code,
    role: row.role,
    createdAt: row.created_at,
    lastSeen: row.last_seen
  };
}

function register({ username, password, displayName, flagCode, adminCode }) {
  if (!username || !password || !displayName) {
    throw new Error('Preencha todos os campos obrigatórios.');
  }
  if (username.length < 3) {
    throw new Error('O usuário deve ter pelo menos 3 caracteres.');
  }
  if (password.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }
  if (displayName.length > 15) {
    throw new Error('O nome de exibição deve ter no máximo 15 caracteres.');
  }

  const existing = stmts.getUserByUsername.get(username.toLowerCase());
  if (existing) {
    throw new Error('Este usuário já está cadastrado.');
  }

  const hash = bcrypt.hashSync(password, 10);
  const safeFlag = flagCode || 'br';

  let role = 'player';
  if (adminCode && adminCode === process.env.ADMIN_CODE) {
    role = 'admin';
  }

  const result = stmts.createUser.run({
    username: username.toLowerCase(),
    password_hash: hash,
    display_name: displayName,
    flag_code: safeFlag,
    role: role
  });

  const user = stmts.getUserById.get(result.lastInsertRowid);
  const token = createSession(user.id);
  return { user: publicUser(user), token };
}

function login(username, password) {
  if (!username || !password) {
    throw new Error('Usuário e senha são obrigatórios.');
  }
  const user = stmts.getUserByUsername.get(username.toLowerCase());
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    throw new Error('Senha incorreta.');
  }
  const token = createSession(user.id);
  return { user: publicUser(user), token };
}

function createSession(userId) {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_DURATION).toISOString();
  stmts.createSession.run(token, userId, expires);
  return token;
}

function getSessionUser(req) {
  const token = req.cookies && req.cookies.auth_token;
  if (!token) return null;
  const row = stmts.getSession.get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    stmts.deleteSession.run(token);
    return null;
  }
  return publicUser(row);
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  req.user = user;
  stmts.updateLastSeen.run(user.id);
  next();
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  req.user = user;
  next();
}

function logout(token) {
  if (token) stmts.deleteSession.run(token);
}

function becomeAdmin(userId, adminCode) {
  const expected = process.env.ADMIN_CODE;
  if (!expected || adminCode !== expected) {
    throw new Error('Código de administrador incorreto.');
  }
  stmts.setRole.run('admin', userId);
  return stmts.getUserById.get(userId);
}

module.exports = {
  register,
  login,
  logout,
  createSession,
  getSessionUser,
  requireAuth,
  requireAdmin,
  becomeAdmin,
  publicUser
};
