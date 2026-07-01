require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { getTrivia } = require('./data/trivia.js');
const { stmts } = require('./src/db');
const routes = require('./src/routes');

const TEAMS = [
  { code: 'us', name: 'Estados Unidos' },
  { code: 'mx', name: 'México' },
  { code: 'ca', name: 'Canadá' },
  { code: 'br', name: 'Brasil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'uy', name: 'Uruguai' },
  { code: 'co', name: 'Colômbia' },
  { code: 'ec', name: 'Equador' },
  { code: 'py', name: 'Paraguai' },
  { code: 'pt', name: 'Portugal' },
  { code: 'es', name: 'Espanha' },
  { code: 'fr', name: 'França' },
  { code: 'de', name: 'Alemanha' },
  { code: 'it', name: 'Itália' },
  { code: 'gb-eng', name: 'Inglaterra' },
  { code: 'nl', name: 'Holanda' },
  { code: 'be', name: 'Bélgica' },
  { code: 'hr', name: 'Croácia' },
  { code: 'ch', name: 'Suíça' },
  { code: 'at', name: 'Áustria' },
  { code: 'no', name: 'Noruega' },
  { code: 'gb-sct', name: 'Escócia' },
  { code: 'ba', name: 'Bósnia e Herzegovina' },
  { code: 'cz', name: 'República Tcheca' },
  { code: 'tr', name: 'Turquia' },
  { code: 'se', name: 'Suécia' },
  { code: 'jp', name: 'Japão' },
  { code: 'kr', name: 'Coreia do Sul' },
  { code: 'au', name: 'Austrália' },
  { code: 'ir', name: 'Irã' },
  { code: 'sa', name: 'Arábia Saudita' },
  { code: 'qa', name: 'Catar' },
  { code: 'jo', name: 'Jordânia' },
  { code: 'uz', name: 'Uzbequistão' },
  { code: 'ma', name: 'Marrocos' },
  { code: 'sn', name: 'Senegal' },
  { code: 'eg', name: 'Egito' },
  { code: 'tn', name: 'Tunísia' },
  { code: 'gh', name: 'Gana' },
  { code: 'ci', name: 'Costa do Marfim' },
  { code: 'cv', name: 'Cabo Verde' },
  { code: 'za', name: 'África do Sul' },
  { code: 'cd', name: 'RD Congo' },
  { code: 'nz', name: 'Nova Zelândia' },
  { code: 'ht', name: 'Haiti' },
  { code: 'cw', name: 'Curaçao' },
  { code: 'pa', name: 'Panamá' },
  { code: 'cr', name: 'Costa Rica' }
];

const COUNTRY_NAMES = TEAMS.reduce((acc, t) => { acc[t.code] = t.name; return acc; }, {});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TURN_TIME = 30;
const VALIDATION_TIME = 30;
const RECONNECT_WINDOW = 60000;
const MAX_PLAYERS = 4;
const PREVIEW_WARN = 5;
const PREVIEW_SHOW = 10;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);

const rooms = new Map();
const playerRooms = new Map();
const onlineUsers = new Map();

