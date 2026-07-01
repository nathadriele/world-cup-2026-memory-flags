# Memory Cup 2026

Jogo da memória multiplayer com as 48 seleções da Copa do Mundo 2026, com quiz de validação de pares e comemoração de vitória com taça animada.

**Stack:** Node.js 18+, Express 4.x, Socket.io 4.x, HTML5/CSS3/JS vanilla

## Como testar localmente

```bash
git clone <repo>
cd memory-flags-2026
npm install
node server.js
```

Abra duas abas (ou um navegador normal + um anônimo) em http://localhost:3000

- Aba 1: digite o nome, escolha a bandeira, clique em "Criar Sala", copie o código.
- Aba 2: digite outro nome, escolha outra bandeira, clique em "Entrar em Sala", cole o código.
- O jogo começa automaticamente com as duas abas conectadas.

Requer conexão com a internet mesmo localmente, pois as bandeiras são carregadas via flagcdn.com.

## Deploy no Render

1. Suba o código no GitHub
2. New Web Service -> conecte o repo
3. Build Command: `npm install` | Start Command: `node server.js` | Plan: Free

Ou use o `render.yaml` fornecido com Blueprint.

## Regras

- 48 pares de bandeiras (96 cartas)
- Login: nome + escolha da bandeira do jogador (10 opções)
- 30 segundos por turno para virar a primeira carta
- Ao formar um par: pop-up de 10s com 2 perguntas (nome do país + V/F de curiosidade)
- Acertar as duas: par vai pro seu deck, joga de novo
- Errar qualquer uma ou estourar o tempo: cartas voltam, passa a vez
- Vencedor: mais pares no deck; comemoração com taça animada no tema da bandeira escolhida

## Como testar (checklist)

- [ ] Servidor sobe sem erros com `node server.js`
- [ ] Duas abas conseguem criar/entrar na mesma sala
- [ ] Tabuleiro renderiza as 96 cartas (48 pares) corretamente embaralhadas
- [ ] Timer de turno de 30s funciona e passa a vez automaticamente
- [ ] Virar carta errada dispara animação de shake + glow vermelho
- [ ] Formar um par abre o pop-up de validação com countdown de 10s
- [ ] Resposta certa no campo de texto fica verde; errada fica vermelha
- [ ] Resposta certa no V/F fica verde; errada fica vermelha
- [ ] Acertar as duas perguntas move o par para o deck e o jogador joga de novo
- [ ] Errar qualquer pergunta devolve as cartas e passa a vez
- [ ] Placar e contagem de pares atualizam em tempo real nas duas abas
- [ ] Ao zerar o tabuleiro, overlay de vitória aparece com taça animada e confetti temático
- [ ] Empate é tratado corretamente
- [ ] Fechar uma aba e reabrir em menos de 60s restaura a partida
- [ ] Responsividade testada em viewport mobile

## Desenvolvido por

Nathalia Adriele - 2026
