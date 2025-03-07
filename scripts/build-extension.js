import { build } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildExtension() {
  try {
    // Create extension directory
    const extensionDir = resolve(__dirname, '../extension/dist');
    
    // Clean up the extension directory
    if (fs.existsSync(extensionDir)) {
      fs.rmSync(extensionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extensionDir, { recursive: true });

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

    // Build popup with esbuild
    const popupSource = resolve(__dirname, '../src/extension/popup.tsx');
    const popupDest = resolve(extensionDir, 'popup.js');

    await esbuild.build({
      entryPoints: [popupSource],
      bundle: true,
      outfile: popupDest,
      format: 'iife',
      target: 'es2020',
      platform: 'browser'
    });

    // Copy popup HTML
    const popupHtmlSource = resolve(__dirname, '../src/extension/popup.html');
    const popupHtmlDest = resolve(extensionDir, 'popup.html');
    
    console.log('Popup HTML source:', popupHtmlSource);
    console.log('Popup HTML destination:', popupHtmlDest);
    
    if (!fs.existsSync(popupHtmlSource)) {
      throw new Error(`Popup HTML file not found at ${popupHtmlSource}`);
    }
    
    fs.copyFileSync(popupHtmlSource, popupHtmlDest);
    
    if (!fs.existsSync(popupHtmlDest)) {
      throw new Error('Popup HTML file was not copied successfully');
    }
    console.log('Popup HTML copied successfully');

    // Build background script
    await build({
      root: '.',
      build: {
        outDir: extensionDir,
        rollupOptions: {
          input: {
            background: resolve(__dirname, '../src/extension/background.ts'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]',
          },
        },
      },
    });

    // Build content scripts using tsc
    execSync('tsc -p tsconfig.content.json', { stdio: 'inherit' });

    // Copy content script
    const contentScriptSource = path.join(__dirname, '../src/extension/content.ts');
    const contentScriptDest = path.join(extensionDir, 'content.js');

    // Build content script with esbuild
    await esbuild.build({
      entryPoints: [contentScriptSource],
      bundle: true,
      outfile: contentScriptDest,
      format: 'iife',
      target: 'es2020',
      platform: 'browser'
    });

    console.log('Content script copied successfully');

    // Create icons directory and resize icons
    const iconsDir = resolve(extensionDir, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    execSync('node scripts/resize-icons.js', { stdio: 'inherit' });

    // Copy manifest last, after all builds are complete
    const manifestSource = resolve(__dirname, '../src/extension/manifest.json');
    const manifestDest = resolve(extensionDir, 'manifest.json');
    
    console.log('Manifest source:', manifestSource);
    console.log('Manifest destination:', manifestDest);
    
    if (!fs.existsSync(manifestSource)) {
      throw new Error(`Manifest file not found at ${manifestSource}`);
    }
    
    fs.copyFileSync(manifestSource, manifestDest);
    console.log('Manifest file copied successfully');

    // Verify the manifest was copied
    if (!fs.existsSync(manifestDest)) {
      throw new Error('Manifest file was not copied successfully');
    }

    // List contents of extension directory
    console.log('\nExtension directory contents:');
    fs.readdirSync(extensionDir).forEach(file => {
      console.log(`- ${file}`);
    });

    console.log('\nExtension built successfully!');
    console.log('Note: You need to add icon files (16x16, 48x48, and 128x128) to the icons directory manually.');
  } catch (error) {
    console.error('Error building extension:', error);
    process.exit(1);
  }
}

buildExtension().catch(console.error); 