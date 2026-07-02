# Memory Cup 2026 - Test Suite

Suite de testes completa e abrangente para o jogo Memory Cup 2026.

## Estrutura

```
tests/
├── helpers.js              # Framework de testes (asserts, HTTP, Socket helpers)
├── run-all.js              # Runner principal (executa todas as suites)
├── README.md               # Esta documentação
│
├── 01-auth.test.js         # Autenticação (caixa-preta)
├── 02-routes.test.js       # Rotas HTTP (caixa-preta)
├── 03-rooms.test.js        # Salas e lobby (caixa-preta)
├── 04-game-flow.test.js    # Fluxo de jogo (caixa-preta)
├── 05-turn-rotation.test.js # Rotacao de turnos (caixa-preta)
├── 06-reveal-cards.test.js # Revelar cartas (caixa-preta)
├── 07-disconnect.test.js   # Desconexao e reconexao (caixa-preta)
├── 08-responsive.test.js   # Layout responsivo (caixa-preta)
│
├── 09-security.test.js     # Seguranca (SQL injection, XSS, auth bypass)
├── 10-game-logic.test.js   # Logica do jogo (caixa-branca)
├── 11-admin.test.js        # Painel administrativo
├── 12-edge-cases.test.js   # Casos extremos e boundaries
├── 13-unit.test.js         # Testes unitarios (funcoes isoladas)
├── 14-integration.test.js  # Testes de integracao (modulos combinados)
├── 15-api-routes.test.js   # API REST (todas as rotas HTTP)
├── 16-e2e.test.js          # End-to-end (fluxos completos)
├── 17-load.test.js         # Carga e stress
├── 18-exploratory.test.js  # Exploratorio (fuzzing, race conditions)
├── 19-regression.test.js   # Regressao (bugs corrigidos)
│
└── pytest/                 # Testes Python (pytest)
    ├── conftest.py          # Configuracao e fixtures
    ├── requirements.txt     # Dependencias Python
    ├── test_auth_api.py     # Auth API (Python)
    ├── test_game_api.py     # Game API endpoints (Python)
    └── test_security.py     # Seguranca (Python)
```

## Como Executar

### Node.js (todas as suites)

```bash
# Opcao 1: Servidor ja rodando
node server.js               # em outro terminal
node tests/run-all.js

# Opcao 2: Auto-start do servidor
node tests/run-all.js --start

# Opcao 3: Suite especifica
node tests/run-all.js --suite=09
```

### Python/pytest

```bash
# Instalar dependencias
pip install -r tests/pytest/requirements.txt

# Servidor deve estar rodando
node server.js

# Executar testes
cd tests/pytest
pytest -v
```

## Suites de Teste

### Suites Originais (01-08)

| Suite | Nome | Tipo | # Testes | Descricao |
|-------|------|------|----------|-----------|
| 01 | Authentication | Caixa-preta | ~15 | Registro, login, logout, sessoes, cookies |
| 02 | Routes | Caixa-preta | ~10 | Rotas HTML, redirects, protegidas |
| 03 | Rooms | Caixa-preta | ~12 | Criar, entrar, sair, codigos de sala |
| 04 | Game Flow | Caixa-preta | ~10 | Iniciar, jogar, terminar, pontuacao |
| 05 | Turn Rotation | Caixa-preta | ~8 | Rotacao entre jogadores, ordem |
| 06 | Reveal Cards | Caixa-preta | ~8 | Virar cartas, encontrar pares |
| 07 | Disconnect | Caixa-preta | ~10 | Desconexao, reconexao, timeout |
| 08 | Responsive | Caixa-preta | ~5 | Layout mobile, CSS, responsividade |

### Suites Avancadas (09-19)

| Suite | Nome | Tipo | # Testes | Descricao |
|-------|------|------|----------|-----------|
| 09 | Security | Seguranca | ~30 | SQL injection, XSS, auth bypass, input validation |
| 10 | Game Logic | Caixa-branca | ~25 | TEAMS/deck, trivia, turn rotation, pair validation |
| 11 | Admin | Funcional | ~25 | Access control, CRUD users, become-admin |
| 12 | Edge Cases | Boundary | ~25 | Limites de username/password/cardIndex, null/empty |
| 13 | Unit | Unitario | ~40 | normalizeText, getTrivia, DB, auth, constants |
| 14 | Integration | Integracao | ~15 | Auth+Socket, Room+Socket, match persistence |
| 15 | API Routes | API/HTTP | ~30 | Todas rotas REST, status codes, content-types |
| 16 | E2E | End-to-end | ~12 | Registro->sala->jogo->vitoria completo |
| 17 | Load | Carga/Stress | ~12 | Concurrencia, burst, multi-room, paralelismo |
| 18 | Exploratory | Fuzzing | ~18 | Random inputs, malformed payloads, race conditions |
| 19 | Regression | Regressao | ~20 | Bugs corrigidos: CORS, binding, timers, DB |

