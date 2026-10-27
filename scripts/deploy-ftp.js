import * as ftp from 'basic-ftp';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const targetDir = path.join(rootDir, 'hostinger-public_html');

import fs from 'fs';

// Read .env from root if available
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// FTP Credentials (from environment or .env)
const FTP_HOST = process.env.FTP_SERVER || '';
const FTP_USER = process.env.FTP_USERNAME || '';
const FTP_PASS = process.env.FTP_PASSWORD || '';
const FTP_PORT = parseInt(process.env.FTP_PORT || '21', 10);

async function deploy() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    console.error('\n❌ Missing FTP Credentials!');
    console.error('Please ensure FTP_SERVER, FTP_USERNAME, and FTP_PASSWORD are set in your root .env file or environment variables.\n');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log('\n🚀 Starting Automated Hostinger Deployment...\n');

  // 1. Build Frontend
  console.log('1️⃣ Compiling React production bundle...');
  execSync('npm --prefix frontend run build', { stdio: 'inherit', cwd: rootDir });

  // 2. Package into hostinger-public_html
  console.log('\n2️⃣ Packaging files into hostinger-public_html...');
  execSync('node scripts/package-hostinger.js', { stdio: 'inherit', cwd: rootDir });

  // 3. Connect via FTP and Upload with auto-resuming retry
  console.log('\n3️⃣ Connecting to Hostinger FTP server (' + FTP_HOST + ')...');

  function getFilesRecursively(dir, base = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const relPath = path.join(base, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getFilesRecursively(fullPath, relPath));
      } else {
        results.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
      }
    }
    return results;
  }

  const filesToUpload = getFilesRecursively(targetDir);
  console.log(`4️⃣ Uploading ${filesToUpload.length} files to Hostinger...`);

  let success = false;
  const uploadedFiles = new Set();

  for (let attempt = 1; attempt <= 10; attempt++) {
    if (uploadedFiles.size === filesToUpload.length) {
      success = true;
      break;
    }

    const client = new ftp.Client();
    client.ftp.verbose = true;
    client.ftp.timeout = 60000;
    client.prepareTransfer = ftp.enterPassiveModeIPv4;

    try {
      if (attempt > 1) {
        const delay = Math.min(attempt * 2000, 10000);
        console.log(`\n🔄 Reconnecting in ${delay / 1000}s (resuming upload, attempt ${attempt}/10)...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        port: FTP_PORT,
        secure: false,
      });

      const remoteRoot = await client.pwd();

      for (const file of filesToUpload) {
        if (uploadedFiles.has(file.relPath)) continue;

        const remoteDir = path.dirname(file.relPath).replace(/\\/g, '/');
        const remoteFileName = path.basename(file.relPath);

        if (remoteDir && remoteDir !== '.') {
          await client.ensureDir(`${remoteRoot}/${remoteDir}`);
        } else {
          await client.cd(remoteRoot);
        }

        // If it's an unchanging image or static asset and remote size matches local size, skip re-uploading
        const isStaticAsset = file.relPath.includes('/documents/') || file.relPath.endsWith('.jpg') || file.relPath.endsWith('.png');
        if (isStaticAsset) {
          try {
            const remoteSize = await client.size(remoteFileName);
            const localSize = fs.statSync(file.fullPath).size;
            if (remoteSize === localSize) {
              uploadedFiles.add(file.relPath);
              console.log(`   ⏭️ Skipped (unchanged): ${file.relPath}`);
              continue;
            }
          } catch (_) {}
        }

        // Remove any pure-ftpd temporary lock file left by interrupted uploads
        try {
          await client.remove(`.in.${remoteFileName}.`);
        } catch (_) {}

        await client.uploadFrom(file.fullPath, remoteFileName);
        uploadedFiles.add(file.relPath);
        console.log(`   ✅ Uploaded [${uploadedFiles.size}/${filesToUpload.length}]: ${file.relPath}`);

        // Brief cooldown between data sockets to prevent firewall throttle
        await new Promise((r) => setTimeout(r, 120));
      }

      client.close();
      success = true;
      break;
    } catch (err) {
      console.warn(`   ⚠️ Transient error on attempt ${attempt}: ${err.message}`);
      try { client.close(); } catch (_) {}
      if (attempt === 10) {
        console.error('\n❌ Deployment failed after 10 attempts.');
        process.exit(1);
      }
    }
  }

  if (success) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 DEPLOYMENT COMPLETE in ${elapsed}s!`);
    console.log('🌐 Live Website: https://lightsteelblue-barracuda-559543.hostingersite.com\n');
  }
}

deploy();
