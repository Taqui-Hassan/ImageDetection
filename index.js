import express from "express";
import cors from "cors";
import multer from "multer";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import FormData from 'form-data';
import qrcodeTerminal from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- CONFIGURATION ---
const CONFIG = {
    PORT: 8000,
    PYTHON_SERVICE_URL: 'https://event-ai-service.onrender.com',
    MAX_FILE_SIZE: 50 * 1024 * 1024
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

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', qr => {
    console.log('\n🔥 SCAN THIS QR CODE:\n');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    isWhatsAppReady = true;
    console.log(`✅ WHATSAPP CONNECTED! (${client.info.wid.user})`);
});

client.on('disconnected', () => {
    isWhatsAppReady = false;
    console.log('⚠️ WhatsApp disconnected');
});

client.initialize();

function formatPhoneNumber(phone) {
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
}

// --- ROUTES ---

// 1. GET GUESTS (Updated for new structure)
app.get("/guests", (req, res) => {
    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            // Map the new object structure back to an array
            const guests = Object.keys(meta).map(name => ({ 
                name, 
                phone: meta[name].phone,
                seat: meta[name].seat || "N/A"
            }));
            res.json(guests);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.json([]);
    }
});

// 2. DELETE GUEST
app.delete("/guests/:name", (req, res) => {
    const nameToDelete = req.params.name;
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        if (meta[nameToDelete]) {
            delete meta[nameToDelete];
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            res.json({ status: "success" });
        } else {
            res.status(404).json({ error: "Guest not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Could not delete" });
    }
});

const upload = multer({ dest: UPLOADS_DIR });

// 3. RECOGNIZE & SEND SEAT NUMBER
app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    
    const originalPath = req.file.path;
    const filePath = originalPath + '.jpg';
    fs.renameSync(originalPath, filePath);

    try {
        if (!isWhatsAppReady) {
            return res.status(503).json({ error: "WhatsApp starting..." });
        }

        // Ask AI
        const form = new FormData();
        form.append('image', fs.createReadStream(filePath));

        console.log("📤 Sending to AI...");
        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, {
            method: 'POST',
            body: form
        });

        const data = await pyRes.json();
        console.log("🤖 AI Result:", data);

        if (data.match && data.name) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            const guestData = meta[data.name]; // Retrieve object { phone, seat }

            if (!guestData || !guestData.phone) {
                return res.json({ status: "matched", name: data.name, warning: "No phone found" });
            }

            const cleanPhone = formatPhoneNumber(guestData.phone);
            const seatNumber = guestData.seat || "Assigned on arrival";
            const chatId = `${cleanPhone}@c.us`;

            // 👇 THE MESSAGE WITH SEAT NUMBER
            const caption = `🎉 Welcome ${data.name}!\n\n📍 *Your Seat Number is: ${seatNumber}*\n\nEnjoy the event! 🚀`;

            try {
                const media = MessageMedia.fromFilePath(filePath);
                await client.sendMessage(chatId, media, { caption });
                
                console.log(`✅ Sent Seat ${seatNumber} to ${data.name}`);
                res.json({ status: "matched", name: data.name, phone: cleanPhone, seat: seatNumber, messageSent: true });

            } catch (waErr) {
                console.error("❌ Send Failed:", waErr.message);
                res.json({ status: "matched", name: data.name, error: "WhatsApp failed" });
            }
        } else {
            res.json({ status: "unknown" });
        }
    } catch (err) {
        console.error("💥 Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (e) { }
    }
});

// 4. UPLOAD EXCEL (Now reads 'Seat' column)
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
            
            // 👇 Try to find the Seat column (Check multiple spellings)
            const seat = row.Seat || row["Seat Number"] || row["SeatNo"] || "General";

            if (name && phone) {
                // Save as OBJECT now: { phone: "...", seat: "..." }
                meta[name] = {
                    phone: formatPhoneNumber(phone),
                    seat: seat.toString()
                };
                enrolled++;
            }
        }
        
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        console.log(`📊 Enrolled ${enrolled} guests with seats.`);
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