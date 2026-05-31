/**
 * Memory Island — UX/UI Tour Script
 * Screenshots all major screens for review.
 * Temporarily enables demo mode by swapping firebase config.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000/memoryIsland';
const OUT_DIR = path.join(process.cwd(), 'scripts/ux-screenshots');
const CONFIG_PATH = path.join(process.cwd(), 'firebase-applet-config.json');

const PLACEHOLDER_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "placeholder.firebaseapp.com",
  projectId: "placeholder",
  storageBucket: "placeholder.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
  firestoreDatabaseId: "(default)"
};

let screenshotCount = 0;

async function shot(page: Page, name: string, fullPage = false) {
  const filename = `${String(++screenshotCount).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage });
  console.log(`  📸 ${filename}`);
}

async function goDashboard(page: Page, clearStorage = false) {
  await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  if (clearStorage) {
    await page.evaluate(() => {
      localStorage.clear();
      // Don't clear the onboarding flag so we can screenshot it
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(2000);
}

async function closeModal(page: Page) {
  // Try Escape first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // If still open, try clicking the X button
  const xBtn = page.locator('button:has(svg[data-lucide="x"]), button[aria-label*="close" i]').first();
  if (await xBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await xBtn.click();
    await page.waitForTimeout(300);
  }
}

async function clickSidebarButton(page: Page, tooltipText: string): Promise<boolean> {
  try {
    // Find the button that contains a tooltip div with this text
    const btn = page.locator(`aside nav button`).filter({ hasText: '' }).all();

    // Hover each nav button and check tooltip
    const navBtns = page.locator('aside nav button');
    const count = await navBtns.count();

    for (let i = 0; i < count; i++) {
      const b = navBtns.nth(i);
      await b.hover();
      await page.waitForTimeout(200);
      const tooltip = page.locator('.absolute.left-full', { hasText: tooltipText });
      if (await tooltip.isVisible({ timeout: 400 }).catch(() => false)) {
        await b.click();
        await page.waitForTimeout(700);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function desktopTour(context: BrowserContext) {
  console.log('\n── DESKTOP (1280×900) ──');
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Firebase')) {
      console.log('  [err]', msg.text().slice(0, 80));
    }
  });

  // ── 1. Auth page (with real config disabled) ──
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 'auth-landing');

  // ── 2. Auth — email view ──
  const emailBtn = page.locator('button:has-text("Continue with Email")');
  if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await emailBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'auth-email');
    // Switch to sign-up
    await page.click('text=Create an explorer account').catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'auth-signup');
    await page.click('text=Back').catch(() => {});
    await page.waitForTimeout(400);
  }

  // ── 3. Dashboard — new user / onboarding ──
  await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Screenshot onboarding step 1
  const onboarding1 = page.locator('text=The Island Way');
  if (await onboarding1.isVisible({ timeout: 3000 }).catch(() => false)) {
    await shot(page, 'onboarding-step1');
    // Step 2
    await page.click('button:has-text("Next")').catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, 'onboarding-step2');
    // Step 3
    await page.click('button:has-text("Next")').catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, 'onboarding-step3');
    // Dismiss
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // ── 4. Dashboard — empty state (new user, no islands) ──
  await shot(page, 'dashboard-new-user');

  // ── 5. New island modal ──
  // Find create/plus buttons
  const createIslandBtn = page.locator('button:has-text("Create"), button:has-text("New Island"), button:has-text("island")').first();
  if (await createIslandBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createIslandBtn.click();
    await page.waitForTimeout(700);
    const modalTitle = page.locator('text=New Island, text=Create Island, text=Create Collection').first();
    if (await modalTitle.isVisible({ timeout: 1500 }).catch(() => false)) {
      await shot(page, 'modal-new-island');
      await closeModal(page);
    }
  }

  // Try all the SVG icon buttons in the content area as CTAs
  const plusBtns = page.locator('button').filter({ has: page.locator('svg') });
  const plusCount = await plusBtns.count();
  for (let i = 0; i < Math.min(plusCount, 6); i++) {
    const b = plusBtns.nth(i);
    const text = (await b.textContent() || '').trim();
    if (text.toLowerCase().includes('island') || text.toLowerCase().includes('create') || text.toLowerCase().includes('collection')) {
      await b.click();
      await page.waitForTimeout(700);
      const hasModal = await page.locator('[role="dialog"]').isVisible({ timeout: 1000 }).catch(() => false);
      if (hasModal) {
        await shot(page, 'modal-new-island-v2');
        await closeModal(page);
        break;
      }
    }
  }

  // ── 6. Sidebar — Discover panel ──
  const discoverOpened = await clickSidebarButton(page, 'Discover');
  if (discoverOpened) {
    await shot(page, 'panel-discover');
    await closeModal(page);
  } else {
    // Try directly by icon position (Compass is always 2nd nav btn)
    const navBtns = page.locator('aside nav button');
    if (await navBtns.count() >= 2) {
      await navBtns.nth(1).click();
      await page.waitForTimeout(700);
      await shot(page, 'panel-discover-fallback');
      await closeModal(page);
    }
  }

  // ── 7. Make the app think we're a returning user (skip localStorage trick — use full nav) ──
  // Set onboarding seen so it doesn't re-trigger
  await page.evaluate(() => {
    localStorage.setItem('mi_onboarding_seen', 'true');
  });

  // ── 8. Simulate returning user to unlock full nav ──
  // The full nav requires isNewUser=false, which needs totalStudySessions > 0 OR currentIslands.length > 0.
  // We can't set Firebase data, but we can screenshot what's available.
  // Try opening Settings via profile dropdown since that's always accessible
  const profileBtn = page.locator('aside button').first();
  await profileBtn.click();
  await page.waitForTimeout(600);
  await shot(page, 'profile-dropdown');

  // Open Settings from dropdown
  const settingsMenuItem = page.locator('button:has-text("Settings")').first();
  if (await settingsMenuItem.isVisible({ timeout: 1500 }).catch(() => false)) {
    await settingsMenuItem.click();
    await page.waitForTimeout(800);
    await shot(page, 'panel-settings');
    await closeModal(page);
  }

  // ── 9. Notifications bell ──
  const bellBtn = page.locator('aside').locator('button').nth(1);
  await bellBtn.click();
  await page.waitForTimeout(600);
  await shot(page, 'panel-notifications');
  await bellBtn.click(); // toggle off
  await page.waitForTimeout(300);

  // ── 10. Full page screenshots ──
  await shot(page, 'dashboard-desktop-full', true);

  await page.close();
}

async function returningUserTour(context: BrowserContext) {
  console.log('\n── RETURNING USER (1280×900) — unlocked nav ──');
  const page = await context.newPage();

  // Pre-seed localStorage to bypass isNewUser check indirectly
  // The isNewUser check looks at Firebase data we can't mock,
  // but we can at least set the onboarding flag
  await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('mi_onboarding_seen', 'true');
  });
  await page.waitForTimeout(2000);

  // Try all nav buttons that might be revealed (depends on isNewUser state)
  const sidebarItems = [
    { label: 'Social',             slug: 'panel-social' },
    { label: 'Stats',              slug: 'panel-stats' },
    { label: 'Leaderboard',        slug: 'panel-leaderboard' },
    { label: 'Trophies',           slug: 'panel-trophies' },
    { label: 'Distress Signals',   slug: 'panel-distress' },
    { label: 'Test Mode',          slug: 'panel-test-mode' },
  ];

  for (const { label, slug } of sidebarItems) {
    const opened = await clickSidebarButton(page, label);
    if (opened) {
      await shot(page, slug);
      await closeModal(page);
      await page.waitForTimeout(300);
    } else {
      console.log(`  (skipped — ${label} not visible, likely hidden for new users)`);
    }
  }

  // ── More button if visible ──
  const moreBtn = page.locator('aside nav button').last();
  const moreBtnText = await moreBtn.textContent().catch(() => '');
  if (moreBtnText?.includes('More') || await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'sidebar-more-popover');
    await closeModal(page);
  }

  await page.close();
}

async function mobileTour(context: BrowserContext) {
  console.log('\n── MOBILE (390×844) ──');
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  // Auth
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(page, 'mobile-auth');

  // Dashboard
  await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Screenshot onboarding on mobile if present
  const onboarding = page.locator('text=The Island Way');
  if (await onboarding.isVisible({ timeout: 2000 }).catch(() => false)) {
    await shot(page, 'mobile-onboarding');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  await shot(page, 'mobile-dashboard');

  // Mobile bottom nav close-up (scroll to bottom area)
  await shot(page, 'mobile-dashboard-full', true);

  // Open a panel on mobile (find bottom nav item)
  const bottomNav = page.locator('nav.fixed, nav[class*="bottom"], footer nav, [class*="bottom-nav"]').first();
  if (await bottomNav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await shot(page, 'mobile-bottom-nav');
    // Click first nav item besides home
    const navItems = bottomNav.locator('button');
    const navCount = await navItems.count();
    if (navCount > 1) {
      await navItems.nth(1).click();
      await page.waitForTimeout(700);
      await shot(page, 'mobile-panel-open');
      await closeModal(page);
    }
  }

  // Also find the mobile-specific nav by class patterns in MobileBottomNav
  // It's likely a fixed bottom div
  const fixedBottomEl = page.locator('.fixed.bottom-0, .fixed[class*="bottom"]').last();
  if (await fixedBottomEl.isVisible({ timeout: 1000 }).catch(() => false)) {
    await shot(page, 'mobile-bottom-nav-v2');
  }

  await page.close();
}

async function runTour() {
  const realConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Clear old screenshots
  const oldFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  oldFiles.forEach(f => fs.unlinkSync(path.join(OUT_DIR, f)));

  console.log('🔄 Enabling demo mode...');
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(PLACEHOLDER_CONFIG, null, 2));
  console.log('⏳ Waiting for Vite HMR (6s)...');
  await new Promise(r => setTimeout(r, 6000));

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: false, slowMo: 80 });

    // Desktop
    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'dark',
    });
    await desktopTour(desktopCtx);
    await returningUserTour(desktopCtx);
    await desktopCtx.close();

    // Mobile
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      isMobile: true,
      hasTouch: true,
    });
    await mobileTour(mobileCtx);
    await mobileCtx.close();

    console.log(`\n✅ Tour complete — ${screenshotCount} screenshots in scripts/ux-screenshots/`);
  } finally {
    if (browser) await browser.close();
    console.log('🔄 Restoring Firebase config...');
    fs.writeFileSync(CONFIG_PATH, realConfig);
    console.log('✅ Config restored.');
  }
}

runTour().catch(err => {
  try { fs.writeFileSync(CONFIG_PATH, fs.readFileSync(CONFIG_PATH + '.bak', 'utf-8')); } catch {}
  console.error('Tour failed:', err);
  process.exit(1);
});
