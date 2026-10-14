/* HadirKu — View: Daftar Kelas (halaman utama) + form buat/ubah kelas */
HK.views = HK.views || {};

HK.views.classes = (function () {
  var U = HK.utils;
  var C = HK.config;

  function render() {
    var ds = HK.state.data;
    var classes = ds.classes.slice().sort(function (a, b) {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

    var activeCount = {};
    ds.members.forEach(function (m) {
      if (m.aktif === false) return;
      activeCount[m.classId] = (activeCount[m.classId] || 0) + 1;
    });

    var html =
      '<div class="page-head">' +
        '<div><h1>Daftar Kelas</h1><p class="page-sub">' + classes.length + ' kelas terdaftar</p></div>' +
        '<button class="btn btn-primary" onclick="HK.views.classes.openFormModal()">' +
          '<i data-lucide="plus"></i> Buat Kelas</button>' +
      '</div>';

    if (classes.length === 0) {
      html += HK.ui.emptyState({
        icon: 'school',
        title: 'Belum ada kelas',
        description: 'Buat kelas pertamamu, atur jadwal rutinnya, lalu mulai catat kehadiran anggota dalam hitungan detik.',
        action: '<button class="btn btn-primary" onclick="HK.views.classes.openFormModal()">' +
                '<i data-lucide="plus"></i> Buat Kelas Pertama</button>'
      });
    } else {
      html += '<div class="class-grid">';
      classes.forEach(function (c) {
        var count = activeCount[c.id] || 0;
        var badge = U.matchesToday(c)
          ? '<span class="badge badge-primary"><i data-lucide="calendar-check"></i> Jadwal Hari Ini</span>'
          : '';
        html +=
          '<div class="class-card" onclick="HK.app.goToClass(\'' + c.id + '\')">' +
            '<div class="class-card-top">' +
              '<div class="class-avatar"><i data-lucide="users"></i></div>' +
              '<div class="class-card-title">' +
                '<h3>' + U.escapeHtml(c.namaKelas) + '</h3>' + badge +
              '</div>' +
            '</div>' +
            '<p class="class-jadwal"><i data-lucide="clock"></i> ' + U.escapeHtml(U.formatJadwal(c)) + '</p>' +
            (c.deskripsi ? '<p class="class-desc">' + U.escapeHtml(c.deskripsi) + '</p>' : '') +
            '<div class="class-card-foot">' +
              '<span>' + count + ' anggota aktif</span>' +
              '<span class="class-card-actions">' +
                '<button class="icon-btn" title="Ubah" onclick="event.stopPropagation();HK.views.classes.openFormModal(\'' + c.id + '\')"><i data-lucide="pencil"></i></button>' +
                '<button class="icon-btn danger" title="Hapus" onclick="event.stopPropagation();HK.views.classes.openDeleteModal(\'' + c.id + '\')"><i data-lucide="trash-2"></i></button>' +
              '</span>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    document.getElementById('app').innerHTML = html;
    HK.ui.refreshIcons();
  }

  /* ---------- Modal buat / ubah kelas (FR-01) ---------- */
  function openFormModal(classId) {
    var cls = classId ? HK.state.data.classes.find(function (c) { return c.id === classId; }) : null;
    var days = cls ? U.parseHari(cls.hariJadwal) : [];

    var dayChips = C.DAYS.map(function (d) {
      return '<label class="chip"><input type="checkbox" name="hk-day" value="' + d + '"' +
             (days.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + d + '</span></label>';
    }).join('');

    HK.ui.openModal({
      title: cls ? 'Ubah Kelas' : 'Buat Kelas Baru',
      body:
        '<div class="form-group"><label>Nama Kelas <span class="req">*</span></label>' +
          '<input type="text" id="f-nama" class="input" maxlength="80" placeholder="cth: Kelas B. Inggris Dasar" value="' + U.escapeHtml(cls ? cls.namaKelas : '') + '">' +
          '<p class="field-hint">Minimal 3 karakter.</p></div>' +
        '<div class="form-group"><label>Hari Jadwal Rutin <span class="req">*</span></label>' +
          '<div class="chip-group">' + dayChips + '</div></div>' +
        '<div class="form-group"><label>Jam Kelas <span class="req">*</span></label>' +
          '<input type="time" id="f-jam" class="input" value="' + U.escapeHtml(cls ? cls.jamJadwal || '09:00' : '09:00') + '"></div>' +
        '<div class="form-group"><label>Deskripsi <span class="opt">opsional</span></label>' +
          '<textarea id="f-desk" class="textarea" rows="2" placeholder="cth: Kelas rutin grammar & conversation">' + U.escapeHtml(cls ? cls.deskripsi || '' : '') + '</textarea></div>' +
        '<p class="form-error" id="f-error"></p>',
      footer:
        '<button class="btn btn-ghost" data-close-modal>Batal</button>' +
        '<button class="btn btn-primary" id="f-save"><i data-lucide="save"></i> Simpan Kelas</button>',
      onOpen: function () {
        document.getElementById('f-save').addEventListener('click', function () { submit(cls ? cls.id : null); });
        document.getElementById('f-nama').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); document.getElementById('f-save').click(); }
        });
      }
    });
  }

  async function submit(editId) {
    var btn = document.getElementById('f-save');
    var errEl = document.getElementById('f-error');
    errEl.textContent = '';
    var payload = {
      id: editId || '',
      namaKelas: document.getElementById('f-nama').value,
      hariJadwal: Array.prototype.map.call(
        document.querySelectorAll('input[name="hk-day"]:checked'), function (el) { return el.value; }),
      jamJadwal: document.getElementById('f-jam').value,
      deskripsi: document.getElementById('f-desk').value
    };
    try {
      btn.disabled = true; // anti double-submit
      var ds = await HK.api.saveClass(payload);
      HK.app.applyDataset(ds);
      HK.ui.closeModal();
      HK.ui.toast(editId ? 'Perubahan kelas disimpan.' : 'Kelas baru berhasil dibuat.');
      HK.app.render();
    } catch (err) {
      btn.disabled = false;
      errEl.textContent = err.message;
    }
  }

  /* ---------- Hapus kelas (kaskade + konfirmasi) ---------- */
  function openDeleteModal(classId) {
    var cls = HK.state.data.classes.find(function (c) { return c.id === classId; });
    if (!cls) return;
    var nMembers = HK.state.data.members.filter(function (m) { return m.classId === classId; }).length;

    HK.ui.confirm({
      title: 'Hapus Kelas',
      icon: 'trash-2',
      danger: true,
      message: 'Yakin ingin menghapus kelas <b>' + U.escapeHtml(cls.namaKelas) + '</b>?' +
        (nMembers ? ' Seluruh <b>' + nMembers + ' anggota</b> dan seluruh riwayat absensinya akan ikut terhapus permanen.' : ''),
      confirmText: 'Ya, Hapus Kelas',
      onConfirm: async function () {
        var ds = await HK.api.deleteClass(classId);
        HK.app.applyDataset(ds);
        HK.ui.toast('Kelas "' + cls.namaKelas + '" dihapus.', 'info');
        if (HK.state.route && HK.state.route.classId === classId) location.hash = '#/';
        else HK.app.render();
      }
    });
  }

  return { render: render, openFormModal: openFormModal, openDeleteModal: openDeleteModal };
})();