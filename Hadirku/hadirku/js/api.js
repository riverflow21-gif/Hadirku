/* HadirKu — storageService / api
   Dua driver dengan kontrak identik (pemilihan otomatis):
   1. cloud : Supabase (PostgreSQL) via @supabase/supabase-js
   2. local : localStorage (mode demo / offline / MVP)

   Kontrak: semua method TULIS mengembalikan Promise<dataset lengkap terbaru>,
   sehingga UI selalu konsisten tanpa logika merge yang rawan bug.
*/
HK.api = (function () {

  /* ---------- Normalisasi & guard struktur data ---------- */
  function normalizeDataset(ds) {
    ds = ds || {};
    var out = {
      classes:  Array.isArray(ds.classes)  ? ds.classes  : [],
      members:  Array.isArray(ds.members)  ? ds.members  : [],
      sessions: Array.isArray(ds.sessions) ? ds.sessions : [],
      records:  Array.isArray(ds.records)  ? ds.records  : []
    };
    out.members.forEach(function (m) { m.aktif = m.aktif !== false; });
    return out;
  }

  /* ---------- Validasi (defensive programming: trim, syarat minimal) ---------- */
  function trimOrThrow(value, label, minLen) {
    var v = String(value == null ? '' : value).trim();
    if (v.length < minLen) throw new Error(label + ' minimal ' + minLen + ' karakter.');
    return v;
  }

  function prepareClass(p) {
    p.namaKelas = trimOrThrow(p.namaKelas, 'Nama kelas', 3);
    var days = Array.isArray(p.hariJadwal) ? p.hariJadwal.filter(Boolean) : [];
    if (days.length === 0) throw new Error('Pilih minimal 1 hari jadwal rutin.');
    for (var i = 0; i < days.length; i++) {
      if (HK.config.DAYS.indexOf(days[i]) < 0) throw new Error('Hari jadwal tidak valid.');
    }
    p.hariJadwal = days.join(',');
    p.jamJadwal = String(p.jamJadwal || '').trim();
    if (!/^\d{2}:\d{2}$/.test(p.jamJadwal)) throw new Error('Jam kelas wajib diisi (format HH:MM).');
    p.deskripsi = String(p.deskripsi || '').trim();
    // createdAt hanya untuk baris BARU agar created_at lama tidak tertimpa saat edit
    var isNew = !p.id;
    if (!p.id) p.id = HK.utils.uid('cls');
    if (isNew && !p.createdAt) p.createdAt = new Date().toISOString();
    return p;
  }

  function prepareMember(m) {
    m.namaLengkap = trimOrThrow(m.namaLengkap, 'Nama anggota', 1);
    var isNew = !m.id;
    if (!m.id) m.id = HK.utils.uid('mbr');
    if (isNew && !m.createdAt) m.createdAt = new Date().toISOString();
    m.aktif = m.aktif !== false;
    return m;
  }

  /* ==================== DRIVER CLOUD (Supabase) ==================== */

  /* Pemetaan baris Postgres (snake_case) <-> aplikasi (camelCase) */
  function mapClassRow(r) {
    return { id: String(r.id), namaKelas: r.nama_kelas || '', hariJadwal: r.hari_jadwal || '',
             jamJadwal: r.jam_jadwal || '', deskripsi: r.deskripsi || '', createdAt: r.created_at || '' };
  }
  function classToRow(c) {
    var row = { id: c.id, nama_kelas: c.namaKelas, hari_jadwal: c.hariJadwal,
                jam_jadwal: c.jamJadwal, deskripsi: c.deskripsi || '' };
    if (c.createdAt) row.created_at = c.createdAt;
    return row;
  }
  function mapMemberRow(r) {
    return { id: String(r.id), classId: r.class_id, namaLengkap: r.nama_lengkap || '',
             aktif: r.aktif !== false, createdAt: r.created_at || '' };
  }
  function memberToRow(m) {
    var row = { id: m.id, class_id: m.classId, nama_lengkap: m.namaLengkap, aktif: m.aktif !== false };
    if (m.createdAt) row.created_at = m.createdAt;
    return row;
  }
  function mapSessionRow(r) {
    return { id: String(r.id), classId: r.class_id, tanggal: r.tanggal,
             catatan: r.catatan || '', createdAt: r.created_at || '' };
  }
  function sessionToRow(s) {
    var row = { id: s.id, class_id: s.classId, tanggal: s.tanggal, catatan: s.catatan || '' };
    if (s.createdAt) row.created_at = s.createdAt;
    return row;
  }
  function mapRecordRow(r) {
    return { sessionId: r.session_id, memberId: r.member_id, status: r.status };
  }

  function mapDataset(raw) {
    return normalizeDataset({
      classes:  (raw.classes  || []).map(mapClassRow),
      members:  (raw.members  || []).map(mapMemberRow),
      sessions: (raw.sessions || []).map(mapSessionRow),
      records:  (raw.records  || []).map(mapRecordRow)
    });
  }

  /* Klien supabase-js di-cache; dibuat ulang otomatis bila kredensial berubah */
  var sbClient = null, sbCfgUrl = 'https://samgzdlwricaropralli.supabase.co', sbCfgKey = 'sb_publishable_HQ6jSxmUnmcmPQSoepVPfQ_sp20yBpo';

  function getClient() {
    var cfg = HK.config.getSupabaseConfig();
    if (!cfg.url || !cfg.key) {
      throw new Error('Project URL & Anon Key Supabase belum diatur (buka Pengaturan / isi config.js).');
    }
    if (!sbClient || sbCfgUrl !== cfg.url || sbCfgKey !== cfg.key) {
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Library @supabase/supabase-js belum termuat (periksa koneksi / file vendor).');
      }
      sbClient = window.supabase.createClient(cfg.url, cfg.key);
      sbCfgUrl = cfg.url;
      sbCfgKey = cfg.key;
    }
    return sbClient;
  }

  async function fetchAll(c) {
    var tables = ['classes', 'members', 'sessions', 'records'];
    var raw = {};
    for (var i = 0; i < tables.length; i++) {
      var name = tables[i];
      var res = await c.from(name).select('*');
      if (res.error) throw new Error('Gagal memuat data (' + name + '): ' + res.error.message);
      raw[name] = res.data || [];
    }
    return mapDataset(raw);
  }

  var cloud = {
    getAllData: async function () {
      return fetchAll(getClient());
    },

    saveClass: async function (p) {
      var c = getClient();
      p = prepareClass(p);
      var res = await c.from('classes').upsert(classToRow(p));
      if (res.error) throw new Error(res.error.message);
      return fetchAll(c);
    },

    deleteClass: async function (classId) {
      var c = getClient();
      // FK "on delete cascade" otomatis menghapus members, sessions, dan records terkait
      var res = await c.from('classes').delete().eq('id', classId);
      if (res.error) throw new Error(res.error.message);
      return fetchAll(c);
    },

    saveMembers: async function (members) {
      var c = getClient();
      var rows = (members || []).map(prepareMember).map(memberToRow);
      if (rows.length === 0) return fetchAll(c);
      var res = await c.from('members').upsert(rows);
      if (res.error) throw new Error(res.error.message);
      return fetchAll(c);
    },

    updateMember: function (p) { return cloud.saveMembers([p]); },

    deleteMember: async function (memberId) {
      var c = getClient();
      // records terkait terhapus otomatis via "on delete cascade"
      var res = await c.from('members').delete().eq('id', memberId);
      if (res.error) throw new Error(res.error.message);
      return fetchAll(c);
    },

    /** FR-06: upsert 1 sesi per kelas per tanggal + ganti seluruh record-nya. */
    saveSession: async function (p) {
      var c = getClient();

      // Cari sesi existing (class_id + tanggal) -> jika ada berarti mode Edit
      var found = await c.from('sessions').select('id')
        .eq('class_id', p.classId).eq('tanggal', p.tanggal).maybeSingle();
      if (found.error) throw new Error(found.error.message);

      var sessionId = found.data ? found.data.id : HK.utils.uid('ses');
      var row = { id: sessionId, class_id: p.classId, tanggal: p.tanggal,
                  catatan: String(p.catatan || '').trim() };

      var up = await c.from('sessions').upsert(row);
      if (up.error) throw new Error(up.error.message);

      // Ganti seluruh record milik sesi ini dengan draft terbaru
      var del = await c.from('records').delete().eq('session_id', sessionId);
      if (del.error) throw new Error(del.error.message);

      var rows = Object.keys(p.records || {}).map(function (memberId) {
        return { session_id: sessionId, member_id: memberId, status: p.records[memberId] };
      }).filter(function (r) { return ['H', 'I', 'S', 'A'].indexOf(r.status) >= 0; });

      if (rows.length > 0) {
        var ins = await c.from('records').insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
      return fetchAll(c);
    },

    /** Restore backup JSON: menimpa seluruh isi 4 tabel (urutan FK dijaga). */
    importData: async function (ds) {
      var c = getClient();
      ds = normalizeDataset(ds);

      // Hapus anak dulu (urutan FK), lalu isi ulang induk -> anak
      var steps = [
        ['records',  'session_id'],
        ['sessions', 'id'],
        ['members',  'id'],
        ['classes',  'id']
      ];
      for (var i = 0; i < steps.length; i++) {
        var res = await c.from(steps[i][0]).delete().neq(steps[i][1], '');
        if (res.error) throw new Error('Gagal membersihkan ' + steps[i][0] + ': ' + res.error.message);
      }

      if (ds.classes.length > 0) {
        var insC = await c.from('classes').insert(ds.classes.map(classToRow));
        if (insC.error) throw new Error(insC.error.message);
      }
      if (ds.members.length > 0) {
        var insM = await c.from('members').insert(ds.members.map(memberToRow));
        if (insM.error) throw new Error(insM.error.message);
      }
      if (ds.sessions.length > 0) {
        var insS = await c.from('sessions').insert(ds.sessions.map(sessionToRow));
        if (insS.error) throw new Error(insS.error.message);
      }
      if (ds.records.length > 0) {
        var insR = await c.from('records').insert(ds.records.map(mapRecordRow));
        if (insR.error) throw new Error(insR.error.message);
      }
      return fetchAll(c);
    },

    testConnection: async function () {
      var c = getClient();
      var res = await c.from('classes').select('id', { count: 'exact', head: true });
      if (res.error) throw new Error(res.error.message);
      return { ok: true, mode: 'cloud' };
    }
  };

  /* ==================== DRIVER LOCAL (localStorage) ==================== */
  function localRead() {
    try {
      var raw = localStorage.getItem(HK.config.LS_DATA_KEY);
      if (raw) return normalizeDataset(JSON.parse(raw));
    } catch (e) { /* korup -> mulai baru */ }
    return { classes: [], members: [], sessions: [], records: [] };
  }

  function localWrite(ds) {
    localStorage.setItem(HK.config.LS_DATA_KEY, JSON.stringify(ds));
    return ds;
  }

  function localUpsert(arr, item) {
    var i = arr.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) arr[i] = Object.assign({}, arr[i], item);
    else arr.push(item);
  }

  var local = {
    getAllData: function () { return Promise.resolve(localRead()); },

    saveClass: function (p) {
      var ds = localRead();
      localUpsert(ds.classes, prepareClass(p));
      return Promise.resolve(localWrite(ds));
    },

    deleteClass: function (classId) {
      var ds = localRead();
      var sessionIds = {};
      ds.sessions = ds.sessions.filter(function (s) {
        if (s.classId === classId) { sessionIds[s.id] = true; return false; }
        return true;
      });
      ds.members = ds.members.filter(function (m) { return m.classId !== classId; });
      ds.records = ds.records.filter(function (r) { return !sessionIds[r.sessionId]; });
      ds.classes = ds.classes.filter(function (c) { return c.id !== classId; });
      return Promise.resolve(localWrite(ds));
    },

    saveMembers: function (members) {
      var ds = localRead();
      (members || []).forEach(function (m) { localUpsert(ds.members, prepareMember(m)); });
      return Promise.resolve(localWrite(ds));
    },

    updateMember: function (p) { return local.saveMembers([p]); },

    deleteMember: function (memberId) {
      var ds = localRead();
      ds.members = ds.members.filter(function (m) { return m.id !== memberId; });
      ds.records = ds.records.filter(function (r) { return r.memberId !== memberId; });
      return Promise.resolve(localWrite(ds));
    },

    saveSession: function (p) {
      var ds = localRead();
      var session = ds.sessions.find(function (s) {
        return s.classId === p.classId && s.tanggal === p.tanggal;
      });
      if (!session) {
        session = { id: HK.utils.uid('ses'), classId: p.classId, tanggal: p.tanggal, createdAt: new Date().toISOString() };
        ds.sessions.push(session);
      }
      session.catatan = String(p.catatan || '').trim();
      ds.records = ds.records.filter(function (r) { return r.sessionId !== session.id; });
      Object.keys(p.records || {}).forEach(function (memberId) {
        var st = p.records[memberId];
        if (['H', 'I', 'S', 'A'].indexOf(st) >= 0) {
          ds.records.push({ sessionId: session.id, memberId: memberId, status: st });
        }
      });
      return Promise.resolve(localWrite(ds));
    },

    importData: function (ds) { return Promise.resolve(localWrite(normalizeDataset(ds))); },

    testConnection: function () { return Promise.resolve({ ok: true, mode: 'local' }); }
  };

  /* ==================== PUBLIC ==================== */
  function driver() { return HK.config.isCloudMode() ? cloud : local; }

  function delegate(method) {
    return function () { return driver()[method].apply(null, arguments); };
  }

  return {
    getAllData:   delegate('getAllData'),
    saveClass:    delegate('saveClass'),
    deleteClass:  delegate('deleteClass'),
    saveMembers:  delegate('saveMembers'),
    updateMember: delegate('updateMember'),
    deleteMember: delegate('deleteMember'),
    saveSession:  delegate('saveSession'),
    importData:   delegate('importData'),
    testConnection: delegate('testConnection'),
    isCloudMode: function () { return HK.config.isCloudMode(); },
    normalizeDataset: normalizeDataset
  };
})();