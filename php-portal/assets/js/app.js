/* ============================================================
 * Paarami portal — shared client helpers
 * Toasts, typed-DELETE confirm modal, user-menu, fetch wrapper
 * ============================================================ */

(function () {
  /* ---------- Toasts ---------- */
  const stack = (() => {
    const el = document.createElement('div');
    el.className = 'toast-stack';
    document.body.appendChild(el);
    return el;
  })();

  window.toast = function (message, type = 'info', opts = {}) {
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    const title = opts.title ? '<b>' + escapeHtml(opts.title) + '</b>' : '';
    el.innerHTML = title + '<div>' + escapeHtml(message) + '</div>';
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, opts.duration || 3800);
  };

  /* ---------- Typed-DELETE confirm modal ----------
   * openDeleteConfirm({
   *   title, message, typeWord = 'DELETE', confirmLabel = 'Delete',
   *   onConfirm: async () => { ... }
   * })
   */
  window.openDeleteConfirm = function (opts) {
    const word = (opts.typeWord || 'DELETE').toUpperCase();
    const back = document.createElement('div');
    back.className = 'modal-backdrop is-open';
    back.innerHTML =
      '<div class="modal modal--danger" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<div class="modal__icon">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>' +
          '</div>' +
          '<h3 class="modal__title">' + escapeHtml(opts.title || 'Confirm deletion') + '</h3>' +
        '</div>' +
        '<div class="modal__body">' +
          '<p>' + escapeHtml(opts.message || 'This action cannot be undone.') + '</p>' +
          '<div>Type <b>' + word + '</b> to confirm:</div>' +
          '<input type="text" autocomplete="off" data-confirm-input>' +
        '</div>' +
        '<div class="modal__foot">' +
          '<button type="button" class="btn btn--ghost" data-cancel>Cancel</button>' +
          '<button type="button" class="btn btn--destructive" data-confirm disabled>' + escapeHtml(opts.confirmLabel || 'Delete') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(back);

    const input = back.querySelector('[data-confirm-input]');
    const confirmBtn = back.querySelector('[data-confirm]');
    const close = () => back.remove();

    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim().toUpperCase() !== word;
    });
    back.querySelector('[data-cancel]').addEventListener('click', close);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting…';
      try {
        await opts.onConfirm?.();
        close();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = opts.confirmLabel || 'Delete';
        toast((err && err.message) || 'Delete failed.', 'error');
      }
    });

    setTimeout(() => input.focus(), 50);
  };

  /* ---------- User menu (topbar) ---------- */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-user-menu]');
    const menu = document.querySelector('.user-menu');
    if (!menu) return;
    if (trigger) {
      menu.classList.toggle('is-open');
    } else if (!e.target.closest('.user-menu')) {
      menu.classList.remove('is-open');
    }
  });

  /* ---------- Slideover panel ----------
   * <div class="slideover" id="myPanel">...</div>
   * <div class="slideover-back" data-slideover-back="myPanel"></div>
   * <button data-slideover-open="myPanel">Open</button>
   * <button data-slideover-close>Close</button>
   */
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-slideover-open]');
    if (openBtn) {
      const id = openBtn.dataset.slideoverOpen;
      const panel = document.getElementById(id);
      const back = document.querySelector(`[data-slideover-back="${id}"]`);
      panel?.classList.add('is-open');
      back?.classList.add('is-open');
      const evt = new CustomEvent('slideover:open', { detail: { id, trigger: openBtn } });
      panel?.dispatchEvent(evt);
      return;
    }
    if (e.target.closest('[data-slideover-close]') || e.target.matches('.slideover-back')) {
      document.querySelectorAll('.slideover.is-open').forEach((p) => p.classList.remove('is-open'));
      document.querySelectorAll('.slideover-back.is-open').forEach((b) => b.classList.remove('is-open'));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.slideover.is-open').forEach((p) => p.classList.remove('is-open'));
      document.querySelectorAll('.slideover-back.is-open').forEach((b) => b.classList.remove('is-open'));
    }
  });

  /* ---------- POST helper with CSRF ---------- */
  window.postJSON = async function (url, data = {}) {
    const fd = new FormData();
    fd.append('_csrf', document.querySelector('meta[name="csrf-token"]')?.content || '');
    for (const [k, v] of Object.entries(data)) {
      fd.append(k, v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
    }
    const r = await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' });
    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await r.json() : await r.text();
    if (!r.ok) {
      const msg = (body && body.error) || (typeof body === 'string' ? body : 'Request failed');
      throw new Error(msg);
    }
    return body;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
})();
