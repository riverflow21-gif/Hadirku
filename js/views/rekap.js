/* HadirKu — View: Tab Rekap Bulanan
   3 kartu metrik ringkasan di atas + 1 tabel rekap di bawah (FR-09 s.d. FR-12),
   lengkap dengan urutkan, ekspor CSV, dan cetak. */
HK.views.rekap = (function () {
  var U = HK.utils;
  var C = HK.config;
  var st = null;

  function render(cls) {
    if (!st || st.classId !== cls.id) {
      var now = new Date();
      st = { classId: cls.id, month: now.getMonth() + 1, year: now.getFullYear(), sortBy: 'nama' };
    }
    document.getElementById('tab-content').innerHTML = buildTab(cls);
    bind(cls);
    HK.ui.refreshIcons();
  }

  function buildTab(cls) {
    var recap = HK.calc.recapForMonth(HK.state.data, cls.id, st.year, st.month);
    var periode = C.MONTHS[st.month - 1] + ' ' + st.year;

    var monthOpts = C.MONTHS.map(function (m, i) {
      return '<option value="' + (i + 1) + '"' + (st.month === i + 1 ? ' selected' : '') + '>' + m + '</option>';
    }).join('');

    var years = [];
    var nowY = new Date().getFullYear();
    for (var y = nowY - 4; y <= nowY + 1; y++) years.push(y);
    var yearOpts = years.map(function (yy) {
      return '<option value="' + yy + '"' + (st.year === yy ? ' selected' : '') + '>' + yy + '</option>';
    }).join('');

    var sortOpts = [['nama', 'Nama (A–Z)'], ['desc', 'Persentase Tertinggi'], ['asc', 'Persentase Terendah']]
      .map(function (o) {
        return '<option value="' + o[0] + '"' + (st.sortBy === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('');

    return '' +
      '<div class="card pad rekap-filter no-print">' +
        '<div class="filter-field"><label>Bulan</label><select id="rk-month" class="input">' + monthOpts + '</select></div>' +
        '<div class="filter-field"><label>Tahun</label><select id="rk-year" class="input">' + yearOpts + '</select></div>' +
        '<div class="filter-field"><label>Urutkan</label><select id="rk-sort" class="input">' + sortOpts + '</select></div>' +
        '<div class="filter-actions">' +
          '<button class="btn btn-soft" id="rk-csv"><i data-lucide="download"></i> CSV</button>' +
          '<button class="btn btn-soft" id="rk-print"><i data-lucide="printer"></i> Cetak</button>' +
        '</div>' +
      '</div>' +
      '<div class="print-area">' +
        '<div class="print-head">' +
          '<h2>Rekap Absensi — ' + U.escapeHtml(cls.namaKelas) + '</h2>' +
          '<p>Periode: ' + periode + '</p>' +
        '</div>' +
        '<div class="summary-grid">' + summaryCards(recap) + '</div>' +
        '<div class="card">' + tableHtml(recap) + '</div>' +
      '</div>';
  }

  function summaryCards(recap) {
    return (
      card('trending-up', 'Rata-rata Kehadiran Kelas',
        '<div class="big-num">' + U.formatPercent(recap.classPercent) + '</div>' +
        '<div class="progressbar"><div style="width:' + Math.min(100, recap.classPercent) + '%"></div></div>'
      ) +
      card('calendar-check', 'Total Sesi Terlaksana',
        '<div class="big-num tabular">' + recap.totalSessions + '</div>' +
        '<div class="card-sub">pertemuan bulan ini</div>'
      ) +
      card('users', 'Total Anggota',
        '<div class="big-num tabular">' + recap.totalMembers + '</div>' +
        '<div class="card-sub">tercatat di rekap</div>'
      )
    );
  }

  function card(icon, title, body) {
    return '<div class="card pad summary-card">' +
      '<div class="summary-head"><i data-lucide="' + icon + '"></i><span>' + title + '</span></div>' +
      body + '</div>';
  }

  function tableHtml(recap) {
    if (recap.totalSessions === 0) {
      return HK.ui.emptyState({
        icon: 'calendar-x',
        title: 'Belum ada sesi bulan ini',
        description: 'Belum ada absensi yang tersimpan pada periode terpilih. Buka tab Absensi dan simpan sesi pertama untuk bulan ini.'
      });
    }
    var rows = sortRows(recap.rows);
    var html =
      '<div class="table-wrap"><table class="table">' +
      '<thead><tr>' +
        '<th class="col-no">No</th><th>Nama Anggota</th>' +
        '<th class="num">H</th><th class="num">I</th><th class="num">S</th><th class="num">A</th>' +
        '<th class="num">Kehadiran</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r, i) {
      html += '<tr>' +
        '<td class="col-no tabular">' + (i + 1) + '</td>' +
        '<td><div class="cell-name">' + U.escapeHtml(r.namaLengkap) +
          (r.aktif ? '' : ' <span class="badge badge-slate">Nonaktif</span>') + '</div></td>' +
        '<td class="num tabular c-H">' + r.h + '</td>' +
        '<td class="num tabular c-I">' + r.i + '</td>' +
        '<td class="num tabular c-S">' + r.s + '</td>' +
        '<td class="num tabular c-A">' + r.a + '</td>' +
        '<td class="num"><span class="pill ' + pillClass(r.persen) + '">' + U.formatPercent(r.persen) + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function pillClass(p) {
    if (p >= 80) return 'pill-hi';
    if (p >= 60) return 'pill-mid';
    return 'pill-low';
  }

  function sortRows(rows) {
    var copy = rows.slice();
    if (st.sortBy === 'desc') copy.sort(function (a, b) { return (b.persen - a.persen) || U.sortByNama(a, b); });
    else if (st.sortBy === 'asc') copy.sort(function (a, b) { return (a.persen - b.persen) || U.sortByNama(a, b); });
    else copy.sort(U.sortByNama);
    return copy;
  }

  function bind(cls) {
    function rerender() {
      document.getElementById('tab-content').innerHTML = buildTab(cls);
      bind(cls);
      HK.ui.refreshIcons();
    }
    document.getElementById('rk-month').addEventListener('change', function (e) { st.month = Number(e.target.value); rerender(); });
    document.getElementById('rk-year').addEventListener('change', function (e) { st.year = Number(e.target.value); rerender(); });
    document.getElementById('rk-sort').addEventListener('change', function (e) { st.sortBy = e.target.value; rerender(); });
    document.getElementById('rk-csv').addEventListener('click', function () { exportCsv(cls); });
    document.getElementById('rk-print').addEventListener('click', function () { window.print(); });
  }

  /* ---------- Ekspor CSV (pemisah ";" agar rapi di Excel Indonesia) ---------- */
  function exportCsv(cls) {
    var recap = HK.calc.recapForMonth(HK.state.data, cls.id, st.year, st.month);
    var periode = C.MONTHS[st.month - 1] + ' ' + st.year;

    var lines = [
      ['Rekap Absensi - ' + cls.namaKelas],
      ['Periode', periode],
      ['Rata-rata Kehadiran Kelas', U.formatPercent(recap.classPercent)],
      ['Total Sesi Terlaksana', recap.totalSessions],
      [],
      ['No', 'Nama Anggota', 'Hadir (H)', 'Izin (I)', 'Sakit (S)', 'Alfa (A)', 'Persentase (%)']
    ];
    sortRows(recap.rows).forEach(function (r, i) {
      lines.push([i + 1, r.namaLengkap, r.h, r.i, r.s, r.a, U.formatPercent(r.persen)]);
    });

    var csv = '\uFEFF' + lines.map(function (row) {
      return row.map(function (cell) {
        var v = String(cell == null ? '' : cell);
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Rekap_' + cls.namaKelas.replace(/[^\w]+/g, '_') + '_' + st.year + '-' + String(st.month).padStart(2, '0') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    HK.ui.toast('File CSV berhasil diunduh.');
  }

  return { render: render };
})();