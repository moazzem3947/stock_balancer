const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initial fallback seed data (71 items from Excel)
const INITIAL_PRODUCTS = [{"code": "N53", "name": "ALGIN 50MG TABS 10X10'S", "sysStock": 8697, "phyStock": 8694, "short": 2, "excess": 0, "price": 747.85}, {"code": "229", "name": "ALGIN 5MG INJ 2ML 1X5'S", "sysStock": 4456, "phyStock": 4460, "short": 0, "excess": 0, "price": 154.03}, {"code": "N64", "name": "ARBECIN 1ML IV INJ 1X1'S", "sysStock": 1875, "phyStock": 1885, "short": 0, "excess": 4, "price": 132.0}, {"code": "983", "name": "BISOREN 2.5MG TAB 3X10'S", "sysStock": 4419, "phyStock": 4420, "short": 0, "excess": 0, "price": 184.91}, {"code": "875", "name": "BREDICON TAB 28'S", "sysStock": 3644, "phyStock": 3649, "short": 0, "excess": 0, "price": 52.08}, {"code": "934", "name": "CALCIN-D TAB 6X10'S", "sysStock": 371, "phyStock": 373, "short": 0, "excess": 0, "price": 422.64}, {"code": "S63", "name": "CILMA 10MG TAB 3X10'S", "sysStock": 182, "phyStock": 184, "short": 0, "excess": 0, "price": 237.74}, {"code": "S65", "name": "CILMA 5MG TAB 3X10'S", "sysStock": 119, "phyStock": 117, "short": 0, "excess": 0, "price": 184.91}, {"code": "N4M", "name": "CORALCIN-DX FC TAB 5X8'S", "sysStock": 589, "phyStock": 588, "short": 0, "excess": 0, "price": 527.84}, {"code": "612", "name": "DANZOL 100MG CAPS. 3X10'S", "sysStock": 163, "phyStock": 161, "short": 2, "excess": 0, "price": 527.96}, {"code": "613", "name": "DANZOL 200MG CAPS. 2X10'S", "sysStock": 25, "phyStock": 27, "short": 0, "excess": 2, "price": 668.95}, {"code": "073", "name": "DELENTIN SUSPENSION 10ML 1'S", "sysStock": 5531, "phyStock": 5535, "short": 0, "excess": 0, "price": 14.12}, {"code": "990", "name": "DOMIREN SUSPENSION 100ML 1X1'S", "sysStock": 5434, "phyStock": 5436, "short": 0, "excess": 0, "price": 33.45}, {"code": "S18", "name": "EAZY JELLY 50GM TUBE 1'S", "sysStock": 682, "phyStock": 681, "short": 0, "excess": 0, "price": 154.01}, {"code": "185", "name": "FENADIN FC 180MG TAB 2X10'S", "sysStock": 11588, "phyStock": 11590, "short": 0, "excess": 0, "price": 176.1}, {"code": "188", "name": "FENADIN FC 60MG TAB 3X10'S", "sysStock": 3859, "phyStock": 3857, "short": 0, "excess": 0, "price": 105.66}, {"code": "C25", "name": "FERIX-V CAP 6X10'S", "sysStock": 1154, "phyStock": 1155, "short": 0, "excess": 0, "price": 237.39}, {"code": "607", "name": "FLUSTAR 500MG CAP 7X4'S", "sysStock": 18, "phyStock": 3, "short": 15, "excess": 0, "price": 246.54}, {"code": "S72", "name": "FUROCEF DS SUSPENSION 50ML 1X1'S", "sysStock": 740, "phyStock": 765, "short": 0, "excess": 25, "price": 220.02}, {"code": "102", "name": "FUROCEF FC SUSPENSION 70ML 1X1'S", "sysStock": 3432, "phyStock": 3407, "short": 25, "excess": 0, "price": 198.02}, {"code": "N77", "name": "FUROCLAV 250MG TAB 2X7'S", "sysStock": 1699, "phyStock": 1702, "short": 0, "excess": 3, "price": 431.27}, {"code": "N78", "name": "FUROCLAV 500MG TAB 2X7'S", "sysStock": 2843, "phyStock": 2842, "short": 1, "excess": 0, "price": 739.28}, {"code": "CY7", "name": "HYDROGEST DS 2ML (500MG/2ML) INJ 1X1'S", "sysStock": 1085, "phyStock": 1084, "short": 1, "excess": 0, "price": 572.04}, {"code": "N8V", "name": "LETROL 2.5MG TAB 3X5'S", "sysStock": 2616, "phyStock": 2617, "short": 0, "excess": 0, "price": 543.0}, {"code": "112", "name": "LUCAN-R SUSP. 35ML", "sysStock": 3561, "phyStock": 3563, "short": 0, "excess": 0, "price": 68.91}, {"code": "C81", "name": "MAXPRO 20MG CAP 10X14'S", "sysStock": 8031, "phyStock": 8032, "short": 0, "excess": 0, "price": 862.89}, {"code": "C39", "name": "MAXPRO EC 40MG TAB 6X10'S", "sysStock": 2462, "phyStock": 2463, "short": 0, "excess": 0, "price": 475.47}, {"code": "C8Y", "name": "MAXPRO MUPS 20MG TAB 5X14'S", "sysStock": 5783, "phyStock": 5782, "short": 1, "excess": 0, "price": 616.35}, {"code": "251", "name": "MEROPEN IV 1GM INJ", "sysStock": 2577, "phyStock": 2575, "short": 2, "excess": 0, "price": 1144.07}, {"code": "275", "name": "MEROPEN IV 500MG INJ", "sysStock": 4170, "phyStock": 4172, "short": 0, "excess": 2, "price": 616.05}, {"code": "N2J", "name": "MYOSIT PLUS FC TAB 5X6'S", "sysStock": 845, "phyStock": 844, "short": 0, "excess": 0, "price": 1293.1}, {"code": "S74", "name": "NOVELON LITE FC TAB 1X28'S", "sysStock": 2383, "phyStock": 2382, "short": 0, "excess": 0, "price": 366.38}, {"code": "S73", "name": "NOVELON-28 FC TAB 1X28'S", "sysStock": 372, "phyStock": 373, "short": 0, "excess": 0, "price": 343.98}, {"code": "911", "name": "ORCEF 200MG CAP 2X8'S", "sysStock": 2960, "phyStock": 2950, "short": 10, "excess": 0, "price": 492.9}, {"code": "298", "name": "ORCEF 200MG TAB 2X6'S", "sysStock": 558, "phyStock": 568, "short": 0, "excess": 10, "price": 369.67}, {"code": "221", "name": "ORCEF DPS 50ML", "sysStock": 4352, "phyStock": 4349, "short": 0, "excess": 0, "price": 184.82}, {"code": "C2X", "name": "PROLIFIC 5000 IU INJ 1X1'S", "sysStock": 527, "phyStock": 526, "short": 0, "excess": 0, "price": 1939.5}, {"code": "926", "name": "RENXIT FC TAB 10X10'S", "sysStock": 5793, "phyStock": 5792, "short": 0, "excess": 0, "price": 440.25}, {"code": "C2N", "name": "REPHASTON 10MG TAB 3X10'S", "sysStock": 3106, "phyStock": 3105, "short": 0, "excess": 0, "price": 924.14}, {"code": "S56", "name": "ROLAC 30MG INJ 1ML 1'S", "sysStock": 6838, "phyStock": 6899, "short": 0, "excess": 61, "price": 48.59}, {"code": "S57", "name": "ROLAC 60MG INJ 2ML 1'S", "sysStock": 4704, "phyStock": 4644, "short": 60, "excess": 0, "price": 83.92}, {"code": "N8B", "name": "ROLIP EZ 10/10MG TAB 3X10'S", "sysStock": 334, "phyStock": 336, "short": 0, "excess": 0, "price": 686.45}, {"code": "CP6", "name": "SALBUREN HFA 100MCG MDI(200PUFF) 1'S", "sysStock": 324, "phyStock": 323, "short": 0, "excess": 0, "price": 220.02}, {"code": "CQ5", "name": "SALBUREN HFA 100MCG REFILL(200PUFF) 1'S", "sysStock": 166, "phyStock": 167, "short": 0, "excess": 0, "price": 193.62}, {"code": "170", "name": "SERONEX 25MG TAB 5X10'S", "sysStock": 11, "phyStock": 10, "short": 0, "excess": 0, "price": 132.08}, {"code": "N5D", "name": "SUBAZOL 65MG CAP 5X6'S", "sysStock": 1134, "phyStock": 1133, "short": 0, "excess": 0, "price": 527.96}, {"code": "C8G", "name": "SUPADOPA TR 195MG CAP 3X6'S", "sysStock": 28, "phyStock": 30, "short": 0, "excess": 0, "price": 792.04}, {"code": "C1W", "name": "TAVEN EZ 10/10MG TAB 2X10'S", "sysStock": 51, "phyStock": 49, "short": 0, "excess": 0, "price": 246.31}, {"code": "N9C", "name": "TELPRO FC 80MG TAB 3X10'S", "sysStock": 172, "phyStock": 173, "short": 0, "excess": 0, "price": 527.96}, {"code": "C9Q", "name": "TELPRO FC 80MG TAB 3X6'S", "sysStock": 80, "phyStock": 79, "short": 0, "excess": 0, "price": 316.77}, {"code": "N1F", "name": "TELPRO MAX FC 40MG TAB 3X10'S", "sysStock": 319, "phyStock": 318, "short": 0, "excess": 0, "price": 330.02}, {"code": "N8Q", "name": "THYROX 100MCG TAB 3X30'S", "sysStock": 1241, "phyStock": 1242, "short": 0, "excess": 0, "price": 245.25}, {"code": "N5A", "name": "THYROX 25MCG TAB 3X30'S", "sysStock": 4249, "phyStock": 4248, "short": 0, "excess": 0, "price": 87.66}, {"code": "955", "name": "THYROX 50MCG 3X30'S", "sysStock": 15000, "phyStock": 14998, "short": 0, "excess": 1, "price": 174.29}, {"code": "C4P", "name": "ULFIX 200ML (1G/5ML) SUSP 1X1'S", "sysStock": 663, "phyStock": 664, "short": 0, "excess": 0, "price": 352.02}, {"code": "CS5", "name": "VILTICA RENACAP 25/200MCG DPI CAP 3X10'S", "sysStock": 58, "phyStock": 59, "short": 0, "excess": 0, "price": 792.05}, {"code": "N61", "name": "ZITHRIN 250MG TAB 3X5'S", "sysStock": 19, "phyStock": 18, "short": 0, "excess": 0, "price": 330.02}, {"code": "N27", "name": "ZITHRIN FC 500MG TAB 3X5'S", "sysStock": 2958, "phyStock": 2959, "short": 0, "excess": 1, "price": 528.11}, {"code": "RG1", "name": "ANDRO-REN 10G PWDR", "sysStock": 4364, "phyStock": 4363, "short": 0, "excess": 0, "price": 40.0}, {"code": "538", "name": "CATOPHOS INJ 30ML", "sysStock": 1250, "phyStock": 1249, "short": 0, "excess": 0, "price": 132.51}, {"code": "550", "name": "DOXIVET POWDER 100GM SACHET", "sysStock": 4326, "phyStock": 4325, "short": 0, "excess": 0, "price": 176.02}, {"code": "R08", "name": "FEVENIL INJ 10ML 1'S", "sysStock": 1153, "phyStock": 1155, "short": 0, "excess": 0, "price": 89.76}, {"code": "RO2", "name": "HEPAREN 500ML SLUSN 1X1'S", "sysStock": 817, "phyStock": 813, "short": 2, "excess": 0, "price": 450.0}, {"code": "555", "name": "MICRONID POWDER 10GM SACHET", "sysStock": 16650, "phyStock": 16662, "short": 0, "excess": 0, "price": 35.83}, {"code": "R30", "name": "MYCO-OUT POWDER 100GM SACHET", "sysStock": 510, "phyStock": 505, "short": 0, "excess": 0, "price": 321.22}, {"code": "RP7", "name": "RE-CHARGE 500ML SLUSN 1X1'S", "sysStock": 354, "phyStock": 358, "short": 0, "excess": 2, "price": 400.0}, {"code": "759", "name": "RENA CAL-P 1LITER", "sysStock": 502, "phyStock": 516, "short": 0, "excess": 0, "price": 300.0}, {"code": "L02", "name": "RENA CAL-P 5LITER", "sysStock": 264, "phyStock": 266, "short": 0, "excess": 0, "price": 1350.0}, {"code": "782", "name": "RENAVIT DB PLUS 1KG", "sysStock": 599, "phyStock": 607, "short": 0, "excess": 0, "price": 336.0}, {"code": "814", "name": "RENAVIT-DB 1000GM (CUSTOM)", "sysStock": 39, "phyStock": 31, "short": 0, "excess": 0, "price": 240.0}, {"code": "L25", "name": "RUMEN-E 100GM", "sysStock": 4052, "phyStock": 4055, "short": 0, "excess": 0, "price": 100.0}];