function createStats(count) {
  return {
    totalFlips: new Array(count).fill(0),
    pairsAttempted: new Array(count).fill(0),
    pairsMatched: new Array(count).fill(0),
    quizAttempts: new Array(count).fill(0),
    quizCorrect: new Array(count).fill(0),
    turnTimeouts: new Array(count).fill(0),
    validationTimeouts: new Array(count).fill(0)
  };
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? genCode() : code;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards() {
  const deck = [];
  TEAMS.forEach(t => {
    deck.push({ code: t.code, name: t.name });
    deck.push({ code: t.code, name: t.name });
  });
  return shuffle(deck);
}

function createRoom(playerName, flagCode, maxPlayers) {
  const code = genCode();
  const max = Math.min(Math.max(maxPlayers || 2, 2), MAX_PLAYERS);
  const room = {
    code,
    maxPlayers: max,
    players: [{ id: null, name: playerName, flagCode, deck: [], quizCorrectFirstTry: 0, connected: true }],
    cards: buildCards(),
    board: new Array(96).fill('hidden'),
    flipped: [],
    pendingValidation: null,
    currentTurn: 0,
    turnTimer: null,
    turnTimeLeft: TURN_TIME,
    validationTimer: null,
    validationTimeLeft: VALIDATION_TIME,
    active: false,
    scores: [0],
    reconnectTimers: {},
    stats: createStats(max),
    startTime: null,
    isPublic: false,
    previewCards: false,
    previewDone: false,
    pairResolveTimer: null,
    previewTimers: []
  };
  rooms.set(code, room);
  return room;
}

function clearTimers(room) {
  if (room.turnTimer) { clearInterval(room.turnTimer); room.turnTimer = null; }
  if (room.validationTimer) { clearInterval(room.validationTimer); room.validationTimer = null; }
  if (room.pairResolveTimer) { clearTimeout(room.pairResolveTimer); room.pairResolveTimer = null; }
  if (room.previewTimers && room.previewTimers.length) {
    room.previewTimers.forEach(t => clearTimeout(t));
    room.previewTimers = [];
  }
}

function emitAll(room, event, payload) {
  room.players.forEach(p => {
    if (p && p.id) io.to(p.id).emit(event, payload);
  });
}

function activePlayerCount(room) {
  return room.players.filter(p => p !== null).length;
}

function nextActivePlayer(room, fromIndex) {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (room.players[idx] && room.players[idx].connected) return idx;
  }
  // Check if current player is still valid
  if (room.players[fromIndex] && room.players[fromIndex].connected) return fromIndex;
  return -1; // No active player found
}

function hasEnoughActivePlayers(room) {
  return room.players.filter(p => p && p.connected).length >= 2;
}

function startTurnTimer(room) {
  if (room.turnTimer) clearInterval(room.turnTimer);
  room.turnTimeLeft = TURN_TIME;
  emitAll(room, 'turn_timer', { remaining: room.turnTimeLeft });
  room.turnTimer = setInterval(() => {
    room.turnTimeLeft--;
    emitAll(room, 'turn_timer', { remaining: room.turnTimeLeft });
    if (room.turnTimeLeft <= 0) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
      room.stats.turnTimeouts[room.currentTurn]++;
      passTurn(room, 'timeout');
    }
  }, 1000);
}

function passTurn(room, reason) {
  clearTimers(room);
  if (room.flipped.length > 0) {
    const indices = room.flipped.slice();
    indices.forEach(i => { room.board[i] = 'hidden'; });
    emitAll(room, 'cards_returned', { indices, reason: 'turn_pass' });
  }
  room.flipped = [];
  room.pendingValidation = null;
  room.currentTurn = nextActivePlayer(room, room.currentTurn);
  if (room.currentTurn === -1 || !hasEnoughActivePlayers(room)) {
    room.active = false;
    clearTimers(room);
    emitAll(room, 'room_error', { message: 'Jogadores insuficientes. A partida foi encerrada.' });
    rooms.delete(room.code);
    return;
  }
  emitAll(room, 'turn_changed', { currentTurn: room.currentTurn, reason });
  if (room.active) startTurnTimer(room);
}

function passTurnSkipDisconnected(room, reason) {
  clearTimers(room);
  if (room.flipped.length > 0) {
    const indices = room.flipped.slice();
    indices.forEach(i => { room.board[i] = 'hidden'; });
    emitAll(room, 'cards_returned', { indices, reason: 'turn_pass' });
  }
  room.flipped = [];
  room.pendingValidation = null;
  const next = nextActivePlayer(room, room.currentTurn);
  if (next === -1) {
    // No active player at all - pause game, wait for reconnect
    return;
  }
  room.currentTurn = next;
  emitAll(room, 'turn_changed', { currentTurn: room.currentTurn, reason });
  if (room.active) startTurnTimer(room);
}

