# Memory Cup 2026

Jogo da memoria multiplayer com as 48 selecoes da Copa do Mundo 2026, com quiz de validacao de pares e comemoracao de vitoria com taca animada.

**Stack:** Node.js 18+, Express 4.x, Socket.io 4.x, better-sqlite3, HTML5/CSS3/JS vanilla

## Funcionalidades

- **Multiplayer em tempo real** (2 a 8 jogadores) via Socket.IO com WebSocket + polling fallback
- **48 pares de bandeiras** (96 cartas) das selecoes da Copa 2026
- **Quiz de validacao:** ao formar um par, responda nome do pais + V/F de curiosidade
- **Sistema de turnos:** acertou o par e a validacao = joga novamente; errou = passa a vez
- **Ranking e estatisticas** de partidas e vitorias
- **Painel administrativo** com gerenciamento de usuarios
- **Design responsivo** para desktop e mobile
- **Reconexcao automatica** em caso de queda de conexao

## Como testar localmente

```bash
git clone <repo>
cd memory-flags-2026
npm install
node server.js
```

Abra duas abas (ou um navegador normal + um incognito) em http://localhost:3000

- Aba 1: registre-se, clique em "Criar Sala", copie o codigo.
- Aba 2: registre-se com outra conta, clique em "Entrar em Sala", cole o codigo.
- O jogo inicia quando o host quiser (botao "Iniciar Jogo").

Requer conexao com a internet mesmo localmente, pois as bandeiras sao carregadas via flagcdn.com.

## Suite de testes automatizados

O projeto possui 89 testes automatizados em 8 suites (100% de taxa de aprovacao):

```bash
node tests/run-all.js
```

**Suites:**

| Suite | Testes | Descricao |
|-------|--------|-----------|
| 01-auth | 12 | Registro, login, logout, cookies de sessao |
| 02-routes | 17 | Rotas, autorizacao, arquivos estaticos |
| 03-rooms | 11 | Criar/entrar/sair de salas, limite de jogadores |
| 04-gameflow | 12 | Inicio de jogo, flip de cartas, bloqueios |
| 05-turn-rotation | 8 | Rotacao sequencial de turnos (2-5 jogadores) |
| 06-reveal-cards | 7 | Modo espiar (peek), privacidade entre jogadores |
| 07-disconnect | 7 | Desconexao, reconexao, limpeza no servidor |
| 08-responsive | 15 | Viewport, CSS responsivo, assets, estrutura |

## Deploy no Render

### Opcao 1: Blueprint (recomendado)

1. Suba o codigo no GitHub
2. No Render, va em New > Blueprint e selecione o repo
3. O `render.yaml` configura tudo automaticamente

### Opcao 2: Manual

1. New Web Service > conecte o repo
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Plan: Free ou Starter

### Persistencia de dados (importante)

O Render **free tier** tem sistema de arquivos efemero: a cada deploy, os dados do SQLite sao apagados. Para manter as contas de usuario e historico de partidas:

**Solucao A - Render Persistent Disk (plano Starter $7/mes):**
- O `render.yaml` ja configura um disk de 1GB em `/var/data`
- A variavel de ambiente `DB_PATH=/var/data/memorycup.db` ja esta definida
- Basta fazer upgrade para o plano Starter e o disco e criado automaticamente

**Solucao B - Banco externo gratuito (Neon, Supabase):**
- Crie um PostgreSQL gratuito em neon.tech ou supabase.com
- Configure a string de conexao como variavel de ambiente no Render

### Variaveis de ambiente

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `PORT` | `3000` | Porta do servidor |
| `DB_PATH` | `data/memorycup.db` | Caminho do banco SQLite |
| `NODE_ENV` | - | `production` em deploy |

## Regras do jogo

- 48 pares de bandeiras (96 cartas)
- Login: nome de usuario + senha + bandeira do jogador
- 30 segundos por turno para virar a primeira carta
- Ao formar um par: pop-up de 10s com 2 perguntas (nome do pais + V/F de curiosidade)
- Acertar as duas: par vai pro seu deck, joga de novo
- Errar qualquer uma ou estourar o tempo: cartas voltam, passa a vez
- Vencedor: mais pares no deck; comemoracao com taca animada no tema da bandeira escolhida
- Suporte a 2-8 jogadores simultaneos por sala

## Estrutura do projeto

```
memory-flags-2026/
  server.js              # Servidor principal (Express + Socket.IO + logica do jogo)
  src/
    db.js                # Configuracao do banco SQLite (better-sqlite3)
    routes.js            # Rotas HTTP e middleware de autenticacao
  public/
    login.html           # Pagina de login/registro
    jogar.html           # Pagina do jogo (cliente Socket.IO)
    dados.html           # Pagina de estatisticas
    ranking.html         # Pagina de ranking
    ajuda.html           # Pagina de ajuda
    admin.html           # Painel administrativo
    shared.css           # CSS compartilhado (responsive)
    shared.js            # JS compartilhado (utilidades)
  data/
    trivia.js            # Banco de perguntas de trivia das selecoes
  tests/
    run-all.js           # Runner da suite de testes
    helpers.js           # Utilitarios de teste
    01-auth.test.js      # Suite: Autenticacao
    02-routes.test.js    # Suite: Rotas
    03-rooms.test.js     # Suite: Salas
    04-gameflow.test.js  # Suite: Fluxo do jogo
    05-turn-rotation.test.js # Suite: Rotacao de turnos
    06-reveal-cards.test.js  # Suite: Modo espiar
    07-disconnect.test.js    # Suite: Desconexao/reconexao
    08-responsive.test.js    # Suite: Design responsivo
  render.yaml            # Configuracao de deploy no Render
```

## Checklist de testes manuais

- [ ] Servidor sobe sem erros com `node server.js`
- [ ] Dois jogadores conseguem criar/entrar na mesma sala online
- [ ] Inicio de jogo propaga para todos os jogadores simultaneamente
- [ ] Tabuleiro renderiza as 96 cartas (48 pares) corretamente embaralhadas
- [ ] Timer de turno de 30s funciona e passa a vez automaticamente
- [ ] Virar carta errada dispara animacao de shake + glow vermelho
- [ ] Formar um par abre o pop-up de validacao com countdown de 10s
- [ ] Resposta certa no campo de texto fica verde; errada fica vermelho
- [ ] Resposta certa no V/F fica verde; errada fica vermelho
- [ ] Acertar as duas perguntas move o par para o deck e o jogador joga de novo
- [ ] Errar qualquer pergunta devolve as cartas e passa a vez
- [ ] Placar e contagem de pares atualizam em tempo real para todos
- [ ] Ao zerar o tabuleiro, overlay de vitoria aparece com taca animada
- [ ] Empate e tratado corretamente
- [ ] Fechar uma aba e reabrir restaura a partida
- [ ] Status online/offline dos jogadores atualiza corretamente
- [ ] Responsividade testada em viewport mobile
- [ ] Contas de usuario persistem apos redeploy (com Persistent Disk)

## Desenvolvido por

Nathalia Adriele - 2026
