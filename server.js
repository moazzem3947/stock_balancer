const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.DB_PATH || path.join(DATA_DIR, 'db.json');
const DEFAULT_SEED_FILE = path.join(DATA_DIR, 'default_seed.json');

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function round2(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      if (fs.existsSync(DEFAULT_SEED_FILE)) {
        fs.copyFileSync(DEFAULT_SEED_FILE, DB_FILE);
      } else {
        const empty = { meta: { lastUpdated: new Date().toISOString() }, products: [], priceCatalog: [], history: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf8');
      }
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { meta: { lastUpdated: new Date().toISOString() }, products: [], priceCatalog: [], history: [] };
  }
}

function writeDb(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    data.meta = data.meta || {};
    data.meta.lastUpdated = new Date().toISOString();
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing db.json:', err);
    return false;
  }
}

// 1. CRONJOB KEEP-ALIVE & HEALTH CHECK API (/health and /api/health)
app.get(['/health', '/api/health'], (req, res) => {
  const db = readDb();
  const products = db.products || [];
  const totalShortTaka = round2(products.reduce((s, p) => s + round2((Number(p.short) || 0) * (Number(p.price) || 0)), 0));
  const totalExcessTaka = round2(products.reduce((s, p) => s + round2((Number(p.excess) || 0) * (Number(p.price) || 0)), 0));
  res.status(200).json({
    status: 'ok',
    service: 'STOCK ALTER PRO - JSON DB SERVER',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    totalProducts: products.length,
    totalShortTaka,
    totalExcessTaka,
    historyCount: (db.history || []).length
  });
});

// 2. GET FULL DATABASE STATE
app.get('/api/data', (req, res) => {
  const db = readDb();
  res.json({
    meta: db.meta || {},
    products: db.products || [],
    history: db.history || []
  });
});

// 3. ATOMIC SYNC & BACKUP RESTORE ENDPOINT
app.post('/api/sync-backup', (req, res) => {
  const { products, history } = req.body || {};
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Invalid products array' });
  }
  const db = readDb();
  db.products = products.map((p, idx) => {
    const price = round2(p.price);
    const shortQty = Math.max(0, Math.round(Number(p.short) || 0));
    const excessQty = Math.max(0, Math.round(Number(p.excess) || 0));
    return {
      ...p,
      id: p.id || `prod_${idx + 1}`,
      price,
      short: shortQty,
      excess: excessQty,
      shortAmount: round2(shortQty * price),
      excessAmount: round2(excessQty * price)
    };
  });
  if (Array.isArray(history)) {
    db.history = history;
  }
  writeDb(db);
  res.json({ status: 'synced', count: db.products.length, historyCount: (db.history || []).length });
});

// 4. 1-CLICK REMOVE ALL PRODUCTS FROM DB
app.delete('/api/products', (req, res) => {
  const db = readDb();
  db.products = [];
  db.history = db.history || [];
  db.history.unshift({
    id: 'log_' + Date.now(),
    type: 'LOG',
    badge: '🗑️ DB CLEARED',
    summary: '১-ক্লিকে ডাটাবেসের সব প্রোডাক্ট রিমুভ করা হয়েছে।',
    timestampDisplay: new Date().toLocaleString('bn-BD')
  });
  writeDb(db);
  res.json({ status: 'cleared', products: [] });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ STOCK ALTER PRO running on http://localhost:${PORT}`);
  console.log(`💓 Cronjob Health Endpoint ready at http://localhost:${PORT}/health`);
});
