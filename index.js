import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; 
import { fileURLToPath } from "url";
import FormData from 'form-data';
import qrcodeTerminal from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';

dotenv.config();

const { Client, LocalAuth, MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- CONFIGURATION ---
const CONFIG = {
    PORT: process.env.PORT || 8000,
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5000',
    GUEST_LIST_PASSWORD: process.env.GUEST_LIST_PASSWORD || "list2024"
};

// --- DIRECTORIES ---
const UPLOADS_DIR = path.join(__dirname, "uploads");
const FACE_DB = path.join(__dirname, "faces");
const AUTH_DIR = path.join(__dirname, ".wwebjs_auth");
const META_FILE = path.join(FACE_DB, "meta.json");

[UPLOADS_DIR, FACE_DB].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// --- LIVE STATS TRACKER (NEW) ---
let stats = {
    totalScans: 0,
    success: 0,
    failed: 0,
    lastScanned: "None",
    recentFailures: [] // Stores last 10 failed names
};

// --- WHATSAPP CLIENT ---
let isWhatsAppReady = false;
let currentQR = null; 

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu']
    }
});

client.on('qr', qr => { console.log('🔥 QR RECEIVED'); currentQR = qr; qrcodeTerminal.generate(qr, { small: true }); });
client.on('ready', () => { isWhatsAppReady = true; currentQR = null; console.log(`✅ WHATSAPP CONNECTED! (${client.info.wid.user})`); });
client.on('disconnected', () => { isWhatsAppReady = false; console.log('⚠️ WhatsApp disconnected'); });
client.initialize();

// --- HELPERS ---
function formatPhoneNumber(phone) {
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
}

// --- ROUTES ---

