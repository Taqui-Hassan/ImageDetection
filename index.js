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

// Load environment variables
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
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:5000',
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

// --- WHATSAPP CLIENT ---
let isWhatsAppReady = false;
let currentQR = null; 

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
        headless: false,
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

// 1. SYSTEM STATUS
app.get("/system-status", async (req, res) => {
    let batteryInfo = null;
    try { if (isWhatsAppReady) batteryInfo = await client.info.getBatteryStatus(); } catch (e) {}
    res.json({ whatsapp: isWhatsAppReady, qr: currentQR, user: isWhatsAppReady ? client.info.wid.user : null, battery: batteryInfo });
});

// 2. GET GUESTS (SECURED)
app.get("/guests", (req, res) => {
    const adminPassword = req.headers['x-admin-password'];
    if (adminPassword !== CONFIG.GUEST_LIST_PASSWORD) {
       // return res.status(403).json({ error: "Wrong Password" }); 
    }
    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            const guests = Object.keys(meta).map(name => ({ 
                name, 
                phone: meta[name].phone, 
                seat: meta[name].seat || "N/A",
                entered: meta[name].entered || false // 👈 NEW FIELD
            }));
            res.json(guests);
        } else { res.json([]); }
    } catch (err) { res.json([]); }
});

// 3. TOGGLE ENTRY STATUS (NEW ROUTE) 👈
app.put("/guests/:name/toggle", (req, res) => {
    const nameToUpdate = req.params.name;
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        if (meta[nameToUpdate]) {
            // Flip the status (True -> False / False -> True)
            meta[nameToUpdate].entered = !meta[nameToUpdate].entered;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            res.json({ status: "success", entered: meta[nameToUpdate].entered });
        } else { res.status(404).json({ error: "Guest not found" }); }
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 4. DELETE GUEST
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

// 5. AI RECOGNIZE (Scanner)
app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    const originalPath = req.file.path;
    const filePath = originalPath + '.jpg';
    fs.renameSync(originalPath, filePath);

    try {
        if (!isWhatsAppReady) return res.status(503).json({ error: "WhatsApp starting..." });
        
        console.log("📤 Sending image to AI..."); 
        const form = new FormData();
        form.append('image', fs.createReadStream(filePath));

        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, { method: 'POST', body: form });
        const data = await pyRes.json();
        console.log("🤖 AI Response:", JSON.stringify(data)); 

        if (data.match && data.name) {
            let meta = JSON.parse(fs.readFileSync(META_FILE));
            // Find matched name (case insensitive)
            const foundName = Object.keys(meta).find(key => key.toLowerCase() === data.name.toLowerCase());
            const guestData = foundName ? meta[foundName] : null;

            if (!guestData) return res.json({ status: "matched", name: data.name, warning: "Not in list" });

            // 👇 MARK AS ENTERED AUTOMATICALLY
            meta[foundName].entered = true;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

            const cleanPhone = formatPhoneNumber(guestData.phone);
            const seatNumber = guestData.seat || "Assigned on arrival";
            const chatId = `${cleanPhone}@c.us`;
            const caption = `🎉 Welcome ${foundName}!\n\n📍 *Your Seat Number is: ${seatNumber}*\n\nEnjoy the event! 🚀`;

            try {
                const media = await MessageMedia.fromFilePath(filePath);
                await client.sendMessage(chatId, media, { caption });
                res.json({ status: "matched", name: foundName, phone: cleanPhone, seat: seatNumber, messageSent: true });
            } catch (waErr) {
                res.json({ status: "matched", name: foundName, error: "WhatsApp failed" });
            }
        } else {
            res.json({ status: "unknown" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (e) { }
    }
});

// 6. UPLOAD EXCEL
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
                // Keep existing "entered" status if updating, otherwise default to false
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

// 7. BULK BLAST (EXCEL URL MODE)
app.post("/send-bulk", upload.single("file"), async (req, res) => {
    // ... (Keep your existing bulk blast code here, no changes needed) ...
});

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 LOCAL BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
});