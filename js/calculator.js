/* HadirKu — attendanceCalculator
   Seluruh logika perhitungan rekap bulanan dipisah dari UI (Single Responsibility)
   agar mudah diuji. Semua rumus punya guard pembagian dengan nol (Anti-Bug).

   Rumus (FR-10 & FR-11):
   - Persentase Individu = (Total H individu / Total Sesi bulan tsb) × 100
   - Persentase Kelas    = (Σ Total H seluruh anggota / (Jml anggota × Total Sesi)) × 100
   - Jika penyebut 0  ->  hasil WAJIB 0% (bukan NaN).
   - Hasil dibulatkan ke 1 angka desimal.
*/
HK.calc = (function () {

  var VALID = ['H', 'I', 'S', 'A'];

  function emptyCounts() { return { h: 0, i: 0, s: 0, a: 0 }; }

  /**
   * @param {Object} dataset  {classes, members, sessions, records}
   * @param {string} classId
   * @param {number} year     mis. 2025
   * @param {number} month    1-12
   * @returns {Object} { totalSessions, totalMembers, classPercent, rows, sessions }
   */
  function recapForMonth(dataset, classId, year, month) {
    var mm = String(month).padStart(2, '0');
    var prefix = year + '-' + mm;

    // FR-09: hanya sesi pada bulan & tahun terpilih
    var sessions = (dataset.sessions || []).filter(function (s) {
      return s.classId === classId && String(s.tanggal || '').slice(0, 7) === prefix;
    }).sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });

    var sessionIds = {};
    sessions.forEach(function (s) { sessionIds[s.id] = true; });
    var totalSessions = sessions.length;

    // Index record per anggota (hanya record milik sesi bulan ini)
    var recsByMember = {};
    (dataset.records || []).forEach(function (r) {
      if (!sessionIds[r.sessionId]) return;
      if (!recsByMember[r.memberId]) recsByMember[r.memberId] = [];
      recsByMember[r.memberId].push(r.status);
    });

    // Rekap memuat anggota aktif + anggota nonaktif yang masih punya rekam jejak di bulan tsb
    var rows = [];
    (dataset.members || []).forEach(function (m) {
      if (m.classId !== classId) return;
      var statuses = recsByMember[m.id] || [];
      if (m.aktif === false && statuses.length === 0) return;

      var counts = emptyCounts();
      statuses.forEach(function (st) {
        if (VALID.indexOf(st) >= 0) counts[st.toLowerCase()]++;
      });

      // FR-10 + guard pembagian nol
      var persen = totalSessions > 0 ? HK.utils.round1((counts.h / totalSessions) * 100) : 0;

      rows.push({
        memberId: m.id, namaLengkap: m.namaLengkap,
        aktif: m.aktif !== false,
        h: counts.h, i: counts.i, s: counts.s, a: counts.a,
        persen: persen
      });
    });
    rows.sort(HK.utils.sortByNama);

    // FR-11 + guard: 0 anggota / 0 sesi -> 0%
    var totalHadir = rows.reduce(function (sum, r) { return sum + r.h; }, 0);
    var denominator = rows.length * totalSessions;
    var classPercent = denominator > 0 ? HK.utils.round1((totalHadir / denominator) * 100) : 0;

    return {
      totalSessions: totalSessions,
      totalMembers: rows.length,
      classPercent: classPercent,
      rows: rows,
      sessions: sessions
    };
  }

  return { recapForMonth: recapForMonth };
})();