/* HadirKu — Helper umum (tanggal, format, escape HTML, dsb) */
HK.utils = (function () {

  var JS_DAY_TO_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayName() { return JS_DAY_TO_NAME[new Date().getDay()]; }

  /** Escape HTML — WAJIB untuk semua teks hasil input user sebelum dirender. */
  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

  /** 87.5 -> "87.5%", 100 -> "100%" (tanpa desimal berlebih). */
  function formatPercent(n) {
    var v = round1(n);
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + '%';
  }

  function formatTanggalIndo(iso) { // 'YYYY-MM-DD'
    if (!iso) return '-';
    var p = String(iso).split('-');
    var y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
    if (!y || !m || !d) return String(iso);
    return d + ' ' + HK.config.MONTHS[m - 1] + ' ' + y;
  }

  function formatHariTanggal(iso) {
    var d = new Date(iso + 'T00:00:00');
    return JS_DAY_TO_NAME[d.getDay()] + ', ' + formatTanggalIndo(iso);
  }

  function parseHari(str) {
    return String(str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function formatJadwal(cls) {
    var days = parseHari(cls.hariJadwal);
    var jam = cls.jamJadwal ? ' · ' + cls.jamJadwal : '';
    return (days.join(' & ') || 'Tanpa jadwal') + jam;
  }

  /** FR-02: cocokkan hari berjalan (jam perangkat) dengan jadwal kelas. */
  function matchesToday(cls) {
    return parseHari(cls.hariJadwal).indexOf(todayName()) >= 0;
  }

  function initials(nama) {
    var parts = String(nama || '').trim().split(/\s+/).slice(0, 2);
    var out = '';
    parts.forEach(function (p) { if (p[0]) out += p[0].toUpperCase(); });
    return out || '?';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 250);
    };
  }

  function sortByNama(a, b) {
    return String(a.namaLengkap || '').localeCompare(String(b.namaLengkap || ''), 'id');
  }

  return {
    uid: uid, todayISO: todayISO, todayName: todayName,
    escapeHtml: escapeHtml, round1: round1, formatPercent: formatPercent,
    formatTanggalIndo: formatTanggalIndo, formatHariTanggal: formatHariTanggal,
    parseHari: parseHari, formatJadwal: formatJadwal, matchesToday: matchesToday,
    initials: initials, debounce: debounce, sortByNama: sortByNama
  };
})();