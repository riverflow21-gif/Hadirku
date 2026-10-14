/* HadirKu — Konfigurasi global & kontrak data */
window.HK = window.HK || {};

HK.config = {
  APP_NAME: 'HadirKu',
  LS_DATA_KEY: 'hadirku_data_v1',
  LS_SETTINGS_KEY: 'hadirku_settings_v1',

  /**
   * Kredensial Supabase (database cloud PostgreSQL).
   * Bisa diisi langsung di sini (DISARANKAN untuk deploy Vercel), ATAU lewat
   * menu Pengaturan di aplikasi (tersimpan di localStorage).
   * Kosong keduanya = Mode Lokal (localStorage).
   */
  DEFAULT_SUPABASE_URL: 'https://samgzdlwricaropralli.supabase.co',
  DEFAULT_SUPABASE_ANON_KEY: 'sb_publishable_HQ6jSxmUnmcmPQSoepVPfQ_sp20yBpo',

  // Urutan hari (senin -> minggu)
  DAYS: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],

  MONTHS: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],

  // Kontrak status absensi (FR-08): H = 1, selain H = 0
  STATUS: {
    H: { label: 'Hadir', short: 'H', color: 'emerald' },
    I: { label: 'Izin',  short: 'I', color: 'sky' },
    S: { label: 'Sakit', short: 'S', color: 'amber' },
    A: { label: 'Alfa',  short: 'A', color: 'rose' }
  },

  settings: null,

  getSettings: function () {
    if (!this.settings) {
      try { this.settings = JSON.parse(localStorage.getItem(this.LS_SETTINGS_KEY)) || {}; }
      catch (e) { this.settings = {}; }
    }
    return this.settings;
  },

  saveSettings: function (patch) {
    this.settings = Object.assign({}, this.getSettings(), patch);
    localStorage.setItem(this.LS_SETTINGS_KEY, JSON.stringify(this.settings));
  },

  /**
   * Kredensial efektif Supabase. Jika user memilih Mode Lokal secara eksplisit
   * (dataMode = 'local'), kembalikan kosong agar mode lokal tetap berlaku
   * walaupun DEFAULT_SUPABASE_* terisi di config.js.
   */
  getSupabaseConfig: function () {
    var s = this.getSettings();
    var mode = s.dataMode ||
      (this.DEFAULT_SUPABASE_URL && this.DEFAULT_SUPABASE_ANON_KEY ? 'cloud' : 'local');
    if (mode === 'local') return { url: '', key: '' };
    var url = (typeof s.supabaseUrl === 'string' ? s.supabaseUrl.trim() : '') ||
              String(this.DEFAULT_SUPABASE_URL || '').trim();
    var key = (typeof s.supabaseKey === 'string' ? s.supabaseKey.trim() : '') ||
              String(this.DEFAULT_SUPABASE_ANON_KEY || '').trim();
    return { url: url, key: key };
  },

  isCloudMode: function () {
    var cfg = this.getSupabaseConfig();
    return cfg.url !== '' && cfg.key !== '';
  }
};