const TRIVIA = {
  us: [
    { statement: 'Os Estados Unidos sediaram a Copa do Mundo de 1994.', answer: true },
    { statement: 'Os Estados Unidos jamais participaram de uma Copa do Mundo.', answer: false }
  ],
  mx: [
    { statement: 'O México sediou a Copa do Mundo em 1970 e 1986.', answer: true },
    { statement: 'O México nunca chegou às quartas de final de uma Copa.', answer: false }
  ],
  ca: [
    { statement: 'O Canadá voltou a disputar uma Copa do Mundo em 2022, após 36 anos de ausência.', answer: true },
    { statement: 'O Canadá já foi campeão mundial de futebol.', answer: false }
  ],
  br: [
    { statement: 'O Brasil é o único país a disputar todas as edições da Copa do Mundo.', answer: true },
    { statement: 'O Brasil tem 4 títulos mundiais.', answer: false }
  ],
  ar: [
    { statement: 'A Argentina conquistou seu terceiro título mundial em 2022, no Catar.', answer: true },
    { statement: 'Diego Maradona nunca marcou gol em Copas do Mundo.', answer: false }
  ],
  uy: [
    { statement: 'O Uruguai venceu a primeira Copa do Mundo da história, em 1930.', answer: true },
    { statement: 'O Uruguai nunca sediou uma Copa do Mundo.', answer: false }
  ],
  co: [
    { statement: 'James Rodríguez foi artilheiro da Copa de 2014 no Brasil.', answer: true },
    { statement: 'A Colômbia jamais chegou às quartas de final de uma Copa.', answer: false }
  ],
  ec: [
    { statement: 'O Equador estreou em Copas do Mundo no ano 2002.', answer: true },
    { statement: 'O Equador já foi campeão da Copa América.', answer: false }
  ],
  py: [
    { statement: 'O Paraguai chegou às quartas de final da Copa de 2010.', answer: true },
    { statement: 'O Paraguai já foi campeão mundial de futebol.', answer: false }
  ],
  pt: [
    { statement: 'Portugal sediou a Eurocopa de 2004.', answer: true },
    { statement: 'Cristiano Ronaldo nunca marcou em Copas do Mundo.', answer: false }
  ],
  es: [
    { statement: 'A Espanha conquistou a Copa do Mundo em 2010, na África do Sul.', answer: true },
    { statement: 'A Espanha nunca chegou a uma final de Copa do Mundo.', answer: false }
  ],
  fr: [
    { statement: 'A França venceu a Copa do Mundo em 1998 como país sede.', answer: true },
    { statement: 'Michel Platini jamais jogou uma Copa do Mundo.', answer: false }
  ],
  de: [
    { statement: 'A Alemanha já sediou duas Copas do Mundo, em 1974 e 2006.', answer: true },
    { statement: 'A Alemanha nunca venceu uma Copa do Mundo.', answer: false }
  ],
  it: [
    { statement: 'A Itália não se classificou para as Copas de 2018 e 2022.', answer: true },
    { statement: 'A Itália tem 2 títulos mundiais.', answer: false }
  ],
  'gb-eng': [
    { statement: 'A Inglaterra venceu a Copa do Mundo em 1966, como país sede.', answer: true },
    { statement: 'A Inglaterra já chegou a três finais de Copa do Mundo.', answer: false }
  ],
  nl: [
    { statement: 'A Holanda chegou a três finais de Copa do Mundo, mas nunca venceu.', answer: true },
    { statement: 'Johan Cruyff foi campeão mundial pela Holanda em 1974.', answer: false }
  ],
  be: [
    { statement: 'A Bélgica terminou em terceiro lugar na Copa de 2018 na Rússia.', answer: true },
    { statement: 'A Bélgica já foi campeã da Copa do Mundo.', answer: false }
  ],
  hr: [
    { statement: 'A Croácia chegou à final da Copa de 2018, perdendo para a França.', answer: true },
    { statement: 'A Croácia já foi campeã da Copa do Mundo.', answer: false }
  ],
  ch: [
    { statement: 'A Suíça sediou a Copa do Mundo de 1954.', answer: true },
    { statement: 'A Suíça já foi campeã da Copa do Mundo.', answer: false }
  ],
  at: [
    { statement: 'A Áustria co-organiza a Copa do Mundo de 2026 com Suíça e Itália.', answer: false },
    { statement: 'A Áustria chegou ao terceiro lugar na Copa de 1954.', answer: true }
  ],
  no: [
    { statement: 'A Noruega jamais chegou a uma fase final de Copa do Mundo neste século.', answer: true },
    { statement: 'Erling Haaland já foi campeão da Copa do Mundo pela Noruega.', answer: false }
  ],
  'gb-sct': [
    { statement: 'A Escócia participou das Copas do Mundo de 1974, 1978 e 1982.', answer: true },
    { statement: 'A Escócia já foi campeã da Copa do Mundo.', answer: false }
  ],
  ba: [
    { statement: 'A Bósnia e Herzegovina estreou em Copas do Mundo em 2014, no Brasil.', answer: true },
    { statement: 'A Bósnia já chegou às semifinais de uma Copa do Mundo.', answer: false }
  ],
  cz: [
    { statement: 'A República Tcheca, como Tchecoslováquia, chegou à final da Copa de 1962.', answer: true },
    { statement: 'A República Tcheca já foi campeã da Copa do Mundo.', answer: false }
  ],
  tr: [
    { statement: 'A Turquia terminou em terceiro lugar na Copa de 2002.', answer: true },
    { statement: 'A Turquia já foi campeã da Copa do Mundo.', answer: false }
  ],
  se: [
    { statement: 'A Suécia chegou à final da Copa do Mundo em 1958, como país sede.', answer: true },
    { statement: 'A Suécia já foi campeã da Copa do Mundo.', answer: false }
  ],
  jp: [
    { statement: 'O Japão co-organizou a Copa do Mundo de 2002 com a Coreia do Sul.', answer: true },
    { statement: 'O Japão jamais chegou às oitavas de final de uma Copa.', answer: false }
  ],
  kr: [
    { statement: 'A Coreia do Sul chegou em quarto lugar na Copa de 2002, como país sede.', answer: true },
    { statement: 'A Coreia do Sul nunca venceu um jogo em Copas do Mundo.', answer: false }
  ],
  au: [
    { statement: 'A Austrália é filiada à Confederação Asiática de Futebol (AFC) desde 2006.', answer: true },
    { statement: 'A Austrália jamais disputou uma Copa do Mundo.', answer: false }
  ],
  ir: [
    { statement: 'O Irã é a seleção asiática com mais participações em Copas do Mundo.', answer: true },
    { statement: 'O Irã já chegou às quartas de final de uma Copa do Mundo.', answer: false }
  ],
  sa: [
    { statement: 'A Arábia Saudita venceu a Argentina na Copa de 2022.', answer: true },
    { statement: 'A Arábia Saudita já foi campeã da Copa do Mundo.', answer: false }
  ],
  qa: [
    { statement: 'O Catar sediou a Copa do Mundo de 2022, a primeira no mundo árabe.', answer: true },
    { statement: 'O Catar chegou às quartas de final em sua estreia na Copa de 2022.', answer: false }
  ],
  jo: [
    { statement: 'A Jordânia chegou à final da Copa Asiática de 2023.', answer: true },
    { statement: 'A Jordânia já disputou uma fase final de Copa do Mundo.', answer: false }
  ],
  uz: [
    { statement: 'O Uzbequistão nunca chegou a uma fase final de Copa do Mundo até 2022.', answer: true },
    { statement: 'O Uzbequistão já foi campeão asiático de futebol.', answer: false }
  ],
  ma: [
    { statement: 'O Marrocos chegou à semifinal da Copa de 2022, primeira seleção africana a conseguir.', answer: true },
    { statement: 'O Marrocos jamais passou da fase de grupos em Copas do Mundo.', answer: false }
  ],
  sn: [
    { statement: 'O Senegal venceu a França na abertura da Copa de 2002.', answer: true },
    { statement: 'O Senegal já foi campeão da Copa do Mundo.', answer: false }
  ],
  eg: [
    { statement: 'O Egito participou de três Copas do Mundo até 2018.', answer: true },
    { statement: 'Mohamed Salah foi campeão mundial pelo Egito em 2018.', answer: false }
  ],
  tn: [
    { statement: 'A Tunísia jamais passou da fase de grupos em Copas do Mundo.', answer: true },
    { statement: 'A Tunísia já chegou às quartas de final de uma Copa do Mundo.', answer: false }
  ],
  gh: [
    { statement: 'Gana chegou às quartas de final da Copa de 2010 na África do Sul.', answer: true },
    { statement: 'Gana já foi campeã da Copa do Mundo.', answer: false }
  ],
  ci: [
    { statement: 'A Costa do Marfim tem como maior nome histórico Didier Drogba.', answer: true },
    { statement: 'A Costa do Marfim já chegou a uma semifinal de Copa do Mundo.', answer: false }
  ],
  cv: [
    { statement: 'Cabo Verde é conhecido por Tubarões Azuis como apelido da seleção.', answer: true },
    { statement: 'Cabo Verde já chegou às quartas de final de uma Copa do Mundo.', answer: false }
  ],
  za: [
    { statement: 'A África do Sul sediou a Copa do Mundo de 2010.', answer: true },
    { statement: 'A África do Sul já foi campeã da Copa do Mundo.', answer: false }
  ],
  cd: [
    { statement: 'A RD Congo, como Zaire, foi a primeira seleção africana a disputar uma Copa, em 1974.', answer: true },
    { statement: 'A RD Congo já foi campeã da Copa do Mundo.', answer: false }
  ],
  nz: [
    { statement: 'A Nova Zelândia é filiada à Confederação de Futebol da Oceania (OFC).', answer: true },
    { statement: 'A Nova Zelândia já chegou às oitavas de final de uma Copa do Mundo.', answer: false }
  ],
  ht: [
    { statement: 'O Haiti participou da Copa do Mundo de 1974, na Alemanha.', answer: true },
    { statement: 'O Haiti já chegou às quartas de final de uma Copa do Mundo.', answer: false }
  ],
  cw: [
    { statement: 'Curaçao é uma seleção filiada à CONCACAF.', answer: true },
    { statement: 'Curaçao já disputou uma fase final de Copa do Mundo.', answer: false }
  ],
  pa: [
    { statement: 'O Panamá estreou em Copas do Mundo em 2018, na Rússia.', answer: true },
    { statement: 'O Panamá já chegou às quartas de final de uma Copa do Mundo.', answer: false }
  ],
  cr: [
    { statement: 'A Costa Rica chegou às quartas de final da Copa de 2014 no Brasil.', answer: true },
    { statement: 'A Costa Rica já foi campeã da Copa do Mundo.', answer: false }
  ]
};

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function getTrivia(code) {
  const list = TRIVIA[code] || TRIVIA.br;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { TRIVIA, getTrivia, normalizeText };
