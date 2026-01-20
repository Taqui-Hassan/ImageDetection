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
    // If PYTHON_URL is not set, default to localhost for testing
    PYTHON_SERVICE_URL: process.env.PYTHON_URL || 'http://localhost:5000', 
    BG_SERVICE_URL: process.env.BG_URL || 'http://localhost:5000',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    REQUEST_TIMEOUT: 30000, // 30 seconds
    DEFAULT_COUNTRY_CODE: '91',
    MAX_CONCURRENT_REQUESTS: 3
};

// --- DIRECTORY SETUP ---
const UPLOADS_DIR = path.resolve(__dirname, "uploads");
const FACE_DB = path.resolve(__dirname, "face_service", "faces");
const META_FILE = path.join(FACE_DB, "meta.json");
const SAFE_AUTH_PATH = path.join(os.homedir(), '.wwebjs_auth_safe');
const LOG_FILE = path.join(__dirname, 'app.log');

console.log(`📂 Auth Storage: ${SAFE_AUTH_PATH}`);

// Create directories
[UPLOADS_DIR, FACE_DB].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// --- LOGGING UTILITY ---
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(LOG_FILE, logEntry);
}

// --- FILE CLEANUP UTILITY ---
async function safeDeleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            await promisify(fs.unlink)(filePath);
            log('INFO', 'File deleted', { path: filePath });
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
    if (cleaned.length < 10 || cleaned.length > 15) {
        log('WARN', 'Invalid phone number length', { original: phone, cleaned });
        return null;
    }
    return cleaned;
}

