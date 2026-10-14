/* HadirKu — View: Tab Absensi
   FR-06 (1 sesi/tanggal, mode edit), FR-07 (default Hadir),
   one-click toggle [H][I][S][A], pencarian anggota, catatan sesi. */
HK.views.absensi = (function () {
  var U = HK.utils;
  var st = null; // state lokal tab ini

  function activeMembers(classId) {
    return HK.state.data.members
      .filter(function (m) { return m.classId === classId && m.aktif !== false; })
      .sort(U.sortByNama);
  }

  function loadDraft(cls, tanggal) {
    var session = HK.state.data.sessions.find(function (s) {
      return s.classId === cls.id && s.tanggal === tanggal;
    });
    var records = {};
    if (session) {
      HK.state.data.records.forEach(function (r) {
        if (r.sessionId === session.id) records[r.memberId] = r.status;
      });
    }
    // FR-07: seluruh anggota otomatis status HADIR sebagai default
    activeMembers(cls.id).forEach(function (m) { if (!records[m.id]) records[m.id] = 'H'; });
    return { session: session || null, records: records, catatan: session ? (session.catatan || '') : '' };
  }

  function render(cls) {
    if (!st || st.classId !== cls.id) {
      st = { classId: cls.id, tanggal: U.todayISO(), search: '', pending: false, hasSession: false };
    }
    var draft = loadDraft(cls, st.tanggal);
    st.records = draft.records;
    st.catatan = draft.catatan;
    st.hasSession = !!draft.session;

    var html =
      '<div class="card pad mb-16">' +
        '<div class="absensi-toolbar">' +
          '<div class="date-pick">' +
            '<label for="abs-date">Tanggal Sesi</label>' +
            '<input type="date" id="abs-date" class="input" value="' + st.tanggal + '">' +
          '</div>' +
          '<div class="absensi-search">' +
            '<i data-lucide="search"></i>' +
            '<input type="text" id="abs-search" class="input" placeholder="Cari nama anggota..." value="' + U.escapeHtml(st.search) + '">' +
          '</div>' +
          '<button class="btn btn-soft" id="abs-all-h" title="Setel semua menjadi Hadir"><i data-lucide="user-check"></i> Semua Hadir</button>' +
        '</div>' +
        (st.hasSession
          ? '<div class="info-banner"><i data-lucide="pencil-line"></i><div><b>Mode Edit</b> — absensi tanggal ' +
            U.escapeHtml(U.formatTanggalIndo(st.tanggal)) + ' sudah pernah disimpan. Perubahan akan menimpa data sebelumnya.</div></div>'
          : '') +
      '</div>' +
      '<div class="card mb-16" id="abs-list">' + renderList() + '</div>' +
      '<div class="card pad mb-16">' +
        '<label for="abs-note" class="session-note-label"><i data-lucide="sticky-note"></i> Catatan Sesi <span class="opt">opsional</span></label>' +
        '<input type="text" id="abs-note" class="input" maxlength="200" placeholder="cth: Materi Unit 4 / kelas diganti karena libur nasional" value="' + U.escapeHtml(st.catatan) + '">' +
      '</div>' +
      renderSaveBar();

    document.getElementById('tab-content').innerHTML = html;

    // ---------- Event ----------
    document.getElementById('abs-date').addEventListener('change', function (e) {
      st.tanggal = e.target.value || U.todayISO();
      render(cls);
    });

    document.getElementById('abs-search').addEventListener('input', function (e) {
      st.search = e.target.value;
      document.getElementById('abs-list').innerHTML = renderList();
      HK.ui.refreshIcons();
    });

    document.getElementById('abs-all-h').addEventListener('click', function () {
      activeMembers(cls.id).forEach(function (m) { st.records[m.id] = 'H'; });
      document.getElementById('abs-list').innerHTML = renderList();
      HK.ui.refreshIcons();
      updateCounts(cls.id);
    });

    // Delegasi klik tombol status [H][I][S][A] — tanpa re-render (super cepat)
    document.getElementById('abs-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-status]');
      if (!btn) return;
      st.records[btn.getAttribute('data-member')] = btn.getAttribute('data-status');
      var seg = btn.parentElement;
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      updateCounts(cls.id);
    });

    document.getElementById('abs-save').addEventListener('click', function () { save(cls); });

    updateCounts(cls.id);
    HK.ui.refreshIcons();
  }

  function renderList() {
    var members = activeMembers(st.classId);
    if (members.length === 0) {
      return HK.ui.emptyState({
        icon: 'user-plus',
        title: 'Belum ada anggota aktif',
        description: 'Tambahkan anggota terlebih dahulu di tab "Anggota & Jadwal".',
        action: '<button class="btn btn-primary" onclick="HK.app.goToTab(\'' + st.classId + '\',\'anggota\')"><i data-lucide="user-plus"></i> Tambah Anggota</button>'
      });
    }

    var q = (st.search || '').trim().toLowerCase();
    var filtered = members.filter(function (m) {
      return String(m.namaLengkap).toLowerCase().indexOf(q) >= 0;
    });
    if (filtered.length === 0) {
      return '<div class="list-empty">Tidak ada anggota yang cocok dengan pencarian "' + U.escapeHtml(st.search) + '".</div>';
    }

    var html = '<div class="abs-head"><span>Anggota</span><span>Status Kehadiran</span></div>';
    filtered.forEach(function (m, i) {
      var cur = st.records[m.id] || 'H';
      html +=
        '<div class="abs-row">' +
          '<div class="abs-id">' + (i + 1) + '</div>' +
          '<div class="avatar">' + U.escapeHtml(U.initials(m.namaLengkap)) + '</div>' +
          '<div class="abs-name"><b>' + U.escapeHtml(m.namaLengkap) + '</b></div>' +
          '<div class="seg">' +
            ['H', 'I', 'S', 'A'].map(function (s) {
              return '<button type="button" data-status="' + s + '" data-member="' + m.id + '"' +
                ' class="' + (cur === s ? 'active st-' + s : '') + '"' +
                ' title="' + HK.config.STATUS[s].label + '">' + s + '</button>';
            }).join('') +
          '</div>' +
        '</div>';
    });
    return html;
  }

  function updateCounts(classId) {
    var c = { H: 0, I: 0, S: 0, A: 0 };
    activeMembers(classId).forEach(function (m) {
      var s = st.records[m.id];
      if (c[s] !== undefined) c[s]++;
    });
    ['H', 'I', 'S', 'A'].forEach(function (s) {
      var el = document.getElementById('cnt-' + s);
      if (el) el.textContent = c[s];
    });
  }

  function renderSaveBar() {
    return '<div class="save-bar">' +
      '<div class="save-counts">' +
        ['H', 'I', 'S', 'A'].map(function (s) {
          return '<span class="cnt cnt-' + s + '"><i></i>' + HK.config.STATUS[s].label + ': <b id="cnt-' + s + '">0</b></span>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-primary btn-lg" id="abs-save"><i data-lucide="check"></i> Simpan Absensi</button>' +
    '</div>';
  }

  async function save(cls) {
    if (st.pending) return; // anti double-submit
    st.pending = true;
    var btn = document.getElementById('abs-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-light"></span> Menyimpan...';
    try {
      var ds = await HK.api.saveSession({
        classId: cls.id,
        tanggal: st.tanggal,
        catatan: document.getElementById('abs-note').value,
        records: Object.assign({}, st.records)
      });
      HK.app.applyDataset(ds);
      HK.ui.toast('Absensi ' + U.formatTanggalIndo(st.tanggal) + ' tersimpan.');
      st.pending = false;
      HK.app.render(); // re-render -> banner berubah jadi "Mode Edit"
    } catch (err) {
      st.pending = false;
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check"></i> Simpan Absensi';
      HK.ui.refreshIcons();
      HK.ui.toast(err.message, 'error');
    }
  }

  return { render: render };
})();