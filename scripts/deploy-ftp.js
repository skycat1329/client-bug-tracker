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

  // 3. Connect via FTP and Upload with retry
  console.log('\n3️⃣ Connecting to Hostinger FTP server (' + FTP_HOST + ')...');

  let success = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    client.ftp.timeout = 60000;

    client.trackProgress((info) => {
      console.log(`   ⬆️ Uploading: ${info.name} (${Math.round(info.bytesOverall / 1024)} KB)`);
    });

    try {
      if (attempt > 1) {
        const delay = attempt * 4000;
        console.log(`\n🔄 Retrying upload in ${delay / 1000}s (attempt ${attempt}/5)...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASS,
        port: FTP_PORT,
        secure: false,
      });

      console.log('   ✅ Connected! Current directory: ' + (await client.pwd()));
      console.log('4️⃣ Uploading updated files to Hostinger...');

      await client.uploadFromDir(targetDir);
      success = true;
      client.close();
      break;
    } catch (err) {
      console.warn(`   ⚠️ Attempt ${attempt} failed: ${err.message}`);
      try { client.close(); } catch (_) {}
      if (attempt === 5) {
        console.error('\n❌ Deployment failed after 5 attempts.');
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
