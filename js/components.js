/* HadirKu — Komponen UI reusable: Modal, Toast, Badge, Empty State, Confirm */
HK.ui = (function () {
  var U = HK.utils;
  var C = HK.config;

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  /* ---------- Toast ---------- */
  var TOAST_ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info' };

  function toast(message, type) {
    type = type || 'success';
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<i data-lucide="' + (TOAST_ICONS[type] || 'info') + '"></i>' +
                   '<span>' + U.escapeHtml(message) + '</span>';
    root.appendChild(el);
    refreshIcons();
    setTimeout(function () {
      el.classList.add('toast-out');
      setTimeout(function () { el.remove(); }, 300);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  var escBound = false;

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function openModal(opts) {
    var root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-overlay" data-modal-overlay>' +
        '<div class="modal' + (opts.size === 'lg' ? ' modal-lg' : '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            '<h3>' + U.escapeHtml(opts.title || '') + '</h3>' +
            '<button type="button" class="icon-btn" data-close-modal aria-label="Tutup"><i data-lucide="x"></i></button>' +
          '</div>' +
          '<div class="modal-body">' + (opts.body || '') + '</div>' +
          (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
        '</div>' +
      '</div>';
    document.body.classList.add('modal-open');

    root.querySelector('[data-modal-overlay]').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
    root.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });
    if (!escBound) {
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
      escBound = true;
    }
    refreshIcons();
    if (typeof opts.onOpen === 'function') opts.onOpen(root);

    var firstInput = root.querySelector('input:not([type=hidden]):not([type=radio]), textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 60);
  }

  /* ---------- Confirm dialog (dengan anti double-submit) ---------- */
  function confirm(opts) {
    openModal({
      title: opts.title || 'Konfirmasi',
      body:
        '<div class="confirm-icon' + (opts.danger ? ' danger' : '') + '">' +
          '<i data-lucide="' + (opts.icon || 'alert-triangle') + '"></i></div>' +
        '<p class="confirm-msg">' + (opts.message || '') + '</p>',
      footer:
        '<button type="button" class="btn btn-ghost" data-close-modal>Batal</button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="confirm-btn">' +
          U.escapeHtml(opts.confirmText || 'Ya, Lanjutkan') + '</button>',
      onOpen: function () {
        document.getElementById('confirm-btn').addEventListener('click', function () {
          var btn = document.getElementById('confirm-btn');
          var label = btn.textContent;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-light"></span> Memproses...';
          Promise.resolve().then(opts.onConfirm).then(function () {
            closeModal();
          }).catch(function (err) {
            btn.disabled = false;
            btn.textContent = label;
            toast(err && err.message ? err.message : 'Terjadi kesalahan.', 'error');
          });
        });
      }
    });
  }

  /* ---------- Badge status absensi ---------- */
  function statusBadge(status) {
    var meta = C.STATUS[status];
    if (!meta) return '';
    return '<span class="badge badge-' + meta.color + '">' + meta.short + ' · ' + meta.label + '</span>';
  }

  /* ---------- Empty state ---------- */
  function emptyState(opts) {
    return '<div class="empty">' +
      '<div class="empty-icon"><i data-lucide="' + (opts.icon || 'inbox') + '"></i></div>' +
      '<h3>' + U.escapeHtml(opts.title) + '</h3>' +
      (opts.description ? '<p>' + U.escapeHtml(opts.description) + '</p>' : '') +
      (opts.action ? '<div class="empty-action">' + opts.action + '</div>' : '') +
    '</div>';
  }

  return { refreshIcons: refreshIcons, toast: toast, openModal: openModal,
           closeModal: closeModal, confirm: confirm, statusBadge: statusBadge,
           emptyState: emptyState };
})();