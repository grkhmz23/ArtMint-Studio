import type { CanonicalInput } from "@artmint/common";

interface CustomCodeArtifactInput {
  code: string;
  seed: number;
  palette: string[];
}

/**
 * Build a self-contained HTML artifact for custom user code.
 * Embeds user code + mulberry32 PRNG + noise2D helpers in a canvas-based page.
 */
export function buildCustomCodeArtifact(input: CustomCodeArtifactInput): string {
  // XSS-safe: escape </ sequences to prevent </script> breakout
  const safeCode = input.code.replace(/<\//g, "\\u003c/");
  const paletteJson = JSON.stringify(input.palette).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ArtMint – Custom Code #${input.seed}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:monospace;color:#ccc}
canvas{max-width:100vmin;max-height:100vmin;border:1px solid #333}
.controls{margin-top:16px;display:flex;gap:8px}
button{background:#222;color:#fff;border:1px solid #555;padding:8px 16px;cursor:pointer;font-family:monospace;font-size:12px}
button:hover{background:#333}
</style>
</head>
<body>
<canvas id="canvas" width="1080" height="1080"></canvas>
<div class="controls">
<button onclick="renderAt(1080)">1080px</button>
<button onclick="renderAt(2160)">2160px</button>
<button onclick="renderAt(3840)">4K</button>
<button onclick="exportPNG()">Export PNG</button>
</div>
<script>
// Mulberry32 PRNG
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoise2D(seed) {
  const rng = mulberry32(seed);
  const TABLE_SIZE = 256;
  const table = [];
  for (let i = 0; i < TABLE_SIZE; i++) table.push(rng());
  function hash(x, y) { return table[((x * 374761393 + y * 668265263 + seed) & 0x7fffffff) % TABLE_SIZE]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
    return lerp(lerp(hash(ix,iy), hash(ix+1,iy), fx), lerp(hash(ix,iy+1), hash(ix+1,iy+1), fx), fy) * 2 - 1;
  };
}

const seed = ${input.seed};
const palette = ${paletteJson};
const _rng = mulberry32(seed);
function random() { return _rng(); }
const noise2D = createNoise2D(seed + 1);

let currentSize = 1080;

function renderAt(size) {
  currentSize = size;
  const canvas = document.getElementById('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const WIDTH = size, HEIGHT = size;
  // Reset PRNG for determinism
  const _rng2 = mulberry32(seed);
  const random2 = () => _rng2();
  try {
    (function(canvas, ctx, WIDTH, HEIGHT, seed, palette, random, noise2D) {
${safeCode}
    })(canvas, ctx, WIDTH, HEIGHT, seed, palette, random2, createNoise2D(seed + 1));
  } catch(e) { console.error('Render error:', e); }
}

function exportPNG() {
  const canvas = document.getElementById('canvas');
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'artmint-custom-' + seed + '-' + currentSize + 'px.png';
    a.click();
  }, 'image/png');
}

renderAt(1080);
</script>
</body>
</html>`;
}

/**
 * Build a self-contained HTML artifact that embeds the renderer code
 * and input params inline. Works offline with no external dependencies.
 */
export function buildHtmlArtifact(input: CanonicalInput): string {
  // We inline the renderer logic as a self-contained script.
  // CRITICAL: escape </ sequences to prevent </script> breakout (XSS).
  const inputJson = JSON.stringify(input).replace(/</g, "\\u003c");

  // Sanitize title to prevent injection
  const safeTemplateId = input.templateId.replace(/[<>"&]/g, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ArtMint – ${safeTemplateId} #${input.seed}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:monospace;color:#ccc}
#canvas{max-width:100vmin;max-height:100vmin;border:1px solid #333}
.controls{margin-top:16px;display:flex;gap:8px}
button{background:#222;color:#fff;border:1px solid #555;padding:8px 16px;cursor:pointer;font-family:monospace;font-size:12px}
button:hover{background:#333}
</style>
</head>
<body>
<div id="canvas"></div>
<div class="controls">
<button onclick="renderAt(1080)">1080px</button>
<button onclick="renderAt(2160)">2160px</button>
<button onclick="renderAt(3840)">4K</button>
<button onclick="exportPNG()">Export PNG</button>
</div>
<script>
// Embedded input params
const INPUT = ${inputJson};

// Mulberry32 PRNG
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoise2D(seed) {
  const rng = mulberry32(seed);
  const TABLE_SIZE = 256;
  const table = [];
  for (let i = 0; i < TABLE_SIZE; i++) table.push(rng());
  function hash(x, y) { return table[((x * 374761393 + y * 668265263 + seed) & 0x7fffffff) % TABLE_SIZE]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
    return lerp(lerp(hash(ix,iy), hash(ix+1,iy), fx), lerp(hash(ix,iy+1), hash(ix+1,iy+1), fx), fy) * 2 - 1;
  };
}

function renderFlowFields(input, SIZE) {
  const { seed, palette, params } = input;
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed + 1);
  const paths = [];
  const { density, lineWidth, curvature, grain, contrast, fieldScale, lineCount, stepCount, turbulence } = params;
  for (let i = 0; i < lineCount; i++) {
    let x = rng() * SIZE, y = rng() * SIZE;
    const color = palette[Math.floor(rng() * palette.length)];
    const opacity = 0.3 + rng() * 0.7 * density;
    const sw = lineWidth * (0.5 + rng() * 0.5);
    const pts = ['M ' + x.toFixed(2) + ' ' + y.toFixed(2)];
    for (let s = 0; s < stepCount; s++) {
      const nx = x / SIZE * fieldScale, ny = y / SIZE * fieldScale;
      const angle = noise(nx, ny) * Math.PI * 2 * curvature + noise(nx*2.3+100, ny*2.3+100) * turbulence;
      const step = 2 + density * 3;
      x += Math.cos(angle) * step; y += Math.sin(angle) * step;
      if (x < 0) x += SIZE; if (x > SIZE) x -= SIZE;
      if (y < 0) y += SIZE; if (y > SIZE) y -= SIZE;
      pts.push('L ' + x.toFixed(2) + ' ' + y.toFixed(2));
    }
    paths.push('<path d="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="' + sw.toFixed(2) + '" stroke-opacity="' + opacity.toFixed(3) + '" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  let grainEl = '';
  if (grain > 0.01) {
    const grainRng = mulberry32(seed + 999);
    const gc = Math.floor(grain * 8000);
    const gs = [];
    for (let g = 0; g < gc; g++) {
      const gx = grainRng() * SIZE, gy = grainRng() * SIZE, gsz = 1 + grainRng() * 2, go = grainRng() * grain * 0.3;
      gs.push('<rect x="'+gx.toFixed(1)+'" y="'+gy.toFixed(1)+'" width="'+gsz.toFixed(1)+'" height="'+gsz.toFixed(1)+'" fill="#fff" opacity="'+go.toFixed(3)+'"/>');
    }
    grainEl = '<g>' + gs.join('') + '</g>';
  }
  const bg = palette[palette.length-1] || '#0a0a0a';
  const bg2 = palette[0] || '#1a1a2e';
  const bgOp = Math.min(1, contrast * 0.5);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+SIZE+' '+SIZE+'" width="'+SIZE+'" height="'+SIZE+'"><rect width="'+SIZE+'" height="'+SIZE+'" fill="'+bg+'"/><rect width="'+SIZE+'" height="'+SIZE+'" fill="'+bg2+'" opacity="'+bgOp.toFixed(2)+'"/><g>'+paths.join('')+'</g>'+grainEl+'</svg>';
}

function renderJazzNoir(input, SIZE) {
  const { seed, palette, params } = input;
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed + 42);
  const els = [];
  const { neonIntensity, skylineBands, glow, rainGrain, circleCount, lineCount, depth, blur } = params;
  const bg = palette[0] || '#0a0a0f';
  els.push('<rect width="'+SIZE+'" height="'+SIZE+'" fill="'+bg+'"/>');
  for (let b = 0; b < skylineBands; b++) {
    const bandY = SIZE * (0.3 + (b/skylineBands)*0.6);
    const bandH = SIZE * (0.02 + rng()*0.08) * depth;
    const color = palette[(b+1)%palette.length] || '#1a0a2e';
    const opacity = 0.1 + rng()*0.3;
    const pts = [];
    const segs = 20 + Math.floor(rng()*20);
    for (let s = 0; s <= segs; s++) {
      const sx = (s/segs)*SIZE;
      const n = noise(s*0.3+b*10, b*5.7)*bandH;
      pts.push(sx.toFixed(1)+','+((bandY+n).toFixed(1)));
    }
    pts.push(SIZE+','+SIZE); pts.push('0,'+SIZE);
    els.push('<polygon points="'+pts.join(' ')+'" fill="'+color+'" opacity="'+opacity.toFixed(3)+'"/>');
  }
  for (let c = 0; c < circleCount; c++) {
    const cx = rng()*SIZE, cy = rng()*SIZE*0.7+SIZE*0.1, r = 10+rng()*80*depth;
    const color = palette[1+Math.floor(rng()*(palette.length-1))] || '#ff6b35';
    const op = neonIntensity*(0.2+rng()*0.6), sw = 1+rng()*3;
    els.push('<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="none" stroke="'+color+'" stroke-width="'+sw.toFixed(1)+'" opacity="'+op.toFixed(3)+'"/>');
    if (glow > 0.1) els.push('<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(r*1.5).toFixed(1)+'" fill="none" stroke="'+color+'" stroke-width="'+(sw*0.5).toFixed(1)+'" opacity="'+(op*glow*0.3).toFixed(3)+'"/>');
  }
  for (let l = 0; l < lineCount; l++) {
    const x1 = rng()*SIZE, y1 = rng()*SIZE, angle = rng()*Math.PI*0.4-Math.PI*0.2;
    const len = 50+rng()*300*depth, x2 = x1+Math.cos(angle)*len, y2 = y1+Math.sin(angle)*len;
    const color = palette[1+Math.floor(rng()*(palette.length-1))] || '#00d4ff';
    const op = neonIntensity*(0.3+rng()*0.5), sw = 0.5+rng()*2;
    els.push('<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+color+'" stroke-width="'+sw.toFixed(1)+'" opacity="'+op.toFixed(3)+'" stroke-linecap="round"/>');
  }
  if (rainGrain > 0.01) {
    const rr = mulberry32(seed+7777);
    const rc = Math.floor(rainGrain*3000);
    const re = [];
    for (let r = 0; r < rc; r++) {
      const rx = rr()*SIZE, ry = rr()*SIZE, rl = 3+rr()*15, ro = rr()*rainGrain*0.2;
      re.push('<line x1="'+rx.toFixed(1)+'" y1="'+ry.toFixed(1)+'" x2="'+(rx+rr()*2-1).toFixed(1)+'" y2="'+(ry+rl).toFixed(1)+'" stroke="#ffffff" stroke-width="0.5" opacity="'+ro.toFixed(3)+'"/>');
    }
    els.push('<g>'+re.join('')+'</g>');
  }
  let fd = '', fa = '';
  if (blur > 0.1) {
    fd = '<defs><filter id="glow"><feGaussianBlur stdDeviation="'+blur.toFixed(1)+'" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    fa = ' filter="url(#glow)"';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+SIZE+' '+SIZE+'" width="'+SIZE+'" height="'+SIZE+'">'+fd+'<g'+fa+'>'+els.join('')+'</g></svg>';
}

function renderSVG(size) {
  const fn = INPUT.templateId === 'flow_fields' ? renderFlowFields : renderJazzNoir;
  return fn(INPUT, size);
}

let currentSize = 1080;
function renderAt(size) {
  currentSize = size;
  const svg = renderSVG(size);
  document.getElementById('canvas').innerHTML = svg;
}

function exportPNG() {
  const svg = renderSVG(currentSize);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = currentSize; canvas.height = currentSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, currentSize, currentSize);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'artmint-' + INPUT.templateId + '-' + INPUT.seed + '-' + currentSize + 'px.png';
      a.click();
    }, 'image/png');
  };
  img.src = url;
}

renderAt(1080);
</script>
</body>
</html>`;
}
