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
import os from "os";
import { promisify } from 'util';

// --- IMPORT FIX ---
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- CONFIGURATION ---
const CONFIG = {
    PORT: process.env.PORT || 8000,
    PYTHON_SERVICE_URL: process.env.PYTHON_URL || 'http://localhost:5000',
    BG_SERVICE_URL: process.env.BG_URL || 'http://localhost:5000',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    IS_RENDER: process.env.RENDER === 'true'
};

// --- DIRECTORY SETUP ---
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const FACE_DB = path.resolve(__dirname, "face_service", "faces");
const META_FILE = path.join(FACE_DB, "meta.json");

// --- CRITICAL: PERSISTENT DISK PATH ---
// This must match the "Mount Path" you set in Render Dashboard
const SAFE_AUTH_PATH = CONFIG.IS_RENDER 
    ? '/opt/render/project/src/.wwebjs_auth' 
    : path.join(os.homedir(), '.wwebjs_auth_safe');

console.log(`📂 Auth Storage Path: ${SAFE_AUTH_PATH}`);

// Create directories
try {
    if (!fs.existsSync(SAFE_AUTH_PATH)) fs.mkdirSync(SAFE_AUTH_PATH, { recursive: true });
    [UPLOADS_DIR, FACE_DB].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");
} catch (err) {
    console.error("Critical Error creating directories:", err);
}

