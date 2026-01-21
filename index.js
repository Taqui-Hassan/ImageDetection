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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
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

// --- HELPER: Validate and format phone number ---
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If 10 digits, add country code
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    
    // Must be 12 digits for India (91 + 10 digits)
    if (cleaned.length !== 12) {
        throw new Error(`Invalid phone format: ${phone} (got ${cleaned.length} digits)`);
    }
    
    return cleaned;
}

// --- HELPER: Send WhatsApp with retry logic ---
async function sendWhatsAppMessage(phoneNumber, filePath, name) {
    try {
        // Step 1: Verify number is on WhatsApp
        const numberId = await client.getNumberId(phoneNumber);
        
        if (!numberId) {
            throw new Error(`${phoneNumber} is not registered on WhatsApp`);
        }
        
        console.log(`✅ Number verified: ${phoneNumber} (${numberId._serialized})`);
        
        // Step 2: Send text message first to initialize the chat
        await client.sendMessage(numberId._serialized, `Welcome ${name}! 📸`);
        console.log(`✅ Text message sent`);
        
        // Step 3: Wait for chat to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 4: Send media using base64 (more reliable)
        try {
            const imageBuffer = fs.readFileSync(filePath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = 'image/jpeg'; // or detect from file extension
            
            const media = new MessageMedia(mimeType, base64Image, 'photo.jpg');
            await client.sendMessage(numberId._serialized, media, {
                caption: `Thank you for attending our event!`
            });
            console.log(`✅ Photo sent to ${name} (${phoneNumber})`);
        } catch (mediaError) {
            console.warn(`⚠️ Photo send failed, but text message was sent:`, mediaError.message);
            // Don't throw - text message was successful
        }
        
        return { success: true, phone: phoneNumber };
        
    } catch (error) {
        console.error(`❌ Failed to send to ${phoneNumber}:`, error.message);
        throw error;
    }
}

// --- ROUTES ---

app.get("/guests", (req, res) => {
    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            const guests = Object.keys(meta).map(name => ({ name, phone: meta[name] }));
            res.json(guests);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.json([]);
    }
});

const upload = multer({ dest: UPLOADS_DIR });

app.post("/recognize-guest", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    const filePath = req.file.path;

    try {
        // 1. Check WhatsApp status first
        if (!isWhatsAppReady) {
            return res.status(503).json({ 
                error: "WhatsApp not ready", 
                hint: "Please scan QR code first" 
            });
        }

        // 2. Ask AI "Who is this?"
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
            // 3. Look up phone number locally
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            const rawPhone = meta[data.name];

            if (!rawPhone) {
                console.log(`⚠️ Matched ${data.name}, but no phone in meta.json!`);
                return res.json({ 
                    status: "matched", 
                    name: data.name, 
                    warning: "No phone number found in database" 
                });
            }

            // 4. Format and validate phone
            let formattedPhone;
            try {
                formattedPhone = formatPhoneNumber(rawPhone);
                console.log(`📞 Formatted phone: ${rawPhone} → ${formattedPhone}`);
            } catch (err) {
                console.error(`❌ Invalid phone for ${data.name}:`, err.message);
                return res.json({
                    status: "matched",
                    name: data.name,
                    error: err.message
                });
            }

            // 5. Send WhatsApp message
            try {
                await sendWhatsAppMessage(formattedPhone, filePath, data.name);
                res.json({ 
                    status: "matched", 
                    name: data.name, 
                    phone: formattedPhone,
                    messageSent: true
                });
            } catch (whatsappError) {
                res.json({
                    status: "matched",
                    name: data.name,
                    phone: formattedPhone,
                    messageSent: false,
                    error: whatsappError.message
                });
            }
        } else {
            console.log("❓ Unknown person");
            res.json({ status: "unknown" });
        }
    } catch (err) {
        console.error("💥 Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        // Clean up uploaded file
        try { 
            fs.unlinkSync(filePath); 
            console.log("🗑️ Cleaned up temp file");
        } catch (e) { }
    }
});

app.post("/upload-excel", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error" });
    const tempFilePath = req.file.path;
    try {
        const workbook = xlsx.readFile(tempFilePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        let meta = JSON.parse(fs.readFileSync(META_FILE));
        let enrolled = 0;
        let errors = [];

        for (const row of rows) {
            const name = row.Name?.toString().trim();
            const phone = row.Phone?.toString().trim();

            if (name && phone) {
                try {
                    const cleanPhone = formatPhoneNumber(phone);
                    meta[name] = cleanPhone;
                    enrolled++;
                    console.log(`✅ Enrolled: ${name} → ${cleanPhone}`);
                } catch (err) {
                    errors.push({ name, phone, error: err.message });
                    console.warn(`⚠️ Skipped ${name}: ${err.message}`);
                }
            }
        }

        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        console.log(`📊 Enrolled ${enrolled} guests locally.`);
        
        res.json({ 
            status: "success", 
            enrolled,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error("❌ Excel error:", err);
        res.status(500).json({ status: "error", message: err.message });
    } finally {
        try { fs.unlinkSync(tempFilePath); } catch (e) { }
    }
});

// Test endpoint to check WhatsApp status
app.get("/whatsapp-status", (req, res) => {
    res.json({
        ready: isWhatsAppReady,
        info: isWhatsAppReady ? {
            user: client.info?.wid?.user,
            platform: client.info?.platform
        } : null
    });
});

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 LOCAL BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
    console.log(`📱 WhatsApp Status: ${isWhatsAppReady ? '✅ Ready' : '⏳ Waiting for QR scan...'}`);
});