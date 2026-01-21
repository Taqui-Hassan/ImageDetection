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
app.use(cors()); // Allow all local connections
app.use(express.json({ limit: '50mb' }));

// --- CONFIGURATION ---
const CONFIG = {
    PORT: 8000,
    // Keep using your Render Python Service for the AI (It was working fine!)
    PYTHON_SERVICE_URL: 'https://event-ai-service.onrender.com', 
    BG_SERVICE_URL: 'http://localhost:5000', // Optional: If you aren't using BG removal, ignore this
    MAX_FILE_SIZE: 50 * 1024 * 1024 // 50MB
};

// --- DIRECTORIES ---
const UPLOADS_DIR = path.join(__dirname, "uploads");
const FACE_DB = path.join(__dirname, "faces"); // Simplified path
const AUTH_DIR = path.join(__dirname, ".wwebjs_auth"); // Saves login right here

// Create dirs
[UPLOADS_DIR, FACE_DB].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- WHATSAPP CLIENT (Windows Optimized) ---
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
        headless: true, // Set to false if you want to see the browser pop up!
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('\n🔥 SCAN THIS QR CODE:\n');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`✅ WHATSAPP CONNECTED! (${client.info.wid.user})`);
});

client.on('authenticated', () => console.log('✅ Authenticated successfully.'));
client.initialize();

// --- API ROUTES ---

// 1. Recognize & Send
const upload = multer({ dest: UPLOADS_DIR });

app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    const filePath = req.file.path;

    try {
        // Send to Python AI on Render
        const form = new FormData();
        form.append('image', fs.createReadStream(filePath));
        
        console.log("Sending to AI...");
        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, {
            method: 'POST',
            body: form
        });

        const data = await pyRes.json();
        console.log("AI Result:", data);

        if (data.match && data.phone) {
            // Send WhatsApp
            const chatId = `91${data.phone}@c.us`; // Adjust country code if needed
            const media = MessageMedia.fromFilePath(filePath);
            
            await client.sendMessage(chatId, media, { 
                caption: `Welcome ${data.name}! 📸 Here is your photo.` 
            });
            
            res.json({ status: "matched", name: data.name });
        } else {
            res.json({ status: "unknown" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        // Clean up file
        try { fs.unlinkSync(filePath); } catch (e) {}
    }
});

// 2. Health
app.get("/health", (req, res) => res.json({ status: "ok", mode: "local" }));

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 LOCAL BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
});