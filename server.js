/**
 * ============================================================================
 * STOCK SHORT & EXCESS RETURN BALANCING SYSTEM (v2.0 PRO)
 * Render 24/7 Ready + /health Cronjob API + Multi-Layer State Persistence
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const http = require('http');
const multer = require('multer');
const xlsx = require('xlsx');

let google = null;
try {
  google = require('googleapis').google;
} catch (e) {
  // googleapis is optional; falls back to local + browser auto-sync
}

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_START_TIME = Date.now();

// Persistence paths (supports Render Persistent Disk if DATA_DIR is set)
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SEED_DB_FILE = path.join(__dirname, 'database.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Optional Google Sheet ID for automatic Cloud State Backup across Render restarts
const GOOGLE_SHEET_ID = (process.env.GOOGLE_SHEET_ID || '1dhezenCZ_rpejBX50DAvlXbHEjV9o9hxOGHR8U-Id9Y').trim();
const CLOUD_STATE_TAB = '_App_State';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: UPLOAD_DIR });

// ============================================================================
// IN-MEMORY + ATOMIC DISK + CLOUD BACKUP STATE ENGINE
// ============================================================================
let dbState = null;
let googleSheetsClient = null;
let cloudSyncStatus = { enabled: false, lastSynced: null, error: null };

function loadInitialDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (raw && Array.isArray(raw.products)) {
        return {
          rev: Number(raw.rev) || 1,
          lastModified: raw.lastModified || new Date().toISOString(),
          priceMode: raw.priceMode || 'TOTAL',
          products: raw.products,
          history: Array.isArray(raw.history) ? raw.history : []
        };
      }
    }
    if (fs.existsSync(SEED_DB_FILE) && SEED_DB_FILE !== DB_FILE) {
      const seed = JSON.parse(fs.readFileSync(SEED_DB_FILE, 'utf8'));
      return {
        rev: Number(seed.rev) || 1,
        lastModified: seed.lastModified || new Date().toISOString(),
        priceMode: seed.priceMode || 'TOTAL',
        products: Array.isArray(seed.products) ? seed.products : [],
        history: Array.isArray(seed.history) ? seed.history : []
      };
    }
  } catch (err) {
    console.error('Error reading DB_FILE:', err.message);
  }
  return { rev: 1, lastModified: new Date().toISOString(), priceMode: 'TOTAL', products: [], history: [] };
}

dbState = loadInitialDbFromDisk();

function saveDbToDisk(bumpRev = true) {
  if (bumpRev) {
    dbState.rev = (Number(dbState.rev) || 1) + 1;
    dbState.lastModified = new Date().toISOString();
  }
  try {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(dbState, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database.json:', err.message);
  }
  scheduleCloudBackup();
}

// Optional Google Sheets Cloud Persistence (prevents data loss on Render restart)
async function initGoogleSheets() {
  if (!google) return false;
  try {
    const rawEnv = process.env.GOOGLE_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let credentials = null;
    if (rawEnv) {
      const trimmed = rawEnv.trim();
      credentials = trimmed.startsWith('{')
        ? JSON.parse(trimmed)
        : JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    } else if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
      credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.json'), 'utf8'));
    }
    if (!credentials) return false;
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    googleSheetsClient = google.sheets({ version: 'v4', auth });
    cloudSyncStatus.enabled = true;
    await restoreFromCloudIfNewer();
    return true;
  } catch (err) {
    cloudSyncStatus.error = err.message;
    return false;
  }
}

async function restoreFromCloudIfNewer() {
  if (!googleSheetsClient || !GOOGLE_SHEET_ID) return;
  try {
    const res = await googleSheetsClient.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${CLOUD_STATE_TAB}!A1:B2`
    });
    const rows = (res.data && res.data.values) || [];
    if (rows.length > 0 && rows[0][0] === 'STATE_GZIP_B64' && rows[0][1]) {
      const jsonStr = zlib.gunzipSync(Buffer.from(rows[0][1], 'base64')).toString('utf8');
      const cloudData = JSON.parse(jsonStr);
      if (cloudData && (Number(cloudData.rev) || 0) > (Number(dbState.rev) || 0)) {
        mergeClientOrCloudState(cloudData);
        saveDbToDisk(false);
        console.log('Restored newer database state from Google Sheets cloud backup! Rev:', dbState.rev);
      }
    }
  } catch (e) {
    // Cloud tab may not exist yet
  }
}

let cloudBackupTimer = null;
function scheduleCloudBackup() {
  if (!googleSheetsClient || !GOOGLE_SHEET_ID) return;
  if (cloudBackupTimer) clearTimeout(cloudBackupTimer);
  cloudBackupTimer = setTimeout(async () => {
    try {
      // Save only modified products (short_qty > 0 or excess_qty > 0 or custom) + full history to keep payload tiny
      const compactState = {
        rev: dbState.rev,
        lastModified: dbState.lastModified,
        priceMode: dbState.priceMode,
        activeProducts: dbState.products.filter(p => (p.short_qty || 0) > 0 || (p.excess_qty || 0) > 0 || p.customUpdated),
        history: dbState.history
      };
      const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(compactState), 'utf8')).toString('base64');
      await googleSheetsClient.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${CLOUD_STATE_TAB}!A1:B1`,
        valueInputOption: 'RAW',
        requestBody: { values: [['STATE_GZIP_B64', compressed]] }
      });
      cloudSyncStatus.lastSynced = new Date().toISOString();
    } catch (e) {
      cloudSyncStatus.error = e.message;
    }
  }, 1500);
}

// Merge incoming state (from Browser Auto-Heal or Cloud Backup) into dbState
function mergeClientOrCloudState(incoming) {
  if (!incoming || typeof incoming !== 'object') return false;
  let changed = false;

  if (Array.isArray(incoming.products) && incoming.products.length > 0) {
    const map = new Map(dbState.products.map(p => [String(p.code).toUpperCase(), p]));
    incoming.products.forEach(ip => {
      if (!ip || !ip.code) return;
      const key = String(ip.code).trim().toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.name = ip.name || existing.name;
        existing.tp = Number(ip.tp) >= 0 ? Number(ip.tp) : existing.tp;
        existing.vat = Number(ip.vat) >= 0 ? Number(ip.vat) : existing.vat;
        existing.price = Number(ip.price) > 0 ? Number(ip.price) : existing.price;
        existing.short_qty = Math.max(0, parseInt(ip.short_qty, 10) || 0);
        existing.excess_qty = Math.max(0, parseInt(ip.excess_qty, 10) || 0);
        if (ip.customUpdated) existing.customUpdated = true;
      } else {
        const newProd = {
          code: String(ip.code).trim(),
          name: String(ip.name || '').trim(),
          tp: Number(ip.tp) || 0,
          vat: Number(ip.vat) || 0,
          price: Number(ip.price) || Number(ip.tp) || 0,
          short_qty: Math.max(0, parseInt(ip.short_qty, 10) || 0),
          excess_qty: Math.max(0, parseInt(ip.excess_qty, 10) || 0),
          customUpdated: true,
          updated_at: ip.updated_at || new Date().toISOString()
        };
        dbState.products.push(newProd);
        map.set(key, newProd);
      }
    });
    changed = true;
  } else if (Array.isArray(incoming.activeProducts)) {
    const map = new Map(dbState.products.map(p => [String(p.code).toUpperCase(), p]));
    // First reset short_qty and excess_qty before applying snapshot's activeProducts
    dbState.products.forEach(p => { p.short_qty = 0; p.excess_qty = 0; });
    incoming.activeProducts.forEach(ip => {
      if (!ip || !ip.code) return;
      const key = String(ip.code).trim().toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.name = ip.name || existing.name;
        if (Number(ip.tp) > 0) existing.tp = Number(ip.tp);
        if (Number(ip.vat) >= 0) existing.vat = Number(ip.vat);
        if (Number(ip.price) > 0) existing.price = Number(ip.price);
        existing.short_qty = Math.max(0, parseInt(ip.short_qty, 10) || 0);
        existing.excess_qty = Math.max(0, parseInt(ip.excess_qty, 10) || 0);
        existing.customUpdated = true;
      } else {
        const newProd = {
          code: String(ip.code).trim(),
          name: String(ip.name || '').trim(),
          tp: Number(ip.tp) || 0,
          vat: Number(ip.vat) || 0,
          price: Number(ip.price) || Number(ip.tp) || 0,
          short_qty: Math.max(0, parseInt(ip.short_qty, 10) || 0),
          excess_qty: Math.max(0, parseInt(ip.excess_qty, 10) || 0),
          customUpdated: true,
          updated_at: new Date().toISOString()
        };
        dbState.products.push(newProd);
        map.set(key, newProd);
      }
    });
    changed = true;
  }

  if (Array.isArray(incoming.history)) {
    const existingIds = new Set(dbState.history.map(h => h.id));
    incoming.history.forEach(h => {
      if (!h || !h.id) return;
      if (!existingIds.has(h.id)) {
        dbState.history.push(h);
        existingIds.add(h.id);
      } else {
        const idx = dbState.history.findIndex(x => x.id === h.id);
        if (idx >= 0) dbState.history[idx] = h;
      }
    });
    dbState.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    changed = true;
  }

  if (incoming.priceMode) dbState.priceMode = incoming.priceMode;
  if (Number(incoming.rev) > Number(dbState.rev)) {
    dbState.rev = Number(incoming.rev);
  }
  if (incoming.lastModified) {
    dbState.lastModified = incoming.lastModified;
  }
  return changed;
}

// ============================================================================
// 1. CRONJOB & HEALTH CHECK ENDPOINTS (/health, /api/health, /ping)
// ============================================================================
function healthHandler(req, res) {
  const shortItems = dbState.products.filter(p => (p.short_qty || 0) > 0).length;
  const excessItems = dbState.products.filter(p => (p.excess_qty || 0) > 0).length;
  res.status(200).json({
    status: 'ok',
    online: true,
    service: 'Stock Short & Excess Return Balancing System',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    dbRevision: dbState.rev,
    lastModified: dbState.lastModified,
    totalProducts: dbState.products.length,
    shortProductsCount: shortItems,
    excessProductsCount: excessItems,
    historyCount: dbState.history.length,
    cloudSync: cloudSyncStatus
  });
}

app.get('/health', healthHandler);
app.head('/health', (req, res) => res.status(200).end());
app.get('/api/health', healthHandler);
app.get('/ping', (req, res) => res.status(200).send('pong'));

// ============================================================================
// 2. STATE & AUTO-HEAL SYNC API (Fixes Render Server Restart Data Loss!)
// ============================================================================
app.get('/api/state', (req, res) => {
  res.json({
    rev: dbState.rev,
    lastModified: dbState.lastModified,
    priceMode: dbState.priceMode,
    products: dbState.products,
    history: dbState.history
  });
});

app.post('/api/sync-state', (req, res) => {
  const clientRev = Number(req.body.rev) || 0;
  const serverRev = Number(dbState.rev) || 1;
  const clientHistoryLen = Array.isArray(req.body.history) ? req.body.history.length : 0;
  const serverHistoryLen = dbState.history.length;

  // If Render server restarted and reset to rev 1 (or has fewer history records than the client browser),
  // automatically recover the client's saved work into the server database!
  if (clientRev > serverRev || (serverRev <= 1 && clientHistoryLen > serverHistoryLen)) {
    mergeClientOrCloudState(req.body);
    saveDbToDisk(false);
    return res.json({
      success: true,
      action: 'RESTORED_FROM_CLIENT',
      rev: dbState.rev,
      lastModified: dbState.lastModified,
      products: dbState.products,
      history: dbState.history
    });
  }

  res.json({
    success: true,
    action: 'SERVER_UP_TO_DATE',
    rev: dbState.rev,
    lastModified: dbState.lastModified,
    products: dbState.products,
    history: dbState.history
  });
});

// ============================================================================
// 3. PRODUCTS & HISTORY CRUD API
// ============================================================================
app.get('/api/products', (req, res) => {
  res.json(dbState.products || []);
});

app.get('/api/history', (req, res) => {
  res.json(dbState.history || []);
});

app.post('/api/products', (req, res) => {
  const { code, name, tp, vat, price, short_qty, excess_qty } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Product Code and Name are required.' });
  }

  const cleanCode = String(code).trim();
  const existingIndex = dbState.products.findIndex(
    p => String(p.code).toLowerCase() === cleanCode.toLowerCase()
  );

  const parsedTp = parseFloat(tp) || parseFloat(price) || 0;
  const parsedVat = parseFloat(vat) || 0;
  const parsedPrice = parseFloat(price) || Number((parsedTp + parsedVat).toFixed(2));

  const item = {
    code: cleanCode,
    name: String(name).trim(),
    tp: parsedTp,
    vat: parsedVat,
    price: parsedPrice,
    short_qty: Math.max(0, parseInt(short_qty, 10) || 0),
    excess_qty: Math.max(0, parseInt(excess_qty, 10) || 0),
    customUpdated: true,
    updated_at: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    dbState.products[existingIndex] = { ...dbState.products[existingIndex], ...item };
  } else {
    dbState.products.unshift(item);
  }

  saveDbToDisk(true);
  res.json({ success: true, product: item, rev: dbState.rev, lastModified: dbState.lastModified });
});

app.delete('/api/products/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toLowerCase();
  dbState.products = dbState.products.filter(p => String(p.code).toLowerCase() !== code);
  saveDbToDisk(true);
  res.json({ success: true, rev: dbState.rev, lastModified: dbState.lastModified });
});

// ============================================================================
// 4. CONFIRM BALANCING ADJUSTMENT API (/api/adjust)
// ============================================================================
app.post('/api/adjust', (req, res) => {
  const { shortCode, shortName, shortQty, targetValue, returnItems, note, priceMode } = req.body;

  if (!shortCode || !Array.isArray(returnItems) || returnItems.length === 0) {
    return res.status(400).json({ error: 'অনুগ্রহ করে শর্ট প্রোডাক্ট এবং কমপক্ষে ১টি এক্সেস প্রোডাক্ট সিলেক্ট করুন।' });
  }

  const cleanShortCode = String(shortCode).trim();
  let shortProduct = dbState.products.find(
    p => String(p.code).toLowerCase() === cleanShortCode.toLowerCase()
  );

  const sQty = Math.max(1, parseInt(shortQty, 10) || 1);
  const useTpOnly = (priceMode || dbState.priceMode) === 'TP';
  const getUnitPrice = (prod) => {
    if (!prod) return 0;
    if (useTpOnly && prod.tp > 0) return Number(prod.tp);
    return Number(prod.price || prod.tp || 0);
  };

  if (!shortProduct) {
    const unitP = Number(targetValue) > 0 ? Number((Number(targetValue) / sQty).toFixed(2)) : 0;
    shortProduct = {
      code: cleanShortCode,
      name: shortName || cleanShortCode,
      tp: unitP,
      vat: 0,
      price: unitP,
      short_qty: sQty,
      excess_qty: 0,
      customUpdated: true,
      updated_at: new Date().toISOString()
    };
    dbState.products.unshift(shortProduct);
  }

  const priorShortQty = Number(shortProduct.short_qty) || 0;
  const unitShortPrice = getUnitPrice(shortProduct);
  const computedShortVal = Number(targetValue) > 0
    ? Number(Number(targetValue).toFixed(2))
    : Number((unitShortPrice * sQty).toFixed(2));

  let totalReturnValue = 0;
  const adjustedExcessList = [];

  for (const item of returnItems) {
    const rCode = String(item.code || '').trim();
    const rQty = Math.max(1, parseInt(item.qty, 10) || 1);
    let prod = dbState.products.find(p => String(p.code).toLowerCase() === rCode.toLowerCase());

    const itemUnitPrice = Number(item.unitPrice || item.price || item.tp) || getUnitPrice(prod) || 0;
    const priorExcessQty = prod ? (Number(prod.excess_qty) || 0) : 0;

    if (prod) {
      prod.excess_qty = Math.max(0, priorExcessQty - rQty);
      prod.customUpdated = true;
      prod.updated_at = new Date().toISOString();
    }

    const subtotal = Number((itemUnitPrice * rQty).toFixed(2));
    totalReturnValue += subtotal;

    adjustedExcessList.push({
      code: prod ? prod.code : rCode,
      name: prod ? prod.name : (item.name || rCode),
      qty: rQty,
      tp: itemUnitPrice,
      unitPrice: itemUnitPrice,
      subtotal,
      priorExcessQty,
      deductedExcessQty: prod ? (priorExcessQty - prod.excess_qty) : 0
    });
  }

  // Deduct short stock cleanly
  shortProduct.short_qty = Math.max(0, priorShortQty - sQty);
  shortProduct.customUpdated = true;
  shortProduct.updated_at = new Date().toISOString();

  totalReturnValue = Number(totalReturnValue.toFixed(2));
  const adjustmentId = 'ADJ-' + Date.now();
  const auditRecord = {
    id: adjustmentId,
    timestamp: new Date().toISOString(),
    shortProduct: {
      code: shortProduct.code,
      name: shortProduct.name,
      qty: sQty,
      tp: unitShortPrice,
      totalValue: computedShortVal,
      priorShortQty,
      deductedShortQty: priorShortQty - shortProduct.short_qty
    },
    returnedProducts: adjustedExcessList,
    totalShortValue: computedShortVal,
    totalReturnValue,
    difference: Number((totalReturnValue - computedShortVal).toFixed(2)),
    remainingTaka: Number((computedShortVal - totalReturnValue).toFixed(2)),
    note: String(note || '').trim(),
    status: 'CONFIRMED'
  };

  dbState.history.unshift(auditRecord);
  saveDbToDisk(true);

  res.json({
    success: true,
    message: 'স্টক ব্যালেন্স সফলভাবে কনফার্ম ও সেভ হয়েছে!',
    auditRecord,
    rev: dbState.rev,
    lastModified: dbState.lastModified
  });
});

// ============================================================================
// 5. CANCEL / UNDO ADJUSTMENT API (/api/history/cancel/:id)
// ============================================================================
app.post('/api/history/cancel/:id', (req, res) => {
  const { id } = req.params;
  const record = dbState.history.find(h => h.id === id);

  if (!record) {
    return res.status(404).json({ error: 'অ্যাডজাস্টমেন্ট রেকর্ড পাওয়া যায়নি।' });
  }
  if (record.status === 'CANCELLED') {
    return res.status(400).json({ error: 'এই অ্যাডজাস্টমেন্ট আগেই ক্যান্সেল করা হয়েছে।' });
  }

  const shortProd = dbState.products.find(
    p => String(p.code).toLowerCase() === String(record.shortProduct.code).toLowerCase()
  );
  if (shortProd) {
    const restoreShort = typeof record.shortProduct.deductedShortQty === 'number'
      ? record.shortProduct.deductedShortQty
      : (record.shortProduct.qty || 0);
    shortProd.short_qty = (Number(shortProd.short_qty) || 0) + restoreShort;
    shortProd.customUpdated = true;
    shortProd.updated_at = new Date().toISOString();
  }

  for (const ret of (record.returnedProducts || [])) {
    const excessProd = dbState.products.find(
      p => String(p.code).toLowerCase() === String(ret.code).toLowerCase()
    );
    if (excessProd) {
      const restoreExcess = typeof ret.deductedExcessQty === 'number'
        ? ret.deductedExcessQty
        : (ret.qty || 0);
      excessProd.excess_qty = (Number(excessProd.excess_qty) || 0) + restoreExcess;
      excessProd.customUpdated = true;
      excessProd.updated_at = new Date().toISOString();
    }
  }

  record.status = 'CANCELLED';
  record.cancelled_at = new Date().toISOString();

  saveDbToDisk(true);
  res.json({
    success: true,
    message: 'অ্যাডজাস্টমেন্ট ক্যান্সেল করা হয়েছে এবং স্টক আগের অবস্থায় ফিরিয়ে নেয়া হয়েছে।',
    rev: dbState.rev,
    lastModified: dbState.lastModified
  });
});

// ============================================================================
// 6. EXCEL UPLOAD API (/api/upload-excel) — NO RESTORE OPTIONS
// ============================================================================
app.post('/api/upload-excel', upload.single('excelFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'কোনো Excel ফাইল সিলেক্ট করা হয়নি।' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    let updatedCount = 0;
    let addedCount = 0;

    workbook.SheetNames.forEach(sheetName => {
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      sheetData.forEach(row => {
        // Flexible column matching
        const normRow = {};
        Object.keys(row).forEach(k => {
          normRow[String(k).trim().toLowerCase().replace(/\s+/g, ' ')] = row[k];
        });

        const rawCode = String(
          normRow['code'] || normRow['p.code'] || normRow['product code'] || normRow['item code'] || ''
        ).trim();
        const name = String(
          normRow['product name'] || normRow['name'] || normRow['item name'] || ''
        ).trim();

        if (!rawCode && !name) return;
        if (name.toUpperCase().includes('PAGE -') || name.toUpperCase() === 'VACANT') return;

        const code = rawCode.replace(/^0+(?=\d)/, '') || rawCode || ('ITEM-' + Date.now());
        const tpVal = parseFloat(normRow['tp'] || normRow['trade price'] || normRow['price'] || 0);
        const vatVal = parseFloat(normRow['vat'] || 0);
        const shortVal = parseInt(normRow['short'] || normRow['short qty'] || normRow['short_qty'] || 0, 10);
        const excessVal = parseInt(normRow['excess'] || normRow['excess qty'] || normRow['excess_qty'] || 0, 10);

        const idx = dbState.products.findIndex(
          p => (code && String(p.code).toLowerCase() === code.toLowerCase()) ||
               (name && String(p.name).toLowerCase() === name.toLowerCase())
        );

        if (idx >= 0) {
          const ex = dbState.products[idx];
          if (name) ex.name = name;
          if (!isNaN(tpVal) && tpVal > 0) {
            ex.tp = tpVal;
            ex.vat = !isNaN(vatVal) ? vatVal : (ex.vat || 0);
            ex.price = Number((ex.tp + ex.vat).toFixed(2));
          }
          if (!isNaN(shortVal) && (normRow['short'] !== '' || normRow['short qty'] !== '' || normRow['short_qty'] !== '')) {
            ex.short_qty = Math.max(0, shortVal);
          }
          if (!isNaN(excessVal) && (normRow['excess'] !== '' || normRow['excess qty'] !== '' || normRow['excess_qty'] !== '')) {
            ex.excess_qty = Math.max(0, excessVal);
          }
          ex.customUpdated = true;
          ex.updated_at = new Date().toISOString();
          updatedCount++;
        } else if (name) {
          const tp = !isNaN(tpVal) && tpVal > 0 ? tpVal : 0;
          const vat = !isNaN(vatVal) && vatVal > 0 ? vatVal : 0;
          dbState.products.push({
            code,
            name,
            tp,
            vat,
            price: Number((tp + vat).toFixed(2)),
            short_qty: !isNaN(shortVal) ? Math.max(0, shortVal) : 0,
            excess_qty: !isNaN(excessVal) ? Math.max(0, excessVal) : 0,
            customUpdated: true,
            updated_at: new Date().toISOString()
          });
          addedCount++;
        }
      });
    });

    saveDbToDisk(true);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Excel সফলভাবে আপলোড হয়েছে! (${updatedCount}টি আপডেট, ${addedCount}টি নতুন প্রোডাক্ট যোগ হয়েছে)`,
      updatedCount,
      addedCount,
      rev: dbState.rev,
      lastModified: dbState.lastModified
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Excel প্রসেস করতে সমস্যা হয়েছে: ' + err.message });
  }
});

// Automatic Self-Ping Keep-Alive when RENDER_EXTERNAL_URL is set
const RENDER_EXTERNAL_URL = (process.env.RENDER_EXTERNAL_URL || '').trim();
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    try {
      const targetUrl = RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/health';
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, (res) => { res.resume(); }).on('error', () => {});
    } catch (e) {}
  }, 10 * 60 * 1000); // Every 10 minutes
}

initGoogleSheets().finally(() => {
  app.listen(PORT, () => {
    console.log(`Stock Short & Excess Balancing Server v2.0 running on port ${PORT}`);
    console.log(`Health check endpoint ready at: http://localhost:${PORT}/health`);
  });
});
