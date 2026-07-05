// twin-stick.ts — Twin-Stick mode: cmg launcher handshake + layout-robust pad
// reads. Vendored identically in shmup-party-phaser3 (src/js) and
// shmup-party-phaser4 (src) — keep the copies in sync.
//
// The cmg launcher shows a "Twin-Stick Mode" toggle in its Guide OSD for games
// that advertise it ({ type: 'cmg-twinstick', default }) and posts
// { type: 'cmg-twinstick-set', value } into the frame on boot and whenever the
// player flips it. When the game runs same-origin inside the launcher (CMG
// Network cache), the launcher additionally patches navigator.getGamepads so
// the pad already presents synthesized analog sticks (D-pad → left stick,
// face buttons → right stick) — the game's normal stick reads just work.
//
// The helpers here cover the streamed/cross-origin case, where the game sees
// the RAW pad and must synthesize twin-stick input itself. The NSO SNES pad
// (057e:2017) reports different raw layouts per platform:
//   - Nintendo HID order: faces B,A,Y,X at 0-3, encoded POV hat on axes[9],
//     ~10 axes;
//   - Linux joydev family: faces B,A,X,Y at 0-3 (top/left swapped vs the W3C
//     standard), D-pad as real buttons 12-15 and/or digital ±1 hat pairs on
//     the low axes, few axes.
// readDpad() / faceAim() fold every observed layout into one read, and behave
// identically on true standard-mapping pads (and on the launcher's patched
// pads), so callers never need to fingerprint the pad themselves.

export const TwinStick = { enabled: true };

const SNES_PAD_RE = /SNES Controller|Nintendo.*SNES|057e.{0,8}2017/i;

export function isSnesPadId(id: string | undefined): boolean {
    return SNES_PAD_RE.test(id || '');
}

let wired = false;

// Advertise Twin-Stick support to a mounting launcher and track its toggle.
// Safe to call standalone (GitHub Pages build, dev server): the advertise is a
// no-op and the mode simply stays at `defaultOn`.
export function initTwinStick(defaultOn = true): void {
    TwinStick.enabled = defaultOn;

    const advertise = () => {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(
                    { type: 'cmg-twinstick', default: defaultOn },
                    '*',
                );
            }
        } catch (_) { /* standalone / cross-origin parent — ignore */ }
    };
    // Re-send a couple of times in case the launcher's listener wasn't mounted
    // on our first boot frame (mirrors launcher-osd.ts / cmg-actions).
    advertise();
    setTimeout(advertise, 300);
    setTimeout(advertise, 1200);

    if (wired) return;
    wired = true;

    window.addEventListener('message', (e: MessageEvent) => {
        // Honour only the launcher that mounted us (no-op when run standalone).
        if (window.parent === window || (e.source && e.source !== window.parent)) return;
        const d: any = (e && e.data) || {};
        if (d.type === 'cmg-twinstick-set') TwinStick.enabled = !!d.value;
    });
}

// ── pad reads ────────────────────────────────────────────────────────────────
// Phaser Gamepad objects: buttons[i].pressed, axes[i].value. The helpers also
// tolerate plain Gamepad-API shapes (numeric axes) so they stay portable.

function pressed(pad: any, i: number): boolean {
    const b = pad && pad.buttons && pad.buttons[i];
    return !!(b && b.pressed);
}

function axisValue(pad: any, i: number): number {
    const a = pad && pad.axes && pad.axes[i];
    if (a && typeof a.value === 'number') return a.value;
    return typeof a === 'number' ? a : 0;
}

const HAT_DIRECTIONS = [
    { x: 0, y: -1 },  // 0  N  (up)
    { x: 1, y: -1 },  // 1  NE
    { x: 1, y: 0 },   // 2  E  (right)
    { x: 1, y: 1 },   // 3  SE
    { x: 0, y: 1 },   // 4  S  (down)
    { x: -1, y: 1 },  // 5  SW
    { x: -1, y: 0 },  // 6  W  (left)
    { x: -1, y: -1 }, // 7  NW
];

// Decode a POV hat on axes[9]: 8 directions clockwise from up, encoded as
// -1 .. 1 in 2/7 steps; neutral is a >1 sentinel (~1.2857). Values off that
// grid — notably an untouched axis resting at exactly 0 — are NOT hat states
// and must not decode (0 would otherwise round to a phantom "down").
function hatDirection(pad: any): { x: number; y: number } | null {
    const v = axisValue(pad, 9);
    if (v < -1.05 || v > 1.05) return null;
    const scaled = (v + 1) * 3.5;
    const octant = Math.round(scaled);
    if (Math.abs(scaled - octant) > 0.25) return null;
    return HAT_DIRECTIONS[octant & 7];
}

function isDigitalValue(v: number): boolean {
    return Math.abs(v) < 0.01 || Math.abs(Math.abs(v) - 1) < 0.01;
}

// D-pad direction as { x, y } each in { -1, 0, 1 }, across every layout:
// standard buttons 12-15, the encoded hat on axes[9], and (SNES pads only —
// they have no analog sticks to false-positive on) digital ±1 hat pairs on
// axes 0-7.
export function readDpad(pad: any): { x: number; y: number } {
    let x = pressed(pad, 14) ? -1 : pressed(pad, 15) ? 1 : 0;
    let y = pressed(pad, 12) ? -1 : pressed(pad, 13) ? 1 : 0;
    if (x || y) return { x, y };

    const hat = hatDirection(pad);
    if (hat && (hat.x || hat.y)) return hat;

    if (isSnesPadId(pad && pad.id)) {
        const pairs: Array<[number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7]];
        for (const [xi, yi] of pairs) {
            const vx = axisValue(pad, xi);
            const vy = axisValue(pad, yi);
            if (!isDigitalValue(vx) || !isDigitalValue(vy)) continue;
            if (vx <= -0.99) x = -1;
            else if (vx >= 0.99) x = 1;
            if (vy <= -0.99) y = -1;
            else if (vy >= 0.99) y = 1;
            if (x || y) break;
        }
    }
    return { x, y };
}

// The four face buttons as an aim vector { x, y } each in { -1, 0, 1 }
// (top = up, right = right, bottom = down, left = left; combinations give
// diagonals). y follows the stick convention: negative = up.
export function faceAim(pad: any): { x: number; y: number } {
    // W3C standard layout: 0=bottom, 1=right, 2=left, 3=top. The Linux
    // joydev-family SNES layout reports X (top) at 2 and Y (left) at 3; it is
    // recognizable by its non-standard mapping and low axis count (the
    // Nintendo-HID-order layout always carries 10 axes with the hat at [9]).
    const joydev = isSnesPadId(pad && pad.id) &&
        pad.mapping !== 'standard' &&
        (pad.axes ? pad.axes.length : 0) <= 9;
    const topIdx = joydev ? 2 : 3;
    const leftIdx = joydev ? 3 : 2;

    const x = (pressed(pad, 1) ? 1 : 0) - (pressed(pad, leftIdx) ? 1 : 0);
    const y = (pressed(pad, 0) ? 1 : 0) - (pressed(pad, topIdx) ? 1 : 0);
    return { x, y };
}
