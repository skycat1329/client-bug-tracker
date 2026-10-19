import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetDir = path.join(rootDir, 'hostinger-public_html');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
const phpBackend = path.join(rootDir, 'php-backend');

console.log('📦 Preparing Hostinger Ready-to-Upload Bundle (PHP + MySQL + React HTML)...');

// 1. Create clean target directory
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// 2. Copy compiled React frontend (index.html, assets, vite.svg)
if (!fs.existsSync(frontendDist)) {
  console.error('❌ frontend/dist not found! Please run `npm --prefix frontend run build` first.');
  process.exit(1);
}

fs.cpSync(frontendDist, targetDir, { recursive: true });
console.log('   ✅ Copied compiled React Frontend (HTML/CSS/JS)');

// 3. Copy PHP API into api/
const targetApiDir = path.join(targetDir, 'api');
fs.cpSync(path.join(phpBackend, 'api'), targetApiDir, { recursive: true });
console.log('   ✅ Copied PHP API router & database helpers into /api');

// 4. Copy .htaccess
fs.copyFileSync(path.join(phpBackend, '.htaccess'), path.join(targetDir, '.htaccess'));
console.log('   ✅ Copied .htaccess Apache router');

// 5. Copy database.sql
fs.copyFileSync(path.join(phpBackend, 'database.sql'), path.join(targetDir, 'database.sql'));
console.log('   ✅ Copied database.sql (MySQL Schema)');

// 6. Create uploads directory
const uploadsDir = path.join(targetDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log('   ✅ Created uploads directory');

// 7. Create ZIP archive with standard Linux forward slashes
import { execSync } from 'child_process';
const zipPath = path.join(rootDir, 'hostinger-deploy.zip');
try {
  const tarCmd = process.platform === 'win32' ? 'tar.exe -a -c -f' : 'tar -czf';
  execSync(`${tarCmd} "${zipPath}" -C "${targetDir}" .`);
  console.log('   ✅ Created hostinger-deploy.zip with Linux forward-slash paths');
} catch (e) {
  console.warn('   ⚠️ Could not automatically create hostinger-deploy.zip:', e.message);
}

console.log('\n🎉 HOSTINGER BUNDLE READY IN:');
console.log(`📁 ${targetDir}`);
console.log(`📦 ${zipPath}\n`);
console.log('Upload instructions:');
console.log('1. Go to Hostinger hPanel -> Databases -> Create MySQL Database.');
console.log('2. Open phpMyAdmin and import `database.sql`.');
console.log('3. In Hostinger public_html, delete everything, upload hostinger-deploy.zip, and click Extract.');
console.log('4. Edit `api/config.php` with your database name, user, and password.');