function formatDateBanglaStyle(dateObj = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = months[dateObj.getMonth()];
  const y = dateObj.getFullYear();
  let hr = dateObj.getHours();
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return `${d}-${m}-${y} ${String(hr).padStart(2, '0')}:${min} ${ampm}`;
}

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initData = {
        products: INITIAL_PRODUCTS,
        history: [],
        lastUpdated: formatDateBanglaStyle()
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2), 'utf8');
      return initData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.products || !Array.isArray(parsed.products)) {
      parsed.products = INITIAL_PRODUCTS;
    }
    if (!parsed.history || !Array.isArray(parsed.history)) {
      parsed.history = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { products: INITIAL_PRODUCTS, history: [], lastUpdated: formatDateBanglaStyle() };
  }
}

function writeDB(data) {
  data.lastUpdated = formatDateBanglaStyle();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Get full database state
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json(db);
});

// Confirm a Return Adjustment (Short & Excess Balancing)
app.post('/api/adjust', (req, res) => {
  try {
    const { shortCode, shortQty, excessItems, note } = req.body;
    const db = readDB();

    const shortProd = db.products.find(p => p.code.toLowerCase() === String(shortCode).toLowerCase());
    if (!shortProd) {
      return res.status(404).json({ error: 'Short product-ti database-e pawa jayni!' });
    }
    const sQty = parseInt(shortQty, 10) || 0;
    if (sQty <= 0 || sQty > shortProd.short) {
      return res.status(400).json({ error: `Invalid Short Qty! Current short ache ${shortProd.short} pcs.` });
    }
    if (!Array.isArray(excessItems) || excessItems.length === 0) {
      return res.status(400).json({ error: 'Kono Excess product select kora hoyni!' });
    }

    // Validate all excess items first
    const validatedExcess = [];
    for (const item of excessItems) {
      const exProd = db.products.find(p => p.code.toLowerCase() === String(item.code).toLowerCase());
      const eQty = parseInt(item.qty, 10) || 0;
      if (!exProd) {
        return res.status(404).json({ error: `Excess product (${item.code}) pawa jayni!` });
      }
      if (eQty <= 0 || eQty > exProd.excess) {
        return res.status(400).json({ error: `${exProd.name}-er excess ache ${exProd.excess} pcs, kintu dewa hoyeche ${eQty} pcs.` });
      }
      validatedExcess.push({ prod: exProd, qty: eQty });
    }

    // Apply adjustments
    shortProd.short -= sQty;
    shortProd.phyStock += sQty;

    const historyExcessDetails = [];
    let totalExcessValue = 0;

    for (const v of validatedExcess) {
      v.prod.excess -= v.qty;
      v.prod.phyStock -= v.qty;
      const lineVal = Number((v.qty * v.prod.price).toFixed(2));
      totalExcessValue += lineVal;
      historyExcessDetails.push({
        code: v.prod.code,
        name: v.prod.name,
        qty: v.qty,
        price: v.prod.price,
        amount: lineVal
      });
    }

    const shortValue = Number((sQty * shortProd.price).toFixed(2));
    totalExcessValue = Number(totalExcessValue.toFixed(2));

    const record = {
      id: 'ADJ-' + Date.now(),
      timestamp: formatDateBanglaStyle(),
      status: 'CONFIRMED',
      shortItem: {
        code: shortProd.code,
        name: shortProd.name,
        qty: sQty,
        price: shortProd.price,
        amount: shortValue
      },
      excessItems: historyExcessDetails,
      totalShortVal: shortValue,
      totalExcessVal: totalExcessValue,
      diffVal: Number((totalExcessValue - shortValue).toFixed(2)),
      note: note || '',
      message: `Apnr stock a ${shortProd.name} (${shortProd.code}) - ${sQty} Pcs (৳${shortValue.toFixed(2)}) short chilo apni prodct ta boje peyechen jar binimoy a ${historyExcessDetails.map(x => `${x.name} [${x.qty} Pcs = ৳${x.amount.toFixed(2)}]`).join(' + ')} retrent dekhaite cacchen.`
    };

    db.history.unshift(record);
    writeDB(db);

    res.json({ ok: true, record, db });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Adjustment save korte somossa hoyeche.' });
  }
});