// 1. NEW: LIVE MONITOR DASHBOARD 📊
app.get("/monitor", (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Event Monitor</title>
        <meta http-equiv="refresh" content="3"> <style>
            body { font-family: sans-serif; background: #1a1a1a; color: white; padding: 20px; text-align: center; }
            .grid { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; }
            .card { background: #333; padding: 20px; border-radius: 10px; width: 200px; }
            .number { font-size: 40px; font-weight: bold; }
            .green { color: #4caf50; } .red { color: #f44336; } .blue { color: #2196f3; }
            table { width: 100%; margin-top: 20px; border-collapse: collapse; }
            th, td { border: 1px solid #444; padding: 10px; text-align: left; }
            th { background: #444; }
        </style>
    </head>
    <body>
        <h1>🚀 Event Live Monitor</h1>
        <div class="grid">
            <div class="card">
                <div>Total Scans</div>
                <div class="number blue">${stats.totalScans}</div>
            </div>
            <div class="card">
                <div>Matched (Success)</div>
                <div class="number green">${stats.success}</div>
            </div>
            <div class="card">
                <div>Failed (Unknown)</div>
                <div class="number red">${stats.failed}</div>
            </div>
        </div>
        <h2>Last Scanned: <span style="color: yellow">${stats.lastScanned}</span></h2>
        
        <h3>❌ Recent Failures (Not in List)</h3>
        <table>
            <tr><th>Time</th><th>Name Detected by AI</th></tr>
            ${stats.recentFailures.map(f => `<tr><td>${f.time}</td><td>${f.name}</td></tr>`).join('')}
        </table>
    </body>
    </html>
    `;
    res.send(html);
});

// 2. EXISTING ROUTES
app.get("/system-status", async (req, res) => {
    let batteryInfo = null;
    try { if (isWhatsAppReady) batteryInfo = await client.info.getBatteryStatus(); } catch (e) {}
    res.json({ whatsapp: isWhatsAppReady, qr: currentQR, user: isWhatsAppReady ? client.info.wid.user : null, battery: batteryInfo });
});

app.get("/guests", (req, res) => {
    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            const guests = Object.keys(meta).map(name => ({ 
                name, 
                phone: meta[name].phone, 
                seat: meta[name].seat || "N/A",
                entered: meta[name].entered || false 
            }));
            res.json(guests);
        } else { res.json([]); }
    } catch (err) { res.json([]); }
});

app.put("/guests/:name/toggle", (req, res) => {
    const nameToUpdate = req.params.name;
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        if (meta[nameToUpdate]) {
            meta[nameToUpdate].entered = !meta[nameToUpdate].entered;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            res.json({ status: "success", entered: meta[nameToUpdate].entered });
        } else { res.status(404).json({ error: "Guest not found" }); }
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

app.delete("/guests/:name", (req, res) => {
    const nameToDelete = req.params.name;
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        if (meta[nameToDelete]) {
            delete meta[nameToDelete];
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            res.json({ status: "success" });
        } else { res.status(404).json({ error: "Guest not found" }); }
    } catch (err) { res.status(500).json({ error: "Could not delete" }); }
});

const upload = multer({ dest: UPLOADS_DIR });

// 3. AI RECOGNIZE (UPDATED WITH STATS)
app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    
    // UPDATE STATS
    stats.totalScans++;

    const originalPath = req.file.path;
    const filePath = originalPath + '.jpg';
    fs.renameSync(originalPath, filePath);

    try {
        console.log("📤 Sending image to AI..."); 
        const form = new FormData();
        form.append('image', fs.createReadStream(filePath));

        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, { method: 'POST', body: form });
        const data = await pyRes.json();
        console.log("🤖 AI Response:", JSON.stringify(data)); 

        if ((data.status === 'matched' || data.match === true) && data.name) {
            
            let meta = JSON.parse(fs.readFileSync(META_FILE));
            const aiNameClean = data.name.trim().toLowerCase();
            stats.lastScanned = data.name;

            const foundKey = Object.keys(meta).find(key => key.toLowerCase() === aiNameClean);
            const guestData = foundKey ? meta[foundKey] : null;

            if (!guestData) {
                // STATS: FAILURE (AI saw face, but not in DB)
                stats.failed++;
                stats.recentFailures.unshift({ time: new Date().toLocaleTimeString(), name: data.name });
                if (stats.recentFailures.length > 10) stats.recentFailures.pop();

                return res.json({ 
                    status: "matched", 
                    name: data.name, 
                    seat: "Check List",
                    entered: false 
                });
            }

            // STATS: SUCCESS
            stats.success++;

            // Safety Check: Already Entered?
           

            // MARK ENTERED
            meta[foundKey].entered = true;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

            const cleanPhone = formatPhoneNumber(guestData.phone);
            const seatNumber = guestData.seat || "General";
            const chatId = `${cleanPhone}@c.us`;
            const caption = `Dear ${foundKey} \n\n✅ *Access Granted*\n📍 *Seat:* ${seatNumber}\n\nEnjoy the event!`;

            if (isWhatsAppReady) {
                try {
                    const media = await MessageMedia.fromFilePath(filePath);
                    client.sendMessage(chatId, media, { caption }).catch(e => console.error("WA Msg Error:", e));
                } catch (waErr) {
                    console.error("WA Media Error:", waErr);
                }
            }

            res.json({ 
                status: "matched", 
                name: foundKey, 
                phone: cleanPhone, 
                seat: seatNumber, 
                entered: true 
            });

        } else {
            // STATS: FAILURE (No face / Unknown)
            stats.failed++;
            res.json({ status: "unknown" });
        }
    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (e) { }
    }
});

// 4. UPLOAD EXCEL
app.post("/upload-excel", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error" });
    const tempFilePath = req.file.path;
    try {
        const workbook = xlsx.readFile(tempFilePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);
        
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        let enrolled = 0;

        for (const row of rows) {
            const name = row.Name?.toString().trim();
            const phone = row.Phone?.toString().trim();
            const seat = row.Seat || row["Seat Number"] || "General";

            if (name && phone) {
                const existingEntry = meta[name];
                meta[name] = { 
                    phone: formatPhoneNumber(phone), 
                    seat: seat.toString(),
                    entered: existingEntry ? existingEntry.entered : false 
                };
                enrolled++;
            }
        }
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        res.json({ status: "success", enrolled });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    } finally {
        try { fs.unlinkSync(tempFilePath); } catch (e) { }
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 LOCAL BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
});