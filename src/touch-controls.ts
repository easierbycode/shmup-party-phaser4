// touch-controls.ts — Twin-Stick touch mode: dynamic analogs synthesized from
// screen touches, mirroring the cmg launcher's NES/TG16 dynamic analog (the
// stick base+knob appear wherever the finger lands; 22px dead zone, 60px
// travel radius) but emitting smooth analog vectors instead of 8-way steps.
//
// The left half of the screen drives movement, the right half drives aim —
// the touch counterpart of Twin-Stick mode's D-pad/face-button mapping.
//
// Division of labour with the cmg launcher: when this game runs SAME-ORIGIN
// inside the launcher (CMG Network cache), the launcher renders its own touch
// zones over the frame and feeds the vectors in as virtual gamepad sticks —
// this module stays dormant so input and visuals can't double up. When the
// game is streamed cross-origin (or the launcher can't patch it), the
// launcher posts
//   { type: 'cmg-twinstick-touch-set', value }
// on boot and on every toggle of the Guide's "Touch Twin-Stick" sub-option
// (shown when the Guide was opened by touch), and THIS module provides the
// zones, visuals, and vectors inside the game realm.
//
// Listeners are passive and never preventDefault, so Phaser pointer input
// (menu buttons, perk cards) keeps working while the mode is on; a stray tap
// on a menu never emits input because of the dead zone.

export const TouchControls = { enabled: false };

const DEAD = 22; // px of travel before any input registers
const RADIUS = 60; // knob travel limit (matches base radius)

interface StickState {
    id: number | null; // active touch identifier
    ox: number; // origin (where the finger landed)
    oy: number;
    x: number; // output vector, -1..1 each
    y: number;
    base: HTMLElement | null;
    knob: HTMLElement | null;
}

const move: StickState = { id: null, ox: 0, oy: 0, x: 0, y: 0, base: null, knob: null };
const aim: StickState = { id: null, ox: 0, oy: 0, x: 0, y: 0, base: null, knob: null };

// Movement vector from the left-half touch, { x, y } each -1..1 (0,0 idle).
export function touchMove(): { x: number; y: number } {
    return TouchControls.enabled ? { x: move.x, y: move.y } : { x: 0, y: 0 };
}

// Aim vector from the right-half touch, { x, y } each -1..1 (0,0 idle).
export function touchAim(): { x: number; y: number } {
    return TouchControls.enabled ? { x: aim.x, y: aim.y } : { x: 0, y: 0 };
}

function makeEl(cls: string, size: number, filled: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.style.cssText = [
        'position:fixed', 'display:none', 'pointer-events:none', 'z-index:9999',
        `width:${size}px`, `height:${size}px`,
        `margin-left:${-size / 2}px`, `margin-top:${-size / 2}px`,
        'border-radius:50%',
        filled
            ? 'background:rgba(124,255,79,0.35);border:2px solid rgba(124,255,79,0.8)'
            : 'background:rgba(124,255,79,0.08);border:2px solid rgba(124,255,79,0.45)',
        'box-shadow:0 0 14px rgba(124,255,79,0.35)',
    ].join(';');
    document.body.appendChild(el);
    return el;
}

function ensureEls(s: StickState) {
    if (!s.base) s.base = makeEl('cmg-touch-base', RADIUS * 2, false);
    if (!s.knob) s.knob = makeEl('cmg-touch-knob', 56, true);
}

function placeEl(el: HTMLElement | null, x: number, y: number) {
    if (!el) return;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
}

function hideStick(s: StickState) {
    if (s.base) s.base.style.display = 'none';
    if (s.knob) s.knob.style.display = 'none';
    s.id = null;
    s.x = 0;
    s.y = 0;
}

function updateStick(s: StickState, cx: number, cy: number) {
    const dx = cx - s.ox;
    const dy = cy - s.oy;
    const mag = Math.sqrt(dx * dx + dy * dy);

    // Clamp the knob to its travel radius for the visual.
    let kx = cx, ky = cy;
    if (mag > RADIUS) {
        kx = s.ox + (dx / mag) * RADIUS;
        ky = s.oy + (dy / mag) * RADIUS;
    }
    placeEl(s.knob, kx, ky);

    if (mag < DEAD) {
        s.x = 0;
        s.y = 0;
        return;
    }
    // Scale past the dead zone so input ramps smoothly from 0 at DEAD to
    // full deflection at RADIUS.
    const norm = Math.min(1, (mag - DEAD) / (RADIUS - DEAD));
    s.x = (dx / mag) * norm;
    s.y = (dy / mag) * norm;
}

function stickFor(clientX: number): StickState {
    return clientX < window.innerWidth / 2 ? move : aim;
}

function onTouchStart(e: TouchEvent) {
    if (!TouchControls.enabled) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const s = stickFor(t.clientX);
        if (s.id !== null) continue; // this half already has a finger down
        ensureEls(s);
        s.id = t.identifier;
        s.ox = t.clientX;
        s.oy = t.clientY;
        placeEl(s.base, s.ox, s.oy);
        updateStick(s, t.clientX, t.clientY);
    }
}

function onTouchMove(e: TouchEvent) {
    if (!TouchControls.enabled) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === move.id) updateStick(move, t.clientX, t.clientY);
        else if (t.identifier === aim.id) updateStick(aim, t.clientX, t.clientY);
    }
}

function onTouchEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === move.id) hideStick(move);
        else if (t.identifier === aim.id) hideStick(aim);
    }
}

let wired = false;

// Wire the launcher handshake + touch listeners. Off until the launcher (or a
// future in-game setting) says otherwise.
export function initTouchControls(): void {
    if (wired) return;
    wired = true;

    window.addEventListener('message', (e: MessageEvent) => {
        // Honour only the launcher that mounted us (no-op when run standalone).
        if (window.parent === window || (e.source && e.source !== window.parent)) return;
        const d: any = (e && e.data) || {};
        if (d.type === 'cmg-twinstick-touch-set') {
            TouchControls.enabled = !!d.value;
            if (!TouchControls.enabled) {
                hideStick(move);
                hideStick(aim);
            }
        }
    });

    // Passive listeners: Phaser pointer input (menus) keeps working; the dead
    // zone keeps stray menu taps from emitting movement/aim.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}