function startValidationTimer(room) {
  if (room.validationTimer) clearInterval(room.validationTimer);
  room.validationTimeLeft = VALIDATION_TIME;
  emitAll(room, 'validation_timer', { remaining: room.validationTimeLeft });
  room.validationTimer = setInterval(() => {
    room.validationTimeLeft--;
    emitAll(room, 'validation_timer', { remaining: room.validationTimeLeft });
    if (room.validationTimeLeft <= 0) {
      clearInterval(room.validationTimer);
      room.validationTimer = null;
      failValidation(room, 'timeout');
    }
  }, 1000);
}

function failValidation(room, reason) {
  clearTimers(room);
  const indices = room.pendingValidation ? room.pendingValidation.indices : [];
  if (reason === 'timeout') room.stats.validationTimeouts[room.currentTurn]++;
  room.pendingValidation = null;
  room.flipped = [];
  emitAll(room, 'validation_result', { truthCorrect: false, success: false });
  emitAll(room, 'cards_returned', { indices, reason });
  room.currentTurn = nextActivePlayer(room, room.currentTurn);
  if (room.currentTurn === -1 || !hasEnoughActivePlayers(room)) {
    room.active = false;
    clearTimers(room);
    emitAll(room, 'room_error', { message: 'Jogadores insuficientes. A partida foi encerrada.' });
    rooms.delete(room.code);
    return;
  }
  emitAll(room, 'turn_changed', { currentTurn: room.currentTurn, reason });
  if (room.active) startTurnTimer(room);
}

function checkGameOver(room) {
  const totalCollected = room.board.filter(s => s === 'collected').length / 2;
  if (totalCollected < 48) return false;

  clearTimers(room);
  room.active = false;

  const deckCounts = room.players.map(p => p ? p.deck.length / 2 : 0);
  let maxDeck = Math.max(...deckCounts);
  let winners = [];
  room.players.forEach((p, i) => {
    if (p && deckCounts[i] === maxDeck) winners.push(i);
  });

  let winner = null;
  let winnerName = null;
  let winnerFlagCode = null;
  if (winners.length === 1) {
    winner = winners[0];
    winnerName = room.players[winner].name;
    winnerFlagCode = room.players[winner].flagCode;
  } else {
    const firstTry = room.players.map(p => p ? p.quizCorrectFirstTry : 0);
    let maxFT = Math.max(...winners.map(i => firstTry[i]));
    let tieBreak = winners.filter(i => firstTry[i] === maxFT);
    if (tieBreak.length === 1) {
      winner = tieBreak[0];
      winnerName = room.players[winner].name;
      winnerFlagCode = room.players[winner].flagCode;
    }
  }

  emitAll(room, 'game_over', {
    winner,
    winnerName,
    winnerFlagCode,
    deckCounts,
    scores: room.scores,
    quizFirstTry: room.players.map(p => p ? p.quizCorrectFirstTry : 0)
  });

  const duration = room.startTime ? Math.round((Date.now() - room.startTime) / 1000) : 0;
  const playersData = room.players.filter(p => p).map(p => ({
    name: p.name,
    flagCode: p.flagCode
  }));

  try {
    stmts.insertMatch.run({
      date: new Date().toISOString(),
      duration,
      room_code: room.code,
      players_json: JSON.stringify(playersData),
      winner_name: winnerName,
      deck_counts_json: JSON.stringify(deckCounts),
      stats_json: JSON.stringify(room.stats),
      quiz_first_try_json: JSON.stringify(room.players.map(p => p ? p.quizCorrectFirstTry : 0))
    });
  } catch (e) {
    console.error('Erro ao salvar partida:', e.message);
  }

  return true;
}

function resetRoomForNewGame(room) {
  room.cards = buildCards();
  room.board = new Array(96).fill('hidden');
  room.flipped = [];
  room.pendingValidation = null;
  room.currentTurn = 0;
  room.scores = room.players.map(() => 0);
  room.players.forEach(p => {
    if (p) { p.deck = []; p.quizCorrectFirstTry = 0; }
  });
  room.active = true;
  room.stats = createStats(room.maxPlayers);
  room.startTime = Date.now();
}

