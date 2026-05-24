/**
 * MoonAi — Beta Access Gate
 * Runs synchronously at top of <body> before any app content renders.
 * The #beta-gate div is in DOM before this script; it covers everything at z-index 9999.
 */
(function () {
  var gate = document.getElementById('beta-gate');
  var SESSION_KEY = 'moonai_beta_session';

  function getRef() {
    try {
      return new URLSearchParams(window.location.search).get('ref') || '';
    } catch { return ''; }
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.ref || !s.token || !s.expiresAt) return null;
      if (Date.now() > s.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch { return null; }
  }

  function saveSession(ref, token, expiresAt) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ref: ref, token: token, expiresAt: expiresAt })); }
    catch {}
  }

  function clearGate() {
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
  }

  function showBlank() {
    gate.innerHTML = '';
  }

  var CARD_STYLE  = 'display:flex;flex-direction:column;align-items:center;background:#111;border:1px solid #2a2a2a;border-radius:18px;padding:2.5rem 2rem;width:90%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,0.8);font-family:Geist,sans-serif;';
  var LOGO_STYLE  = 'width:60px;height:60px;object-fit:contain;margin-bottom:1.1rem;filter:drop-shadow(0 0 12px rgba(20,241,149,0.35));';
  var TITLE_STYLE = 'font-size:1.1rem;font-weight:700;color:#fff;letter-spacing:-0.02em;margin-bottom:0.3rem;';
  var SUB_STYLE   = 'font-size:12.5px;color:#888;margin-bottom:1.4rem;text-align:center;line-height:1.5;';
  var INPUT_STYLE = 'width:100%;background:#0d0d0d;border:1.5px solid #2a2a2a;border-radius:8px;padding:10px 14px;font-family:Geist,sans-serif;font-size:13px;color:#fff;outline:none;margin-bottom:0.6rem;box-sizing:border-box;display:block;';
  var BTN_STYLE   = 'width:100%;background:#14F195;color:#000;font-family:Geist,sans-serif;font-weight:700;font-size:13px;padding:10px;border:none;border-radius:8px;cursor:pointer;display:block;';
  var ERR_STYLE   = 'font-size:12px;color:#FF3B30;margin-bottom:0.6rem;display:none;';
  var EXP_STYLE   = 'font-size:13px;color:#FF3B30;text-align:center;margin-top:0.5rem;line-height:1.5;';

  function showError(msg) {
    gate.innerHTML =
      '<div style="' + CARD_STYLE + '">' +
        '<img src="logo.png" alt="MoonAi" style="' + LOGO_STYLE + '">' +
        '<div style="' + TITLE_STYLE + '">Beta Access</div>' +
        '<div style="' + EXP_STYLE + '">' + msg + '</div>' +
      '</div>';
  }

  function showPasswordForm(ref) {
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
        body: JSON.stringify({ ref: ref, password: pw }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok) {
            saveSession(ref, data.token, data.expiresAt);
            clearGate();
          } else {
            btn.disabled = false;
            btn.textContent = 'Enter';
            input.value = '';
            errEl.style.display = 'block';
            var card = gate.querySelector('.beta-card');
            if (card) {
              card.classList.remove('beta-shake');
              void card.offsetWidth;
              card.classList.add('beta-shake');
            }
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

  function verifyAndEnter(session, ref) {
    fetch('/api/beta-gate?action=verify&ref=' + encodeURIComponent(session.ref) +
          '&token=' + encodeURIComponent(session.token) +
          '&expiresAt=' + session.expiresAt)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          clearGate();
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          validateAndShowForm(ref);
        }
      })
      .catch(function () {
        // Network error — fail closed, keep gate up
        showError('Unable to verify session. Please reload.');
      });
  }

  function validateAndShowForm(ref) {
    fetch('/api/beta-gate?ref=' + encodeURIComponent(ref))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.valid) {
          showPasswordForm(ref);
        } else if (data && data.reason === 'expired') {
          showError('This invite link has expired.');
        } else {
          showBlank();
        }
      })
      .catch(function () {
        showBlank();
      });
  }

  // ── Entry point ──────────────────────────────────────────────────────
  var ref = getRef();

  if (!ref) {
    showBlank();
    return;
  }

  var session = getSession();
  if (session && session.ref === ref) {
    verifyAndEnter(session, ref);
  } else {
    validateAndShowForm(ref);
  }
}());
