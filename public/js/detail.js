const scriptId = window.location.pathname.split('/').pop();
let sseSource = null;

async function loadDetail() {
  const wrapper = document.getElementById('detailWrapper');

  try {
    const res = await fetch(`/api/scripts/${scriptId}`, {
      headers: localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}
    });
    if (!res.ok) throw new Error('Script tidak ditemukan');
    const s = await res.json();

    const tags = (s.tags || '').split(',').filter(Boolean);
    const emoji = { aibot:'🤖', game:'🎮', utility:'🛠️', downloader:'⬇️', sticker:'🎨', group:'👥', general:'⚙️' }[s.category] || '⚙️';

    document.title = `${s.title} — ALL SC BY ANDRI STORE`;

    wrapper.innerHTML = `
      <div class="detail-card">
        <div class="detail-image">
          ${s.image ? `<img src="${s.image}" alt="${s.title}">` : `<span style="font-size:5rem;">${emoji}</span>`}
        </div>
        <div class="detail-body">
          <h1 class="detail-title">${s.title}</h1>
          <div class="detail-meta">
            <span class="meta-item">👤 <strong>${s.username || 'Unknown'}</strong></span>
            <span class="meta-item">📂 <strong>${s.category}</strong></span>
            <span class="meta-item">🕐 <strong>${timeAgo(s.created_at)}</strong></span>
          </div>

          <!-- Realtime Stats -->
          <div class="realtime-stats">
            <div class="rt-stat">
              <span class="rt-number" id="rtViews">${s.view_count || 0}</span>
              <div class="rt-label">Total Views</div>
              <div class="rt-indicator"><div class="rt-dot"></div>Live</div>
            </div>
            <div class="rt-stat">
              <span class="rt-number" id="rtDownloads">${s.download_count || 0}</span>
              <div class="rt-label">Total Downloads</div>
              <div class="rt-indicator"><div class="rt-dot"></div>Live</div>
            </div>
          </div>

          <p class="detail-desc">${s.description}</p>

          ${tags.length ? `<div class="card-tags" style="margin-bottom:1.5rem;">${tags.map(t => `<span class="tag">#${t.trim()}</span>`).join('')}</div>` : ''}

          ${s.file_content && !s.file_name?.endsWith('.zip') ? `
            <div class="code-block-wrapper">
              <div class="code-block-header">
                <span>📄 ${s.file_name || 'script.js'}</span>
                <button class="btn btn-ghost btn-sm" onclick="copyCode()">📋 Copy</button>
              </div>
              <pre class="code-block" id="codeBlock">${escapeHtml(s.file_content.slice(0, 5000))}${s.file_content.length > 5000 ? '\n\n// ... (kode dipotong, download untuk melihat selengkapnya)' : ''}</pre>
            </div>` : ''}
        </div>
      </div>

      <!-- Sidebar -->
      <div class="detail-sidebar">
        <div class="sidebar-card">
          <h4>📥 Download Script</h4>
          <a class="download-btn" href="/api/scripts/${scriptId}/download" onclick="trackDownload()">
            <span>💾</span> Download Script
          </a>
          <div style="text-align:center;font-size:0.8rem;color:var(--gray-light);margin-top:0.75rem;">
            Format: ${s.file_name || 'script.js'}
          </div>
        </div>

        <div class="sidebar-card">
          <h4>ℹ️ Informasi Script</h4>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.875rem;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:var(--gray);">Kategori</span>
              <span style="font-weight:600;">${s.category}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:var(--gray);">Uploader</span>
              <span style="font-weight:600;">${s.username || 'Unknown'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:var(--gray);">Diupload</span>
              <span style="font-weight:600;">${new Date(s.created_at).toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-card">
          <h4>🏷️ Tags</h4>
          <div class="card-tags">
            ${tags.length ? tags.map(t => `<span class="tag">#${t.trim()}</span>`).join('') : '<span style="color:var(--gray-light);font-size:0.85rem;">Tidak ada tags</span>'}
          </div>
        </div>
      </div>`;

    // Start SSE for realtime stats
    startRealtimeStats();

  } catch (err) {
    wrapper.innerHTML = `
      <div style="grid-column:1/-1;" class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Script Tidak Ditemukan</h3>
        <p>${err.message}</p>
        <a href="/" class="btn btn-primary">Kembali ke Beranda</a>
      </div>`;
  }
}

function startRealtimeStats() {
  if (sseSource) sseSource.close();

  sseSource = new EventSource(`/api/stats/realtime/${scriptId}`);

  sseSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const viewsEl = document.getElementById('rtViews');
    const downloadsEl = document.getElementById('rtDownloads');

    if (viewsEl && data.views !== undefined) {
      animateNumber(viewsEl, parseInt(viewsEl.textContent) || 0, data.views);
    }
    if (downloadsEl && data.downloads !== undefined) {
      animateNumber(downloadsEl, parseInt(downloadsEl.textContent) || 0, data.downloads);
    }
  };

  sseSource.onerror = () => {
    sseSource.close();
    // Fallback: poll every 10 seconds
    setTimeout(pollStats, 10000);
  };
}

async function pollStats() {
  try {
    const res = await fetch(`/api/scripts/${scriptId}/stats`);
    const data = await res.json();
    const viewsEl = document.getElementById('rtViews');
    const downloadsEl = document.getElementById('rtDownloads');
    if (viewsEl) viewsEl.textContent = formatNumber(data.total_views);
    if (downloadsEl) downloadsEl.textContent = formatNumber(data.total_downloads);
  } catch {}
  setTimeout(pollStats, 15000);
}

function animateNumber(el, from, to) {
  if (from === to) return;
  const duration = 600;
  const start = performance.now();
  const diff = to - from;

  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + diff * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function trackDownload() {
  const el = document.getElementById('rtDownloads');
  if (el) {
    const curr = parseInt(el.textContent.replace(/,/g, '')) || 0;
    animateNumber(el, curr, curr + 1);
  }
}

function copyCode() {
  const code = document.getElementById('codeBlock')?.textContent;
  if (code) {
    navigator.clipboard.writeText(code).then(() => showToast('Kode berhasil disalin!', 'success'));
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  return Math.floor(diff / 86400) + ' hari lalu';
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return (n || 0).toLocaleString();
}

// Cleanup SSE on leave
window.addEventListener('beforeunload', () => sseSource?.close());

loadDetail();
