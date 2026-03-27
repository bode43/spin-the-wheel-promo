(function () {
  'use strict';

  const GRAND_INDEX = 5;
  const SEGMENTS = 6;
  const SEG_DEG = 360 / SEGMENTS;

  const el = {
    urgencyText: document.getElementById('urgencyText'),
    igUser: document.getElementById('igUser'),
    spinBtn: document.getElementById('spinBtn'),
    formError: document.getElementById('formError'),
    wheel: document.getElementById('wheel'),
    wheelLabels: document.getElementById('wheelLabels'),
    suspenseText: document.getElementById('suspenseText'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalReward: document.getElementById('modalReward'),
    modalCoupon: document.getElementById('modalCoupon'),
    copyBtn: document.getElementById('copyBtn'),
    modalClose: document.getElementById('modalClose'),
  };

  const LABELS = ['30% OFF', '40% OFF', 'Gift 800', 'Gift 1.6K', 'Gift 2.4K', 'GRAND'];

  let wheelRotation = 0;
  let urgencySeconds = 0;
  let urgencyRewards = 0;

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

  function buildLabels() {
    el.wheelLabels.innerHTML = '';
    for (let i = 0; i < SEGMENTS; i += 1) {
      const li = document.createElement('li');
      li.style.transform = `rotate(${i * SEG_DEG}deg)`;
      const span = document.createElement('span');
      span.textContent = LABELS[i];
      span.style.transform = `rotate(${-(i * SEG_DEG + SEG_DEG / 2)}deg)`;
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

  /**
   * Absolute rotation increase so segment `index` center sits under top pointer.
   * Pointer at top; segment 0 starts at -90° in conic-gradient (top middle of slice 0).
   */
  /** Remainder (mod 360) where segment `index` center sits under the top pointer. */
  function rotationModForIndex(index) {
    return (330 - index * SEG_DEG + 360) % 360;
  }

  function deltaToLandIndex(index, fullSpins, jitterFrac) {
    const j = (jitterFrac || 0) * SEG_DEG * 0.22;
    return fullSpins * 360 + (360 - index * SEG_DEG - SEG_DEG / 2 + j);
  }

  /** From absolute rotation `current`, add full spins + twist so `targetIndex` centers on pointer. */
  function extendRotationToIndex(current, targetIndex, extraFullSpins, jitterFrac) {
    const want = rotationModForIndex(targetIndex);
    const cur = ((current % 360) + 360) % 360;
    let delta = (want - cur + 360) % 360;
    if (delta < 10) delta += 360;
    const j = (jitterFrac || 0) * SEG_DEG * 0.15;
    return current + extraFullSpins * 360 + delta + j;
  }

  function runSpinAnimation(winIndex, onComplete) {
    const start = wheelRotation;
    const jitter = Math.random() - 0.5;

    const doNearMiss = winIndex !== GRAND_INDEX;
    if (doNearMiss) {
      const nearEnd = start + deltaToLandIndex(GRAND_INDEX, 4, jitter * 0.5);
      el.suspenseText.textContent = 'The wheel chooses…';
      animateRotation(start, nearEnd, 4200, easeInOutCubic, (r1) => {
        el.suspenseText.textContent = 'Almost there…';
        const finalTarget = extendRotationToIndex(r1, winIndex, 3, jitter);
        animateRotation(r1, finalTarget, 3400, easeOutCubic, (r2) => {
          wheelRotation = r2;
          el.suspenseText.textContent = '';
          onComplete();
        });
      });
    } else {
      el.suspenseText.textContent = 'Legendary pull incoming…';
      const finalTarget = start + deltaToLandIndex(winIndex, 7, jitter);
      animateRotation(start, finalTarget, 6500, easeOutCubic, (r2) => {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data.error || 'Something went wrong.';
      throw new Error(err);
    }
    return data;
  }

  function openModal(rewardLabel, coupon) {
    el.modalReward.textContent = rewardLabel;
    el.modalCoupon.textContent = coupon;
    el.modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    el.modalBackdrop.hidden = true;
    document.body.style.overflow = '';
  }

  async function refreshUrgency() {
    try {
      const res = await fetch('/api/urgency');
      const data = await res.json();
      urgencySeconds = data.nextResetSeconds ?? 0;
      urgencyRewards = data.rewardsLeftToday ?? 0;
      renderUrgency();
    } catch {
      el.urgencyText.textContent = 'Limited rewards available today.';
    }
  }

  function renderUrgency() {
    const h = Math.floor(urgencySeconds / 3600);
    const m = Math.floor((urgencySeconds % 3600) / 60);
    const s = urgencySeconds % 60;
    const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.urgencyText.textContent = `Only ${urgencyRewards} rewards left today · Next reset in ${clock}`;
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

    setTimeout(() => {
      runSpinAnimation(serverIndex, () => {
        setTimeout(() => {
          openModal(payload.rewardLabel, payload.coupon);
          el.spinBtn.disabled = false;
          el.spinBtn.querySelector('.btn-spin__label').textContent = 'Spin';
        }, 650);
      });
    }, 400);
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

  refreshUrgency();
  setInterval(() => {
    if (urgencySeconds > 0) urgencySeconds -= 1;
    renderUrgency();
  }, 1000);
  setInterval(refreshUrgency, 60000);

  el.igUser.addEventListener('input', clearError);
})();
