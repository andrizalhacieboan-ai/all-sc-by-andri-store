const API = '/api';

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

function saveSession(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}

// Redirect if already logged in
if (localStorage.getItem('token')) {
  const u = JSON.parse(localStorage.getItem('user') || '{}');
  if (u.role === 'admin') {
    window.location.href = '/admin';
  } else {
    window.location.href = '/';
  }
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Clear errors
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));

    let valid = true;
    if (!email) { showFieldError('emailError', 'Email wajib diisi'); valid = false; }
    if (!password) { showFieldError('passwordError', 'Password wajib diisi'); valid = false; }
    if (!valid) return;

    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';

    try {
      const data = await apiPost('/auth/login', { email, password });
      saveSession(data);
      showToast('Login berhasil! Selamat datang ' + data.user.username, 'success');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? '/admin' : '/';
      }, 800);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });
}

// Register Form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registerBtn');
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));

    let valid = true;
    if (!username || username.length < 3) { showFieldError('usernameError', 'Username minimal 3 karakter'); valid = false; }
    if (!/\S+@\S+\.\S+/.test(email)) { showFieldError('emailError', 'Email tidak valid'); valid = false; }
    if (password.length < 6) { showFieldError('passwordError', 'Password minimal 6 karakter'); valid = false; }
    if (password !== confirmPassword) { showFieldError('confirmPasswordError', 'Password tidak cocok'); valid = false; }
    if (!valid) return;

    btn.disabled = true;
    btn.textContent = '⏳ Membuat akun...';

    try {
      const data = await apiPost('/auth/register', { username, email, password });
      saveSession(data);
      showToast('Akun berhasil dibuat! Selamat bergabung!', 'success');
      setTimeout(() => window.location.href = '/', 800);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Buat Akun';
    }
  });
}

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

// Google Login
window.handleGoogleLogin = async (response) => {
  try {
    const data = await apiPost('/auth/google', { credential: response.credential });
    saveSession(data);
    showToast('Login Google berhasil!', 'success');
    setTimeout(() => {
      window.location.href = data.user.role === 'admin' ? '/admin' : '/';
    }, 800);
  } catch (err) {
    showToast('Login Google gagal: ' + err.message, 'error');
  }
};

window.triggerGoogleLogin = () => {
  google.accounts.id.prompt();
};