// --- LOGGING ---
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}`);
}

// --- FILE CLEANUP ---
async function safeDeleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) await promisify(fs.unlink)(filePath);
    } catch (err) {}
}

// --- MULTER CONFIG ---
const uploadConfig = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: CONFIG.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type'));
    }
});

// --- HELPER: PHONE SANITIZER ---
function sanitizePhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.toString().replace(/\D/g, '').replace(/^0+/, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned; // Default to India
    if (cleaned.length < 10 || cleaned.length > 15) return null;
    return cleaned;
}

// --- WHATSAPP CLIENT SETUP ---
let clientReady = false;
let qrCodeUrl = null;

const client = new Client({
    // USE LOCAL AUTH (Persistent Session)
    authStrategy: new LocalAuth({ 
        dataPath: SAFE_AUTH_PATH,
        clientId: 'client-one' 
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        // Optimized Args for Render Linux Environment
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', 
            '--disable-gpu'
        ]
    }
});

// --- EVENTS ---
client.on('qr', qr => {
    qrCodeUrl = qr;
    log('INFO', 'QR Code generated');
    console.log('\n🔥 SCAN THIS QR CODE:\n');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    clientReady = true;
    qrCodeUrl = null;
    log('INFO', `WhatsApp connected as ${client.info.wid.user}`);
    console.log(`✅ WHATSAPP READY: ${client.info.wid.user}`);
});

client.on('authenticated', () => {
    log('INFO', 'WhatsApp authenticated successfully');
});

client.on('auth_failure', (msg) => {
    log('ERROR', 'Authentication failed', { message: msg });
});

client.on('disconnected', (reason) => {
    log('WARN', 'WhatsApp disconnected', { reason });
    clientReady = false;
    // Auto-reconnect since we have a persistent session now
    client.initialize();
});

console.log('Initializing WhatsApp Client...');
client.initialize().catch(err => console.error('Init Error:', err));


// --- HELPER: BACKGROUND REMOVAL ---
async function addEventBackground(inputPath) {
    const processedPath = inputPath.replace(/\.(jpg|png)$/i, '_branded.jpg');
    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(inputPath));

        const response = await fetch(`${CONFIG.BG_SERVICE_URL}/composite`, {
            method: 'POST',
            body: form
        });

        if (!response.ok) throw new Error(`BG Service error: ${response.status}`);

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(processedPath, Buffer.from(buffer));
        return processedPath;
    } catch (err) {
        log('WARN', 'Background removal failed, using original', { error: err.message });
        return inputPath;
    }
}

// --- HELPER: SEND MESSAGE ---
async function sendWhatsAppPhoto(name, phone, imagePath) {
    if (!clientReady) return false;
    try {
        const sanitized = sanitizePhoneNumber(phone);
        if (!sanitized) return false;
        
        const targetId = `${sanitized}@c.us`;
        const fileData = fs.readFileSync(imagePath, { encoding: 'base64' });
        const media = new MessageMedia('image/jpeg', fileData, `${name}.jpg`);

        await client.sendMessage(targetId, media, {
            caption: `Welcome, ${name}! 📸\n\nHere is your event souvenir!`,
            sendSeen: false
        });

        log('INFO', 'Message sent', { name, phone: sanitized });
        return true;
    } catch (err) {
        log('ERROR', 'Failed to send message', { error: err.message });
        return false;
    }
}

// --- ROUTES ---

// 1. QR Code Endpoint
app.get('/qr', (req, res) => {
    if (clientReady) res.json({ status: 'connected', message: 'WhatsApp already connected' });
    else if (qrCodeUrl) res.json({ status: 'qr_ready', qr: qrCodeUrl });
    else res.json({ status: 'initializing', message: 'Waiting for QR code...' });
});

// 2. Health Check
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        whatsapp: clientReady ? "connected" : "disconnected",
        storage: SAFE_AUTH_PATH
    });
});

// 3. Recognize & Send
app.post("/recognize-guest", uploadConfig.single("image"), async (req, res) => {
    if (!clientReady) return res.status(503).json({ status: "error", message: "WhatsApp not connected" });
    if (!req.file) return res.status(400).json({ status: "error", message: "No image uploaded" });

    const tempFilePath = path.resolve(req.file.path);

    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));

        // Call Python Service
        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, {
            method: 'POST',
            body: form
        });

        if (!pyRes.ok) throw new Error(`Python service error: ${pyRes.status}`);
        const data = await pyRes.json();
        
        log('INFO', 'Recognition Result', data);

        if (data.match === true && data.phone) {
            // Check for HD stored image
            const storedImagePath = path.join(FACE_DB, data.name, `${data.name}.jpg`);
            let rawImage = fs.existsSync(storedImagePath) ? storedImagePath : tempFilePath;
            
            // Add Background
            const finalImage = await addEventBackground(rawImage);
            
            // Send Message
            sendWhatsAppPhoto(data.name, data.phone, finalImage);

            res.json({ status: "matched", name: data.name, phone: data.phone });
        } else {
            res.json({ status: "unknown", message: "Guest not recognized" });
        }
    } catch (err) {
        log('ERROR', 'Process failed', { error: err.message });
        res.status(500).json({ status: "error", message: "Processing failed" });
    } finally {
        safeDeleteFile(tempFilePath);
    }
});

// 4. Excel Enrollment
app.post("/upload-excel", uploadConfig.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error", message: "No file uploaded" });

    const tempFilePath = req.file.path;
    try {
        const workbook = xlsx.readFile(tempFilePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);
        
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        let enrolled = 0;
        let failed = 0;

        for (const row of rows) {
            try {
                const name = row.Name?.toString().trim();
                const phone = row.Phone?.toString().trim();
                const imageURL = row.ImageURL?.toString().trim();

                if (!name || !phone || !imageURL) { failed++; continue; }
                const sanitized = sanitizePhoneNumber(phone);
                if (!sanitized) { failed++; continue; }

                const personDir = path.join(FACE_DB, name);
                if (!fs.existsSync(personDir)) fs.mkdirSync(personDir, { recursive: true });

                const response = await fetch(imageURL);
                if (!response.ok) { failed++; continue; }

                const buffer = await response.arrayBuffer();
                fs.writeFileSync(path.join(personDir, `${name}.jpg`), Buffer.from(buffer));
                
                meta[name] = sanitized;
                enrolled++;
            } catch (e) { failed++; }
        }
        
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        res.json({ status: "success", enrolled, failed });
        
    } catch (err) {
        res.status(500).json({ status: "error", message: "Excel error" });
    } finally {
        safeDeleteFile(tempFilePath);
    }
});

const server = app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`🚀 Node Backend running on ${CONFIG.PORT}`);
});