// Cancel / Undo an Adjustment from History
app.post('/api/cancel-adjust', (req, res) => {
  try {
    const { id } = req.body;
    const db = readDB();
    const record = db.history.find(h => h.id === id);

    if (!record) {
      return res.status(404).json({ error: 'History record pawa jayni!' });
    }
    if (record.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Ei adjustment-ti agei cancel kora hoyeche!' });
    }

    // Restore Short product
    const shortProd = db.products.find(p => p.code.toLowerCase() === record.shortItem.code.toLowerCase());
    if (shortProd) {
      shortProd.short += record.shortItem.qty;
      shortProd.phyStock = Math.max(0, shortProd.phyStock - record.shortItem.qty);
    }

    // Restore Excess products
    for (const ex of record.excessItems) {
      const exProd = db.products.find(p => p.code.toLowerCase() === ex.code.toLowerCase());
      if (exProd) {
        exProd.excess += ex.qty;
        exProd.phyStock += ex.qty;
      }
    }

    record.status = 'CANCELLED';
    record.cancelledAt = formatDateBanglaStyle();
    writeDB(db);

    res.json({ ok: true, record, db });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cancel korte somossa hoyeche.' });
  }
});

// Add or Update Single Product (Edit Price, Short, Excess, Name, Code)
app.post('/api/product/save', (req, res) => {
  try {
    const { originalCode, code, name, sysStock, phyStock, short, excess, price } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Product Code ebong Name obosshoi dite hobe!' });
    }
    const db = readDB();
    const cleanCode = String(code).trim();
    const cleanName = String(name).trim();
    const itemObj = {
      code: cleanCode,
      name: cleanName,
      sysStock: parseInt(sysStock, 10) || 0,
      phyStock: parseInt(phyStock, 10) || 0,
      short: Math.max(0, parseInt(short, 10) || 0),
      excess: Math.max(0, parseInt(excess, 10) || 0),
      price: Math.max(0, Number(parseFloat(price || 0).toFixed(2)))
    };

    if (originalCode) {
      const idx = db.products.findIndex(p => p.code.toLowerCase() === String(originalCode).toLowerCase());
      if (idx !== -1) {
        db.products[idx] = itemObj;
      } else {
        db.products.push(itemObj);
      }
    } else {
      const existingIdx = db.products.findIndex(p => p.code.toLowerCase() === cleanCode.toLowerCase());
      if (existingIdx !== -1) {
        db.products[existingIdx] = itemObj;
      } else {
        db.products.unshift(itemObj);
      }
    }

    writeDB(db);
    res.json({ ok: true, db });
  } catch (err) {
    res.status(500).json({ error: 'Product save korte somossa hoyeche.' });
  }
});

