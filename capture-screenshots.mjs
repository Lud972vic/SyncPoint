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
  // Scan ALL folders to find one of each file type
  console.log('→ Scanning all folders for file previews...');
  try {
    // Collect all folder hrefs (skip /browse/new and /rename)
    await page.goto(`${BASE}/browse/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    const topLinks = await page.$$('a[href*="/browse/"]');
    const folderHrefs = [];
    for (const link of topLinks) {
      const href = await link.getAttribute('href');
      if (href && href.startsWith('/browse/') && !href.includes('/new') && !href.includes('/rename') && href !== '/browse/' && !folderHrefs.includes(href)) {
        folderHrefs.push(href);
      }
    }

    let xlsxDone = false, csvDone = false, pdfDone = false, imgDone = false;

    for (const fhref of folderHrefs) {
      if (xlsxDone && csvDone && pdfDone && imgDone) break;
      // Scan multiple pages (pageSize=10, up to 80 files = 8 pages)
      for (let p = 1; p <= 8; p++) {
        if (xlsxDone && csvDone && pdfDone && imgDone) break;
        await page.goto(`${BASE}${fhref}?page=${p}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(500);

      // OnlyOffice links (xlsx, csv, txt, docx, etc.)
      if (!xlsxDone) {
        const xlsxLink = await page.$('a[href*="/file/"][href$="/edit"]:has-text(".xlsx")');
        if (xlsxLink) {
          const xlsxHref = await xlsxLink.getAttribute('href');
          console.log(`  → xlsx at ${xlsxHref}`);
          const ooPage = await context.newPage();
          await ooPage.goto(`${BASE}${xlsxHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await ooPage.waitForTimeout(10000);
          await ooPage.screenshot({ path: path.join(CAPTURES, '18-onlyoffice-xlsx.png'), fullPage: false });
          console.log('  ✓ 18-onlyoffice-xlsx.png');
          await ooPage.close();
          xlsxDone = true;
        }
      }

      if (!csvDone) {
        const csvLink = await page.$('a[href*="/file/"][href$="/edit"]:has-text(".csv")');
        if (csvLink) {
          const csvHref = await csvLink.getAttribute('href');
          console.log(`  → csv at ${csvHref}`);
          const ooPage = await context.newPage();
          await ooPage.goto(`${BASE}${csvHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await ooPage.waitForTimeout(10000);
          await ooPage.screenshot({ path: path.join(CAPTURES, '20-onlyoffice-csv.png'), fullPage: false });
          console.log('  ✓ 20-onlyoffice-csv.png');
          await ooPage.close();
          csvDone = true;
        }
      }

      // Preview buttons (pdf, images)
      if (!pdfDone || !imgDone) {
        const buttons = await page.$$('button[data-preview-trigger="1"]');
        for (const btn of buttons) {
          if (pdfDone && imgDone) break;
          const name = (await btn.getAttribute('data-preview-name')) || '';
          const mime = (await btn.getAttribute('data-preview-mime')) || '';
          if (!pdfDone && (name.toLowerCase().endsWith('.pdf') || mime === 'application/pdf')) {
            console.log(`  → PDF: ${name}`);
            await btn.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(CAPTURES, '19-pdf-preview.png'), fullPage: false });
            console.log('  ✓ 19-pdf-preview.png');
            pdfDone = true;
            try { await page.keyboard.press('Escape'); await page.waitForTimeout(500); } catch {}
            continue;
          }
          if (!imgDone && mime.startsWith('image/')) {
            console.log(`  → Image: ${name}`);
            await btn.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(CAPTURES, '17-image-preview.png'), fullPage: false });
            console.log('  ✓ 17-image-preview.png');
            imgDone = true;
            try { await page.keyboard.press('Escape'); await page.waitForTimeout(500); } catch {}
            continue;
          }
        }
      }
      } // end page loop
    }
    if (!xlsxDone) console.log('  ✗ no .xlsx file found in any folder');
    if (!csvDone) console.log('  ✗ no .csv file found in any folder');
    if (!pdfDone) console.log('  ✗ no .pdf file found in any folder');
    if (!imgDone) console.log('  ✗ no image file found in any folder');
  } catch (e) {
    console.error(`  ✗ preview: ${e.message}`);
  }

  await browser.close();
  console.log('\nDone! All captures saved to captures/');
}

main().catch(e => { console.error(e); process.exit(1); });
