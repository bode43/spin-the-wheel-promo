(function () {
  'use strict';

  const GRAND_INDEX = 5;
  const SEGMENTS = 6;
  const SEG_DEG = 360 / SEGMENTS;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FALLBACK_SEGMENT_DISPLAY = [
    { lines: ['30% discount'] },
    { lines: ['40% discount'] },
    { lines: ['Free gift worth 800'] },
    { lines: ['Free gift worth 1,600'] },
    { lines: ['Free gift worth 2,400'] },
    { lines: ['free order worth 8,000'] },
  ];

  const segmentLines = FALLBACK_SEGMENT_DISPLAY.map((s) => s.lines);

  const el = {
    mainShell: document.getElementById('mainShell'),
    igUser: document.getElementById('igUser'),
    spinBtn: document.getElementById('spinBtn'),
    formError: document.getElementById('formError'),
    wheel: document.getElementById('wheel'),
    wheelLabels: document.getElementById('wheelLabels'),
    suspenseText: document.getElementById('suspenseText'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    resultModal: document.getElementById('resultModal'),
    modalReward: document.getElementById('modalReward'),
    modalCoupon: document.getElementById('modalCoupon'),
    copyBtn: document.getElementById('copyBtn'),
    modalClose: document.getElementById('modalClose'),
  };

  let wheelRotation = 0;
  let modalFocusCleanup = null;

  function showError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = false;
  }

  function clearError() {
    el.formError.hidden = true;
    el.formError.textContent = '';
  }

  function validateUsernameClient(raw) {
    if (raw == null || typeof raw !== 'string') return { ok: false, error: 'Enter your Instagram username.' };
    let u = raw.trim();
    if (u.startsWith('@')) u = u.slice(1);
    u = u.toLowerCase();
    if (u.length < 1 || u.length > 30) return { ok: false, error: 'Username must be 1–30 characters.' };
    if (!/^[a-z0-9._]+$/.test(u)) {
      return { ok: false, error: 'Use only letters, numbers, periods, and underscores.' };
    }
    if (u.startsWith('.') || u.endsWith('.') || u.includes('..')) {
      return { ok: false, error: 'Invalid username format.' };
    }
    return { ok: true, username: u };
  }

  function setWheelLabelLines(span, lines) {
    const list = Array.isArray(lines) && lines.length ? lines : [String(lines)];
    list.forEach((line, j) => {
      if (j > 0) span.appendChild(document.createElement('br'));
      const lineEl = document.createElement('span');
      lineEl.className = j === 0 ? 'wheel-label-line' : 'wheel-label-sub';
      lineEl.textContent = line;
      span.appendChild(lineEl);
    });
  }

  function buildLabels() {
    el.wheelLabels.innerHTML = '';
    for (let i = 0; i < SEGMENTS; i += 1) {
      const li = document.createElement('li');
      li.className = 'wheel-spoke';
      if (i === 5) li.classList.add('is-grand');
      li.style.transform = `rotate(${i * SEG_DEG}deg)`;
      const span = document.createElement('span');
      span.className = 'wheel-label-inner';
      setWheelLabelLines(span, segmentLines[i] || []);
      span.style.transform = `rotate(${-i * SEG_DEG}deg)`;
      li.appendChild(span);
      el.wheelLabels.appendChild(li);
    }
  }

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  function animateRotation(from, to, durationMs, easing, onDone) {
    if (prefersReducedMotion || durationMs <= 0) {
      el.wheel.style.transform = `rotate(${to}deg)`;
      onDone(to);
      return;
    }
    const t0 = performance.now();
    function frame(now) {
      const u = Math.min(1, (now - t0) / durationMs);
      const e = easing(u);
      const ang = from + (to - from) * e;
      el.wheel.style.transform = `rotate(${ang}deg)`;
      if (u < 1) requestAnimationFrame(frame);
      else onDone(ang);
    }
    requestAnimationFrame(frame);
  }

  function rotationModForIndex(index) {
    return (330 - index * SEG_DEG + 360) % 360;
  }

  function deltaToLandIndex(index, fullSpins, jitterFrac) {
    const j = (jitterFrac || 0) * SEG_DEG * 0.22;
    return fullSpins * 360 + (360 - index * SEG_DEG - SEG_DEG / 2 + j);
  }

  function extendRotationToIndex(current, targetIndex, extraFullSpins, jitterFrac) {
    const want = rotationModForIndex(targetIndex);
    const cur = ((current % 360) + 360) % 360;
    let delta = (want - cur + 360) % 360;
    if (delta < 10) delta += 360;
    const j = (jitterFrac || 0) * SEG_DEG * 0.15;
    return current + extraFullSpins * 360 + delta + j;
  }

  function spinTimings() {
    if (prefersReducedMotion) {
      return { near: 0, final: 0, grand: 0, settleDelay: 0, openDelay: 0 };
    }
    return { near: 4200, final: 3400, grand: 6500, settleDelay: 400, openDelay: 650 };
  }

  function runSpinAnimation(winIndex, onComplete) {
    const start = wheelRotation;
    const jitter = Math.random() - 0.5;
    const t = spinTimings();

    const doNearMiss = winIndex !== GRAND_INDEX;
    if (doNearMiss) {
      const nearEnd = start + deltaToLandIndex(GRAND_INDEX, 4, jitter * 0.5);
      el.suspenseText.textContent = 'The wheel chooses…';
      animateRotation(start, nearEnd, t.near, easeInOutCubic, (r1) => {
        el.suspenseText.textContent = 'Almost there…';
        const finalTarget = extendRotationToIndex(r1, winIndex, 3, jitter);
        animateRotation(r1, finalTarget, t.final, easeOutCubic, (r2) => {
          wheelRotation = r2;
          el.suspenseText.textContent = '';
          onComplete();
        });
      });
    } else {
      el.suspenseText.textContent = 'Legendary pull incoming…';
      const finalTarget = start + deltaToLandIndex(winIndex, 7, jitter);
      animateRotation(start, finalTarget, t.grand, easeOutCubic, (r2) => {
        wheelRotation = r2;
        el.suspenseText.textContent = '';
        onComplete();
      });
    }
  }

  async function simpleFingerprint() {
    try {
      const data = [
        navigator.userAgent || '',
        navigator.language || '',
        String(screen.width),
        String(screen.height),
        String(screen.colorDepth || 0),
        String(new Date().getTimezoneOffset()),
      ].join('|');
      const enc = new TextEncoder().encode(data);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex.slice(0, 48);
    } catch {
      return '';
    }
  }

  async function postSpin(username, fingerprint) {
    const res = await fetch('/api/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, fingerprint }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      const err = data.error || 'Something went wrong.';
      throw new Error(err);
    }
    return data;
  }

  function getFocusable(root) {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(sel)).filter((node) => {
      if (node.disabled) return false;
      if (node.getAttribute('aria-hidden') === 'true') return false;
      return true;
    });
  }

  function openModal(rewardLabel, coupon) {
    el.modalReward.textContent = rewardLabel;
    el.modalCoupon.textContent = coupon;
    el.modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    if (el.mainShell) el.mainShell.setAttribute('inert', '');
    const prevFocus = document.activeElement;
    const modalRoot = el.resultModal;
    const focusables = getFocusable(modalRoot);
    const first = focusables[0] || el.modalClose;
    requestAnimationFrame(() => {
      first.focus();
    });

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab' || focusables.length === 0) return;
      const f0 = focusables[0];
      const fLast = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === f0) {
          e.preventDefault();
          fLast.focus();
        }
      } else if (document.activeElement === fLast) {
        e.preventDefault();
        f0.focus();
      }
    }
    document.addEventListener('keydown', onKeydown);
    modalFocusCleanup = () => {
      document.removeEventListener('keydown', onKeydown);
      if (el.mainShell) el.mainShell.removeAttribute('inert');
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }

  function closeModal() {
    el.modalBackdrop.hidden = true;
    document.body.style.overflow = '';
    if (modalFocusCleanup) {
      const done = modalFocusCleanup;
      modalFocusCleanup = null;
      done();
    } else if (el.mainShell) {
      el.mainShell.removeAttribute('inert');
    }
  }

  async function onSpin() {
    clearError();
    const v = validateUsernameClient(el.igUser.value);
    if (!v.ok) {
      showError(v.error);
      return;
    }

    el.spinBtn.disabled = true;
    el.spinBtn.querySelector('.btn-spin__label').textContent = 'Spinning…';

    let payload;
    try {
      const fp = await simpleFingerprint();
      payload = await postSpin(v.username, fp);
    } catch (e) {
      showError(e.message || 'Spin failed.');
      el.spinBtn.disabled = false;
      el.spinBtn.querySelector('.btn-spin__label').textContent = 'Spin';
      return;
    }

    const serverIndex = payload.segmentIndex;
    if (typeof serverIndex !== 'number' || serverIndex < 0 || serverIndex > 5) {
      showError('Invalid response from server.');
      el.spinBtn.disabled = false;
      el.spinBtn.querySelector('.btn-spin__label').textContent = 'Spin';
      return;
    }

    const t = spinTimings();
    setTimeout(() => {
      runSpinAnimation(serverIndex, () => {
        setTimeout(() => {
          openModal(payload.rewardLabel, payload.coupon);
          el.spinBtn.disabled = false;
          el.spinBtn.querySelector('.btn-spin__label').textContent = 'Spin';
        }, t.openDelay);
      });
    }, t.settleDelay);
  }

  el.spinBtn.addEventListener('click', onSpin);

  el.copyBtn.addEventListener('click', async () => {
    const code = el.modalCoupon.textContent;
    try {
      await navigator.clipboard.writeText(code);
      el.copyBtn.textContent = 'Copied';
      setTimeout(() => {
        el.copyBtn.textContent = 'Copy';
      }, 2000);
    } catch {
      el.copyBtn.textContent = 'Select & copy';
    }
  });

  el.modalClose.addEventListener('click', closeModal);
  el.modalBackdrop.addEventListener('click', (ev) => {
    if (ev.target === el.modalBackdrop) closeModal();
  });

  buildLabels();
  closeModal();

  el.igUser.addEventListener('input', clearError);
})();
