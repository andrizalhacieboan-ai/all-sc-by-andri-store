// Auth guard
if (!localStorage.getItem('token')) {
  window.location.href = '/login';
}

const fileInput = document.getElementById('fileInput');
const fileDropArea = document.getElementById('fileDropArea');
const codePreview = document.getElementById('codePreview');
let fileContent = '';
let fileName = '';

// File drag & drop
fileDropArea.addEventListener('click', () => fileInput.click());

fileDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDropArea.classList.add('dragover');
});

fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('dragover'));

fileDropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDropArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
  const maxSize = 50 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast('File terlalu besar. Maksimal 50MB.', 'error');
    return;
  }

  const allowedExts = ['.js', '.ts', '.json', '.zip', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedExts.includes(ext)) {
    showToast('Tipe file tidak didukung.', 'error');
    return;
  }

  fileName = file.name;
  const reader = new FileReader();

  reader.onload = (e) => {
    fileContent = e.target.result;
    fileDropArea.innerHTML = `
      <div class="upload-icon">✅</div>
      <p><strong>${file.name}</strong></p>
      <p class="file-info">${(file.size / 1024).toFixed(1)} KB — Klik untuk ganti file</p>
      <input type="file" id="fileInput" style="display:none;" accept=".js,.ts,.json,.zip,.txt">`;
    fileDropArea.querySelector('input').addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });
    fileDropArea.onclick = () => fileDropArea.querySelector('input').click();

    // Preview for text files
    if (['.js', '.ts', '.json', '.txt'].includes(ext)) {
      codePreview.textContent = fileContent.slice(0, 3000) + (fileContent.length > 3000 ? '\n... (dipotong untuk preview)' : '');
      codePreview.style.display = 'block';
    }
  };

  if (ext === '.zip') {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

// Upload form
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const category = document.getElementById('category').value;
  const tags = document.getElementById('tags').value.trim();
  const image = document.getElementById('image').value.trim();

  // Validate
  let valid = true;
  if (!title) { showFieldError('titleError', 'Nama script wajib diisi'); valid = false; }
  if (!description) { showFieldError('descError', 'Deskripsi wajib diisi'); valid = false; }
  if (!fileContent) { showFieldError('fileError', 'File script wajib diunggah'); valid = false; }
  if (!valid) return;

  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  btn.disabled = true;
  btn.textContent = '⏳ Mengupload...';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/scripts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, category, tags, file_content: fileContent, file_name: fileName, image: image || null })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload gagal');

    showToast(data.message, 'success');
    setTimeout(() => window.location.href = '/', 1500);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = '🚀 Upload Script';
  } finally {
    overlay.classList.remove('show');
  }
});

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
