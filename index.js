import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; 
import axios from "axios"; 
import { fileURLToPath } from "url";
import FormData from 'form-data';
import qrcodeTerminal from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import sharp from 'sharp'; 

// Load environment variables
dotenv.config();

// --- ⚡ FIX: DEFINE DIRECTORIES FIRST ⚡ ---
const { Client, LocalAuth, MessageMedia } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const CONFIG = {
    PORT: process.env.PORT || 8000,
    PYTHON_AI_URL: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5000', 
    PHOTOROOM_API_KEY: process.env.PHOTOROOM_API_KEY, 
    BACKGROUND_IMAGE: path.join(__dirname, "background.png") 
};

// --- DIRECTORIES SETUP ---
const UPLOADS_DIR = path.join(__dirname, "uploads");
const FACE_DB = path.join(__dirname, "face_service", "faces"); 
const AUTH_DIR = path.join(__dirname, ".wwebjs_auth");
const META_FILE = path.join(FACE_DB, "meta.json");
const CONFIG_FILE = path.join(__dirname, "config.json"); 

// Ensure directories exist
[UPLOADS_DIR, FACE_DB].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// --- 🆕 LOAD/SAVE MESSAGE CONFIG ---
let appConfig = {
    captionTemplate: "Dear {name} San\n\n✅ *Access Granted*\n📍 *Seat:* {seat}\n\nEnjoy the day!" 
};

if (fs.existsSync(CONFIG_FILE)) {
    try { appConfig = JSON.parse(fs.readFileSync(CONFIG_FILE)); } catch(e) {}
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
}

// --- STATE ---
let stats = { totalScans: 0, success: 0, failed: 0, lastScanned: "None" };
let isWhatsAppReady = false;
let currentQR = null; 

// --- WHATSAPP SETUP ---
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => { 
    console.log('🔥 QR RECEIVED'); 
    currentQR = qr; 
    qrcodeTerminal.generate(qr, { small: true }); 
});

client.on('ready', () => { 
    isWhatsAppReady = true; 
    currentQR = null; 
    console.log(`✅ WHATSAPP CONNECTED! (${client.info.wid.user})`); 
});

client.on('disconnected', () => { 
    isWhatsAppReady = false; 
    currentQR = null; 
    console.log('⚠️ WhatsApp disconnected');
});

client.initialize();

// --- EXPRESS APP ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
const upload = multer({ dest: UPLOADS_DIR });

// --- HELPERS ---
function formatPhoneNumber(phone) {
    if (!phone) return "";
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length > 10) cleaned = cleaned.slice(-10); // Take last 10 digits
    return '91' + cleaned;
}

// 🔍 NEW HELPER: FIND PERSON BY PHONE
function findPersonKeyByPhone(meta, phoneInput) {
    if (!phoneInput) return null;
    const cleanInput = phoneInput.toString().replace(/\D/g, '').slice(-10);
    
    // 🛑 SAFETY: Ignore empty or default zero phones to prevent "Black Hole" merging
    if (!cleanInput || cleanInput === '0000000000') return null;

    // Check every person in database to see if phone ends with the same last 10 digits
    return Object.keys(meta).find(key => {
        const storedPhone = meta[key].phone ? meta[key].phone.toString().replace(/\D/g, '') : "";
        return storedPhone.endsWith(cleanInput);
    });
}