function getRoomState(room, playerIndex) {
  const collected = [];
  room.players.forEach((p, i) => {
    if (p) {
      for (let j = 0; j < p.deck.length; j += 2) {
        collected.push({ playerIndex: i, flagCode: p.deck[j].code, countryName: p.deck[j].name });
      }
    }
  });

  const revealedCards = {};
  room.flipped.forEach(i => {
    if (room.cards[i]) revealedCards[i] = { flagCode: room.cards[i].code, countryName: room.cards[i].name };
  });
  room.board.forEach((s, i) => {
    if (s === 'collected' && room.cards[i]) {
      revealedCards[i] = { flagCode: room.cards[i].code, countryName: room.cards[i].name };
    }
  });

  return {
    code: room.code,
    playerIndex,
    board: room.board,
    revealedCards,
    flipped: room.flipped,
    currentTurn: room.currentTurn,
    scores: room.scores,
    active: room.active,
    maxPlayers: room.maxPlayers,
    players: room.players.map(p => p ? {
      name: p.name,
      flagCode: p.flagCode,
      deckCount: p.deck.length / 2,
      connected: p.connected
    } : null),
    collectedFlags: collected
  };
}

function emitLobbyUpdate(room) {
  emitAll(room, 'lobby_update', {
    players: room.players.map(p => p ? {
      name: p.name, flagCode: p.flagCode, connected: p.connected
    } : null),
    maxPlayers: room.maxPlayers,
    code: room.code
  });
}

function emitOnlineStatus() {
  const userIds = Array.from(onlineUsers.values()).filter(v => v.userId);
  const uniqueIds = [...new Set(userIds)];
  io.emit('online_users', { count: uniqueIds.length });
}

