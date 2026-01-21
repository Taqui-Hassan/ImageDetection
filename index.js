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
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    REQUEST_TIMEOUT: 60000,
    DEFAULT_COUNTRY_CODE: '91',
    IS_RENDER: process.env.RENDER === 'true' // Detect if running on Render
};

// --- DIRECTORY SETUP ---
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const FACE_DB = path.resolve(__dirname, "face_service", "faces");
const META_FILE = path.join(FACE_DB, "meta.json");

// CRITICAL: On Render, use /opt/render/project/src/.wwebjs_auth
// This directory persists across deploys (if you use persistent disk)
const SAFE_AUTH_PATH = CONFIG.IS_RENDER 
    ? path.join(__dirname, '.wwebjs_auth')  // Within project on Render
    : path.join(os.homedir(), '.wwebjs_auth_safe'); // Local development

console.log(`📂 Auth Storage: ${SAFE_AUTH_PATH}`);
console.log(`📦 Environment: ${CONFIG.IS_RENDER ? 'Render' : 'Local'}`);

[UPLOADS_DIR, FACE_DB, SAFE_AUTH_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// --- LOGGING ---
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}`);
}

// --- FILE CLEANUP ---
async function safeDeleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            await promisify(fs.unlink)(filePath);
        }
    } catch (err) {
        log('ERROR', 'File deletion failed', { path: filePath, error: err.message });
    }
}

// --- MULTER SETUP ---
const uploadConfig = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: CONFIG.MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// --- PHONE NUMBER SANITIZATION ---
function sanitizePhoneNumber(phone, countryCode = CONFIG.DEFAULT_COUNTRY_CODE) {
    if (!phone) return null;
    let cleaned = phone.toString().replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    if (cleaned.length === 10) {
        cleaned = countryCode + cleaned;
    }
    if (cleaned.length < 10 || cleaned.length > 15) return null;
    return cleaned;
}

// --- WHATSAPP CLIENT SETUP ---
let clientReady = false;
let clientInitializing = false;
let qrCodeUrl = null; // Store QR for web display

// FIX: On Render free tier without persistent disk, you'll need to re-scan QR on each deploy
// OPTION 1: Use persistent disk (recommended)
// OPTION 2: Store session in external database (advanced)
// OPTION 3: Accept re-scanning QR code on each restart (current setup)

const client = new Client({
    authStrategy: new LocalAuth({ 
        dataPath: SAFE_AUTH_PATH,
        clientId: 'whatsapp-event-bot'
    }),
    puppeteer: {
        headless: true,
        // Chrome path detection (works with your Dockerfile)
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
            (CONFIG.IS_RENDER ? '/usr/bin/google-chrome-stable' : 
            (process.platform === 'win32' 
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : undefined)),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            // Render-specific optimizations
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// QR Code Handler
client.on('qr', qr => {
    qrCodeUrl = qr;
    log('INFO', 'QR Code generated');
    console.log('\n🔥 SCAN THIS QR CODE WITH WHATSAPP:\n');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('\n📱 Or visit: GET /qr endpoint\n');
});

client.on('ready', () => {
    clientReady = true;
    clientInitializing = false;
    qrCodeUrl = null;
    log('INFO', `WhatsApp connected as ${client.info.wid.user}`);
    console.log(`✅ WHATSAPP READY: ${client.info.wid.user}`);
});

client.on('authenticated', () => {
    log('INFO', 'WhatsApp authenticated');
    console.log('✅ WhatsApp Authenticated Successfully');
});

client.on('auth_failure', (msg) => {
    log('ERROR', 'Auth failure', { message: msg });
    clientReady = false;
    clientInitializing = false;
    qrCodeUrl = null;
});

client.on('disconnected', (reason) => {
    log('WARN', 'Disconnected', { reason });
    clientReady = false;
    
    // Only auto-reconnect on unexpected disconnections
    if (reason !== 'LOGOUT' && !CONFIG.IS_RENDER) {
        log('INFO', 'Auto-reconnecting in 5s...');
        setTimeout(() => {
            if (!clientInitializing) {
                clientInitializing = true;
                client.initialize();
            }
        }, 5000);
    }
});

// Keep connection alive
client.on('loading_screen', async () => {
    try {
        await client.pupPage?.evaluate(() => {
            if (window.WWebJS) {
                window.injectToFunction({ 
                    module: 'WAWebLid1X1MigrationGating', 
                    function: 'Lid1X1MigrationUtils.isLidMigrated' 
                }, () => false);
            }
        });
    } catch(e) {}
});

// Initialize
log('INFO', 'Initializing WhatsApp...');
clientInitializing = true;
client.initialize().catch(err => {
    log('ERROR', 'Init failed', { error: err.message });
    clientInitializing = false;
});

// --- BACKGROUND REMOVAL ---
async function addEventBackground(inputPath) {
    const processedPath = inputPath.replace(/\.(jpg|png)$/i, '_branded.jpg');
    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(inputPath));

        const response = await fetch(`${CONFIG.BG_SERVICE_URL}/composite`, {
            method: 'POST',
            body: form,
            timeout: 30000
        });

        if (!response.ok) throw new Error(`BG Service error: ${response.status}`);

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(processedPath, Buffer.from(buffer));
        return processedPath;
    } catch (err) {
        log('WARN', 'Background failed, using original', { error: err.message });
        return inputPath;
    }
}

// --- SEND WHATSAPP ---
async function sendWhatsAppPhoto(name, phone, imagePath) {
    if (!clientReady) {
        log('WARN', 'WhatsApp not ready');
        return false;
    }

    try {
        const sanitized = sanitizePhoneNumber(phone);
        if (!sanitized) return false;

        const targetId = `${sanitized}@c.us`;
        await new Promise(r => setTimeout(r, 1000));

        const numberInfo = await client.getNumberId(targetId);
        if (!numberInfo) {
            log('WARN', 'Number not found', { phone: sanitized });
            return false;
        }

        const fileData = fs.readFileSync(imagePath, { encoding: 'base64' });
        const media = new MessageMedia('image/jpeg', fileData, `${name}.jpg`);

        await client.sendMessage(numberInfo._serialized, media, {
            caption: `Welcome, ${name}! 📸\n\nHere is your event souvenir!`,
            sendSeen: false
        });

        log('INFO', 'Photo sent', { name, phone: sanitized });
        return true;
    } catch (err) {
        log('ERROR', 'Send failed', { name, error: err.message });
        return false;
    }
}

// --- ROUTES ---

// QR Code endpoint (for web display)
app.get('/qr', (req, res) => {
    if (clientReady) {
        res.json({ status: 'connected', message: 'WhatsApp already connected' });
    } else if (qrCodeUrl) {
        res.json({ status: 'qr_ready', qr: qrCodeUrl });
    } else {
        res.json({ status: 'initializing', message: 'Waiting for QR code...' });
    }
});

// Recognition
app.post("/recognize-guest", uploadConfig.single("image"), async (req, res) => {
    if (!clientReady) {
        return res.status(503).json({ status: "error", message: "WhatsApp not connected" });
    }
    if (!req.file) {
        return res.status(400).json({ status: "error", message: "No image" });
    }

    const tempFilePath = path.resolve(req.file.path);

    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));

        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, {
            method: 'POST',
            body: form
        });

        if (!pyRes.ok) throw new Error(`Recognition error: ${pyRes.status}`);
        const data = await pyRes.json();
        log('INFO', 'Recognition', data);

        if (data.match === true && data.phone) {
            const storedImagePath = path.join(FACE_DB, data.name, `${data.name}.jpg`);
            let rawImage = fs.existsSync(storedImagePath) ? storedImagePath : tempFilePath;
            
            const finalImage = await addEventBackground(rawImage);
            
            // Send async (don't block response)
            sendWhatsAppPhoto(data.name, data.phone, finalImage);

            res.json({ status: "matched", name: data.name });
        } else {
            res.json({ status: "unknown" });
        }
    } catch (err) {
        log('ERROR', 'Process failed', { error: err.message });
        res.status(500).json({ status: "error", message: err.message });
    } finally {
        setTimeout(() => safeDeleteFile(tempFilePath), 3000);
    }
});

// Enrollment
app.post("/upload-excel", uploadConfig.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const tempFilePath = req.file.path;
    try {
        const workbook = xlsx.readFile(tempFilePath);
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        let enrolled = 0, failed = 0;

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
                log('INFO', 'Enrolled', { name });
            } catch (e) { failed++; }
        }
        
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        res.json({ status: "success", enrolled, failed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        safeDeleteFile(tempFilePath);
    }
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        whatsapp: clientReady ? "connected" : (qrCodeUrl ? "qr_pending" : "initializing"),
        environment: CONFIG.IS_RENDER ? "render" : "local"
    });
});

// Root
app.get("/", (req, res) => {
    res.json({ 
        service: "WhatsApp Event Bot",
        status: clientReady ? "✅ Connected" : "⏳ Waiting for QR scan",
        endpoints: {
            qr: "GET /qr",
            health: "GET /health",
            recognize: "POST /recognize-guest",
            enroll: "POST /upload-excel"
        }
    });
});

const server = app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${CONFIG.PORT}`);
    console.log(`📱 Environment: ${CONFIG.IS_RENDER ? 'Render' : 'Local'}`);
    console.log(`📂 Auth path: ${SAFE_AUTH_PATH}`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    try {
        await client.destroy();
    } catch (e) {}
    process.exit(0);
});