// --- WHATSAPP CLIENT SETUP ---
let clientReady = false;
let clientInitializing = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const client = new Client({
    authStrategy: new LocalAuth({ 
        dataPath: SAFE_AUTH_PATH, 
        restartOnAuthFail: true 
    }),
    puppeteer: { 
        headless: true,
       
        executablePath: process.platform === 'win32' 
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
            : undefined, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', // <--- This one is crucial for images
            '--no-first-run',
            '--no-zygote',
            '--single-process' // <--- This prevents the RAM crash
        ] 
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

async function attemptReconnect() {
    clearReconnectTimer();
    if (clientInitializing || clientReady) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        log('ERROR', 'Max reconnect attempts reached.');
        return;
    }
    reconnectAttempts++;
    clientInitializing = true;
    log('INFO', `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    try {
        await client.destroy().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));
        await client.initialize();
    } catch (err) {
        log('ERROR', 'Reconnect failed', { error: err.message });
        clientInitializing = false;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        reconnectTimer = setTimeout(attemptReconnect, delay);
    }
}

// Event Handlers
client.on('qr', qr => {
    log('INFO', 'QR Code generated');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    clientReady = true;
    clientInitializing = false;
    reconnectAttempts = 0;
    clearReconnectTimer();
    log('INFO', `WhatsApp connected as ${client.info.wid.user}`);
    console.log(`🔥 CONNECTED as ${client.info.wid.user}`);
});

client.on('authenticated', () => log('INFO', 'WhatsApp authenticated'));

client.on('auth_failure', (msg) => {
    log('ERROR', 'WhatsApp auth failure', { message: msg });
    clientReady = false;
    clientInitializing = false;
});

client.on('disconnected', (reason) => {
    log('WARN', 'WhatsApp disconnected', { reason });
    clientReady = false;
    clientInitializing = false;
    if (reason !== 'LOGOUT') {
        log('INFO', 'Scheduling reconnection...');
        clearReconnectTimer();
        reconnectTimer = setTimeout(attemptReconnect, 5000);
    }
});

client.on('loading_screen', async () => {
    try {
        await client.pupPage.evaluate(() => {
            if (window.WWebJS) {
                window.injectToFunction({ module: 'WAWebLid1X1MigrationGating', function: 'Lid1X1MigrationUtils.isLidMigrated' }, () => false);
            }
        });
    } catch(e) {}
});

log('INFO', 'Initializing WhatsApp client...');
clientInitializing = true;
client.initialize().catch(err => {
    log('ERROR', 'Client initialization failed', { error: err.message });
    clientInitializing = false;
});

// --- PROCESSING QUEUE ---
class ProcessingQueue {
    constructor(maxConcurrent = 3) {
        this.queue = [];
        this.processing = 0;
        this.maxConcurrent = maxConcurrent;
    }
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }
    async process() {
        if (this.processing >= this.maxConcurrent || this.queue.length === 0) return;
        this.processing++;
        const { task, resolve, reject } = this.queue.shift();
        try {
            const result = await task();
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.processing--;
            this.process();
        }
    }
}
const processingQueue = new ProcessingQueue(CONFIG.MAX_CONCURRENT_REQUESTS);

// --- NEW: BACKGROUND REMOVAL HELPER ---
async function addEventBackground(inputPath) {
    // Generates a temp path for the result (e.g. image_branded.jpg)
    const processedPath = inputPath.replace('.jpg', '_branded.jpg').replace('.png', '_branded.jpg');
    
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
        
        log('INFO', 'Background added successfully', { path: processedPath });
        return processedPath; // Success: Return new path

    } catch (err) {
        log('ERROR', 'Background processing failed, using original', { error: err.message });
        return inputPath; // Fail Safe: Return original path if Python fails
    }
}

// --- SEND WHATSAPP PHOTO ---
async function sendWhatsAppPhoto(name, phone, imagePath) {
    let waitTime = 0;
    while (!clientReady && waitTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitTime += 500;
    }
    
    if (!clientReady) {
        log('ERROR', 'WhatsApp not ready after 30s', { name, phone });
        return false;
    }
    
    try {
        const sanitized = sanitizePhoneNumber(phone);
        if (!sanitized) {
            log('ERROR', 'Invalid phone number', { name, phone });
            return false;
        }
        
        const targetId = `${sanitized}@c.us`;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const numberInfo = await client.getNumberId(targetId);
        if (!numberInfo) {
            log('WARN', 'Number not on WhatsApp', { name, phone: sanitized });
            return false;
        }
        
        const fileData = fs.readFileSync(imagePath, { encoding: 'base64' });
        const media = new MessageMedia('image/jpeg', fileData, `${name}.jpg`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await client.sendMessage(numberInfo._serialized, media, {
            caption: `Welcome, ${name}! 📸\n\nHere is your event souvenir!`,
            sendSeen: false
        });
        
        log('INFO', 'Photo sent successfully', { name, phone: sanitized });
        return true;
        
    } catch (err) {
        log('ERROR', 'WhatsApp send failed', { name, phone, error: err.message });
        return false;
    }
}

// --- PROCESS RECOGNITION (INTEGRATED) ---
async function processRecognition(tempFilePath) {
    const form = new FormData();
    form.append('image', fs.createReadStream(tempFilePath));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    
    try {
        // 1. Recognize Face
        const pyRes = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/recognize`, { 
            method: 'POST', 
            body: form,
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!pyRes.ok) throw new Error(`Python service returned ${pyRes.status}`);
        
        const data = await pyRes.json();
        log('INFO', 'Recognition result', { match: data.match, name: data.name });

        if (data.match === true && data.phone) {
            // 2. Select Image Source (Stored vs Captured)
            const storedImagePath = path.join(FACE_DB, data.name, `${data.name}.jpg`);
            let rawImage = tempFilePath;
            
            if (fs.existsSync(storedImagePath)) {
                log('INFO', 'Found stored HD image', { path: storedImagePath });
                rawImage = storedImagePath;
            } else {
                log('WARN', 'Stored image missing, using capture');
            }

            // 3. Add Background (The New Step)
            const finalImage = await addEventBackground(rawImage);

            // 4. Send Result
            await sendWhatsAppPhoto(data.name, data.phone, finalImage);

            // 5. Cleanup Temporary Branded Image
            if (finalImage !== rawImage) {
                await safeDeleteFile(finalImage);
            }

            return { status: "matched", name: data.name, phone: data.phone };
        }
        
        return { status: "unknown", message: "Guest not recognized" };
        
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('Recognition timeout');
        throw err;
    } finally {
        clearTimeout(timeout);
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
        const result = await processingQueue.add(async () => {
            return await processRecognition(tempFilePath);
        });
        res.json(result);
    } catch (err) {
        log('ERROR', 'Recognition failed', { error: err.message });
        res.status(500).json({ status: "error", message: "Recognition failed" });
    } finally {
        await safeDeleteFile(tempFilePath);
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
                
                const response = await fetch(imageURL, { timeout: 10000 });
                if (!response.ok) { failed++; continue; }
                
                const buffer = await response.arrayBuffer();
                const imagePath = path.join(personDir, `${name}.jpg`);
                fs.writeFileSync(imagePath, Buffer.from(buffer));
                
                meta[name] = sanitized;
                enrolled++;
                log('INFO', 'Guest enrolled', { name });
            } catch (err) {
                failed++;
            }
        }
        
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        res.json({ status: "success", enrolled, failed, total: rows.length });
        
    } catch (err) {
        log('ERROR', 'Excel processing failed', { error: err.message });
        res.status(500).json({ status: "error", message: "Failed to process Excel file" });
    } finally {
        await safeDeleteFile(tempFilePath);
    }
});

app.get("/guests", (req, res) => {
    try {
        const meta = JSON.parse(fs.readFileSync(META_FILE));
        const guests = Object.keys(meta).map(name => ({ name, phone: meta[name] }));
        res.json({ status: "success", guests, count: guests.length });
    } catch (err) {
        res.status(500).json({ status: "error", message: "Failed to retrieve guests" });
    }
});

app.get("/health", (req, res) => {
    res.json({ 
        status: "ok",
        whatsapp: clientReady ? "connected" : "disconnected",
        queue: processingQueue.processing,
        uptime: process.uptime()
    });
});

app.use((err, req, res, next) => {
    log('ERROR', 'Unhandled error', { error: err.message });
    res.status(500).json({ status: "error", message: "Internal server error" });
});

const server = app.listen(CONFIG.PORT, () => {
    log('INFO', `Server started on port ${CONFIG.PORT}`);
    console.log(`🚀 Node Backend running on ${CONFIG.PORT}`);
});

const shutdown = async () => {
    server.close();
    try { await client.destroy(); } catch (err) {}
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);