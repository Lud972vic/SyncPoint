import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const CAPTURES = path.join(__dirname, 'captures');

const EMAIL = 'admin@syncpoint.fr';
const PASSWORD = '@dmin123';

// Routes vérifiées via debug:router — pas de 404 possibles
const shots = [
  { name: '02-dashboard.png',      path: '/',                fullPage: true },
  { name: '03-browse.png',         path: '/browse/',         fullPage: true },
  { name: '04-audit.png',          path: '/audit/',          fullPage: true },
  { name: '05-faq.png',            path: '/faq',             fullPage: true },
  { name: '06-bookmarks.png',      path: '/bookmarks/',      fullPage: true },
  { name: '07-admin.png',          path: '/admin/settings',  fullPage: true },
  { name: '08-backup.png',         path: '/admin/backup',    fullPage: true },
  { name: '09-apikeys.png',        path: '/admin/api-keys',  fullPage: true },
  { name: '10-profile.png',        path: '/profile',         fullPage: true },
  { name: '11-search.png',         path: '/search',          fullPage: true },
  { name: '12-trash.png',          path: '/trash/',          fullPage: true },
  { name: '14-groups.png',         path: '/groups/',         fullPage: true },
  { name: '15-share.png',          path: '/share',           fullPage: true },
  { name: '21-license.png',        path: '/license/',        fullPage: true },
  { name: '22-users.png',          path: '/users',           fullPage: true },
  { name: '23-user-import.png',    path: '/users/import',    fullPage: true },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  // --- Capture login page FIRST (before auth) ---
  console.log('→ 01-login.png (pre-auth)');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(CAPTURES, '01-login.png'), fullPage: false });
  console.log('  ✓ saved');

  // --- Login ---
  console.log('→ Login...');
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  console.log('✓ Logged in');

  // --- Capture static pages ---
  for (const shot of shots) {
    console.log(`→ ${shot.name} (${shot.path})`);
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(CAPTURES, shot.name), fullPage: shot.fullPage });
      console.log(`  ✓ saved`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }

  // --- Capture notifications dropdown (it's a dropdown in navbar, not a page) ---
  console.log('→ 13-notifications.png (dropdown)');
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.click('#notificationBell');
    await page.waitForTimeout(2000); // wait for AJAX to load notifications
    await page.screenshot({ path: path.join(CAPTURES, '13-notifications.png'), fullPage: false });
    console.log('  ✓ saved');
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
  }

  // --- Capture dynamic pages (need a UUID from the app) ---
  // 16-folder-content.png : open first folder in browse
  console.log('→ 16-folder-content.png');
  try {
    await page.goto(`${BASE}/browse/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    // Find first folder link
    const folderLink = await page.$('a[href*="/browse/"]');
    if (folderLink) {
      const href = await folderLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(CAPTURES, '16-folder-content.png'), fullPage: true });
      console.log('  ✓ saved');
    } else {
      console.log('  ✗ no folder found');
    }
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
  }

  // 14b-group-detail.png : open first group
  console.log('→ 14b-group-detail.png');
  try {
    await page.goto(`${BASE}/groups/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    const groupLink = await page.$('a[href*="/groups/"]');
    if (groupLink) {
      const href = await groupLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(CAPTURES, '14b-group-detail.png'), fullPage: true });
      console.log('  ✓ saved');
    } else {
      console.log('  ✗ no group found');
    }
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
  }

  // --- File previews (PDF, image, xlsx, csv) ---
  // Navigate to a folder and find files
  console.log('→ Looking for file previews...');
  try {
    // Go back to browse and find a folder with files
    await page.goto(`${BASE}/browse/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    const folderLink = await page.$('a[href*="/browse/"]');
    if (folderLink) {
      const href = await folderLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      // PDF preview
      const pdfLink = await page.$('a[href*="/preview"]');
      if (pdfLink) {
        const href = await pdfLink.getAttribute('href');
        await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(CAPTURES, '19-pdf-preview.png'), fullPage: true });
        console.log('  ✓ 19-pdf-preview.png');
        await page.goBack();
        await page.waitForTimeout(1000);
      }

      // Image preview — find any image file link
      const imgLink = await page.$('a:has-text(".png"), a:has-text(".jpg"), a:has-text(".jpeg"), a:has-text(".gif"), a:has-text(".webp")');
      if (imgLink) {
        await imgLink.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(CAPTURES, '17-image-preview.png'), fullPage: true });
        console.log('  ✓ 17-image-preview.png');
        await page.goBack();
        await page.waitForTimeout(1000);
      }

      // OnlyOffice xlsx
      const xlsxLink = await page.$('a:has-text(".xlsx")');
      if (xlsxLink) {
        await xlsxLink.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(CAPTURES, '18-onlyoffice-xlsx.png'), fullPage: true });
        console.log('  ✓ 18-onlyoffice-xlsx.png');
        await page.goBack();
        await page.waitForTimeout(1000);
      }

      // OnlyOffice csv
      const csvLink = await page.$('a:has-text(".csv")');
      if (csvLink) {
        await csvLink.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(CAPTURES, '20-onlyoffice-csv.png'), fullPage: true });
        console.log('  ✓ 20-onlyoffice-csv.png');
      }
    }
  } catch (e) {
    console.error(`  ✗ preview: ${e.message}`);
  }

  await browser.close();
  console.log('\nDone! All captures saved to captures/');
}

main().catch(e => { console.error(e); process.exit(1); });
