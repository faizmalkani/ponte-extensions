import fs from 'fs';
import path from 'path';

// Paths
const srcManifest = path.resolve('./manifest.json');
const destManifest = path.resolve('./chrome-extension-build/manifest.json');

// Read original manifest
const manifest = JSON.parse(fs.readFileSync(srcManifest, 'utf-8'));

// Update values for production build
manifest.background.service_worker = 'background/background.js';
manifest.content_scripts = manifest.content_scripts.map(script =>
{
    return {
        ...script,
        js: script.js.map(file => file.replace(/^dist\//, ''))
    };
});

// Optional: change name/version for production
manifest.name = manifest.name.replace('[DEV]', '').trim();
manifest.version = '1.0.5';

// Write updated manifest to package folder
fs.writeFileSync(destManifest, JSON.stringify(manifest, null, 4), 'utf-8');

console.log('Manifest updated for production build!');
