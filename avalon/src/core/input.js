// Keyboard / mouse / touch input with pointer lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0 };
    this.mPressed = new Set(); this.mReleased = new Set();
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.touch = { active: false, move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.blockKey(e)) e.preventDefault(); return; }
      this.keys.add(e.code); this.pressed.add(e.code);
      if (this.blockKey(e)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouse.buttons |= 1 << e.button; this.mPressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => { if (this.mouse.buttons & (1 << e.button)) this.mReleased.add(e.button); this.mouse.buttons &= ~(1 << e.button); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  blockKey(e) { return ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F1', 'AltLeft', 'Quote'].includes(e.code) || (e.ctrlKey && e.code === 'KeyS'); }
  lock() { if (!this.locked && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  mouseDown(b) { return this.enabled && (this.mouse.buttons & (1 << b)) !== 0; }
  mouseHit(b) { return this.enabled && this.mPressed.has(b); }
  mouseUp(b) { return this.enabled && this.mReleased.has(b); }
  // virtual press from touch UI
  virtualPress(code) { this.pressed.add(code); }
  virtualDown(code, on) { if (on) { this.keys.add(code); this.pressed.add(code); } else { this.keys.delete(code); this.released.add(code); } }
  virtualMouse(b, on) { if (on) { this.mouse.buttons |= 1 << b; this.mPressed.add(b); } else { if (this.mouse.buttons & (1 << b)) this.mReleased.add(b); this.mouse.buttons &= ~(1 << b); } }
  endFrame() {
    this.pressed.clear(); this.released.clear(); this.mPressed.clear(); this.mReleased.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }
}
