/* HadirKu — View: Tab Anggota & Jadwal
   Konfigurasi jadwal kelas + daftar anggota (tambah satuan, bulk add,
   edit, nonaktifkan/hapus dengan konfirmasi FR-05). */
HK.views.anggota = (function () {
  var U = HK.utils;
  var st = { search: '' };

  function render(cls) {
    var members = HK.state.data.members
      .filter(function (m) { return m.classId === cls.id; })
      .sort(U.sortByNama);
    var q = st.search.trim().toLowerCase();
    var filtered = members.filter(function (m) {
      return String(m.namaLengkap).toLowerCase().indexOf(q) >= 0;
    });
    var activeCount = members.filter(function (m) { return m.aktif !== false; }).length;

    var days = U.parseHari(cls.hariJadwal);
    var jadwalHtml = days.length
      ? '<div class="chip-group">' + days.map(function (d) {
          return '<span class="chip-on">' + U.escapeHtml(d) + '</span>';
        }).join('') + '</div>' +
        (cls.jamJadwal ? '<p class="jam-text"><i data-lucide="clock"></i> Pukul ' + U.escapeHtml(cls.jamJadwal) + '</p>' : '')
      : '<p class="jadwal-empty">Belum ada jadwal rutin diatur.</p>';

    var html =
      '<div class="card pad mb-16">' +
        '<div class="section-head">' +
          '<div><h2><i data-lucide="calendar-days"></i> Jadwal Rutin</h2>' +
          '<p class="section-sub">Hari pertemuan rutin kelas ini.</p></div>' +
          '<button class="btn btn-soft" onclick="HK.views.classes.openFormModal(\'' + cls.id + '\')">' +
            '<i data-lucide="pencil"></i> Ubah Jadwal &amp; Info</button>' +
        '</div>' + jadwalHtml +
      '</div>' +
      '<div class="card">' +
        '<div class="member-head">' +
          '<div><h2><i data-lucide="users"></i> Daftar Anggota</h2>' +
          '<p class="section-sub">' + activeCount + ' aktif dari ' + members.length + ' anggota</p></div>' +
          '<div class="member-actions">' +
            '<button class="btn btn-soft" onclick="HK.views.anggota.openBulkModal(\'' + cls.id + '\')"><i data-lucide="clipboard-list"></i> Tempel Daftar Nama</button>' +
            '<button class="btn btn-primary" onclick="HK.views.anggota.openAddModal(\'' + cls.id + '\')"><i data-lucide="user-plus"></i> Tambah Anggota</button>' +
          '</div>' +
        '</div>' +
        (members.length
          ? '<div class="member-search"><i data-lucide="search"></i>' +
            '<input type="text" id="mb-search" class="input" placeholder="Cari anggota..." value="' + U.escapeHtml(st.search) + '"></div>' +
            '<div id="mb-list">' + memberList(filtered) + '</div>'
          : HK.ui.emptyState({
              icon: 'user-plus',
              title: 'Belum ada anggota',
              description: 'Tambahkan peserta satu per satu, atau tempel daftar nama sekaligus (satu nama per baris).',
              action: '<button class="btn btn-primary" onclick="HK.views.anggota.openBulkModal(\'' + cls.id + '\')"><i data-lucide="clipboard-list"></i> Tempel Daftar Nama</button>'
            })
        ) +
      '</div>';

    document.getElementById('tab-content').innerHTML = html;

    var searchEl = document.getElementById('mb-search');
    if (searchEl) {
      searchEl.addEventListener('input', function (e) {
        st.search = e.target.value;
        var needle = st.search.trim().toLowerCase();
        var f = members.filter(function (m) {
          return String(m.namaLengkap).toLowerCase().indexOf(needle) >= 0;
        });
        document.getElementById('mb-list').innerHTML = memberList(f);
        HK.ui.refreshIcons();
      });
    }
    HK.ui.refreshIcons();
  }

  function memberList(members) {
    if (members.length === 0) return '<div class="list-empty">Tidak ada anggota yang cocok dengan pencarian.</div>';
    return members.map(function (m, i) {
      return '<div class="member-row' + (m.aktif === false ? ' inactive' : '') + '">' +
        '<div class="abs-id">' + (i + 1) + '</div>' +
        '<div class="avatar">' + U.escapeHtml(U.initials(m.namaLengkap)) + '</div>' +
        '<div class="abs-name"><b>' + U.escapeHtml(m.namaLengkap) + '</b></div>' +
        (m.aktif === false ? '<span class="badge badge-slate">Nonaktif</span>' : '') +
        '<span class="member-actions-row">' +
          '<button class="icon-btn" title="Ubah" onclick="HK.views.anggota.openEditModal(\'' + m.id + '\')"><i data-lucide="pencil"></i></button>' +
          '<button class="icon-btn danger" title="Hapus" onclick="HK.views.anggota.openDeleteModal(\'' + m.id + '\')"><i data-lucide="trash-2"></i></button>' +
        '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------- Tambah satu anggota ---------- */
  function openAddModal(classId) {
    HK.ui.openModal({
      title: 'Tambah Anggota',
      body:
        '<div class="form-group"><label>Nama Lengkap <span class="req">*</span></label>' +
          '<input type="text" id="m-nama" class="input" maxlength="100" placeholder="cth: Budi Santoso"></div>' +
        '<p class="form-error" id="m-error"></p>',
      footer:
        '<button class="btn btn-ghost" data-close-modal>Batal</button>' +
        '<button class="btn btn-primary" id="m-save"><i data-lucide="plus"></i> Simpan</button>',
      onOpen: function () {
        document.getElementById('m-nama').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); document.getElementById('m-save').click(); }
        });
        document.getElementById('m-save').addEventListener('click', async function () {
          var btn = document.getElementById('m-save');
          try {
            btn.disabled = true; // anti double-submit
            var ds = await HK.api.saveMembers([{
              classId: classId,
              namaLengkap: document.getElementById('m-nama').value
            }]);
            HK.app.applyDataset(ds);
            HK.ui.closeModal();
            HK.ui.toast('Anggota baru ditambahkan.');
            HK.app.render();
          } catch (err) {
            btn.disabled = false;
            document.getElementById('m-error').textContent = err.message;
          }
        });
      }
    });
  }

  /* ---------- Bulk add (FR-04): satu nama per baris, duplikat dilewati ---------- */
  function openBulkModal(classId) {
    HK.ui.openModal({
      title: 'Tempel Daftar Nama',
      body:
        '<div class="form-group"><label>Daftar Nama <span class="req">*</span></label>' +
          '<textarea id="b-names" class="textarea" rows="8" placeholder="Satu nama per baris, contoh:&#10;Budi Santoso&#10;Siti Aminah&#10;Raka Pratama"></textarea>' +
          '<p class="field-hint">Setiap baris dihitung sebagai satu anggota. Nama duplikat otomatis dilewati.</p></div>' +
        '<p class="form-error" id="b-error"></p>',
      footer:
        '<button class="btn btn-ghost" data-close-modal>Batal</button>' +
        '<button class="btn btn-primary" id="b-save"><i data-lucide="check"></i> Simpan Semua</button>',
      onOpen: function () {
        document.getElementById('b-save').addEventListener('click', async function () {
          var btn = document.getElementById('b-save');
          var raw = document.getElementById('b-names').value;

          var existing = {};
          HK.state.data.members.forEach(function (m) {
            if (m.classId === classId) existing[String(m.namaLengkap).trim().toLowerCase()] = true;
          });

          var seen = {}, toAdd = [], duplicates = 0;
          raw.split(/\r?\n/).forEach(function (line) {
            var nama = line.trim(); // wajib trimming
            if (!nama) return;
            var key = nama.toLowerCase();
            if (existing[key] || seen[key]) { duplicates++; return; }
            seen[key] = true;
            toAdd.push({ classId: classId, namaLengkap: nama });
          });

          if (toAdd.length === 0) {
            document.getElementById('b-error').textContent =
              duplicates > 0 ? 'Semua nama sudah terdaftar sebelumnya.' : 'Daftar nama masih kosong.';
            return;
          }
          try {
            btn.disabled = true; // anti double-submit
            btn.innerHTML = '<span class="spinner-light"></span> Menyimpan...';
            var ds = await HK.api.saveMembers(toAdd);
            HK.app.applyDataset(ds);
            HK.ui.closeModal();
            HK.ui.toast(toAdd.length + ' anggota ditambahkan' + (duplicates ? ', ' + duplicates + ' duplikat dilewati' : '') + '.');
            HK.app.render();
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="check"></i> Simpan Semua';
            document.getElementById('b-error').textContent = err.message;
          }
        });
      }
    });
  }

  /* ---------- Edit anggota ---------- */
  function openEditModal(memberId) {
    var m = HK.state.data.members.find(function (x) { return x.id === memberId; });
    if (!m) return;
    HK.ui.openModal({
      title: 'Ubah Anggota',
      body:
        '<div class="form-group"><label>Nama Lengkap <span class="req">*</span></label>' +
          '<input type="text" id="m-nama" class="input" maxlength="100" value="' + U.escapeHtml(m.namaLengkap) + '"></div>' +
        '<label class="check-row"><input type="checkbox" id="m-aktif"' + (m.aktif !== false ? ' checked' : '') + '>' +
          '<span>Anggota aktif (ikut absensi &amp; rekap)</span></label>' +
        '<p class="form-error" id="m-error"></p>',
      footer:
        '<button class="btn btn-ghost" data-close-modal>Batal</button>' +
        '<button class="btn btn-primary" id="m-save"><i data-lucide="save"></i> Simpan Perubahan</button>',
      onOpen: function () {
        document.getElementById('m-save').addEventListener('click', async function () {
          var btn = document.getElementById('m-save');
          try {
            btn.disabled = true;
            var ds = await HK.api.updateMember({
              id: m.id, classId: m.classId,
              namaLengkap: document.getElementById('m-nama').value,
              aktif: document.getElementById('m-aktif').checked
            });
            HK.app.applyDataset(ds);
            HK.ui.closeModal();
            HK.ui.toast('Data anggota diperbarui.');
            HK.app.render();
          } catch (err) {
            btn.disabled = false;
            document.getElementById('m-error').textContent = err.message;
          }
        });
      }
    });
  }

  /* ---------- Hapus anggota (FR-05: wajib konfirmasi bila ada riwayat) ---------- */
  function openDeleteModal(memberId) {
    var m = HK.state.data.members.find(function (x) { return x.id === memberId; });
    if (!m) return;
    var hasHistory = HK.state.data.records.some(function (r) { return r.memberId === memberId; });

    if (hasHistory) {
      HK.ui.openModal({
        title: 'Hapus Anggota',
        body:
          '<div class="confirm-icon danger"><i data-lucide="alert-triangle"></i></div>' +
          '<p class="confirm-msg"><b>' + U.escapeHtml(m.namaLengkap) + '</b> sudah memiliki riwayat absensi.<br>' +
          'Menghapus permanen akan ikut menghapus seluruh catatan kehadirannya dan mengubah angka rekap bulanan. ' +
          'Alternatif yang aman: <b>nonaktifkan</b> anggota (riwayat tetap tersimpan).</p>',
        footer:
          '<button class="btn btn-ghost" data-close-modal>Batal</button>' +
          '<button class="btn btn-soft" id="d-deact">Nonaktifkan Saja</button>' +
          '<button class="btn btn-danger" id="d-del">Hapus Permanen</button>',
        onOpen: function () {
          document.getElementById('d-deact').addEventListener('click', function () { doDeactivate(m); });
          document.getElementById('d-del').addEventListener('click', function () { doDelete(m); });
        }
      });
    } else {
      HK.ui.confirm({
        title: 'Hapus Anggota',
        danger: true,
        message: 'Yakin ingin menghapus <b>' + U.escapeHtml(m.namaLengkap) + '</b> dari kelas ini?',
        confirmText: 'Ya, Hapus',
        onConfirm: async function () {
          var ds = await HK.api.deleteMember(memberId);
          HK.app.applyDataset(ds);
          HK.ui.toast('Anggota dihapus.', 'info');
          HK.app.render();
        }
      });
    }
  }

  async function doDeactivate(m) {
    try {
      var ds = await HK.api.updateMember(Object.assign({}, m, { aktif: false }));
      HK.app.applyDataset(ds);
      HK.ui.closeModal();
      HK.ui.toast(m.namaLengkap + ' dinonaktifkan. Riwayat tetap tersimpan.', 'info');
      HK.app.render();
    } catch (err) { HK.ui.toast(err.message, 'error'); }
  }

  async function doDelete(m) {
    try {
      var ds = await HK.api.deleteMember(m.id);
      HK.app.applyDataset(ds);
      HK.ui.closeModal();
      HK.ui.toast('Anggota "' + m.namaLengkap + '" dihapus permanen.', 'info');
      HK.app.render();
    } catch (err) { HK.ui.toast(err.message, 'error'); }
  }

  return { render: render, openAddModal: openAddModal, openBulkModal: openBulkModal,
           openEditModal: openEditModal, openDeleteModal: openDeleteModal };
})();