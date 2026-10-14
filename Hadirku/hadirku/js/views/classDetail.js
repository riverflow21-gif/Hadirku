/* HadirKu — View: kerangka detail kelas (header + 3 navigasi tab horizontal)
   Batasan layout: setiap tab hanya menampilkan SATU fungsi utama. */
HK.views.classDetail = (function () {
  var U = HK.utils;

  var TABS = [
    { id: 'absensi', label: 'Absensi',        icon: 'clipboard-check' },
    { id: 'rekap',   label: 'Rekap Bulanan',  icon: 'bar-chart-3' },
    { id: 'anggota', label: 'Anggota & Jadwal', icon: 'users' }
  ];

  function render(classId, tab) {
    var cls = HK.state.data.classes.find(function (c) { return c.id === classId; });
    if (!cls) { location.hash = '#/'; return; }

    var isToday = U.matchesToday(cls);

    var html =
      '<div class="detail-head">' +
        '<button class="btn btn-back" onclick="location.hash=\'#/\'"><i data-lucide="arrow-left"></i> Semua Kelas</button>' +
        '<div class="detail-title">' +
          '<h1>' + U.escapeHtml(cls.namaKelas) + '</h1>' +
          '<div class="detail-meta">' +
            '<span><i data-lucide="clock"></i> ' + U.escapeHtml(U.formatJadwal(cls)) + '</span>' +
            (isToday ? '<span class="badge badge-primary"><i data-lucide="calendar-check"></i> Jadwal Hari Ini</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<nav class="tabs">' +
        TABS.map(function (t) {
          return '<button class="tab' + (t.id === tab ? ' active' : '') +
            '" onclick="HK.app.goToTab(\'' + classId + '\',\'' + t.id + '\')">' +
            '<i data-lucide="' + t.icon + '"></i> ' + t.label + '</button>';
        }).join('') +
      '</nav>' +
      '<div id="tab-content"></div>';

    document.getElementById('app').innerHTML = html;
    HK.ui.refreshIcons();

    // Delegasi ke modul tab: absensi | rekap | anggota
    HK.views[tab].render(cls);
  }

  return { render: render };
})();