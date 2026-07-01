const flagUrl = code => `https://flagcdn.com/${code}.svg`;

const TEAMS = [
  { code: 'us', name: 'Estados Unidos' }, { code: 'mx', name: 'México' },
  { code: 'ca', name: 'Canadá' }, { code: 'br', name: 'Brasil' },
  { code: 'ar', name: 'Argentina' }, { code: 'uy', name: 'Uruguai' },
  { code: 'co', name: 'Colômbia' }, { code: 'ec', name: 'Equador' },
  { code: 'py', name: 'Paraguai' }, { code: 'pt', name: 'Portugal' },
  { code: 'es', name: 'Espanha' }, { code: 'fr', name: 'França' },
  { code: 'de', name: 'Alemanha' }, { code: 'it', name: 'Itália' },
  { code: 'gb-eng', name: 'Inglaterra' }, { code: 'nl', name: 'Holanda' },
  { code: 'be', name: 'Bélgica' }, { code: 'hr', name: 'Croácia' },
  { code: 'ch', name: 'Suíça' }, { code: 'at', name: 'Áustria' },
  { code: 'no', name: 'Noruega' }, { code: 'gb-sct', name: 'Escócia' },
  { code: 'ba', name: 'Bósnia e Herzegovina' }, { code: 'cz', name: 'República Tcheca' },
  { code: 'tr', name: 'Turquia' }, { code: 'se', name: 'Suécia' },
  { code: 'jp', name: 'Japão' }, { code: 'kr', name: 'Coreia do Sul' },
  { code: 'au', name: 'Austrália' }, { code: 'ir', name: 'Irã' },
  { code: 'sa', name: 'Arábia Saudita' }, { code: 'qa', name: 'Catar' },
  { code: 'jo', name: 'Jordânia' }, { code: 'uz', name: 'Uzbequistão' },
  { code: 'ma', name: 'Marrocos' }, { code: 'sn', name: 'Senegal' },
  { code: 'eg', name: 'Egito' }, { code: 'tn', name: 'Tunísia' },
  { code: 'gh', name: 'Gana' }, { code: 'ci', name: 'Costa do Marfim' },
  { code: 'cv', name: 'Cabo Verde' }, { code: 'za', name: 'África do Sul' },
  { code: 'cd', name: 'RD Congo' }, { code: 'nz', name: 'Nova Zelândia' },
  { code: 'ht', name: 'Haiti' }, { code: 'cw', name: 'Curaçao' },
  { code: 'pa', name: 'Panamá' }, { code: 'cr', name: 'Costa Rica' }
];

const FLAG_THEMES = {
  br: ['#009C3B', '#FFDF00', '#002776'],
  'gb-eng': ['#CF142B', '#FFFFFF', '#012169'],
  ar: ['#74ACDF', '#FFFFFF', '#F6B40E'],
  pt: ['#FF0000', '#006600', '#FFFF00'],
  fr: ['#0055A4', '#FFFFFF', '#EF4135'],
  es: ['#AA151B', '#F1BF00'],
  hr: ['#FF0000', '#FFFFFF', '#171796'],
  mx: ['#006847', '#FFFFFF', '#CE1126'],
  be: ['#000000', '#FAE042', '#ED2939'],
  de: ['#000000', '#DD0000', '#FFCE00'],
  us: ['#B22234', '#FFFFFF', '#3C3B6E'],
  ca: ['#FF0000', '#FFFFFF', '#FF0000'],
  co: ['#FCD116', '#003893', '#CE1126'],
  ec: ['#FFD700', '#003893', '#CF142B'],
  pe: ['#D91023', '#FFFFFF', '#D91023'],
  cl: ['#0033A0', '#FFFFFF', '#D52B1E'],
  bo: ['#DA291C', '#FFE000', '#007934'],
  py: ['#D52B1E', '#FFFFFF', '#0038A8'],
  ve: ['#FCD116', '#00247D', '#CF142B'],
  nl: ['#AE1C28', '#FFFFFF', '#21468B'],
  it: ['#009246', '#FFFFFF', '#CE2B37'],
  rs: ['#C6363C', '#FFFFFF', '#0C4076'],
  ch: ['#DA291C', '#FFFFFF', '#DA291C'],
  at: ['#ED2939', '#FFFFFF', '#ED2939'],
  pl: ['#FFFFFF', '#DC143C', '#FFFFFF'],
  dk: ['#C8102E', '#FFFFFF', '#C8102E'],
  se: ['#005293', '#FECC00', '#005293'],
  no: ['#ED2939', '#FFFFFF', '#002664'],
  ua: ['#0057B7', '#FFD700', '#0057B7'],
  tr: ['#E30A17', '#FFFFFF', '#E30A17'],
  gr: ['#0D5EAF', '#FFFFFF', '#0D5EAF'],
  jp: ['#BC002D', '#FFFFFF', '#BC002D'],
  kr: ['#CD2E3A', '#FFFFFF', '#0047A0'],
  au: ['#012169', '#FFFFFF', '#E4002B'],
  nz: ['#012169', '#FFFFFF', '#C8102E'],
  ma: ['#C1272D', '#006233', '#C1272D'],
  dz: ['#006233', '#FFFFFF', '#D21034'],
  sn: ['#00853F', '#FDEF42', '#E31B23'],
  ng: ['#008751', '#FFFFFF', '#008751'],
  cm: ['#007A5E', '#CE1126', '#FCD116'],
  gh: ['#CE1126', '#FCD116', '#006B3F'],
  'gb-sct': ['#0065BD', '#FFFFFF', '#0065BD'],
  'gb-wls': ['#AC302C', '#FFFFFF', '#006B3F'],
  sa: ['#006C35', '#FFFFFF', '#006C35'],
  qa: ['#8A1538', '#FFFFFF', '#8A1538'],
  ae: ['#00732F', '#FFFFFF', '#FF0000'],
  ba: ['#002395', '#FFFFFF', '#FDC30C'],
  cz: ['#FFFFFF', '#D7141A', '#11457E']
};

