/**
 * MoonAi — Beta Access Gate
 * Runs synchronously at top of <body> before any app content renders.
 * The #beta-gate div is in DOM before this script; it covers everything at z-index 9999.
 */
(function () {
  var gate = document.getElementById('beta-gate');
  var SESSION_KEY = 'moonai_beta_session';

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token || !s.expiresAt) return null;
      if (Date.now() > s.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch { return null; }
  }

  function saveSession(token, expiresAt) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token, expiresAt: expiresAt })); }
    catch {}
  }

  function clearGate() {
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
  }

  var CARD_STYLE  = 'display:flex;flex-direction:column;align-items:center;background:#111;border:1px solid #2a2a2a;border-radius:18px;padding:2.5rem 2rem;width:90%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,0.8);font-family:\'Plus Jakarta Sans\',system-ui,sans-serif;';
  var LOGO_STYLE  = 'width:60px;height:60px;object-fit:contain;margin-bottom:1.1rem;filter:drop-shadow(0 0 12px rgba(20,241,149,0.35));';
  var TITLE_STYLE = 'font-size:1.1rem;font-weight:700;color:#fff;letter-spacing:-0.02em;margin-bottom:0.3rem;';
  var SUB_STYLE   = 'font-size:12.5px;color:#888;margin-bottom:1.4rem;text-align:center;line-height:1.5;';
  var INPUT_STYLE = 'width:100%;background:#0d0d0d;border:1.5px solid #2a2a2a;border-radius:8px;padding:10px 14px;font-family:\'Plus Jakarta Sans\',system-ui,sans-serif;font-size:13px;color:#fff;outline:none;margin-bottom:0.6rem;box-sizing:border-box;display:block;';
  var BTN_STYLE   = 'width:100%;background:#14F195;color:#000;font-family:\'Plus Jakarta Sans\',system-ui,sans-serif;font-weight:700;font-size:13px;padding:10px;border:none;border-radius:8px;cursor:pointer;display:block;';
  var ERR_STYLE   = 'font-size:12px;color:#FF3B30;margin-bottom:0.6rem;display:none;';

  function showPasswordForm() {
    gate.innerHTML =
      '<div style="' + CARD_STYLE + '">' +
        '<img src="logo.png" alt="MoonAi" style="' + LOGO_STYLE + '">' +
        '<div style="' + TITLE_STYLE + '">Beta Access</div>' +
        '<div style="' + SUB_STYLE + '">Enter the beta password to continue</div>' +
        '<form id="beta-form" autocomplete="off" style="width:100%;">' +
          '<input id="beta-pw" type="password" style="' + INPUT_STYLE + '" placeholder="Password" autocomplete="new-password" autofocus>' +
          '<div id="beta-err" style="' + ERR_STYLE + '">Wrong password — try again</div>' +
          '<button type="submit" id="beta-submit" style="' + BTN_STYLE + '">Enter</button>' +
        '</form>' +
      '</div>';

    var form  = document.getElementById('beta-form');
    var input = document.getElementById('beta-pw');
    var errEl = document.getElementById('beta-err');
    var btn   = document.getElementById('beta-submit');

    if (input) setTimeout(function () { input.focus(); }, 60);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = (input.value || '').trim();
      if (!pw) return;

      btn.disabled = true;
      btn.textContent = '...';
      errEl.style.display = 'none';

      fetch('/api/beta-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok) {
            saveSession(data.token, data.expiresAt);
            clearGate();
          } else {
            btn.disabled = false;
            btn.textContent = 'Enter';
            input.value = '';
            errEl.style.display = 'block';
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Enter';
          errEl.textContent = 'Connection error — try again';
          errEl.style.display = 'block';
        });
    });
  }

  function verifyAndEnter() {
    var session = getSession();
    if (!session) { showPasswordForm(); return; }

    fetch('/api/beta-gate?action=verify&token=' + encodeURIComponent(session.token) +
          '&expiresAt=' + session.expiresAt)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          clearGate();
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          showPasswordForm();
        }
      })
      .catch(function () {
        showPasswordForm();
      });
  }

  // ── Entry point ──────────────────────────────────────────────────────
  verifyAndEnter();
}());
