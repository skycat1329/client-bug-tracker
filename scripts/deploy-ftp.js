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

  // 3. Connect via FTP and Upload
  console.log('\n3️⃣ Connecting to Hostinger FTP server (' + FTP_HOST + ')...');
  const client = new ftp.Client();
  client.ftp.verbose = false;

  client.trackProgress((info) => {
    console.log(`   ⬆️ Uploading: ${info.name} (${Math.round(info.bytesOverall / 1024)} KB)`);
  });

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      port: FTP_PORT,
      secure: false,
    });

    console.log('   ✅ Connected! Current directory: ' + (await client.pwd()));
    console.log('4️⃣ Uploading updated files to Hostinger...');

    // Upload files from hostinger-public_html to current root directory
    await client.uploadFromDir(targetDir);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 DEPLOYMENT COMPLETE in ${elapsed}s!`);
    console.log('🌐 Live Website: https://lightsteelblue-barracuda-559543.hostingersite.com\n');
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
