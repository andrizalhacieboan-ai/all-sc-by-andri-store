// Auth guard - admin only
const adminUser = JSON.parse(localStorage.getItem('user') || '{}');
const adminToken = localStorage.getItem('token');

if (!adminToken || adminUser.role !== 'admin') {
  window.location.href = '/login';
}

const API = '/api';

async function adminFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...opts.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

window.showSection = (name) => {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  event.currentTarget.classList.add('active');

  if (name === 'scripts' || name === 'pending') loadAdminScripts();
  if (name === 'users') loadAdminUsers();
};

// Load Dashboard Stats
async function loadDashboardStats() {
  try {
    const stats = await adminFetch('/admin/stats');
    const grid = document.getElementById('adminStatsGrid');

    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">🚀</div>
        <div class="stat-info">
          <div class="stat-value">${stats.total_scripts}</div>
          <div class="stat-label">Total Script</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-info">
          <div class="stat-value">${stats.active_scripts}</div>
          <div class="stat-label">Script Aktif</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-info">
          <div class="stat-value">${stats.pending_scripts}</div>
          <div class="stat-label">Menunggu Review</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <div class="stat-info">
          <div class="stat-value">${stats.total_users}</div>
          <div class="stat-label">Total User</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon cyan">⬇️</div>
        <div class="stat-info">
          <div class="stat-value">${formatNumber(stats.total_downloads)}</div>
          <div class="stat-label">Total Download</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">👁️</div>
        <div class="stat-info">
          <div class="stat-value">${formatNumber(stats.total_views)}</div>
          <div class="stat-label">Total Views</div>
        </div>
      </div>`;

    // Render chart
    if (stats.weekly_downloads && typeof Chart !== 'undefined') {
      const ctx = document.getElementById('downloadChart');
      if (ctx) {
        const labels = [];
        const values = [];
        const last7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
          const found = stats.weekly_downloads.find(r => r.date?.startsWith(dateStr));
          values.push(found ? found.count : 0);
        }

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Downloads',
              data: values,
              backgroundColor: 'rgba(135,206,235,0.6)',
              borderColor: '#0ea5e9',
              borderWidth: 2,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }
  } catch (err) {
    showToast('Gagal memuat statistik: ' + err.message, 'error');
  }
}

// Load scripts table
window.loadAdminScripts = async () => {
  const status = document.getElementById('statusFilter')?.value || 'all';
  const isPending = document.getElementById('section-pending')?.classList.contains('active');
  const tbody = document.getElementById(isPending ? 'pendingTable' : 'scriptsTable');

  try {
    const { scripts } = await adminFetch(`/admin/scripts?status=${isPending ? 'pending' : status}&limit=50`);
    if (!tbody) return;

    if (!scripts.length) {
      tbody.innerHTML = `<tr><td colspan="${isPending ? 5 : 7}" style="text-align:center;padding:2rem;color:var(--gray);">Tidak ada script</td></tr>`;
      return;
    }

    tbody.innerHTML = scripts.map(s => `
      <tr>
        <td>
          <div style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.title}</div>
          <div style="font-size:0.78rem;color:var(--gray-light);">ID: ${s.id}</div>
        </td>
        <td style="font-size:0.875rem;">${s.username || '—'}</td>
        <td><span class="badge badge-user">${s.category}</span></td>
        ${!isPending ? `<td style="font-size:0.82rem;">👁️ ${s.view_count} · ⬇️ ${s.download_count}</td>` : ''}
        ${!isPending ? `<td><span class="badge badge-${s.status}">${s.status}</span></td>` : ''}
        <td style="font-size:0.8rem;">${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${s.status !== 'active' ? `<button class="btn btn-success btn-sm" onclick="updateScript(${s.id}, 'active')">✅ Approve</button>` : ''}
            ${s.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" onclick="updateScript(${s.id}, 'rejected')">❌ Tolak</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="deleteScript(${s.id})" style="color:var(--danger);">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Gagal memuat script: ' + err.message, 'error');
  }
};

// Load users table
async function loadAdminUsers() {
  const tbody = document.getElementById('usersTable');
  try {
    const users = await adminFetch('/admin/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="author-avatar">${u.avatar ? `<img src="${u.avatar}" alt="">` : u.username?.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600;">${u.username}</div>
              <div style="font-size:0.75rem;color:var(--gray-light);">ID: ${u.id}</div>
            </div>
          </div>
        </td>
        <td style="font-size:0.875rem;">${u.email}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td style="font-size:0.8rem;">${new Date(u.created_at).toLocaleDateString('id-ID')}</td>
        <td>
          <select class="sort-select" onchange="updateUserRole(${u.id}, this.value)" style="font-size:0.8rem;">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Gagal memuat users: ' + err.message, 'error');
  }
}

window.updateScript = async (id, status) => {
  if (!confirm(`${status === 'active' ? 'Approve' : 'Tolak'} script ini?`)) return;
  try {
    await adminFetch(`/admin/scripts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    showToast(`Script berhasil di-${status === 'active' ? 'approve' : 'tolak'}!`, 'success');
    loadAdminScripts();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteScript = async (id) => {
  if (!confirm('Yakin ingin menghapus script ini? Aksi tidak bisa dibatalkan.')) return;
  try {
    await adminFetch(`/admin/scripts/${id}`, { method: 'DELETE' });
    showToast('Script berhasil dihapus!', 'success');
    loadAdminScripts();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.updateUserRole = async (id, role) => {
  try {
    await adminFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
    showToast(`Role user diperbarui menjadi ${role}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// Initial load
loadDashboardStats();
loadAdminScripts();
