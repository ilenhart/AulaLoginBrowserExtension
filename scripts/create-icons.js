// Icon generation script
// To use this, you would need to install: npm install sharp
// Then run: node scripts/create-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, '../icons/icon.svg');

async function createIcons() {
  console.log('Creating PNG icons from SVG...');

  for (const size of sizes) {
    const outputPath = path.join(__dirname, `../icons/icon${size}.png`);

    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ Created icon${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to create icon${size}.png:`, error.message);
    }
  }

  console.log('\nDone! All icons created.');
}

createIcons();
