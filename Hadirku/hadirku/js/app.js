/* HadirKu — Bootstrap, router hash, state global, dan pengaturan sumber data */
HK.state = {
  data: { classes: [], members: [], sessions: [], records: [] },
  route: { classId: null, tab: null },
  ready: false
};

HK.app = (function () {
  var U = HK.utils;
  var lastRouteKey = null;

  function applyDataset(ds) {
    HK.state.data = HK.api.normalizeDataset(ds);
  }

  /* ---------- Navigasi ---------- */
  function goToClass(classId) { location.hash = '#/class/' + classId + '/absensi'; }
  function goToTab(classId, tab) { location.hash = '#/class/' + classId + '/' + tab; }

  function parseRoute() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'class' && parts[1]) {
      var valid = ['absensi', 'rekap', 'anggota'];
      var tab = valid.indexOf(parts[2]) >= 0 ? parts[2] : 'absensi';
      return { name: 'class', classId: parts[1], tab: tab };
    }
    return { name: 'classes' };
  }

  function render() {
    if (!HK.state.ready) return;
    var route = parseRoute();
    HK.state.route = route;

    if (route.name === 'class') HK.views.classDetail.render(route.classId, route.tab);
    else HK.views.classes.render();

    // Hanya scroll ke atas saat pindah rute (bukan saat re-render setelah simpan)
    var key = route.name + (route.classId || '') + (route.tab || '');
    if (key !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = key; }
  }

  /* ---------- Boot & error ---------- */
  async function boot() {
    var appEl = document.getElementById('app');
    if (!HK.state.ready) {
      appEl.innerHTML = '<div class="boot-loading"><span class="spinner"></span><p>Memuat data...</p></div>';
    }
    try {
      var ds = await HK.api.getAllData();
      applyDataset(ds);
      HK.state.ready = true;
      renderHeaderInfo();
      render();
    } catch (err) {
      HK.state.ready = true;
      renderBootError(err.message || 'Tidak dapat terhubung ke sumber data.');
    }
  }

  function renderBootError(message) {
    document.getElementById('app').innerHTML =
      '<div class="boot-error card">' +
        '<i data-lucide="cloud-off"></i>' +
        '<h2>Gagal memuat data</h2>' +
        '<p>' + U.escapeHtml(message) + '</p>' +
        '<div class="boot-actions">' +
          '<button class="btn btn-primary" onclick="location.reload()">Coba Lagi</button>' +
          '<button class="btn btn-ghost" onclick="HK.app.openSettings()">Pengaturan Sumber Data</button>' +
        '</div>' +
      '</div>';
    HK.ui.refreshIcons();
  }

  function renderHeaderInfo() {
    var el = document.getElementById('today-indicator');
    if (el) el.innerHTML = '<i data-lucide="calendar"></i> ' + U.escapeHtml(U.formatHariTanggal(U.todayISO()));
    var modeEl = document.getElementById('mode-indicator');
    if (modeEl) modeEl.textContent = 'Sumber data: ' + (HK.config.isCloudMode() ? 'Supabase' : 'Perangkat (Lokal)');
    HK.ui.refreshIcons();
  }

  /* ---------- Backup & Restore JSON ---------- */
  function backupJson() {
    var payload = { app: 'HadirKu', version: 1, exportedAt: new Date().toISOString(), data: HK.state.data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hadirku_backup_' + U.todayISO() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    HK.ui.toast('Backup JSON berhasil diunduh.');
  }

  function restoreJson(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        var parsed = JSON.parse(reader.result);
        var ds = parsed && parsed.data ? parsed.data : parsed;
        if (!ds || !Array.isArray(ds.classes)) throw new Error('Format file backup tidak dikenal.');
        if (!window.confirm('Restore akan MENIMPA seluruh data pada sumber data aktif. Lanjutkan?')) return;
        var fresh = await HK.api.importData(ds);
        applyDataset(fresh);
        HK.ui.toast('Data berhasil di-restore.');
        renderHeaderInfo();
        render();
      } catch (err) {
        HK.ui.toast(err.message || 'Gagal restore data.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Modal Pengaturan Sumber Data ---------- */
  function openSettings() {
    var s = HK.config.getSettings();
    var cfg = HK.config.getSupabaseConfig();
    var isCloud = HK.config.isCloudMode();

    HK.ui.openModal({
      title: 'Pengaturan Sumber Data',
      size: 'lg',
      body:
        '<div class="form-group">' +
          '<label class="check-row"><input type="radio" name="ds-mode" value="local"' + (!isCloud ? ' checked' : '') + '>' +
            '<span><b>Mode Lokal</b> — data disimpan di perangkat ini (localStorage). Cocok untuk demo &amp; offline.</span></label>' +
          '<label class="check-row"><input type="radio" name="ds-mode" value="cloud"' + (isCloud ? ' checked' : '') + '>' +
            '<span><b>Supabase</b> — data tersimpan di database PostgreSQL Supabase (sinkron lintas perangkat).</span></label>' +
        '</div>' +
        '<div class="form-group"><label>Project URL Supabase</label>' +
          '<input type="url" id="st-url" class="input" placeholder="https://xxxxxxxx.supabase.co" value="' + U.escapeHtml(cfg.url) + '"></div>' +
        '<div class="form-group"><label>Anon Public Key Supabase</label>' +
          '<input type="text" id="st-key" class="input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="' + U.escapeHtml(cfg.key) + '">' +
          '<p class="field-hint">Kedua nilai ada di Supabase Dashboard &gt; Project Settings &gt; API. ' +
          'Hanya dipakai pada mode Supabase. Anon Key aman dipublikasikan — akses dijaga kebijakan RLS.</p></div>' +
        '<div class="settings-row">' +
          '<button class="btn btn-soft" id="st-test"><i data-lucide="plug-zap"></i> Tes Koneksi</button>' +
          '<span id="st-test-result" class="test-result"></span>' +
        '</div>' +
        '<hr class="divider">' +
        '<div class="form-group"><label>Backup &amp; Restore</label>' +
          '<div class="settings-row">' +
            '<button class="btn btn-soft" id="st-backup"><i data-lucide="hard-drive-download"></i> Backup JSON</button>' +
            '<label class="btn btn-soft btn-file"><i data-lucide="hard-drive-upload"></i> Restore JSON' +
              '<input type="file" id="st-restore" accept=".json,application/json" hidden></label>' +
          '</div>' +
          '<p class="field-hint">Restore akan <b>menimpa seluruh data</b> pada sumber data aktif.</p></div>',
      footer:
        '<button class="btn btn-ghost" data-close-modal>Tutup</button>' +
        '<button class="btn btn-primary" id="st-save"><i data-lucide="save"></i> Simpan Pengaturan</button>',
      onOpen: function () {
        document.getElementById('st-test').addEventListener('click', async function () {
          var out = document.getElementById('st-test-result');
          var url = document.getElementById('st-url').value.trim();
          var key = document.getElementById('st-key').value.trim();
          var mode = document.querySelector('input[name="ds-mode"]:checked').value;
          if (mode === 'cloud' && (!url || !key)) {
            out.textContent = 'Project URL dan Anon Key wajib diisi.';
            out.className = 'test-result bad';
            return;
          }
          var prev = {
            dataMode: s.dataMode,
            supabaseUrl: s.supabaseUrl || '',
            supabaseKey: s.supabaseKey || ''
          };
          HK.config.saveSettings({
            dataMode: mode,
            supabaseUrl: mode === 'cloud' ? url : '',
            supabaseKey: mode === 'cloud' ? key : ''
          });
          out.textContent = 'Menguji...';
          out.className = 'test-result';
          try {
            await HK.api.testConnection();
            out.textContent = mode === 'cloud' ? 'Koneksi ke Supabase berhasil ✓' : 'Mode lokal siap ✓';
            out.classList.add('ok');
          } catch (err) {
            HK.config.saveSettings(prev); // kembalikan jika gagal
            out.textContent = 'Gagal: ' + err.message;
            out.classList.add('bad');
          }
        });

        document.getElementById('st-backup').addEventListener('click', backupJson);
        document.getElementById('st-restore').addEventListener('change', restoreJson);

        document.getElementById('st-save').addEventListener('click', async function () {
          var url = document.getElementById('st-url').value.trim();
          var key = document.getElementById('st-key').value.trim();
          var mode = document.querySelector('input[name="ds-mode"]:checked').value;
          HK.config.saveSettings({
            dataMode: mode,
            supabaseUrl: mode === 'cloud' ? url : '',
            supabaseKey: mode === 'cloud' ? key : ''
          });
          HK.ui.closeModal();
          HK.ui.toast('Pengaturan disimpan. Memuat ulang data...');
          await boot();
        });
      }
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('hashchange', render);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    boot();
  });

  return { applyDataset: applyDataset, render: render, goToClass: goToClass,
           goToTab: goToTab, openSettings: openSettings, boot: boot };
})();