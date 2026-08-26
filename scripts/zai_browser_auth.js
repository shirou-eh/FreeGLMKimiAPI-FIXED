#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { defaultChromeExecutable } from '../src/providers/zaiBrowser.js';

const outPath = process.argv[2] || process.env.AUTH_PATH || './auth.json';
const profileDir = process.env.ZAI_BROWSER_PROFILE_DIR || path.join(os.homedir(), '.free-glm-kimi-api', 'zai-browser-profile');
const timeoutMs = Number(process.env.ZAI_AUTH_TIMEOUT_MS || 300_000);
const loginUrl = 'https://chat.z.ai';
const allowGuestAuth = ['1', 'true', 'yes', 'on'].includes(String(process.env.ZAI_ALLOW_GUEST_AUTH || '').toLowerCase());

async function loadPuppeteer() {
  const [{ default: puppeteerExtra }, { default: StealthPlugin }] = await Promise.all([
    import('puppeteer-extra'),
    import('puppeteer-extra-plugin-stealth')
  ]);
  puppeteerExtra.use(StealthPlugin());
  return puppeteerExtra;
}

function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch { return {}; }
}

function loadExistingAccounts() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve(outPath), 'utf8'));
    const list = raw.accounts || (raw.id ? [raw] : []);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function saveAccount(token, cookieHeader = '') {
  const payload = decodeJwt(token);
  const newId = payload.email || payload.id || `zai-${Date.now()}`;
  const existing = loadExistingAccounts();
  // check if account with same id/email/token already exists -> update it
  const idx = existing.findIndex(a => a.id === newId || a.token === token || (a.provider==='glm' && (a.token===token)));
  const account = {
    id: newId,
    provider: 'glm',
    backend: 'zai',
    token,
    browser_fallback: true
  };
  if (cookieHeader) account.cookie = cookieHeader;
  let accounts;
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...account };
    accounts = existing;
    console.log(`Updating existing account ${newId} (already in ${outPath})`);
  } else {
    // if existing has only one and it's the same email, treat as update, otherwise add
    const sameEmailIdx = existing.findIndex(a => a.id === newId);
    if (sameEmailIdx >=0) {
      existing[sameEmailIdx] = { ...existing[sameEmailIdx], ...account };
      accounts = existing;
    } else {
      accounts = [...existing, account];
      if (existing.length > 0) console.log(`Adding new account ${newId} to ${outPath} (was ${existing.length}, now ${accounts.length})`);
    }
  }
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ accounts }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, outPath, email: payload.email || null, userId: payload.id || payload.user_id || null, browserFallback: true, totalAccounts: accounts.length }, null, 2));
}

export function isGuestZaiPayload(payload = {}) {
  const email = String(payload.email || '').toLowerCase();
  const id = String(payload.id || payload.user_id || '').toLowerCase();
  return email.endsWith('@guest.com') || id.startsWith('guest-') || email.startsWith('guest-');
}

export function isUsableZaiAuthToken(token, { allowGuest = false } = {}) {
  if (!token || !token.startsWith('eyJ') || token.split('.').length !== 3) return { ok: false, reason: 'not_jwt' };
  const payload = decodeJwt(token);
  if (!allowGuest && isGuestZaiPayload(payload)) return { ok: false, reason: 'guest_token', payload };
  return { ok: true, reason: 'ok', payload };
}

async function readToken(page) {
  return page.evaluate(() => {
    try { return localStorage.getItem('token') || ''; } catch { return ''; }
  });
}

async function cookieHeader(page) {
  const cookies = await page.cookies('https://chat.z.ai');
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

async function main() {
  const puppeteer = await loadPuppeteer();
  fs.mkdirSync(profileDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: defaultChromeExecutable(),
    userDataDir: profileDir,
    defaultViewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check', '--window-size=1365,768']
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.setUserAgent(process.env.ZAI_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');

  let networkToken = '';
  page.on('request', req => {
    const h = req.headers();
    const auth = h.authorization || h.Authorization || '';
    const m = String(auth).match(/^Bearer\s+(.+)$/i);
    if (m) networkToken = m[1];
  });

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  console.log('Z.ai browser auth window is open. Log in once there; this script will save token automatically.');
  console.log(`Profile: ${profileDir}`);
  console.log(`Timeout: ${Math.round(timeoutMs / 1000)}s`);

  const existingForCheck = loadExistingAccounts();
  const existingTokens = new Set(existingForCheck.map(a=>a.token).filter(Boolean));
  const existingIds = new Set(existingForCheck.map(a=>a.id).filter(Boolean));
  if (existingForCheck.length > 0) {
    console.log(`Found existing ${existingForCheck.length} account(s) in ${outPath}: ${[...existingIds].join(', ')}`);
    console.log('To add a NEW account, either:');
    console.log('  1) Log out in the browser and log in with a different Google, OR');
    console.log('  2) Run with a new profile: ZAI_BROWSER_PROFILE_DIR=~/.free-glm-kimi-api/zai2 npm run auth:browser -- ./auth.json');
    console.log('Waiting for a token (existing will be updated if same, new will be added)...');
  }
  const started = Date.now();
  let warnedGuest = false;
  let foundExistingAndWaited = false;
  while (Date.now() - started < timeoutMs) {
    const localToken = await readToken(page);
    const candidates = [localToken, networkToken].filter(Boolean);
    const usable = candidates.map(token => ({ token, state: isUsableZaiAuthToken(token, { allowGuest: allowGuestAuth }) })).find(item => item.state.ok);
    const guestSeen = candidates.some(token => isUsableZaiAuthToken(token, { allowGuest: false }).reason === 'guest_token');
    if (guestSeen && !warnedGuest) {
      warnedGuest = true;
      console.log('Found only a temporary guest Z.ai token; keeping browser open until you log in with a real account.');
    }
    if (usable) {
      const isAlreadySaved = existingTokens.has(usable.token) || existingIds.has(decodeJwt(usable.token).email) || existingIds.has(decodeJwt(usable.token).id);
      // if it's already saved and we haven't waited for a new one, give user 15s to switch account
      if (isAlreadySaved && !foundExistingAndWaited && existingForCheck.length>0) {
        if (!foundExistingAndWaited) {
          console.log(`Found existing account ${decodeJwt(usable.token).email || 'unknown'} already in ${outPath}. Waiting 15s for you to switch to a DIFFERENT account (log out / use another Google) if you want to ADD new...`);
          foundExistingAndWaited = true;
          await new Promise(r => setTimeout(r, 15000));
          continue; // check again for a different token
        }
      }
      const cookies = await cookieHeader(page).catch(() => '');
      saveAccount(usable.token, cookies);
      await browser.close();
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  await browser.close();
  console.error(JSON.stringify({ ok: false, error: 'Timed out waiting for Z.ai token. Keep profile dir and retry auth:browser after login.' }, null, 2));
  process.exit(2);
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