io.on('connection', (socket) => {
  playerRooms.set(socket.id, null);

  socket.on('identify', ({ userId }) => {
    if (userId) {
      onlineUsers.set(socket.id, { userId });
      try { stmts.updateLastSeen.run(userId); } catch (e) {}
      emitOnlineStatus();
    }
  });

  socket.on('create_room', ({ name, flagCode, maxPlayers, previewCards }) => {
    if (!name || !flagCode) {
      socket.emit('room_error', { message: 'Nome e bandeira são obrigatórios.' });
      return;
    }
    const existing = Array.from(rooms.values()).find(r =>
      r.players.some(p => p && p.id === socket.id)
    );
    if (existing) {
      socket.emit('room_error', { message: 'Você já está em uma sala.' });
      return;
    }
    const room = createRoom(name, flagCode, maxPlayers);
    room.previewCards = !!previewCards;
    room.players[0].id = socket.id;
    playerRooms.set(socket.id, { code: room.code, index: 0 });
    socket.join(room.code);
    socket.emit('room_created', { code: room.code, playerIndex: 0, maxPlayers: room.maxPlayers });
    emitLobbyUpdate(room);
  });

  socket.on('join_room', ({ name, flagCode, code }) => {
    if (!name || !flagCode || !code) {
      socket.emit('room_error', { message: 'Nome, bandeira e código são obrigatórios.' });
      return;
    }
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('room_error', { message: 'Sala não encontrada.' });
      return;
    }
    if (room.active) {
      socket.emit('room_error', { message: 'Partida em andamento.' });
      return;
    }
    if (activePlayerCount(room) >= room.maxPlayers) {
      socket.emit('room_error', { message: 'Sala cheia.' });
      return;
    }

    const idx = room.players.push({ id: socket.id, name, flagCode, deck: [], quizCorrectFirstTry: 0, connected: true }) - 1;
    while (room.scores.length < room.players.length) room.scores.push(0);
    playerRooms.set(socket.id, { code: room.code, index: idx });
    socket.join(room.code);
    socket.emit('room_joined', { code: room.code, playerIndex: idx });
    emitLobbyUpdate(room);
  });

  socket.on('start_game', () => {
    const info = playerRooms.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || room.active) return;
    if (activePlayerCount(room) < 2) {
      socket.emit('room_error', { message: 'Mínimo de 2 jogadores.' });
      return;
    }
    const realPlayers = room.players.filter(p => p !== null);
    room.players = realPlayers;
    room.scores = room.players.map(() => 0);
    room.stats = createStats(room.players.length);
    room.maxPlayers = room.players.length;
    room.reconnectTimers = {};

    // Fix playerRooms indices for all sockets in this room
    room.players.forEach((p, i) => {
      if (p && p.id) {
        playerRooms.set(p.id, { code: room.code, index: i });
      }
    });

    resetRoomForNewGame(room);

    if (room.previewCards && !room.previewDone) {
      doCardPreview(room);
    } else {
      beginGame(room);
    }
  });

  function doCardPreview(room) {
    const allCards = {};
    for (let i = 0; i < 96; i++) {
      allCards[i] = { flagCode: room.cards[i].code, countryName: room.cards[i].name };
    }
    emitAll(room, 'preview_warning', { seconds: PREVIEW_WARN, cards: allCards });
    const t1 = setTimeout(() => {
      if (!rooms.has(room.code)) return;
      emitAll(room, 'preview_reveal', { seconds: PREVIEW_SHOW });
      const t2 = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        emitAll(room, 'preview_done', {});
        room.previewDone = true;
        beginGame(room);
      }, PREVIEW_SHOW * 1000);
      room.previewTimers.push(t2);
    }, PREVIEW_WARN * 1000);
    room.previewTimers.push(t1);
  }

  function beginGame(room) {
    emitAll(room, 'game_start', {
      players: room.players.map(p => ({ name: p.name, flagCode: p.flagCode, connected: p.connected })),
      currentTurn: 0,
      scores: room.scores,
      maxPlayers: room.maxPlayers
    });
    startTurnTimer(room);
  }

  socket.on('flip_card', ({ cardIndex }) => {
    const info = playerRooms.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || !room.active) return;
    if (room.currentTurn !== info.index) return;
    if (room.pendingValidation) return;
    if (cardIndex < 0 || cardIndex > 95) return;
    if (room.board[cardIndex] !== 'hidden') return;
    if (room.flipped.length >= 2) return;

    room.flipped.push(cardIndex);
    room.board[cardIndex] = 'flipped';
    room.stats.totalFlips[info.index]++;
    const card = room.cards[cardIndex];
    emitAll(room, 'card_flipped', {
      cardIndex,
      flagCode: card.code,
      countryName: card.name,
      playerIndex: info.index
    });

    if (room.flipped.length === 2) {
      if (room.turnTimer) { clearInterval(room.turnTimer); room.turnTimer = null; }
      const [a, b] = room.flipped;
      const ca = room.cards[a];
      const cb = room.cards[b];
      room.stats.pairsAttempted[info.index]++;

      if (ca.code !== cb.code) {
        room.pairResolveTimer = setTimeout(() => {
          room.pairResolveTimer = null;
          if (!rooms.has(room.code) || !room.active) return;
          room.board[a] = 'hidden';
          room.board[b] = 'hidden';
          room.flipped = [];
          emitAll(room, 'cards_returned', { indices: [a, b], reason: 'wrong_pair' });
          room.currentTurn = nextActivePlayer(room, room.currentTurn);
          if (room.currentTurn === -1 || !hasEnoughActivePlayers(room)) {
            room.active = false;
            clearTimers(room);
            emitAll(room, 'room_error', { message: 'Jogadores insuficientes. A partida foi encerrada.' });
            rooms.delete(room.code);
            return;
          }
          emitAll(room, 'turn_changed', { currentTurn: room.currentTurn, reason: 'wrong_pair' });
          if (room.active) startTurnTimer(room);
        }, 1800);
      } else {
        const trivia = getTrivia(ca.code);
        room.pendingValidation = {
          indices: [a, b],
          countryName: ca.name,
          flagCode: ca.code,
          trivia,
          firstAttempt: true
        };
        emitAll(room, 'pair_found_pending_validation', {
          indices: [a, b],
          countryName: ca.name,
          flagCode: ca.code,
          trueFalseStatement: trivia.statement
        });
        startValidationTimer(room);
      }
    }
  });

  socket.on('submit_validation', ({ truthAnswer }) => {
    const info = playerRooms.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || !room.active || !room.pendingValidation) return;
    if (room.currentTurn !== info.index) return;

    const pv = room.pendingValidation;
    const truthCorrect = String(truthAnswer) === String(pv.trivia.answer);
    room.stats.quizAttempts[info.index]++;

    if (truthCorrect) {
      if (room.validationTimer) { clearInterval(room.validationTimer); room.validationTimer = null; }
      const player = room.players[info.index];
      pv.indices.forEach(i => {
        room.board[i] = 'collected';
        player.deck.push(room.cards[i]);
      });
      room.scores[info.index]++;
      room.stats.pairsMatched[info.index]++;
      room.stats.quizCorrect[info.index]++;
      if (pv.firstAttempt) player.quizCorrectFirstTry++;
      room.pendingValidation = null;
      room.flipped = [];

      emitAll(room, 'validation_result', { truthCorrect: true, success: true });
      emitAll(room, 'cards_to_deck', {
        indices: pv.indices,
        playerIndex: info.index,
        deckCount: player.deck.length / 2,
        flagCode: pv.flagCode,
        countryName: pv.countryName
      });

      if (checkGameOver(room)) return;
      if (room.active) startTurnTimer(room);
    } else {
      if (room.validationTimer) { clearInterval(room.validationTimer); room.validationTimer = null; }
      emitAll(room, 'validation_result', { truthCorrect: false, success: false });
      pv.indices.forEach(i => { room.board[i] = 'hidden'; });
      room.flipped = [];
      room.pendingValidation = null;
      emitAll(room, 'cards_returned', { indices: pv.indices, reason: 'validation_failed' });
      room.currentTurn = nextActivePlayer(room, room.currentTurn);
      if (room.currentTurn === -1 || !hasEnoughActivePlayers(room)) {
        room.active = false;
        clearTimers(room);
        emitAll(room, 'room_error', { message: 'Jogadores insuficientes. A partida foi encerrada.' });
        rooms.delete(room.code);
        return;
      }
      emitAll(room, 'turn_changed', { currentTurn: room.currentTurn, reason: 'validation_failed' });
      if (room.active) startTurnTimer(room);
    }
  });

  socket.on('play_again', () => {
    const info = playerRooms.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;
    const realPlayers = room.players.filter(p => p !== null);
    if (realPlayers.length < 2) return;
    clearTimers(room);
    room.players = realPlayers;
    room.maxPlayers = realPlayers.length;
    room.reconnectTimers = {};

    // Fix playerRooms indices for all sockets in this room
    room.players.forEach((p, i) => {
      if (p && p.id) {
        playerRooms.set(p.id, { code: room.code, index: i });
      }
    });

    resetRoomForNewGame(room);
    emitAll(room, 'game_start', {
      players: room.players.map(p => ({ name: p.name, flagCode: p.flagCode, connected: p.connected })),
      currentTurn: 0,
      scores: room.scores,
      maxPlayers: room.maxPlayers
    });
    startTurnTimer(room);
  });

  socket.on('leave_room', () => {
    const info = playerRooms.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (room) {
      if (room.players[info.index]) {
        room.players[info.index] = null;
      }
      if (room.active) {
        const remaining = room.players.filter(p => p !== null && p.connected);
        if (remaining.length < 2) {
          clearTimers(room);
          room.active = false;
          emitAll(room, 'room_error', { message: 'Jogador insuficiente. A partida foi encerrada.' });
          rooms.delete(info.code);
        }
      } else {
        emitLobbyUpdate(room);
      }
    }
    playerRooms.set(socket.id, null);
  });

  socket.on('reconnect_room', ({ code, playerName, playerIndex }) => {
    const room = rooms.get(String(code).toUpperCase());
    if (!room) {
      socket.emit('room_error', { message: 'Sala não existe mais.' });
      return;
    }
    const idx = Number(playerIndex);
    const slot = room.players[idx];
    if (!slot || slot.name !== playerName) {
      socket.emit('room_error', { message: 'Não foi possível reconectar.' });
      return;
    }
    // BUG #5 fix: Clean up old socket's playerRooms entry if it still exists
    if (slot.id && playerRooms.has(slot.id)) {
      playerRooms.set(slot.id, null);
    }
    // Clear reconnect timer
    if (room.reconnectTimers[idx]) {
      clearTimeout(room.reconnectTimers[idx]);
      room.reconnectTimers[idx] = null;
    }
    room.players[idx].id = socket.id;
    room.players[idx].connected = true;
    playerRooms.set(socket.id, { code: room.code, index: idx });
    socket.join(room.code);

    socket.emit('reconnect_state', getRoomState(room, idx));

    if (room.active && room.currentTurn === idx) {
      socket.emit('turn_timer', { remaining: room.turnTimeLeft });
    }
    if (room.pendingValidation) {
      socket.emit('pair_found_pending_validation', {
        indices: room.pendingValidation.indices,
        countryName: room.pendingValidation.countryName,
        flagCode: room.pendingValidation.flagCode,
        trueFalseStatement: room.pendingValidation.trivia.statement
      });
      socket.emit('validation_timer', { remaining: room.validationTimeLeft });
    }

    emitAll(room, 'player_status', {
      players: room.players.map(p => p ? {
        name: p.name, flagCode: p.flagCode, connected: p.connected,
        deckCount: p.deck.length / 2
      } : null)
    });
  });

  socket.on('disconnect', () => {
    const info = playerRooms.get(socket.id);
    playerRooms.delete(socket.id);
    onlineUsers.delete(socket.id);
    emitOnlineStatus();

    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;
    const idx = info.index;
    if (room.players[idx]) {
      const leftName = room.players[idx].name;
      room.players[idx].connected = false;
      room.players[idx].id = null;

      emitAll(room, 'player_status', {
        players: room.players.map(p => p ? {
          name: p.name, flagCode: p.flagCode, connected: p.connected,
          deckCount: p.deck.length / 2
        } : null)
      });

      emitAll(room, 'player_left', { name: leftName });

      if (room.active && room.currentTurn === idx) {
        passTurnSkipDisconnected(room, 'player_disconnected');
      }
    }
    if (room.reconnectTimers[idx]) clearTimeout(room.reconnectTimers[idx]);
    const roomCode = room.code;
    const roomIdx = idx;
    room.reconnectTimers[idx] = setTimeout(() => {
      const r = rooms.get(roomCode);
      if (!r) return;
      const stillMissing = r.players[roomIdx] && !r.players[roomIdx].connected;
      if (stillMissing) {
        r.players[roomIdx] = null;
        if (r.active) {
          const remaining = r.players.filter(p => p !== null && p.connected);
          if (remaining.length < 2) {
            clearTimers(r);
            r.active = false;
            emitAll(r, 'room_error', { message: 'Jogadores insuficientes. A partida foi encerrada.' });
            rooms.delete(roomCode);
          }
        } else {
          const anyLeft = r.players.some(p => p !== null);
          if (!anyLeft) {
            rooms.delete(roomCode);
          } else {
            emitLobbyUpdate(r);
          }
        }
      }
    }, RECONNECT_WINDOW);
  });
});

server.listen(PORT, () => {
  console.log(`Memory Cup 2026 rodando na porta ${PORT}`);
});
