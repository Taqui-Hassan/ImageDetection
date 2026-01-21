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

// --- CRITICAL FIX: Correct Import for whatsapp-web.js ---
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, NoAuth, MessageMedia } = pkg;

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
    REQUEST_TIMEOUT: 60000, // Increased to 60s for stability
    DEFAULT_COUNTRY_CODE: '91',
    MAX_CONCURRENT_REQUESTS: 1 // Reduced to 1 to prevent memory crashes
};

// --- DIRECTORY SETUP ---
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const FACE_DB = path.resolve(__dirname, "face_service", "faces");
const META_FILE = path.join(FACE_DB, "meta.json");
const SAFE_AUTH_PATH = path.join(os.homedir(), '.wwebjs_auth_safe');
const LOG_FILE = path.join(__dirname, 'app.log');

// Create directories
[UPLOADS_DIR, FACE_DB].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// --- LOGGING UTILITY ---
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}`);
}

// --- FILE CLEANUP UTILITY ---
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

// --- WHATSAPP CLIENT SETUP (CRASH PROOF VERSION) ---
let clientReady = false;

const client = new Client({
    // FIX 1: Use NoAuth to prevent saving session files (Saves RAM/Disk)
    authStrategy: new NoAuth(),

    puppeteer: {
        headless: true,
        // FIX 2: Small viewport to save RAM
        defaultViewport: { width: 800, height: 600 },
        // FIX 3: Critical flags for Render Free Tier
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process' 
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// Event Handlers
client.on('qr', qr => {
    log('INFO', 'QR Code generated');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    clientReady = true;
    log('INFO', `WhatsApp connected as ${client.info.wid.user}`);
    console.log(`🔥 CONNECTED as ${client.info.wid.user}`);
});

client.on('authenticated', () => log('INFO', 'WhatsApp authenticated'));

client.on('auth_failure', (msg) => {
    log('ERROR', 'WhatsApp auth failure', { message: msg });
    clientReady = false;
});

client.on('disconnected', (reason) => {
    log('WARN', 'WhatsApp disconnected', { reason });
    clientReady = false;
    // On free tier, we don't auto-reconnect to avoid death loops. 
    // You must restart service manually if it dies.
});

log('INFO', 'Initializing WhatsApp client...');
client.initialize().catch(err => {
    log('ERROR', 'Client initialization failed', { error: err.message });
});

// --- BACKGROUND REMOVAL HELPER ---
async function addEventBackground(inputPath) {
    const processedPath = inputPath.replace(/\.(jpg|png)$/i, '_branded.jpg');
    try {
        log('INFO', 'Sending to BG Service...');
        const form = new FormData();
        form.append('image', fs.createReadStream(inputPath));

        const response = await fetch(`${CONFIG.BG_SERVICE_URL}/composite`, {
            method: 'POST',
            body: form
        });

        if (!response.ok) throw new Error(`BG Service returned ${response.status}`);

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(processedPath, Buffer.from(buffer));
        return processedPath;
    } catch (err) {
        log('ERROR', 'Background processing failed, using original', { error: err.message });
        return inputPath;
    }
}

// --- SEND WHATSAPP PHOTO ---
async function sendWhatsAppPhoto(name, phone, imagePath) {
    if (!clientReady) return false;

    try {
        const sanitized = sanitizePhoneNumber(phone);
        if (!sanitized) return false;

        const targetId = `${sanitized}@c.us`;
        // Delay to prevent spam blocks
        await new Promise(resolve => setTimeout(resolve, 1000));

        const numberInfo = await client.getNumberId(targetId);
        if (!numberInfo) {
            log('WARN', 'Number not on WhatsApp', { phone: sanitized });
            return false;
        }

        const fileData = fs.readFileSync(imagePath, { encoding: 'base64' });
        const media = new MessageMedia('image/jpeg', fileData, `${name}.jpg`);

        await client.sendMessage(numberInfo._serialized, media, {
            caption: `Welcome, ${name}! 📸\n\nHere is your event souvenir!`,
            sendSeen: false
        });

        log('INFO', 'Photo sent successfully', { name });
        return true;
    } catch (err) {
        log('ERROR', 'WhatsApp send failed', { error: err.message });
        return false;
    }
}

// --- RECOGNITION ROUTE ---
app.post("/recognize-guest", uploadConfig.single("image"), async (req, res) => {
    if (!clientReady) {
        return res.status(503).json({ status: "error", message: "WhatsApp not connected." });
    }
    if (!req.file) {
        return res.status(400).json({ status: "error", message: "No image uploaded" });
    }

    const tempFilePath = path.resolve(req.file.path);

    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));

        // 1. Recognize Face
        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, {
            method: 'POST',
            body: form
        });

        if (!pyRes.ok) throw new Error(`Python service error: ${pyRes.status}`);
        const data = await pyRes.json();

        log('INFO', 'Recognition result', data);

        if (data.match === true && data.phone) {
            // 2. Select Image (Stored or Captured)
            const storedImagePath = path.join(FACE_DB, data.name, `${data.name}.jpg`);
            let rawImage = tempFilePath;
            
            if (fs.existsSync(storedImagePath)) {
                rawImage = storedImagePath;
            }

            // 3. Add Background
            const finalImage = await addEventBackground(rawImage);

            // 4. Send Message
            sendWhatsAppPhoto(data.name, data.phone, finalImage); // Don't await to speed up response

            res.json({ status: "matched", name: data.name, phone: data.phone });
        } else {
            res.json({ status: "unknown", message: "Guest not recognized" });
        }

    } catch (err) {
        log('ERROR', 'Process failed', { error: err.message });
        res.status(500).json({ status: "error", message: "Processing failed" });
    } finally {
        // Cleanup temp file
        setTimeout(() => safeDeleteFile(tempFilePath), 5000);
    }
});

// --- ENROLLMENT ROUTE ---
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

app.get("/health", (req, res) => {
    res.json({ status: "ok", whatsapp: clientReady ? "connected" : "disconnected" });
});

const server = app.listen(CONFIG.PORT, () => {
    console.log(`🚀 Node Backend running on ${CONFIG.PORT}`);
});

process.on('SIGINT', () => {
    server.close();
    process.exit(0);
});//