### Python/pytest

| Arquivo | # Testes | Descricao |
|---------|----------|-----------|
| conftest.py | - | Fixtures: registered_user, authed_session, admin_session |
| test_auth_api.py | ~20 | Registration, login, logout, auth/me |
| test_game_api.py | ~25 | Matches, ranking, users/online, page routes, static files |
| test_security.py | ~30 | SQL injection, XSS, auth bypass, password security |

## Cobertura de Testes

### Tipos de Teste

- **Caixa-preta**: Testam comportamento externo sem acessar codigo interno
- **Caixa-branca**: Testam logica interna, estruturas de dados, funcoes
- **Unitario**: Funcoes isoladas (normalizeText, getTrivia)
- **Integracao**: Multiplos modulos combinados
- **Funcional**: Funcionalidades completas de ponta a ponta
- **Seguranca**: Injecao, XSS, bypass de autenticacao
- **Carga/Stress**: Multiplas conexoes, eventos em rajada
- **Exploratorio**: Inputs aleatorios, casos extremos
- **Regressao**: Bugs anteriores verificados

### Cenarios Cobertos

**Autenticacao (15+ testes)**
- Registro com dados validos/invalidos
- Login com credenciais corretas/erradas
- Logout e invalidacao de sessao
- Validacao de cookies HttpOnly
- Deteccao de senha hasheada (nao exposta)

**Rotas HTTP (30+ testes)**
- Todas as rotas GET/POST testadas
- Status codes corretos (200, 302, 400, 401, 403, 404)
- Content-Type correto (JSON vs HTML)
- redirects para usuarios nao autenticados
- Static files servidos corretamente

**Logica do Jogo (25+ testes)**
- 48 paises no baralho, 96 cartas
- Sistema de trivia (verdadeiro/falso)
- Rotacao de turnos entre jogadores
- Validacao de pares encontrados
- Estado do jogo (board, flipped, scores)
- Preview mode (3 segundos no inicio)

**Seguranca (30+ testes)**
- SQL injection em username/login
- XSS em displayName
- Auth bypass com tokens falsos
- Input validation rigorosa
- Password nunca exposta em respostas
- Casos insensitivos para usernames duplicados

**Edge Cases (25+ testes)**
- Boundary: username 3 chars (min), displayName 15 chars (max)
- Boundary: password 6 chars (min), maxPlayers 2-8
- Boundary: cardIndex 0-95
- Null/undefined/empty em todos os campos
- Tipos errados (string vs number)

**Carga (12+ testes)**
- 5 salas criadas concorrentemente
- 10 usuarios registrados em paralelo
- 8 sockets conectados simultaneamente
- 4 jogos rodando em paralelo
- 50 eventos flip_card em rajada

**Regressao (20+ testes)**
- Server binds 0.0.0.0 (nao localhost only)
- Socket.IO CORS configurado
- DB_PATH environment variable
- Card flip delay = 3800ms
- Reconnect window = 120000ms
- SQLite foreign keys ON
- WAL journal mode

## Helpers de Teste

O arquivo `helpers.js` prove:

```javascript
// HTTP
h.httpGet('/path')                    // GET request
h.httpReq('POST', '/path', data)      // POST/PUT/DELETE com body JSON
h.registerUser(username, display, flag) // Registra e retorna {cookie, user}
h.loginUser(username, password)       // Login e retorna cookie
h.logoutUser(cookie)                  // Logout
h.getMe(cookie)                       // GET /api/auth/me

// Assertions
h.assert(condition, message)
h.assertEqual(actual, expected, message)

// Socket.IO
h.createSocket(cookie)                // Cria cliente socket conectado
h.waitEvent(socket, eventName, timeout) // Aguarda evento
h.setupRoom(numPlayers, opts)         // Cria sala com N jogadores
h.cleanupSockets(sockets)             // Desconecta todos
```

## Estatisticas

- **Total de suites**: 19 Node.js + 3 Python = 22 suites
- **Total de testes**: ~350+ casos de teste
- **Tipos cobertos**: funcional, caixa-preta, caixa-branca, unitario, integracao, E2E, carga, exploratorio, regressao, seguranca, API
- **Cobertura de codigo**: server.js, routes.js, auth.js, db.js, trivia.js
