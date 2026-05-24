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

  function showError(msg) {
    gate.innerHTML =
      '<div class="beta-card">' +
        '<img src="logo.png" alt="MoonAi" class="beta-logo">' +
        '<div class="beta-title">Beta Access</div>' +
        '<div class="beta-expired">' + msg + '</div>' +
      '</div>';
  }

  function showPasswordForm(ref) {
    gate.innerHTML =
      '<div class="beta-card">' +
        '<img src="logo.png" alt="MoonAi" class="beta-logo">' +
        '<div class="beta-title">Beta Access</div>' +
        '<div class="beta-subtitle">Enter the beta password to continue</div>' +
        '<form id="beta-form" autocomplete="off">' +
          '<input id="beta-pw" type="password" class="beta-input" placeholder="Password" autocomplete="new-password" autofocus>' +
          '<div id="beta-err" class="beta-error" style="display:none;">Wrong password — try again</div>' +
          '<button type="submit" class="beta-btn">Enter</button>' +
        '</form>' +
      '</div>';

    var form  = document.getElementById('beta-form');
    var input = document.getElementById('beta-pw');
    var errEl = document.getElementById('beta-err');
    var btn   = form.querySelector('.beta-btn');

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
