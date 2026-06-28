/* app.js — Zero-Backend Version (GitHub Pages Compatible)
 * ⚙️ No serverless functions. No Azure. No Vercel. Pure static.
 * 🔗 Works entirely on GitHub Pages + Microsoft OneDrive Web UI.
 */
(function () {
  'use strict';

  const CONFIG = {
    ONEDRIVE_FOLDER_URL: 'https://polyuit-my.sharepoint.com/:f:/g/personal/kflee_polyu_edu_hk/IgCJ-KWGOAsrTptAMbuacb_AAU0h9IBf84mQzXxYRgLjOgM',
    SUBMISSIONS_JSON: 'submissions.json',
    POLL_INTERVAL_MS: 5000,
    MAX_IMAGE_DIMENSION: 1920,
    IMAGE_QUALITY: 0.85,
    MAX_FILE_BYTES: 10 * 1024 * 1024
  };

  const $ = (id) => document.getElementById(id);
  const toast = (msg, type) => {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast hidden'; }, 3800);
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* =========================================================================
   * STUDENT PAGE
   * =========================================================================*/
  function initStudentPage() {
    const INSTRUCTIONS_MD = [
      '### 👋 歡迎來到 AI 創作坊！',
      '1. **選擇你的名字**，再輸入老師給你的**學生編號**。',
      '2. 上載你用 AI 製作的**圖片** 🖼️，或貼上你的 **HTML 程式碼** 💻。',
      '3. 按 **提交** 🚀 — 完成啦！作品會儲存在本機，並可一鍵同步至 OneDrive。'
    ].join('\n');
    $('instructions').innerHTML = marked.parse ? marked.parse(INSTRUCTIONS_MD) : escapeHtml(INSTRUCTIONS_MD).replace(/\n/g, '<br>');

    let verified = null;
    let mode = 'image';
    let selectedImage = null;
    let localStudents = null;

    (async function loadNames() {
      const select = $('nameSelect');
      try {
        const res = await fetch('students.json');
        if (res.ok) {
          localStudents = await res.json();
          localStudents.forEach((s) => {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.name; select.appendChild(o);
          });
        }
      } catch { toast('無法載入名單 Could not load name list', 'err'); }
    })();

    $('verifyBtn').addEventListener('click', async () => {
      const selectedName = $('nameSelect').value;
      const id = $('studentId').value.trim();
      const msg = $('verifyMsg');
      if (!selectedName) { msg.className = 'msg err'; msg.textContent = '⚠️ 請先選擇名字 Please choose your name.'; return; }
      if (!id) { msg.className = 'msg err'; msg.textContent = '⚠️ 請輸入學生編號 Please enter your ID.'; return; }

      $('verifyBtn').disabled = true; msg.className = 'msg'; msg.textContent = '檢查中… Checking…';

      const match = localStudents.find((s) => String(s.id) === id && s.name === selectedName);
      $('verifyBtn').disabled = false;

      if (match) {
        verified = { name: match.name, id: match.id };
        msg.className = 'msg ok'; msg.textContent = '✅ 確認成功 Verified!';
        $('welcomeMsg').textContent = `你好，${match.name}！🎉 準備好上載你的作品了嗎？`;
        $('uploadCard').classList.remove('hidden');
        $('uploadCard').scrollIntoView({ behavior: 'smooth' });
        refreshSyncButton();
      } else {
        msg.className = 'msg err'; msg.textContent = '❌ 名字或編號不正確 Name or ID is incorrect. 請再試一次 Try again.';
      }
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        mode = tab.dataset.mode;
        $('imageMode').classList.toggle('hidden', mode !== 'image');
        $('htmlMode').classList.toggle('hidden', mode !== 'html');
      });
    });

    const dz = $('dropZone');
    $('pickFileBtn').addEventListener('click', () => $('fileInput').click());
    dz.addEventListener('click', (e) => { if (e.target === dz || e.target.closest('.dz-title, .dz-icon')) $('fileInput').click(); });
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    $('fileInput').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) handleFile(f); });

    async function handleFile(file) {
      if (!file.type.startsWith('image/')) { toast('請選擇圖片檔案 Please choose an image', 'err'); return; }
      if (file.size > CONFIG.MAX_FILE_BYTES) { toast('檔案太大（最大 10MB）File too large', 'err'); return; }
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
            const max = CONFIG.MAX_IMAGE_DIMENSION;
            if (width > max || height > max) { const scale = Math.min(max / width, max / height); width = Math.round(width * scale); height = Math.round(height * scale); }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            const mime = file.type === 'image/png' && (width <= 1600 && height <= 1600) ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mime, CONFIG.IMAGE_QUALITY);
            const size = Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3 / 4);
            selectedImage = { dataUrl, mime, size, fileName: file.name };
            $('previewImg').src = dataUrl;
            $('fileInfo').textContent = `${file.name} · ${(size / 1024).toFixed(0)} KB`;
            $('imagePreview').classList.remove('hidden');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } catch (err) { toast(err.message, 'err'); }
    }

    $('clearImageBtn').addEventListener('click', () => { selectedImage = null; $('fileInput').value = ''; $('imagePreview').classList.add('hidden'); $('previewImg').src = ''; });
    $('previewHtmlBtn').addEventListener('click', () => { $('htmlPreviewFrame').srcdoc = $('htmlInput').value; $('htmlPreviewFrame').classList.remove('hidden'); });

    $('submitBtn').addEventListener('click', submit);

    async function submit() {
      if (!verified) { toast('請先確認身份 Please verify first', 'err'); return; }
      let payload;
      if (mode === 'image') {
        if (!selectedImage) { toast('請先選擇圖片 Please choose an image', 'err'); return; }
        payload = { name: verified.name, studentId: verified.id, type: 'image', fileName: selectedImage.fileName, base64Data: selectedImage.dataUrl, savedAt: Date.now() };
      } else {
        const content = $('htmlInput').value.trim();
        if (!content) { toast('請先貼上程式碼 Please paste your code', 'err'); return; }
        payload = { name: verified.name, studentId: verified.id, type: 'html', content, savedAt: Date.now() };
      }

      const btn = $('submitBtn');
      btn.disabled = true; const label = btn.textContent; btn.textContent = '上載中… Uploading…';

      try {
        const q = readQueue(); q.push(payload); writeQueue(q);
        toast('✅ 已儲存至本機！已觸發 OneDrive 上載視窗。Saved locally. OneDrive upload window opened.', 'ok');
        // Trigger OneDrive native web upload
        window.open(CONFIG.ONEDRIVE_FOLDER_URL, '_blank');
        resetAfterSubmit();
        refreshSyncButton();
      } catch (err) { toast('⚠️ 上載失敗。請手動重新提交。', 'err'); }
      finally { btn.disabled = false; btn.textContent = label; }
    }

    function resetAfterSubmit() { selectedImage = null; $('fileInput').value = ''; $('imagePreview').classList.add('hidden'); $('previewImg').src = ''; $('htmlInput').value = ''; $('htmlPreviewFrame').classList.add('hidden'); }

    const QUEUE_KEY = 'polyu_pending_submissions';
    function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
    function writeQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* sandbox may block */ } }

    function refreshSyncButton() {
      const q = readQueue();
      const btn = $('syncBtn');
      if (q.length) { btn.classList.remove('hidden'); btn.textContent = `🔁 同步並匯出 ZIP Sync ${q.length} pending`; } else btn.classList.add('hidden');
    }

    $('syncBtn').addEventListener('click', async () => {
      let q = readQueue(); if (!q.length) return;
      $('syncBtn').disabled = true;
      try {
        // Dynamically load JSZip & FileSaver from CDN
        const zipScript = document.createElement('script'); zipScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        const fileSaverScript = document.createElement('script'); fileSaverScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
        await Promise.all([new Promise(r => { zipScript.onload = r; document.head.appendChild(zipScript); }), new Promise(r => { fileSaverScript.onload = r; document.head.appendChild(fileSaverScript); })]);

        const zip = new JSZip();
        q.forEach((item, i) => {
          const dir = zip.folder(item.studentId + '__' + item.name);
          if (item.type === 'image') {
            const fileName = item.fileName || `${item.studentId}_${i}.jpg`;
            dir.file(fileName, item.base64Data.split(',')[1], { base64: true });
          } else {
            dir.file(`${item.studentId}_${i}.html`, item.content);
          }
        });
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `polyu_submissions_${new Date().toISOString().slice(0, 10)}.zip`);
        writeQueue([]);
        refreshSyncButton();
        toast('✅ ZIP 已下載！請將檔案拖入 OneDrive 資料夾。', 'ok');
      } catch (err) { toast('匯出失敗 Export failed', 'err'); }
      $('syncBtn').disabled = false;
    });

    refreshSyncButton();
  }

  /* =========================================================================
   * ADMIN PAGE
   * =========================================================================*/
  function initAdminPage() {
    let timer = null;
    let submissions = [];

    async function fetchSubmissions() {
      try {
        const res = await fetch(CONFIG.SUBMISSIONS_JSON);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        submissions = await res.json();
        render(submissions);
        $('lastUpdated').textContent = '更新於 ' + new Date().toLocaleTimeString('zh-HK');
      } catch (err) {
        $('lastUpdated').textContent = '⚠️ 連線失敗 — 將重試';
      }
    }

    function render(rows) {
      const body = $('subsBody');
      body.innerHTML = '';
      $('emptyMsg').style.display = rows.length ? 'none' : 'block';

      let imgN = 0, htmlN = 0;
      rows.forEach((r) => {
        if (r.type === 'image') imgN++; else htmlN++;
        const tr = document.createElement('tr');
        const previewTd = document.createElement('td');
        if (r.type === 'image') {
          const img = document.createElement('img');
          img.className = 'thumb'; img.loading = 'lazy';
          img.src = r.thumbnailUrl || r.downloadUrl || '';
          img.alt = r.studentName;
          img.addEventListener('click', () => openImageModal(r));
          previewTd.appendChild(img);
        } else {
          const box = document.createElement('div');
          box.className = 'html-icon'; box.textContent = '💻'; box.title = '預覽 HTML';
          box.addEventListener('click', () => openHtmlModal(r));
          previewTd.appendChild(box);
        }
        tr.appendChild(previewTd);
        tr.appendChild(cell(escapeHtml(r.studentName)));
        tr.appendChild(cell(escapeHtml(r.studentId)));
        tr.appendChild(cell(`<span class="badge ${r.type}">${r.type === 'image' ? '🖼️ 圖片' : '💻 HTML'}</span>`, true));
        tr.appendChild(cell(escapeHtml(new Date(r.savedAt || Date.now()).toLocaleString('zh-HK'))));
        const actions = document.createElement('td');
        actions.innerHTML = `<div class="row-actions">
            <button class="btn btn-secondary" data-act="view">👀 View</button>
            <button class="btn btn-primary" data-act="download">⬇️ Download</button>
          </div>`;
        actions.querySelector('[data-act="view"]').addEventListener('click', () => r.type === 'image' ? openImageModal(r) : openHtmlModal(r));
        actions.querySelector('[data-act="download"]').addEventListener('click', () => {
          const blob = new Blob([r.type === 'image' ? atob(r.base64Data.split(',')[1]) : r.content], { type: r.type === 'image' ? r.mime || 'image/jpeg' : 'text/html' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${r.studentId}_${r.name}.${r.type === 'image' ? 'jpg' : 'html'}`; a.click(); URL.revokeObjectURL(a.href);
        });
        tr.appendChild(actions);
        body.appendChild(tr);
      });

      $('statCount').textContent = rows.length;
      $('statImages').textContent = imgN;
      $('statHtml').textContent = htmlN;
    }

    function cell(html, isHtml) { const td = document.createElement('td'); if (isHtml) td.innerHTML = html; else td.textContent = html.replace(/&[a-z#0-9]+;/g, (m) => m); if (!isHtml) td.innerHTML = html; return td; }

    function openImageModal(r) {
      $('modalTitle').textContent = `${r.studentName} (${r.studentId})`;
      $('modalContent').innerHTML = `<img src="${escapeHtml(r.base64Data || r.downloadUrl || r.thumbnailUrl)}" alt="${escapeHtml(r.studentName)}">`;
      $('modal').classList.remove('hidden');
    }

    function openHtmlModal(r) {
      $('modalTitle').textContent = `${r.studentName} (${r.studentId})`;
      $('modalContent').innerHTML = '載入中… Loading…';
      $('modal').classList.remove('hidden');
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', '');
      frame.srcdoc = r.content || '<p class="muted">無法載入內容</p>';
      $('modalContent').innerHTML = '';
      $('modalContent').appendChild(frame);
    }

    $('modalClose').addEventListener('click', () => $('modal').classList.add('hidden'));
    $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });

    $('exportBtn').addEventListener('click', () => {
      const headers = ['Name', 'StudentID', 'Type', 'FileName', 'Time'];
      const csvEscape = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const lines = [headers.join(',')];
      submissions.forEach((r) => lines.push([r.studentName, r.studentId, r.type, r.fileName || 'N/A', r.savedAt].map(csvEscape).join(',')));
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `polyu_submissions_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    });

    function startTimer() { stopTimer(); timer = setInterval(fetchSubmissions, CONFIG.POLL_INTERVAL_MS); }
    function stopTimer() { if (timer) clearInterval(timer); timer = null; }
    $('autoRefresh').addEventListener('change', (e) => { e.target.checked ? startTimer() : stopTimer(); });
    $('refreshBtn').addEventListener('click', fetchSubmissions);

    fetchSubmissions();
    startTimer();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if ($('verifyCard')) initStudentPage();
    if ($('subsBody')) initAdminPage();
  });
})();
