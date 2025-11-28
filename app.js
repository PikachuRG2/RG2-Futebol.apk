// PWA Futebol de Hoje - app.js (com painel admin e export/import)
const STORAGE_KEY = 'futebol_hoje_matches_v1';
const ADMIN_KEY = 'futebol_hoje_admin_v1';

const el = id => document.getElementById(id);
const q = sel => document.querySelector(sel);

let matches = [];

function load() {
  try {
    matches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch(e) {
    matches = [];
  }
  render();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  render();
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function formatTime(t) {
  return t ? t.replace('h',':') : '';
}

function render() {
  const container = el('matches');
  container.innerHTML = '';
  const count = el('count');
  count.textContent = `(${matches.length})`;
  if (matches.length === 0) {
    el('empty').style.display = 'block';
    return;
  }
  el('empty').style.display = 'none';
  const tpl = q('#matchTpl');
  matches.forEach(m => {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.team1').textContent = m.team1;
    node.querySelector('.team2').textContent = m.team2;
    node.querySelector('.time').textContent = formatTime(m.time || '');
    const linkEl = node.querySelector('.link');
    if (m.link) {
      linkEl.href = m.link;
      linkEl.textContent = 'Abrir';
    } else {
      linkEl.href = '#';
      linkEl.textContent = '—';
      linkEl.classList.add('muted');
    }
    const noteEl = node.querySelector('.note');
    noteEl.textContent = m.note || '';
    const editBtn = node.querySelector('.edit');
    const delBtn = node.querySelector('.delete');
    editBtn.addEventListener('click', () => editMatch(m.id));
    delBtn.addEventListener('click', () => {
      if (!confirm('Excluir essa partida?')) return;
      matches = matches.filter(x => x.id !== m.id);
      save();
    });
    container.appendChild(node);
  });
}

function addMatch(data) {
  const newMatch = { id: uid(), time: data.time, team1: data.team1, team2: data.team2, link: data.link, note: data.note };
  matches.unshift(newMatch);
  save();
}

function editMatch(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;
  el('time').value = m.time || '';
  el('team1').value = m.team1;
  el('team2').value = m.team2;
  el('link').value = m.link || '';
  el('note').value = m.note || '';
  matches = matches.filter(x => x.id !== id);
  save();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearAll() {
  if (!confirm('Limpar todas as partidas?')) return;
  matches = [];
  save();
}

function exportJSON() {
  const dataStr = JSON.stringify(matches, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'futebol_hoje_export.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const arr = JSON.parse(e.target.result);
      if (!Array.isArray(arr)) throw new Error('Formato inválido');
      // simples merge
      matches = arr.concat(matches);
      save();
      alert('Importado com sucesso.');
    } catch(err) {
      alert('Erro ao importar: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function genSalt() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, '0');
    hex += h;
  }
  return hex;
}

async function hashPass(pass, salt) {
  const enc = new TextEncoder().encode(pass + salt);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return toHex(buf);
}

async function adminInit() {
  let admin = JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null');
  if (!admin) {
    const salt = genSalt();
    const hash = await hashPass('admin123', salt);
    admin = { salt, hash };
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  }
  return admin;
}

async function checkAdminPass(input) {
  const admin = JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null');
  if (!admin) return false;
  if (admin.salt && admin.hash) {
    const h = await hashPass(input, admin.salt);
    return h === admin.hash;
  }
  const ok = btoa(input) === admin.hash;
  if (ok) {
    const salt = genSalt();
    const hash = await hashPass(input, salt);
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ salt, hash }));
  }
  return ok;
}

async function setAdminPass(newPass) {
  const salt = genSalt();
  const hash = await hashPass(newPass, salt);
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ salt, hash }));
  alert('Senha atualizada.');
}

function wire() {
  const form = el('matchForm');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const data = {
      time: el('time').value.trim(),
      team1: el('team1').value.trim(),
      team2: el('team2').value.trim(),
      link: el('link').value.trim(),
      note: el('note').value.trim()
    };
    if (!data.team1 || !data.team2) {
      alert('Preencha os nomes dos dois times.');
      return;
    }
    addMatch(data);
    form.reset();
  });
  el('clearBtn').addEventListener('click', clearAll);

  // Admin modal
  const adminModal = el('adminModal');
  const adminBtn = el('adminBtn');
  const adminCloseBtn = el('adminCloseBtn');
  const adminLoginBtn = el('adminLoginBtn');
  const adminPass = el('adminPass');
  const adminControls = el('adminControls');
  const exportBtn = el('exportBtn');
  const importBtn = el('importBtn');
  const importFile = el('importFile');
  const resetPassBtn = el('resetPassBtn');
  const clearAllBtn = el('clearAllBtn');

  adminBtn.addEventListener('click', () => {
    adminModal.setAttribute('aria-hidden', 'false');
  });
  adminCloseBtn.addEventListener('click', () => {
    adminModal.setAttribute('aria-hidden', 'true');
  });

  adminLoginBtn.addEventListener('click', async () => {
    const val = adminPass.value || '';
    const ok = await checkAdminPass(val);
    if (ok) {
      adminControls.style.display = 'block';
      adminPass.value = '';
      alert('Acesso concedido.');
    } else {
      alert('Senha incorreta.');
    }
  });

  exportBtn.addEventListener('click', exportJSON);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importJSON(f);
  });

  resetPassBtn.addEventListener('click', async () => {
    if (!confirm('Resetar senha para admin123?')) return;
    await setAdminPass('admin123');
  });
  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Apagar todas as partidas permanentemente?')) return;
    matches = [];
    save();
  });

  // Install prompt handling
  let deferredPrompt;
  const installBtn = el('installBtn');
  installBtn.style.display = 'none';
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  // Backup quick download
  el('syncBtn').addEventListener('click', exportJSON);
}

window.addEventListener('load', async () => {
  await adminInit();
  wire();
  load();
});
