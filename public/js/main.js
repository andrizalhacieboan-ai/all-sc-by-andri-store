// ── UTILITIES ──────────────────────────────────────────────────────
const API = '/api';

const token = () => localStorage.getItem('token');
const user  = () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } };

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token()) headers['Authorization'] = `Bearer ${token()}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n?.toString() || '0';
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
  return new Date(dateStr).toLocaleDateString('id-ID');
}

function initNavbar() {
  const u = user();
  const actions = document.getElementById('navActions');
  const mobileAuth = document.getElementById('mobileAuthLinks');
  if (!actions) return;

  if (u) {
    actions.innerHTML = `
      <div class="user-menu-wrapper" id="userMenuWrapper">
        <button class="user-btn" id="userBtn">
          <div class="user-avatar" id="navAvatar">${u.avatar ? `<img src="${u.avatar}" alt="">` : u.username?.charAt(0).toUpperCase()}</div>
          <span class="user-name">${u.username}</span>
          <span>▾</span>
        </button>
        <div class="dropdown-menu" id="dropdownMenu">
          ${u.role === 'admin' ? '<a href="/admin" class="dropdown-item">⚙️ Admin Panel</a><div class="dropdown-divider"></div>' : ''}
          <a href="/upload" class="dropdown-item">⬆️ Upload Script</a>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" onclick="logout()">🚪 Keluar</button>
        </div>
      </div>`;

    document.getElementById('userBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('dropdownMenu').classList.toggle('show');
    });

    document.addEventListener('click', () => {
      document.getElementById('dropdownMenu')?.classList.remove('show');
    });

    if (mobileAuth) {
      mobileAuth.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:12px;">
          <div class="author-avatar">${u.avatar ? `<img src="${u.avatar}" alt="">` : u.username?.charAt(0).toUpperCase()}</div>
          <span style="font-weight:600;">${u.username}</span>
        </div>
        ${u.role === 'admin' ? '<a href="/admin" class="nav-link">⚙️ Admin Panel</a>' : ''}
        <a href="/upload" class="nav-link">⬆️ Upload Script</a>
        <button class="nav-link" style="background:none;border:none;cursor:pointer;width:100%;text-align:left;color:var(--danger);" onclick="logout()">🚪 Keluar</button>`;
    }
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('Berhasil keluar!', 'success');
  setTimeout(() => window.location.href = '/', 500);
}

// Hamburger menu
document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.getElementById('mobileMenu')?.classList.toggle('show');
});

// ── INDEX PAGE ──────────────────────────────────────────────────────
if (document.getElementById('scriptGrid')) {
  let currentPage = 1;
  let currentCategory = 'all';
  let currentSort = 'newest';
  let currentSearch = '';

  async function loadScripts() {
    const grid = document.getElementById('scriptGrid');
    const empty = document.getElementById('emptyState');
    const params = new URLSearchParams({
      page: currentPage, limit: 12, sort: currentSort,
      ...(currentCategory !== 'all' && { category: currentCategory }),
      ...(currentSearch && { search: currentSearch })
    });

    try {
      const { scripts, total, pages } = await apiFetch(`/scripts?${params}`);
      grid.innerHTML = '';

      if (!scripts.length) {
        empty.style.display = 'block';
        document.getElementById('pagination').innerHTML = '';
        return;
      }

      empty.style.display = 'none';
      scripts.forEach(s => {
        const card = document.createElement('a');
        card.className = 'script-card';
        card.href = `/script/${s.id}`;
        const tags = (s.tags || '').split(',').filter(Boolean).slice(0, 3);
        const emoji = { aibot:'🤖', game:'🎮', utility:'🛠️', downloader:'⬇️', sticker:'🎨', group:'👥', general:'⚙️' }[s.category] || '⚙️';
        card.innerHTML = `
          <div class="card-image">
            ${s.image ? `<img src="${s.image}" alt="${s.title}" loading="lazy">` : `<span style="font-size:3rem;">${emoji}</span>`}
            <span class="card-category">${s.category}</span>
          </div>
          <div class="card-body">
            <div class="card-title">${s.title}</div>
            <div class="card-desc">${s.description}</div>
            ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="tag">#${t.trim()}</span>`).join('')}</div>` : ''}
          </div>
          <div class="card-footer">
            <div class="card-author">
              <div class="author-avatar">${s.avatar ? `<img src="${s.avatar}" alt="">` : (s.username?.charAt(0) || '?').toUpperCase()}</div>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.username || 'Unknown'}</span>
            </div>
            <div class="card-stats">
              <span class="stat">👁️ ${formatNumber(s.view_count)}</span>
              <span class="stat">⬇️ ${formatNumber(s.download_count)}</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      renderPagination(pages);
      loadGlobalStats();
    } catch (err) {
      grid.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-icon">⚠️</div><h3>Gagal memuat script</h3><p>${err.message}</p></div>`;
    }
  }

  function renderPagination(pages) {
    const pg = document.getElementById('pagination');
    if (pages <= 1) { pg.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">◀</button>`;
    for (let i = 1; i <= Math.min(pages, 7); i++) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${currentPage === pages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">▶</button>`;
    pg.innerHTML = html;
  }

  window.changePage = (p) => { currentPage = p; loadScripts(); scrollTo({ top: 0, behavior: 'smooth' }); };

  async function loadGlobalStats() {
    try {
      const { total, total_downloads, total_views, total_users } = await apiFetch('/scripts?limit=1').then(async d => {
        const pool = { total: d.total };
        try {
          const s = await apiFetch('/admin/stats').catch(() => null);
          return { ...pool, ...s };
        } catch { return pool; }
      });
      document.getElementById('statTotal').textContent = formatNumber(total);
      if (total_downloads) document.getElementById('statDownloads').textContent = formatNumber(total_downloads);
      if (total_users) document.getElementById('statUsers').textContent = formatNumber(total_users);
    } catch {}
  }

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      currentPage = 1;
      loadScripts();
    });
  });

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    loadScripts();
  });

  // Search
  const doSearch = () => {
    currentSearch = document.getElementById('heroSearch').value.trim();
    currentPage = 1;
    if (currentSearch) document.querySelector('#scripts').scrollIntoView({ behavior: 'smooth' });
    loadScripts();
  };

  document.getElementById('heroSearchBtn')?.addEventListener('click', doSearch);
  document.getElementById('heroSearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // URL params
  const urlP = new URLSearchParams(location.search);
  if (urlP.get('category')) {
    currentCategory = urlP.get('category');
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === currentCategory);
    });
  }
  if (urlP.get('search')) {
    currentSearch = urlP.get('search');
    if (document.getElementById('heroSearch')) document.getElementById('heroSearch').value = currentSearch;
  }

  loadScripts();
}

initNavbar();
