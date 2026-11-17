// input.js — keyboard + mouse input for Palmera Bay: Street Heat.
// Tracks held keys, edge-triggered presses, and mouse position/clicks in
// canvas coordinates. No dependencies.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();       // currently held (lowercase, e.g. 'w', 'shift', 'escape')
    this.pressed = new Set();    // pressed since last consume (edge triggered)
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      this.keys.delete(k);
    };
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
      if (e.button === 0) this.pressed.add('mouse0');
    };
    this._onMouseUp = () => { this.mouse.down = false; };
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** True while the key is held. Accepts 'w', 'shift', 'escape', 'mouse0', ... */
  down(key) { return this.keys.has(key.toLowerCase()); }

  /** True once per physical press; consumed after the frame reads it. */
  wasPressed(key) { return this.pressed.has(key.toLowerCase()); }

  /** Mouse position in canvas pixels. */
  mousePos() { return { x: this.mouse.x, y: this.mouse.y }; }

  /** True if the left mouse button went down since last endFrame. */
  mouseClicked() { return this.mouse.clicked; }

  /** Axis helper: returns -1, 0 or 1 from a pair of keys. */
  axis(neg, pos) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  }

  /** Call at the end of every frame to clear edge-triggered state. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
