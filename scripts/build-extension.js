import { build } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildExtension() {
  try {
    // Build the web app first
    await build({
      root: '.',
      build: {
        outDir: 'dist',
        rollupOptions: {
          input: {
            main: resolve(__dirname, '../index.html'),
          },
        },
      },
    });

    // Create extension directory
    const extensionDir = resolve(__dirname, '../extension/dist');
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true });
    }

    // Copy popup files
    fs.copyFileSync(
      resolve(__dirname, '../dist/index.html'),
      resolve(extensionDir, 'popup.html')
    );
    fs.copyFileSync(
      resolve(__dirname, '../dist/assets/main.js'),
      resolve(extensionDir, 'popup.js')
    );

    // Build background and content scripts
    await build({
      root: '.',
      build: {
        outDir: extensionDir,
        rollupOptions: {
          input: {
            background: resolve(__dirname, '../src/extension/background.ts'),
            content: resolve(__dirname, '../src/extension/content.ts'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]',
          },
        },
      },
    });

    // Create icons directory (you'll need to add icons manually)
    const iconsDir = resolve(extensionDir, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Copy manifest last, after all builds are complete
    const manifestSource = resolve(__dirname, '../src/extension/manifest.json');
    const manifestDest = resolve(extensionDir, 'manifest.json');
    
    if (!fs.existsSync(manifestSource)) {
      throw new Error(`Manifest file not found at ${manifestSource}`);
    }
    
    fs.copyFileSync(manifestSource, manifestDest);
    console.log('Manifest file copied successfully');

    // Verify the manifest was copied
    if (!fs.existsSync(manifestDest)) {
      throw new Error('Manifest file was not copied successfully');
    }

    console.log('Extension built successfully!');
    console.log('Note: You need to add icon files (16x16, 48x48, and 128x128) to the icons directory manually.');
  } catch (error) {
    console.error('Error building extension:', error);
    process.exit(1);
  }
}

buildExtension().catch(console.error); 