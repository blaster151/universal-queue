import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 48, 128];
const masterIcon = resolve(__dirname, '../icon_master.png');
const iconsDir = resolve(__dirname, '../extension/dist/icons');

function resizeIcons() {
  try {
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Resize for each size using ImageMagick
    for (const size of sizes) {
      const outputPath = resolve(iconsDir, `icon${size}.png`);
      execSync(`magick "${masterIcon}" -resize ${size}x${size} "${outputPath}"`);
      console.log(`Created ${size}x${size} icon`);
    }

    console.log('All icons created successfully!');
  } catch (error) {
    console.error('Error creating icons:', error);
    process.exit(1);
  }
}

resizeIcons(); 