/**
 * Mulberry32 seeded PRNG — deterministic random number generator.
 * Returns a function that produces floats in [0, 1) with each call.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded noise function (value noise) for flow fields.
 * Simple hash-based 2D noise. Not Perlin, but deterministic and good enough for art.
 */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const rng = mulberry32(seed);
  const TABLE_SIZE = 256;
  const table: number[] = [];
  for (let i = 0; i < TABLE_SIZE; i++) {
    table.push(rng());
  }

  function hash(x: number, y: number): number {
    const idx = ((x * 374761393 + y * 668265263 + seed) & 0x7fffffff) % TABLE_SIZE;
    return table[idx]!;
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  return (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smoothstep(x - ix);
    const fy = smoothstep(y - iy);

    const v00 = hash(ix, iy);
    const v10 = hash(ix + 1, iy);
    const v01 = hash(ix, iy + 1);
    const v11 = hash(ix + 1, iy + 1);

    const top = lerp(v00, v10, fx);
    const bottom = lerp(v01, v11, fx);
    return lerp(top, bottom, fy) * 2 - 1; // [-1, 1]
  };
}
