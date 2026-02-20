"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

export type CodeMode = "svg" | "javascript";

interface Props {
  code: string;
  mode: CodeMode;
  seed: number;
  palette: string[];
  onError?: (error: string | null) => void;
}

export interface CodePreviewHandle {
  capture: () => Promise<string>;
}

export const CodePreview = forwardRef<CodePreviewHandle, Props>(
  function CodePreview({ code, mode, seed, palette, onError }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const captureResolveRef = useRef<((dataUrl: string) => void) | null>(null);

    // Listen for messages from iframe
    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "error") {
          onError?.(e.data.message);
        } else if (e.data?.type === "render-ok") {
          onError?.(null);
        } else if (e.data?.type === "capture-result") {
          captureResolveRef.current?.(e.data.dataUrl);
          captureResolveRef.current = null;
        }
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [onError]);

    const srcdoc = mode === "svg"
      ? buildSvgSrcdoc(code)
      : buildJsSrcdoc(code, seed, palette);

    useImperativeHandle(ref, () => ({
      capture: () => {
        return new Promise<string>((resolve, reject) => {
          const iframe = iframeRef.current;
          if (!iframe?.contentWindow) {
            reject(new Error("Preview not ready"));
            return;
          }
          captureResolveRef.current = resolve;
          iframe.contentWindow.postMessage({ type: "capture" }, "*");
          setTimeout(() => {
            if (captureResolveRef.current) {
              captureResolveRef.current = null;
              reject(new Error("Capture timed out"));
            }
          }, 5000);
        });
      },
    }));

    return (
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="w-full h-full border-0 bg-[#0a0a0a]"
        title="Code preview"
      />
    );
  }
);

function buildSvgSrcdoc(svgCode: string): string {
  // For SVG mode: render SVG directly, draw to canvas for PNG capture
  const safeSvg = svgCode.replace(/<script[\s\S]*?<\/script>/gi, "");

  return `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#preview{max-width:100vmin;max-height:100vmin;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
#preview svg{max-width:100%;max-height:100%}
canvas{display:none}
</style></head><body>
<div id="preview"></div>
<canvas id="canvas" width="1080" height="1080"></canvas>
<script>
try {
  var svgStr = ${JSON.stringify(safeSvg)};

  // Basic SVG validation
  if (!svgStr.trim()) {
    throw new Error('SVG code is empty');
  }

  var parser = new DOMParser();
  var doc = parser.parseFromString(svgStr, 'image/svg+xml');

  var parseError = doc.querySelector('parsererror');
  if (parseError) {
    var msg = parseError.textContent || 'Invalid SVG markup';
    // Clean up the error message
    msg = msg.replace(/Below is a rendering.*$/s, '').trim();
    if (msg.length > 200) msg = msg.substring(0, 200) + '...';
    throw new Error(msg);
  }

  var svgEl = doc.documentElement;
  if (svgEl.tagName !== 'svg') {
    throw new Error('Root element must be <svg>. Got <' + svgEl.tagName + '>');
  }

  document.getElementById('preview').innerHTML = svgStr;
  parent.postMessage({ type: 'render-ok' }, '*');
} catch(e) {
  document.getElementById('preview').innerHTML =
    '<div style="color:#ef4444;font-family:monospace;font-size:14px;padding:24px;text-align:center;max-width:500px">' +
    '<div style="font-size:18px;margin-bottom:12px;font-weight:bold">SVG Error</div>' +
    '<div>' + e.message.replace(/</g,'&lt;') + '</div></div>';
  parent.postMessage({ type: 'error', message: e.message }, '*');
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'capture') {
    try {
      var svgEl = document.querySelector('#preview svg');
      if (!svgEl) {
        parent.postMessage({ type: 'error', message: 'No SVG to capture' }, '*');
        return;
      }
      var svgData = new XMLSerializer().serializeToString(svgEl);
      var blob = new Blob([svgData], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function() {
        var canvas = document.getElementById('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1080, 1080);
        URL.revokeObjectURL(url);
        var dataUrl = canvas.toDataURL('image/png');
        parent.postMessage({ type: 'capture-result', dataUrl: dataUrl }, '*');
      };
      img.onerror = function() {
        URL.revokeObjectURL(url);
        parent.postMessage({ type: 'error', message: 'Failed to render SVG to image' }, '*');
      };
      img.src = url;
    } catch(err) {
      parent.postMessage({ type: 'error', message: err.message }, '*');
    }
  }
});
</script></body></html>`;
}

function buildJsSrcdoc(code: string, seed: number, palette: string[]): string {
  const safeCode = code.replace(/<\//g, "\\u003c/");
  const paletteJson = JSON.stringify(palette).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
canvas{max-width:100vmin;max-height:100vmin}
</style></head><body>
<canvas id="canvas" width="1080" height="1080"></canvas>
<script>
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

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const WIDTH = 1080, HEIGHT = 1080;
const seed = ${seed};
const palette = ${paletteJson};
const _rng = mulberry32(seed);
function random() { return _rng(); }
const noise2D = createNoise2D(seed + 1);

try {
  ${safeCode}
  parent.postMessage({ type: 'render-ok' }, '*');
} catch(e) {
  parent.postMessage({ type: 'error', message: e.message }, '*');
}

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'capture') {
    const dataUrl = canvas.toDataURL('image/png');
    parent.postMessage({ type: 'capture-result', dataUrl: dataUrl }, '*');
  }
});
</script></body></html>`;
}
