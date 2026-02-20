export const starterSvgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <rect width="1080" height="1080" fill="#1a1a2e"/>

  <!-- Circles -->
  <circle cx="540" cy="540" r="300" fill="none" stroke="#e94560" stroke-width="2" opacity="0.6"/>
  <circle cx="540" cy="540" r="200" fill="none" stroke="#0f3460" stroke-width="3" opacity="0.8"/>
  <circle cx="540" cy="540" r="100" fill="#e94560" opacity="0.3"/>

  <!-- Lines -->
  <line x1="100" y1="100" x2="980" y2="980" stroke="#16213e" stroke-width="1" opacity="0.5"/>
  <line x1="980" y1="100" x2="100" y2="980" stroke="#16213e" stroke-width="1" opacity="0.5"/>

  <!-- Text -->
  <text x="540" y="560" text-anchor="middle" font-family="monospace" font-size="24" fill="#f5f5f5" opacity="0.8">
    ArtMint Custom Art
  </text>
</svg>`;

export const starterJsCode = `// ArtMint Custom Code
// Available: canvas, ctx, WIDTH, HEIGHT, seed, palette, random(), noise2D(x, y)

// Clear background
ctx.fillStyle = palette[0];
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Draw flow lines
const lineCount = 80;
const stepCount = 100;

for (let i = 0; i < lineCount; i++) {
  let x = random() * WIDTH;
  let y = random() * HEIGHT;
  const color = palette[1 + Math.floor(random() * (palette.length - 1))];
  const lineWidth = 1 + random() * 3;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.3 + random() * 0.5;

  for (let s = 0; s < stepCount; s++) {
    const angle = noise2D(x / 200, y / 200) * Math.PI * 4;
    x += Math.cos(angle) * 3;
    y += Math.sin(angle) * 3;
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

ctx.globalAlpha = 1;
`;
