/** 4x4 Bayer matrix, normalised to [-0.5, 0.5). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

/** Levels per channel for the dithered scenery; character palettes use a finer grid below. */
export const PALETTE_LEVELS = 8;
/** How strongly the Bayer matrix perturbs values before quantising (1 = full checkerboard between levels). */
export const DITHER_STRENGTH = 0.6;

// Authored character ramps need finer steps than dithered scenery, especially skin and dark cloth.
const STEP = 255 / 31;
/** Plain nearest-level quantisation, no dither: sprites keep flat cel colours that survive the world dither untouched. */
const FLAT = new Uint8ClampedArray(256);
for (let v = 0; v < 256; v++) FLAT[v] = Math.round(Math.round(v / STEP) * STEP);

let scratch = new Uint8Array(0);

/**
 * Turns a smoothly rendered RGBA image into hard-edged pixel art in place: colours snap to the palette grid,
 * partial alpha becomes an ordered-dither mesh (how 16-bit hardware faked transparency) and every solid pixel
 * bordering empty space becomes a dark outline.
 */
export function pixelize(img: ImageData): void {
  const W = img.width;
  const H = img.height;
  const d = img.data;
  if (scratch.length < W * H) scratch = new Uint8Array(W * H);
  const solid = scratch;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0, p = 0; y < H; y++) {
    const row = (y & 3) << 2;
    for (let x = 0; x < W; x++, p++) {
      const i = p << 2;
      const a = d[i + 3];
      if (a === 0) {
        solid[p] = 0;
        continue;
      }
      const keep = a >= 250 || a > (BAYER4[row | (x & 3)] + 0.5) * 255;
      d[i + 3] = keep ? 255 : 0;
      d[i] = FLAT[d[i]];
      d[i + 1] = FLAT[d[i + 1]];
      d[i + 2] = FLAT[d[i + 2]];
      solid[p] = a >= 128 ? 1 : 0;
      if (solid[p]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  // Most of the full-resolution layer is empty; outline only its occupied rectangle.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0, p = y * W + x0; x <= x1; x++, p++) {
      if (!solid[p]) continue;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !solid[p - 1] || !solid[p + 1] || !solid[p - W] || !solid[p + W];
      if (!edge) continue;
      const i = p << 2;
      d[i] = FLAT[(d[i] * 0.3) | 0];
      d[i + 1] = FLAT[(d[i + 1] * 0.28) | 0];
      d[i + 2] = FLAT[(d[i + 2] * 0.36) | 0];
    }
  }
}