function getDirectDriveLink(url) {
    if (!url) return null;
    let fileId = null;
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId) fileId = matchId[1];
    else if (matchD) fileId = matchD[1];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w4000`;
    return url;
}

// --- ROUTES ---

app.get("/config", (req, res) => res.json(appConfig));
app.post("/config", (req, res) => {
    if (req.body.captionTemplate) {
        appConfig.captionTemplate = req.body.captionTemplate;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
        console.log("📝 Caption Updated!");
    }
    res.json({ status: "success", config: appConfig });
});

app.get("/monitor", (req, res) => res.send(`<h1>System Online</h1>`));

app.get("/system-status", async (req, res) => {
    let batteryInfo = null;
    try { if (isWhatsAppReady) batteryInfo = await client.info.getBatteryStatus(); } catch (e) {}
    
    res.json({ 
        whatsapp: isWhatsAppReady, 
        qr: currentQR, 
        user: isWhatsAppReady ? client.info.wid.user : null,
        battery: batteryInfo
    });
});

app.get("/guests", (req, res) => {
    try {
        if (fs.existsSync(META_FILE)) {
            const meta = JSON.parse(fs.readFileSync(META_FILE));
            res.json(Object.keys(meta).map(name => ({ name, ...meta[name] })));
        } else { res.json([]); }
    } catch (err) { res.json([]); }
});

// ⚡ STEP 1: SCAN ONLY (FAST) ⚡
app.post("/scan-face", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image" });
    
    const originalPath = req.file.path;
    const tempFileName = `temp_${Date.now()}.jpg`;
    const tempFilePath = path.join(UPLOADS_DIR, tempFileName);
    fs.renameSync(originalPath, tempFilePath);

    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));
        
        const pyRes = await fetch(`${CONFIG.PYTHON_AI_URL}/recognize`, { method: 'POST', body: form });
        const data = await pyRes.json();

        if ((data.status === 'matched' || data.match === true) && data.name) {
            let meta = JSON.parse(fs.readFileSync(META_FILE));
            const aiNameClean = data.name.trim().toLowerCase();
            const foundKey = Object.keys(meta).find(k => k.toLowerCase() === aiNameClean);
            
            if (foundKey) {
                res.json({ 
                    status: "matched", 
                    name: foundKey, 
                    seat: meta[foundKey].seat,
                    tempId: tempFileName 
                });
            } else {
                res.json({ status: "unknown" });
                try { fs.unlinkSync(tempFilePath); } catch(e){} 
            }
        } else {
            res.json({ status: "unknown" });
            try { fs.unlinkSync(tempFilePath); } catch(e){}
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
        try { fs.unlinkSync(tempFilePath); } catch(e){}
    }
});

// ⚡ STEP 2: CONFIRM & PROCESS (BACKGROUND) ⚡
app.post("/confirm-visit", async (req, res) => {
    const { name, tempId } = req.body;
    
    res.json({ status: "queued", message: "Processing in background" });
    console.log(`\n🚀 Starting background process for: ${name}`);
    
    const filePath = path.join(UPLOADS_DIR, tempId);
    if (!fs.existsSync(filePath)) {
        console.error("❌ Temp file missing for background process");
        return;
    }

    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        const guestData = meta[name];
        
        let finalImagePath = filePath; 
        
        if (CONFIG.PHOTOROOM_API_KEY) {
            try {
                console.log("✂️ Sending to Photoroom for Background Removal...");
                const prForm = new FormData();
                prForm.append('image_file', fs.createReadStream(filePath));

                const prRes = await axios.post('https://sdk.photoroom.com/v1/segment', prForm, {
                    headers: { 'x-api-key': CONFIG.PHOTOROOM_API_KEY, ...prForm.getHeaders() },
                    responseType: 'arraybuffer'
                });

                if (fs.existsSync(CONFIG.BACKGROUND_IMAGE)) {
                    console.log("🖼️ Compositing Image with Event Template...");
                    const compositePath = filePath.replace('.jpg', '_final.jpg');
                    const templateMetadata = await sharp(CONFIG.BACKGROUND_IMAGE).metadata();
                    
                    const resizedPerson = await sharp(prRes.data)
                        .resize({ 
                            width: Math.floor(templateMetadata.width * 0.85),
                            height: Math.floor(templateMetadata.height * 0.70),
                            fit: 'inside',
                            background: { r: 0, g: 0, b: 0, alpha: 0 }
                        })
                        .toBuffer();

                    await sharp(CONFIG.BACKGROUND_IMAGE)
                        .composite([{ input: resizedPerson, gravity: 'south' }])
                        .toFile(compositePath);

                    finalImagePath = compositePath;
                    console.log("✅ Custom Souvenir Photo Created!");
                } else {
                    const transPath = filePath.replace('.jpg', '_trans.png');
                    fs.writeFileSync(transPath, prRes.data);
                    finalImagePath = transPath;
                }
            } catch (e) { console.error("⚠️ Background Removal Failed:", e.message); }
        }

        if (guestData) {
            meta[name].entered = true;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

            if (isWhatsAppReady) {
                console.log(`📨 Preparing WhatsApp Message for ${name}...`);
                let caption = appConfig.captionTemplate
                    .replace(/{name}/g, name)
                    .replace(/{seat}/g, guestData.seat);

                const cleanPhone = formatPhoneNumber(guestData.phone);
                const chatId = `${cleanPhone}@c.us`;
                
                try {
                    const media = await MessageMedia.fromFilePath(finalImagePath);
                    await client.sendMessage(chatId, media, { caption });
                    console.log(`✅ WhatsApp Sent to ${name} Successfully!`);
                } catch (e) { console.error("❌ WhatsApp Failed:", e.message); }
            } else {
                console.log("⚠️ WhatsApp is NOT connected. Skipping message.");
            }
        }
        
    } catch (err) {
        console.error("❌ Background Process Error:", err);
    } finally {
        setTimeout(() => {
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                const finalPath = filePath.replace('.jpg', '_final.jpg');
                if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
            } catch(e){}
        }, 15000);
    }
});

// ⚡ 5. SIMPLE EXCEL UPLOAD (SEAT UPDATER) - FIXED NAME COLLISION ⚡
app.post("/upload-excel", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error" });
    const tempFilePath = req.file.path;
    try {
        const workbook = xlsx.readFile(tempFilePath);
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        let enrolled = 0;
        let updated = 0;

        console.log(`\n📄 Importing Guest/Seat List... Found ${rows.length} rows.`);

        for (const row of rows) {
            let name = row.Name?.toString().trim();
            // 🛡️ Try multiple column names for phone
            const phoneRaw = (row.Phone || row.Mobile || row.Contact || "0000000000").toString().trim(); 
            const seat = row.Seat || row["Seat Number"] || "Please Contact Manual Desk";
            const imageURL = getDirectDriveLink(row.ImageURL || row.imageurl || ""); 

            if (name && phoneRaw.length > 5 && phoneRaw !== "0000000000") {
                // 1. Check if phone exists (First priority)
                const existingKey = findPersonKeyByPhone(meta, phoneRaw);

                if (existingKey) {
                    // ✅ UPDATE: Phone matched, update the existing person
                    console.log(`🔄 Matched Phone: "${phoneRaw}" -> Updating "${existingKey}" (Seat: ${seat})`);
                    meta[existingKey].seat = seat.toString();
                    meta[existingKey].phone = formatPhoneNumber(phoneRaw);
                    if(imageURL) meta[existingKey].imageURL = imageURL;
                    updated++;
                } else {
                    // 🆕 NEW PHONE: But wait, does the NAME already exist?
                    if (meta[name]) {
                        // ⚠️ NAME COLLISION! 
                        // "Sumit" exists, but phone is different.
                        // Rename new guy to "Sumit (Last4Digits)"
                        const suffix = phoneRaw.slice(-4);
                        const newName = `${name} (${suffix})`;
                        console.log(`⚠️ Name Collision: "${name}" exists. Renaming new entry to "${newName}"`);
                        name = newName; 
                    }

                    // Create New Entry
                    console.log(`🆕 Creating: "${name}" with Seat ${seat}.`);
                    meta[name] = { 
                        phone: formatPhoneNumber(phoneRaw), 
                        seat: seat.toString(),
                        imageURL: imageURL, 
                        entered: false 
                    };
                    enrolled++;
                }
            } else {
                 if (name && phoneRaw === "0000000000") {
                     console.log(`⚠️ Skipping "${name}" - No valid Phone Number.`);
                 }
            }
        }
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
        console.log(`✅ Import Complete. New: ${enrolled} | Updated: ${updated}`);
        res.json({ status: "success", enrolled, updated });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    } finally { try { fs.unlinkSync(tempFilePath); } catch (e) { } }
});

// 6. BULK SENDER (UNCHANGED)
app.post("/send-bulk", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error" });
    const excelPath = req.file.path;
    const messageTemplate = req.body.message || "Hello {name}, welcome! Your seat is {seat}.";

    try {
        const workbook = xlsx.readFile(excelPath);
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let successCount = 0; let failCount = 0;

        console.log(`\n📢 Starting Bulk Broadcast to ${rows.length} numbers...`);

        for (const row of rows) {
            const name = row.Name || row.name;
            const phone = (row.Phone || row.phone || "").toString().trim();
            const seat = row.Seat || row.seat || "Please Contact Manual Desk";
            const imageUrl = getDirectDriveLink(row.ImageURL || row.imageurl || row["Image Link"]);

            if (name && phone.length > 5) {
                const chatId = `${formatPhoneNumber(phone)}@c.us`;
                const finalMessage = messageTemplate.replace("{name}", name).replace("{seat}", seat);
                
                if (isWhatsAppReady) {
                    try {
                        let media = null;
                        if (imageUrl) media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
                        media ? await client.sendMessage(chatId, media, { caption: finalMessage }) 
                              : await client.sendMessage(chatId, finalMessage);
                        successCount++;
                        console.log(`✅ Bulk msg sent to ${name}`);
                        await new Promise(r => setTimeout(r, 4000)); 
                    } catch (e) { 
                        failCount++; 
                        console.log(`❌ Failed bulk msg for ${name}`);
                    }
                }
            }
        }
        console.log(`🏁 Bulk broadcast complete. Sent: ${successCount}, Failed: ${failCount}`);
        res.json({ status: "success", sent: successCount, failed: failCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        try { fs.unlinkSync(excelPath); } catch (e) {}
    }
});

// 7. ADMIN TOOL: AUTO-ENROLLMENT (PHONE BASED PHOTO DOWNLOADER) ⚡ MODIFIED
app.post("/admin/enroll-guests", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: "error", message: "No file" });
    const tempFilePath = req.file.path;
    res.json({ status: "started", message: "Processing started." });

    try {
        const workbook = xlsx.readFile(tempFilePath);
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        
        console.log(`\n=================================================`);
        console.log(`🚀 ADMIN ENROLLMENT (Phone-Based) STARTING...`);
        console.log(`=================================================`);
        
        let downloaded = 0;
        let skipped = 0;

        (async () => {
            for (const row of rows) {
                let name = row.Name?.toString().trim();
                const phoneRaw = (row.Phone || "0000000000").toString().trim(); 
                const imageUrl = getDirectDriveLink(row.ImageURL || "");

                // 🛡️ Strict Check: Ignore if no phone number
                if (name && imageUrl && phoneRaw.length > 5 && phoneRaw !== "0000000000") {
                    let finalName = name;
                    const existingKey = findPersonKeyByPhone(meta, phoneRaw);

                    if (existingKey) {
                        console.log(`🔄 Found existing user by phone: "${existingKey}". Using this folder to store photo.`);
                        finalName = existingKey; // Use the OLD name to keep folder consistent
                    } else {
                        // 🆕 NEW USER: Check for Name Collision
                        if (meta[name]) {
                             const suffix = phoneRaw.slice(-4);
                             finalName = `${name} (${suffix})`;
                             console.log(`⚠️ Name Collision: "${name}" exists. Creating "${finalName}"`);
                        } else {
                            console.log(`🆕 New user detected: "${name}"`);
                        }
                    }

                    const userFolder = path.join(FACE_DB, finalName);
                    if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
                    const imagePath = path.join(userFolder, "1.jpg");

                    if (!fs.existsSync(imagePath)) {
                        try {
                            console.log(`📥 Downloading photo for: ${finalName}...`);
                            const response = await axios({ url: imageUrl, method: 'GET', responseType: 'stream' });
                            const writer = fs.createWriteStream(imagePath);
                            response.data.pipe(writer);
                            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
                            
                            console.log(`✅ Saved photo for: ${finalName}`);
                            downloaded++;
                        } catch (e) { 
                            console.log(`❌ Failed to download photo for ${finalName}: ${e.message}`); 
                        }
                    } else {
                        console.log(`⏭️ Skipped ${finalName} (Photo already exists)`);
                        skipped++;
                    }
                    
                    // Update Meta info (Merge)
                    if (!meta[finalName]) meta[finalName] = { entered: false, seat: "Please Contact Manual Desk" };
                    meta[finalName].phone = formatPhoneNumber(phoneRaw);
                    meta[finalName].imageURL = imageUrl;
                    if(row.Seat) meta[finalName].seat = row.Seat;
                }
            }
            
            // Save the meta file after the loop finishes
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            console.log(`\n🏁 Enrollment Complete!`);
            console.log(`📊 Total Downloaded: ${downloaded} | Total Skipped: ${skipped}`);
            console.log(`=================================================\n`);
            
        })();
    } catch (err) { 
        console.error("❌ Enrollment System Error:", err); 
    } finally { 
        try { fs.unlinkSync(tempFilePath); } catch(e){} 
    }
});

// Toggle
app.put("/guests/:name/toggle", (req, res) => {
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        const key = Object.keys(meta).find(k => k.toLowerCase() === req.params.name.toLowerCase());
        if (key) {
            meta[key].entered = !meta[key].entered;
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            res.json({ status: "success" });
        } else res.status(404).json({ error: "Not found" });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

// Delete
app.delete("/guests/:name", (req, res) => {
    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        const key = Object.keys(meta).find(k => k.toLowerCase() === req.params.name.toLowerCase());
        if (key) {
            delete meta[key];
            fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
            const folder = path.join(FACE_DB, key);
            if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
            res.json({ status: "success" });
        } else res.status(404).json({ error: "Not found" });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

// ⚡ STEP 1.5: MANUAL PHONE ENTRY (FAIL-SAFE) ⚡
app.post("/manual-entry", upload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Camera failed" });
    
    const inputPhone = req.body.phone?.replace(/\D/g, '').slice(-10);
    if (!inputPhone) return res.status(400).json({ error: "No phone provided" });

    const originalPath = req.file.path;
    const tempFileName = `temp_manual_${Date.now()}.jpg`;
    const tempFilePath = path.join(UPLOADS_DIR, tempFileName);
    fs.renameSync(originalPath, tempFilePath);

    try {
        let meta = JSON.parse(fs.readFileSync(META_FILE));
        
        // Find by phone
        const foundKey = findPersonKeyByPhone(meta, inputPhone);

        if (foundKey) {
            res.json({ 
                status: "matched", 
                name: foundKey, 
                seat: meta[foundKey].seat,
                tempId: tempFileName 
            });
        } else {
            res.json({ status: "unknown" });
            try { fs.unlinkSync(tempFilePath); } catch(e){} 
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
        try { fs.unlinkSync(tempFilePath); } catch(e){} 
    }
});

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 BACKEND RUNNING ON http://localhost:${CONFIG.PORT}`);
});