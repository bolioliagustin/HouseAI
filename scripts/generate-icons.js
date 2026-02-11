const fs = require('fs');
const path = require('path');

function generateSVG(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#22c55e"/>
      <stop offset="100%" style="stop-color:#059669"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" 
    font-family="Arial, sans-serif" font-weight="bold" font-size="${size * 0.28}" fill="white">
    MitAI
  </text>
  <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" 
    font-family="Arial, sans-serif" font-size="${size * 0.1}" fill="rgba(255,255,255,0.8)">
    💰
  </text>
</svg>`;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (we'll update manifest to use SVG)
[192, 512].forEach(size => {
    const svg = generateSVG(size);
    fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
    console.log(`Generated icon-${size}x${size}.svg`);
});