function showToast(message, type) {
  type = type || 'info';
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icon = type === 'success' ? '\u2713' : type === 'error' ? '\u2717' : type === 'warning' ? '\u26A0' : '\u2139';
  toast.innerHTML = '<span>' + icon + '</span><span>' + message + '</span>';
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function buildSidebar(activePage, user) {
  const navItems = [
    { href: '/jogar', icon: '\u26BD', label: 'Jogar', key: 'jogar' },
    { href: '/dados', icon: '\u2637', label: 'Dados das Partidas', key: 'dados' },
    { href: '/ranking', icon: '\u2654', label: 'Ranking', key: 'ranking' },
    { href: '/ajuda', icon: '?', label: 'Como Jogar', key: 'ajuda' }
  ];
  if (user && user.role === 'admin') {
    navItems.push({ href: '/admin', icon: '\u2691', label: 'Administração', key: 'admin' });
  }

  const navHtml = navItems.map(item =>
    '<a href="' + item.href + '" class="nav-item ' + (item.key === activePage ? 'active' : '') + '">' +
    '<span class="nav-icon">' + item.icon + '</span>' +
    '<span>' + item.label + '</span></a>'
  ).join('');

  const userHtml = user ?
    '<div class="user-card">' +
    '<img class="user-avatar" src="' + flagUrl(user.flagCode) + '" alt="">' +
    '<div class="user-info">' +
    '<div class="user-name">' + user.displayName + '</div>' +
    '<div class="user-role ' + user.role + '">' + (user.role === 'admin' ? 'Administrador' : 'Jogador') + '</div>' +
    '</div></div>' +
    '<button class="btn-logout" onclick="doLogout()">Sair</button>'
    : '';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.innerHTML =
    '<div class="sidebar-header">' +
    '<div class="sidebar-logo">MEMORY CUP</div>' +
    '<div class="sidebar-toggle" onclick="toggleSidebar()">&times;</div>' +
    '</div>' +
    '<ul class="nav-menu">' + navHtml + '</ul>' +
    '<div class="sidebar-footer">' + userHtml + '</div>';

  return sidebar;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('full');
    // Show/hide floating reopen button
    if (sidebar.classList.contains('collapsed')) {
      showSidebarReopenButton();
    } else {
      hideSidebarReopenButton();
    }
  }
}

function showSidebarReopenButton() {
  if (document.getElementById('sidebar-reopen-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'sidebar-reopen-btn';
  btn.className = 'sidebar-reopen-btn';
  btn.innerHTML = '&#9776;';
  btn.title = 'Abrir menu';
  btn.onclick = function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('collapsed');
    document.querySelector('.main-content').classList.remove('full');
    hideSidebarReopenButton();
  };
  document.body.appendChild(btn);
}

function hideSidebarReopenButton() {
  const btn = document.getElementById('sidebar-reopen-btn');
  if (btn) btn.remove();
}

async function doLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (e) {
    showToast('Erro ao sair.', 'error');
  }
}

async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) return (await res.json()).user;
    return null;
  } catch (e) {
    return null;
  }
}
