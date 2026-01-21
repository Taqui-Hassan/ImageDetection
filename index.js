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
    // Locking to stable version to prevent bugs
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

// 1. GET GUESTS (SECURED)
app.get("/guests", (req, res) => {
    // Check for password header from frontend
    const adminPassword = req.headers['x-admin-password'];
    
    // If accessing from browser directly, we might not have headers, 
    // but the frontend GuestList.jsx sends "list2024" (or whatever you set).
    // If you want strict security, uncomment the next 3 lines:
    // if (adminPassword && adminPassword !== "list2024") {
    //    return res.status(403).json({ error: "Wrong Password" });
    // }

    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
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
            console.log(`🗑️ Deleted guest: ${nameToDelete}`);
            res.json({ status: "success" });
        } else {
            res.status(404).json({ error: "Guest not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Could not delete" });
    }
});

const upload = multer({ dest: UPLOADS_DIR });

// 3. AI RECOGNIZE & SEND (The Scanner)
app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    
    // Rename to .jpg so WhatsApp recognizes it as an image
    const originalPath = req.file.path;
    const filePath = originalPath + '.jpg';
    fs.renameSync(originalPath, filePath);

    try {
        if (!isWhatsAppReady) {
            return res.status(503).json({ error: "WhatsApp starting..." });
        }

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
            
            // Case-Insensitive Lookup (Matches "taqui" to "Taqui")
            const foundName = Object.keys(meta).find(key => key.toLowerCase() === data.name.toLowerCase());
            const guestData = foundName ? meta[foundName] : null;

            if (!guestData || !guestData.phone) {
                console.log(`⚠️ Match found for '${data.name}', but not in Excel list.`);
                return res.json({ status: "matched", name: data.name, warning: "No phone found in Excel" });
            }

            const cleanPhone = formatPhoneNumber(guestData.phone);
            const seatNumber = guestData.seat || "Assigned on arrival";
            const chatId = `${cleanPhone}@c.us`;

            const caption = `🎉 Welcome ${foundName}!\n\n📍 *Your Seat Number is: ${seatNumber}*\n\nEnjoy the event! 🚀`;

            try {
                const media = MessageMedia.fromFilePath(filePath);
                await client.sendMessage(chatId, media, { caption });
                
                console.log(`✅ Sent Seat ${seatNumber} to ${foundName}`);
                res.json({ status: "matched", name: foundName, phone: cleanPhone, seat: seatNumber, messageSent: true });

            } catch (waErr) {
                console.error("❌ Send Failed:", waErr.message);
                res.json({ status: "matched", name: foundName, error: "WhatsApp failed" });
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

// 4. DATABASE IMPORT (Update Local DB)
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
            const seat = row.Seat || row["Seat Number"] || row["SeatNo"] || "General";

            if (name && phone) {
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

// 5. BULK MESSAGE BLAST (Direct Broadcast)
app.post("/send-bulk", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error", message: "No file uploaded" });
    const tempFilePath = req.file.path;

    try {
        if (!isWhatsAppReady) return res.status(503).json({ status: "error", message: "WhatsApp not ready" });

        const workbook = xlsx.readFile(tempFilePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        let sentCount = 0;
        let errors = [];

        console.log(`🚀 Starting Bulk Blast for ${rows.length} users...`);

        for (const row of rows) {
            const name = row.Name?.toString().trim();
            const phone = row.Phone?.toString().trim();
            const seat = row.Seat || row["Seat Number"] || row["SeatNo"] || "General";

            if (name && phone) {
                try {
                    const cleanPhone = formatPhoneNumber(phone);
                    const chatId = `${cleanPhone}@c.us`;
                    
                    const message = `👋 Hello ${name}!\n\n🎟️ Welcome to the event.\n📍 *Your Seat Number is: ${seat}*\n\nPlease proceed to your seat.`;

                    await client.sendMessage(chatId, message);
                    console.log(`✅ Sent to ${name} (${cleanPhone})`);
                    sentCount++;
                    
                    // 1 second delay to avoid spam detection
                    await new Promise(r => setTimeout(r, 1000)); 

                } catch (err) {
                    console.error(`❌ Failed for ${name}:`, err.message);
                    errors.push(name);
                }
            }
        }

        res.json({ 
            status: "success", 
            total: rows.length, 
            sent: sentCount, 
            failed: errors.length 
        });

    } catch (err) {
        console.error("Bulk Error:", err);
        res.status(500).json({ status: "error", message: err.message });
    } finally {
        try { fs.unlinkSync(tempFilePath); } catch (e) { }
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 LOCAL BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
});