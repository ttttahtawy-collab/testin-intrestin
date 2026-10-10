// Unified input: keyboard, gamepad and touch/mouse (pointer events) mapped to
// abstract actions. Edge states (pressed/released) are latched between fixed
// update steps so no tap is ever lost, regardless of frame rate.
(function (G) {
  'use strict';
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'pause', 'confirm', 'back'];

  const KEYMAP = {
    ArrowLeft: ['left'], KeyA: ['left'],
    ArrowRight: ['right'], KeyD: ['right'],
    ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'],
    ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump', 'confirm'], KeyZ: ['jump', 'confirm'], KeyK: ['jump'],
    KeyX: ['attack', 'back'], KeyJ: ['attack'],
    KeyC: ['dash'], KeyL: ['dash'], ShiftLeft: ['dash'], ShiftRight: ['dash'],
    Escape: ['pause', 'back'], KeyP: ['pause'], Backspace: ['back'],
    Enter: ['confirm', 'pause'], NumpadEnter: ['confirm'],
  };

  const I = (G.Input = {
    down: {}, pressed: {}, released: {},
    _q: {}, _qr: {}, _keys: {}, _pad: {}, _touch: {},
    lastDevice: 'keyboard',
    usingTouch: false,
    // Pointer (for menus): logical coords, click latch
    pointer: { x: -1, y: -1, active: false, clicked: false, _clickQ: false, moved: false },
    touchButtons: [],
    _ptrButtons: new Map(),
    anyPressed: false,
  });
  ACTIONS.forEach((a) => { I.down[a] = false; I.pressed[a] = false; I.released[a] = false; });

  function setSource(src, action, isDown) {
    const prev = I.down[action];
    src[action] = isDown;
    const now = !!(I._keys[action] || I._pad[action] || I._touch[action]);
    if (now && !prev) I._q[action] = true;
    if (!now && prev) I._qr[action] = true;
    I.down[action] = now;
  }
  // Each action may be held by multiple keys: track key counts.
  const keyHeld = {};
  function keyAction(action) {
    let held = false;
    for (const k in keyHeld) if (keyHeld[k] && KEYMAP[k] && KEYMAP[k].indexOf(action) >= 0) { held = true; break; }
    return held;
  }

  I.init = function (canvas) {
    window.addEventListener('keydown', (e) => {
      const acts = KEYMAP[e.code];
      if (G.Audio) G.Audio.unlock();
      I.lastDevice = 'keyboard';
      if (!acts) return;
      e.preventDefault();
      if (e.repeat) return;
      keyHeld[e.code] = true;
      acts.forEach((a) => setSource(I._keys, a, true));
    });
    window.addEventListener('keyup', (e) => {
      const acts = KEYMAP[e.code];
      if (!acts) return;
      e.preventDefault();
      keyHeld[e.code] = false;
      acts.forEach((a) => setSource(I._keys, a, keyAction(a)));
    });
    window.addEventListener('blur', () => {
      for (const k in keyHeld) keyHeld[k] = false;
      ACTIONS.forEach((a) => { setSource(I._keys, a, false); setSource(I._touch, a, false); });
      I._ptrButtons.clear();
    });

    const ptr = I.pointer;
    function updatePtr(e) {
      const p = G.R.toLogical(e.clientX, e.clientY);
      ptr.x = p.x; ptr.y = p.y; ptr.moved = true;
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (G.Audio) G.Audio.unlock();
      updatePtr(e);
      if (e.pointerType === 'touch') { I.usingTouch = true; I.lastDevice = 'touch'; }
      else I.lastDevice = 'mouse';
      // Virtual buttons get first claim on the pointer.
      const btn = I.touchVisible() ? hitButton(ptr.x, ptr.y) : null;
      if (btn) {
        I._ptrButtons.set(e.pointerId, btn);
        refreshTouch();
      } else {
        ptr.active = true;
        ptr._clickQ = true;
        ptr.downX = ptr.x; ptr.downY = ptr.y;
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      updatePtr(e);
      if (I._ptrButtons.has(e.pointerId)) {
        const btn = hitButton(ptr.x, ptr.y);
        // Allow sliding between the d-pad buttons, keep others latched.
        const cur = I._ptrButtons.get(e.pointerId);
        if (btn && btn !== cur && (btn.slide && cur.slide)) { I._ptrButtons.set(e.pointerId, btn); refreshTouch(); }
      }
    });
    const end = (e) => {
      if (I._ptrButtons.has(e.pointerId)) { I._ptrButtons.delete(e.pointerId); refreshTouch(); }
      else ptr.active = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', () => { I.lastDevice = 'gamepad'; });
  };

  function hitButton(x, y) {
    for (const b of I.touchButtons) {
      if (b.hidden) continue;
      const dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy <= (b.r * 1.25) * (b.r * 1.25)) return b;
    }
    return null;
  }
  function refreshTouch() {
    const held = {};
    I._ptrButtons.forEach((b) => b.actions.forEach((a) => (held[a] = true)));
    ACTIONS.forEach((a) => setSource(I._touch, a, !!held[a]));
  }

  I.touchVisible = function () {
    const mode = (G.Save && G.Save.options.touch) || 'auto';
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return I.usingTouch;
  };
  // Called by the renderer whenever the logical view size changes.
  I.layoutTouch = function (W, H) {
    const s = 1;
    I.touchButtons = [
      { id: 'left', x: 78, y: H - 86, r: 46 * s, actions: ['left'], label: '◀', slide: true },
      { id: 'right', x: 186, y: H - 86, r: 46 * s, actions: ['right'], label: '▶', slide: true },
      { id: 'down', x: 132, y: H - 176, r: 34 * s, actions: ['down'], label: '▼', slide: true },
      { id: 'jump', x: W - 82, y: H - 92, r: 52 * s, actions: ['jump', 'confirm'], label: 'JUMP' },
      { id: 'attack', x: W - 194, y: H - 70, r: 42 * s, actions: ['attack'], label: 'HIT' },
      { id: 'dash', x: W - 112, y: H - 210, r: 34 * s, actions: ['dash'], label: 'DASH' },
      { id: 'pause', x: W - 36, y: 36, r: 24, actions: ['pause'], label: 'II' },
    ];
  };
  I.isTouchHeld = function (id) {
    for (const b of I._ptrButtons.values()) if (b.id === id) return true;
    return false;
  };

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const st = {};
    if (gp) {
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      st.left = b(14) || ax < -0.4;
      st.right = b(15) || ax > 0.4;
      st.up = b(12) || ay < -0.5;
      st.down = b(13) || ay > 0.5;
      st.jump = b(0);
      st.confirm = b(0);
      st.attack = b(2);
      st.back = b(1);
      st.dash = b(1) || b(5) || b(7);
      st.pause = b(9);
      let any = false;
      for (const k in st) if (st[k]) any = true;
      if (any) I.lastDevice = 'gamepad';
    }
    ACTIONS.forEach((a) => {
      if (!!st[a] !== !!I._pad[a]) setSource(I._pad, a, !!st[a]);
    });
  }

  // Called once per fixed update step.
  I.update = function () {
    pollGamepad();
    I.anyPressed = false;
    ACTIONS.forEach((a) => {
      I.pressed[a] = !!I._q[a];
      I.released[a] = !!I._qr[a];
      if (I.pressed[a]) I.anyPressed = true;
    });
    I._q = {}; I._qr = {};
    I.pointer.clicked = I.pointer._clickQ;
    I.pointer._clickQ = false;
    if (I.pointer.clicked) I.anyPressed = true;
  };
  // Swallow all pending edges (used on scene switches so a confirm press
  // doesn't carry over into the next screen).
  I.flush = function () {
    I._q = {}; I._qr = {};
    ACTIONS.forEach((a) => { I.pressed[a] = false; I.released[a] = false; });
    I.pointer._clickQ = false; I.pointer.clicked = false;
  };
})(window.G);