// Delete a Product
app.post('/api/product/delete', (req, res) => {
  try {
    const { code } = req.body;
    const db = readDB();
    db.products = db.products.filter(p => p.code.toLowerCase() !== String(code).toLowerCase());
    writeDB(db);
    res.json({ ok: true, db });
  } catch (err) {
    res.status(500).json({ error: 'Product delete korte somossa hoyeche.' });
  }
});

// Bulk Import / Replace or Merge from Excel/JSON Upload
app.post('/api/import', (req, res) => {
  try {
    const { products, mode, history } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Valid product list pawa jayni!' });
    }
    const db = readDB();

    if (mode === 'merge') {
      const map = new Map();
      db.products.forEach(p => map.set(p.code.toUpperCase(), p));
      products.forEach(p => {
        if (p.code && p.name) {
          map.set(String(p.code).trim().toUpperCase(), {
            code: String(p.code).trim(),
            name: String(p.name).trim(),
            sysStock: parseInt(p.sysStock, 10) || 0,
            phyStock: parseInt(p.phyStock, 10) || 0,
            short: Math.max(0, parseInt(p.short, 10) || 0),
            excess: Math.max(0, parseInt(p.excess, 10) || 0),
            price: Math.max(0, Number(parseFloat(p.price || 0).toFixed(2)))
          });
        }
      });
      db.products = Array.from(map.values());
    } else {
      // Replace mode
      db.products = products.map(p => ({
        code: String(p.code).trim(),
        name: String(p.name).trim(),
        sysStock: parseInt(p.sysStock, 10) || 0,
        phyStock: parseInt(p.phyStock, 10) || 0,
        short: Math.max(0, parseInt(p.short, 10) || 0),
        excess: Math.max(0, parseInt(p.excess, 10) || 0),
        price: Math.max(0, Number(parseFloat(p.price || 0).toFixed(2)))
      }));
      if (Array.isArray(history)) {
        db.history = history;
      }
    }

    writeDB(db);
    res.json({ ok: true, count: db.products.length, db });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update korte somossa hoyeche.' });
  }
});

// Clear History or Reset DB to Initial Excel State
app.post('/api/reset', (req, res) => {
  try {
    const { type } = req.body;
    const db = readDB();
    if (type === 'history') {
      db.history = [];
    } else if (type === 'factory') {
      db.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
      db.history = [];
    }
    writeDB(db);
    res.json({ ok: true, db });
  } catch (err) {
    res.status(500).json({ error: 'Reset korte somossa hoyeche.' });
  }
});

// Download raw db.json backup
app.get('/api/backup', (req, res) => {
  const db = readDB();
  res.setHeader('Content-Disposition', 'attachment; filename="db.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Stock Short & Excess Balancing Server running on port ${PORT}`);
});
