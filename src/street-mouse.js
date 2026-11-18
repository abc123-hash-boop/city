// Native Pointer Lock for the desktop street camera. Pointer capture alone
// cannot hide the cursor or provide continuous relative movement at an edge.
export class StreetMouse {
  constructor(canvas, { allowed, turn, use, scope, reset, state }) {
    this.canvas = canvas;
    this.doc = canvas.ownerDocument;
    this.win = this.doc.defaultView;
    this.allowed = allowed;
    this.reset = reset;
    this.onState = state;
    this.active = false;
    this.wanted = false;
    this.generation = 0;
    this.mode = 'idle';
    this.reason = '';

    const ownsInput = () => this.active && this.wanted && this.locked && this.allowed();
    this.doc.addEventListener('mousemove', e => {
      if (ownsInput()) turn(e.movementX || 0, e.movementY || 0);
    });
    // Use a *new* press for tools. The mouseup/click that acquires the lock
    // must not also use the selected tool.
    this.doc.addEventListener('mousedown', e => {
      if (!ownsInput()) return;
      if (e.button === 0) { e.preventDefault(); use(); }
      if (e.button === 2) { e.preventDefault(); scope(); }
    });
    this.doc.addEventListener('pointerlockchange', () => {
      if (this.locked) {
        // A pending browser permission prompt can resolve after leaving play.
        if (!this.active || !this.wanted || !this.allowed() || this.doc.hidden) {
          this.doc.exitPointerLock();
          return;
        }
        this.reset();
        this.set('locked');
      } else if (this.mode === 'locked') {
        // Also handles Esc when the browser consumes the key event itself.
        this.release();
      }
    });
    this.doc.addEventListener('pointerlockerror', () => {
      if (this.legacyRequest) this.failed(this.generation);
    });
    this.win.addEventListener('blur', () => this.release());
    this.win.addEventListener('pagehide', () => this.release());
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.hidden) this.release();
    });
  }

  get locked() { return this.doc.pointerLockElement === this.canvas; }

  set(mode, reason = '') {
    if (this.mode === mode && this.reason === reason) return;
    this.mode = mode;
    this.reason = reason;
    this.onState(mode, reason);
  }

  enter(touch = false) {
    this.active = true;
    if (touch) return this.set('drag', 'touch');
    if (typeof this.canvas.requestPointerLock !== 'function') return this.set('drag', 'unsupported');
    this.set('ready');
    // Preserve user activation: do not put this behind a render, fetch, or timer.
    if (this.win.navigator.userActivation?.isActive !== false) this.request();
  }

  request() {
    if (!this.active || !this.allowed() || this.doc.hidden || this.locked || this.mode === 'requesting') return;
    if (typeof this.canvas.requestPointerLock !== 'function') return this.set('drag', 'unsupported');
    const generation = ++this.generation;
    this.reset();
    this.wanted = true;
    this.legacyRequest = true;
    this.set('requesting');
    this.canvas.focus({ preventScroll: true });
    try {
      const result = this.canvas.requestPointerLock();
      // Older browsers report failure by event, newer ones reject a Promise.
      if (result && typeof result.catch === 'function') {
        this.legacyRequest = false;
        result.catch(() => this.failed(generation));
      }
    } catch { this.failed(generation); }
  }

  failed(generation) {
    if (generation !== this.generation || !this.active || !this.wanted || this.mode !== 'requesting' || this.locked) return;
    this.wanted = false;
    this.legacyRequest = false;
    this.set('drag', 'denied');
  }

  release() {
    ++this.generation;
    this.wanted = false;
    this.legacyRequest = false;
    this.reset();
    if (this.locked) this.doc.exitPointerLock();
    if (!this.active) this.set('idle');
    else if (this.mode !== 'drag') this.set('ready');
  }

  leave() {
    this.active = false;
    this.release();
  }
}
