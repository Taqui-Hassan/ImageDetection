//OWN REMOVER

// const { createCanvas, loadImage } = require('canvas');
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// const fetch = require('node-fetch');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());
// // Add this to parse JSON request bodies
// app.use(express.json());


// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client setup
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: { headless: true }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// const delay = ms => new Promise(res => setTimeout(res, ms));

// // =================================================================
// // UPDATED FUNCTION TO USE YOUR LOCAL PYTHON API
// // =================================================================
// async function removeBg(imageUrl) {
//   try {
//     console.log('Starting background removal using local API for:', imageUrl);
    
//     // Call your own Python Flask API running on localhost
//     const response = await fetch("http://localhost:5000/remove", {
//       method: "POST",
//       headers: { 
//         'Content-Type': 'application/json'
//       },
//       // Send the image URL in the request body as JSON
//       body: JSON.stringify({ imageUrl: imageUrl }),
//     });

//     console.log('Local API response status:', response.status);

//     if (response.ok) {
//       const resultBuffer = await response.buffer();
//       console.log('Local background removal successful, result size:', resultBuffer.length, 'bytes');
//       return resultBuffer;
//     } else {
//       const errorText = await response.text();
//       console.error('Local API Error:', response.status, errorText);
//       throw new Error(`Local API Error ${response.status}: ${errorText}`);
//     }
//   } catch (error) {
//     console.error('Local background removal failed:', error.message);
//     // This could happen if the Python server is not running
//     if (error.code === 'ECONNREFUSED') {
//         throw new Error('Connection to local background removal API failed. Is the Python server running?');
//     }
//     throw error;
//   }
// }

// // API endpoint to upload Excel and send messages
// app.post('/send-whatsapp', upload.single('file'), async (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Scan QR and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
//   // The checkbox on the frontend will determine if this is true or false
//   const removeBgEnabled = true;

//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     console.log(`Processing ${rows.length} contacts. Background removal: ${removeBgEnabled ? 'Enabled' : 'Disabled'}`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row.Mobile) {
//         console.log(`Skipping row ${i + 1}: No Number`);
//         continue;
//       }

//       const phoneRaw = `91${row.Mobile.toString().replace(/\D/g, '')}`;
//       const number = phoneRaw.endsWith('@c.us') ? phoneRaw : `${phoneRaw}@c.us`;
//       const name = row.Name || row.name || '';
//       const message = row.Message || `Dear ${name} San ,                                  Thank you for your presence!                              Team Market Quality`;
//       const imageUrl = row.ImageURL || row.ImageUrl || row.imageurl || '';

//       console.log(`Processing row ${i + 1}: ${name}, ${row.Mobile}, Background removal: ${removeBgEnabled}`);

//       const canvas = createCanvas(1080, 1080);
//       const ctx = canvas.getContext('2d');

//       const background = await loadImage(path.join(__dirname, 'bg.png'));
//       ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

//       try {
//         if (imageUrl) {
//           let personImage;

//           if (removeBgEnabled) {
//             console.log(`Removing background for ${name}...`);
//             try {
//               // This now calls your local API
//               const noBgImageData = await removeBg(imageUrl);
//               personImage = await loadImage(noBgImageData); // loadImage can handle buffers directly
//               console.log(`Background removed successfully for ${name}`);
//             } catch (bgError)
//             {
//               console.warn(`Background removal failed for ${name}, using original image:`, bgError.message);
//               personImage = await loadImage(imageUrl);
//             }
//           } else {
//             personImage = await loadImage(imageUrl);
//           }

//           // Positioning logic remains the same
//           const imageStartY = 200; // Adjusted position
//           const imageEndY = canvas.height - 20;
//           const availableHeight = imageEndY - imageStartY;
//           const availableWidth = canvas.width - 40;

//           const scale = Math.min(availableWidth / personImage.width, availableHeight / personImage.height);
//           const newWidth = personImage.width * scale;
//           const newHeight = personImage.height * scale;
//           const x = (canvas.width - newWidth) / 2;
//           const y = imageStartY + (availableHeight - newHeight) / 2;
          
//           ctx.drawImage(personImage, x, y, newWidth, newHeight);
//           console.log(`Image positioned: ${newWidth}x${newHeight} at (${x}, ${y})`);
//         }

//         const buffer = canvas.toBuffer('image/png');
//         const media = new MessageMedia('image/png', buffer.toString('base64'));

//         await client.sendMessage(number, media, { caption: message });
//         console.log(`Sent personalized card to ${row.Mobile}`);

//       } catch (err) {
//         console.error(`Error processing/sending to ${row.Mobile}:`, err.message);
//       }

//       await delay(5000); // Increased delay for safety
//     }

//     fs.unlinkSync(filePath);
//     res.json({
//       status: 'Messages sent (or attempted) to all numbers in Excel.',
//       processedCount: rows.length,
//       backgroundRemoval: removeBgEnabled
//     });

//   } catch (error) {
//     if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//     }
//     console.error('Error processing file:', error.message);
//     res.status(500).json({ error: 'Failed to process file.', details: error.message });
//   }
// });


// // Test endpoint for your local background remover
// app.post('/test-remove-bg', async (req, res) => {
//   const { imageUrl } = req.body;

//   if (!imageUrl) {
//     return res.status(400).json({ error: 'imageUrl is required' });
//   }

//   try {
//     const noBgImageData = await removeBg(imageUrl);
//     const base64Image = Buffer.from(noBgImageData).toString('base64');
//     res.json({
//       status: 'Background removed successfully using local API',
//       image: `data:image/png;base64,${base64Image}`
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to remove background with local API', details: error.message });
//   }
// });


// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'Server is running',
//     whatsapp: client.info ? 'Connected' : 'Not connected',
//   });
// });

// // Final catch-all for client-side routing
// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
//   console.log('Using LOCAL background removal API.');
// });



// FINAL 


// const { createCanvas, loadImage } = require('canvas');
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// const fetch = require('node-fetch');
// const FormData = require('form-data'); // Fixed: Added FormData import
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || 'INSERT_YOUR_API_KEY_HERE';
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client without session
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: { headless: true }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// const delay = ms => new Promise(res => setTimeout(res, ms));

// // Fixed Function to remove background using remove.bg API
// async function removeBg(imageUrl) {
//   try {
//     console.log('Starting background removal for image:', imageUrl);
    
//     // First, fetch the image from the URL
//     const imageResponse = await fetch(imageUrl);
//     if (!imageResponse.ok) {
//       throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
//     }

//     const imageBuffer = await imageResponse.buffer();
//     console.log('Image fetched successfully, size:', imageBuffer.length, 'bytes');

//     // Use form-data package instead of browser FormData
//     const formData = new FormData();
//     formData.append("size", "auto");
//     formData.append("image_file", imageBuffer, {
//       filename: 'image.jpg',
//       contentType: 'image/jpeg'
//     });

//     console.log('Sending request to Remove.bg API...');
//     const response = await fetch("https://api.remove.bg/v1.0/removebg", {
//       method: "POST",
//       headers: { 
//         "X-Api-Key": REMOVE_BG_API_KEY,
//         ...formData.getHeaders() // This is crucial for proper content-type
//       },
//       body: formData,
//     });

//     console.log('Remove.bg API response status:', response.status);

//     if (response.ok) {
//       const resultBuffer = await response.buffer();
//       console.log('Background removal successful, result size:', resultBuffer.length, 'bytes');
//       return resultBuffer;
//     } else {
//       const errorText = await response.text();
//       console.error('Remove.bg API Error:', response.status, errorText);
//       throw new Error(`Remove.bg API Error ${response.status}: ${errorText}`);
//     }
//   } catch (error) {
//     console.error('Background removal failed:', error.message);
//     throw error;
//   }
// }

// // API endpoint to upload Excel and send messages
// app.post('/send-whatsapp', upload.single('file'), async (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Scan QR and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
//   const removeBgEnabled = true; // Option to enable/disable background removal

//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     console.log(`Processing ${rows.length} contacts. Background removal: ${removeBgEnabled ? 'Enabled' : 'Disabled'}`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row.Mobile) {
//         console.log(`Skipping row ${i + 1}: No Number`);
//         continue;
//       }

//       const phoneRaw = `91${row.Mobile.toString().replace(/\D/g, '')}`;
//       const number = phoneRaw.endsWith('@c.us') ? phoneRaw : `${phoneRaw}@c.us`;
//       const name = row.Name || row.name || '';
//       const message = row.Message || `Dear ${name} San ,                                           Thank you for your Presence                                Team MQVC 2  `;
//       const imageUrl = row.ImageURL || row.ImageUrl || row.imageurl || '';

//       console.log(`Processing row ${i + 1}: ${name}, ${row.Mobile}, Background removal: ${removeBgEnabled}`);

//       // Create canvas and load background
//       const canvas = createCanvas(1080, 1080); // square Instagram-like card
//       const ctx = canvas.getContext('2d');

//       // Load background image (your template)
//       const background = await loadImage(path.join(__dirname, 'bg.png'));
//       ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

//       try {
//         // Load and draw person image taking all available space after header
//         if (imageUrl) {
//           let personImage;

//           if (removeBgEnabled && REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE') {
//             console.log(`Removing background for ${name}...`);
//             try {
//               // Remove background using remove.bg API
//               const noBgImageData = await removeBg(imageUrl);
//               const noBgBuffer = Buffer.from(noBgImageData);

//               // Create image from processed buffer
//               personImage = await loadImage(noBgBuffer);
//               console.log(`Background removed successfully for ${name}`);
//             } catch (bgError) {
//               console.warn(`Background removal failed for ${name}, using original image:`, bgError.message);
//               // Fallback to original image if background removal fails
//               personImage = await loadImage(imageUrl);
//             }
//           } else {
//             // Use original image without background removal
//             personImage = await loadImage(imageUrl);
//           }

//           // Calculate dimensions for image taking all space after header
//           const imageStartY = 200; // Start below the background header
//           const imageEndY = canvas.height - 20; // Use almost all space to bottom
//           const availableHeight = imageEndY - imageStartY;
//           const availableWidth = canvas.width - 40; // Leave 20px margin on each side

//           // Scale to fit available space while maintaining aspect ratio
//           const scaleX = availableWidth / personImage.width;
//           const scaleY = availableHeight / personImage.height;
//           const scale = Math.min(scaleX, scaleY); // THIS LINE MAINTAINS ASPECT RATIO - Change to Math.max to fill space or use scaleX for width-only scaling

//           const newWidth = personImage.width * scale;
//           const newHeight = personImage.height * scale;

//           // Center the image horizontally and vertically
//           const x = (canvas.width - newWidth) / 2;
//           const y = imageStartY + (availableHeight - newHeight) / 2;

//           // Draw image with rounded corners
//           ctx.save();
//           const radius = 20; // Corner radius
//           ctx.beginPath();
//           ctx.roundRect(x, y, newWidth, newHeight, radius);
//           ctx.closePath();
//           ctx.clip();
//           ctx.drawImage(personImage, x, y, newWidth, newHeight);
//           ctx.restore();

//           // Border removed as requested

//           console.log(`Image positioned: ${newWidth}x${newHeight} at (${x}, ${y})`);
//         }

//         // Export as buffer and send via WhatsApp
//         const buffer = canvas.toBuffer('image/png');
//         const media = new MessageMedia('image/png', buffer.toString('base64'));

//         await client.sendMessage(number, media, { caption: message });
//         console.log(`Sent personalized card to ${row.Mobile}`);

//       } catch (err) {
//         console.error(`Error processing/sending to ${row.Mobile}:`, err.message);
//       }

//       // Delay between messages to avoid rate limiting
//       await delay(2000);
//     }

//     fs.unlinkSync(filePath);
//     res.json({
//       status: 'Messages sent (or attempted) to all numbers in Excel.',
//       processedCount: rows.length,
//       backgroundRemoval: removeBgEnabled
//     });

//   } catch (error) {
//     fs.unlinkSync(filePath);
//     console.error('Error processing file:', error.message);
//     res.status(500).json({ error: 'Failed to process file.', details: error.message });
//   }
// });

// // Updated endpoint to test background removal
// app.post('/test-remove-bg', async (req, res) => {
//   const { imageUrl } = req.body;

//   if (!imageUrl) {
//     return res.status(400).json({ error: 'imageUrl is required' });
//   }

//   if (REMOVE_BG_API_KEY === 'INSERT_YOUR_API_KEY_HERE') {
//     return res.status(400).json({ error: 'Please set your Remove.bg API key in environment variables' });
//   }

//   try {
//     const noBgImageData = await removeBg(imageUrl);
//     const base64Image = Buffer.from(noBgImageData).toString('base64');
//     res.json({
//       status: 'Background removed successfully',
//       image: `data:image/png;base64,${base64Image}`
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to remove background', details: error.message });
//   }
// });

// // Debug endpoint to test Remove.bg API
// app.get('/debug-removebg', async (req, res) => {
//   console.log('Debug endpoint called');
  
//   try {
//     console.log('Environment variables check:');
//     console.log('REMOVE_BG_API_KEY exists:', !!REMOVE_BG_API_KEY);
//     console.log('API Key length:', REMOVE_BG_API_KEY ? REMOVE_BG_API_KEY.length : 0);
//     console.log('API Key preview:', REMOVE_BG_API_KEY ? REMOVE_BG_API_KEY.substring(0, 10) + '...' : 'NOT SET');
    
//     if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'INSERT_YOUR_API_KEY_HERE') {
//       return res.json({
//         status: 'error',
//         message: 'Remove.bg API key not set or invalid'
//       });
//     }
    
//     // Test API key validity with account endpoint
//     console.log('Testing API key...');
//     const testResponse = await fetch("https://api.remove.bg/v1.0/account", {
//       headers: { "X-Api-Key": REMOVE_BG_API_KEY }
//     });
    
//     console.log('Account API response status:', testResponse.status);
    
//     if (testResponse.ok) {
//       const accountInfo = await testResponse.json();
//       console.log('Account info:', accountInfo);
      
//       // Test actual background removal
//       console.log('Testing background removal...');
//       try {
//         const testImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300';
//         const noBgImageData = await removeBg(testImageUrl);
        
//         res.json({
//           status: 'success',
//           message: 'API Key is valid and background removal works',
//           account: accountInfo,
//           testResult: {
//             imageProcessed: true,
//             resultSize: noBgImageData.length + ' bytes'
//           }
//         });
//       } catch (bgError) {
//         res.json({
//           status: 'partial_success',
//           message: 'API Key is valid but background removal failed',
//           account: accountInfo,
//           bgError: bgError.message
//         });
//       }
//     } else {
//       const errorText = await testResponse.text();
//       console.log('Account API error:', errorText);
//       res.json({
//         status: 'error',
//         message: 'API Key is invalid',
//         details: errorText
//       });
//     }
//   } catch (error) {
//     console.error('Debug endpoint error:', error);
//     res.status(500).json({
//       status: 'error',
//       message: 'Error testing API key',
//       error: error.message
//     });
//   }
// });

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'Server is running',
//     whatsapp: client.info ? 'Connected' : 'Not connected',
//     removeBgEnabled: REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE'
//   });
// });

// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
//   console.log(`Remove.bg API: ${REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE' ? 'Configured' : 'Not configured'}`);
// });


// --------------------------------------------------------------------------------------------------------------------------------------------------------------


// NEAR FINAL CODE

// const { createCanvas, loadImage } = require('canvas');
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// const fetch = require('node-fetch');
// const FormData = require('form-data'); // Fixed: Added FormData import
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || 'INSERT_YOUR_API_KEY_HERE';
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client without session
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: { headless: true }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// const delay = ms => new Promise(res => setTimeout(res, ms));

// // Fixed Function to remove background using remove.bg API
// async function removeBg(imageUrl) {
//   try {
//     console.log('Starting background removal for image:', imageUrl);
    
//     // First, fetch the image from the URL
//     const imageResponse = await fetch(imageUrl);
//     if (!imageResponse.ok) {
//       throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
//     }

//     const imageBuffer = await imageResponse.buffer();
//     console.log('Image fetched successfully, size:', imageBuffer.length, 'bytes');

//     // Use form-data package instead of browser FormData
//     const formData = new FormData();
//     formData.append("size", "auto");
//     formData.append("image_file", imageBuffer, {
//       filename: 'image.jpg',
//       contentType: 'image/jpeg'
//     });

//     console.log('Sending request to Remove.bg API...');
//     const response = await fetch("https://api.remove.bg/v1.0/removebg", {
//       method: "POST",
//       headers: { 
//         "X-Api-Key": REMOVE_BG_API_KEY,
//         ...formData.getHeaders() // This is crucial for proper content-type
//       },
//       body: formData,
//     });

//     console.log('Remove.bg API response status:', response.status);

//     if (response.ok) {
//       const resultBuffer = await response.buffer();
//       console.log('Background removal successful, result size:', resultBuffer.length, 'bytes');
//       return resultBuffer;
//     } else {
//       const errorText = await response.text();
//       console.error('Remove.bg API Error:', response.status, errorText);
//       throw new Error(`Remove.bg API Error ${response.status}: ${errorText}`);
//     }
//   } catch (error) {
//     console.error('Background removal failed:', error.message);
//     throw error;
//   }
// }

// // API endpoint to upload Excel and send messages
// app.post('/send-whatsapp', upload.single('file'), async (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Scan QR and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
//   const removeBgEnabled = true; // Option to enable/disable background removal

//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     console.log(`Processing ${rows.length} contacts. Background removal: ${removeBgEnabled ? 'Enabled' : 'Disabled'}`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row.Mobile) {
//         console.log(`Skipping row ${i + 1}: No Number`);
//         continue;
//       }

//       const phoneRaw = `91${row.Mobile.toString().replace(/\D/g, '')}`;
//       const number = phoneRaw.endsWith('@c.us') ? phoneRaw : `${phoneRaw}@c.us`;
//       const name = row.Name || row.name || '';
//       const message = row.Message || `Dear ${name} San ,  Thank you for your Presence                                TEAM MQVC 2  `;
//       const imageUrl = row.ImageURL || row.ImageUrl || row.imageurl || '';

//       console.log(`Processing row ${i + 1}: ${name}, ${row.Mobile}, Background removal: ${removeBgEnabled}`);

//       // Create canvas and load background
//       const canvas = createCanvas(1080, 1080); // square Instagram-like card
//       const ctx = canvas.getContext('2d');

//       // Load background image (your template)
//       const background = await loadImage(path.join(__dirname, 'bg.png'));
//       ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

//       try {
//         // Load and draw person image taking all available space after header
//         if (imageUrl) {
//           let personImage;

//           if (removeBgEnabled && REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE') {
//             console.log(`Removing background for ${name}...`);
//             try {
//               // Remove background using remove.bg API
//               const noBgImageData = await removeBg(imageUrl);
//               const noBgBuffer = Buffer.from(noBgImageData);

//               // Create image from processed buffer
//               personImage = await loadImage(noBgBuffer);
//               console.log(`Background removed successfully for ${name}`);
//             } catch (bgError) {
//               console.warn(`Background removal failed for ${name}, using original image:`, bgError.message);
//               // Fallback to original image if background removal fails
//               personImage = await loadImage(imageUrl);
//             }
//           } else {
//             // Use original image without background removal
//             personImage = await loadImage(imageUrl);
//           }

//           // Calculate dimensions for image taking all space after header
//           const imageStartY = 150; // Start below the background header
//           const imageEndY = canvas.height - 20; // Use almost all space to bottom
//           const availableHeight = imageEndY - imageStartY;
//           const availableWidth = canvas.width - 40; // Leave 20px margin on each side

//           // Scale to fit available space while maintaining aspect ratio
//           const scaleX = availableWidth / personImage.width;
//           const scaleY = availableHeight / personImage.height;
//           const scale = Math.min(scaleX, scaleY); // THIS LINE MAINTAINS ASPECT RATIO - Change to Math.max to fill space or use scaleX for width-only scaling

//           const newWidth = personImage.width * scale;
//           const newHeight = personImage.height * scale;

//           // Center the image horizontally and vertically
//           const x = (canvas.width - newWidth) / 2;
//           const y = imageStartY + (availableHeight - newHeight) / 2;

//           // Draw image with rounded corners
//           ctx.save();
//           const radius = 20; // Corner radius
//           ctx.beginPath();
//           ctx.roundRect(x, y, newWidth, newHeight, radius);
//           ctx.closePath();
//           ctx.clip();
//           ctx.drawImage(personImage, x, y, newWidth, newHeight);
//           ctx.restore();

//           // Border removed as requested

//           console.log(`Image positioned: ${newWidth}x${newHeight} at (${x}, ${y})`);
//         }

//         // Export as buffer and send via WhatsApp
//         const buffer = canvas.toBuffer('image/png');
//         const media = new MessageMedia('image/png', buffer.toString('base64'));

//         await client.sendMessage(number, media, { caption: message });
//         console.log(`Sent personalized card to ${row.Mobile}`);

//       } catch (err) {
//         console.error(`Error processing/sending to ${row.Mobile}:`, err.message);
//       }

//       // Delay between messages to avoid rate limiting
//       await delay(2000);
//     }

//     fs.unlinkSync(filePath);
//     res.json({
//       status: 'Messages sent (or attempted) to all numbers in Excel.',
//       processedCount: rows.length,
//       backgroundRemoval: removeBgEnabled
//     });

//   } catch (error) {
//     fs.unlinkSync(filePath);
//     console.error('Error processing file:', error.message);
//     res.status(500).json({ error: 'Failed to process file.', details: error.message });
//   }
// });

// // Updated endpoint to test background removal
// app.post('/test-remove-bg', async (req, res) => {
//   const { imageUrl } = req.body;

//   if (!imageUrl) {
//     return res.status(400).json({ error: 'imageUrl is required' });
//   }

//   if (REMOVE_BG_API_KEY === 'INSERT_YOUR_API_KEY_HERE') {
//     return res.status(400).json({ error: 'Please set your Remove.bg API key in environment variables' });
//   }

//   try {
//     const noBgImageData = await removeBg(imageUrl);
//     const base64Image = Buffer.from(noBgImageData).toString('base64');
//     res.json({
//       status: 'Background removed successfully',
//       image: `data:image/png;base64,${base64Image}`
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to remove background', details: error.message });
//   }
// });

// // Debug endpoint to test Remove.bg API
// app.get('/debug-removebg', async (req, res) => {
//   console.log('Debug endpoint called');
  
//   try {
//     console.log('Environment variables check:');
//     console.log('REMOVE_BG_API_KEY exists:', !!REMOVE_BG_API_KEY);
//     console.log('API Key length:', REMOVE_BG_API_KEY ? REMOVE_BG_API_KEY.length : 0);
//     console.log('API Key preview:', REMOVE_BG_API_KEY ? REMOVE_BG_API_KEY.substring(0, 10) + '...' : 'NOT SET');
    
//     if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'INSERT_YOUR_API_KEY_HERE') {
//       return res.json({
//         status: 'error',
//         message: 'Remove.bg API key not set or invalid'
//       });
//     }
    
//     // Test API key validity with account endpoint
//     console.log('Testing API key...');
//     const testResponse = await fetch("https://api.remove.bg/v1.0/account", {
//       headers: { "X-Api-Key": REMOVE_BG_API_KEY }
//     });
    
//     console.log('Account API response status:', testResponse.status);
    
//     if (testResponse.ok) {
//       const accountInfo = await testResponse.json();
//       console.log('Account info:', accountInfo);
      
//       // Test actual background removal
//       console.log('Testing background removal...');
//       try {
//         const testImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300';
//         const noBgImageData = await removeBg(testImageUrl);
        
//         res.json({
//           status: 'success',
//           message: 'API Key is valid and background removal works',
//           account: accountInfo,
//           testResult: {
//             imageProcessed: true,
//             resultSize: noBgImageData.length + ' bytes'
//           }
//         });
//       } catch (bgError) {
//         res.json({
//           status: 'partial_success',
//           message: 'API Key is valid but background removal failed',
//           account: accountInfo,
//           bgError: bgError.message
//         });
//       }
//     } else {
//       const errorText = await testResponse.text();
//       console.log('Account API error:', errorText);
//       res.json({
//         status: 'error',
//         message: 'API Key is invalid',
//         details: errorText
//       });
//     }
//   } catch (error) {
//     console.error('Debug endpoint error:', error);
//     res.status(500).json({
//       status: 'error',
//       message: 'Error testing API key',
//       error: error.message
//     });
//   }
// });

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'Server is running',
//     whatsapp: client.info ? 'Connected' : 'Not connected',
//     removeBgEnabled: REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE'
//   });
// });

// app.use((err, req, res, next) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
//   console.log(`Remove.bg API: ${REMOVE_BG_API_KEY !== 'INSERT_YOUR_API_KEY_HERE' ? 'Configured' : 'Not configured'}`);
// });





// ORIGINAL CODE




// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client without session
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: { headless: true }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// const delay = ms => new Promise(res => setTimeout(res, ms));

// // API endpoint to upload Excel and send messages
// app.post('/send-whatsapp', upload.single('file'), async (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Scan QR and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row.Mobile) {
//         console.log(`Skipping row ${i + 1}: No Number`);
//         continue;
//       }
//       const phoneRaw = `91${row.Mobile.toString().replace(/\D/g, '')}`;
//       const number = phoneRaw.endsWith('@c.us') ? phoneRaw : `${phoneRaw}@c.us`;
//       const name = row.Name || row.name || '';
//       const message = row.Message || `TEAM MARKET QUALTIY`;
//       const imageUrl = row.ImageUrl ;

//       try {
//         if (imageUrl) {
//           const { MessageMedia } = require('whatsapp-web.js');
//           const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//           console.log(`Sent image to ${row.Mobile}`);
//         } else {
//           await client.sendMessage(number, message);
//           console.log(`Sent message to ${row.Mobile}`);
//         }
//       } catch (err) {
//         console.error(`Error sending to ${row.Mobile}:`, err.message);
//       }

//       await delay(2000);
//     }

//     fs.unlinkSync(filePath);
//     res.json({ status: 'Messages sent (or attempted) to all numbers in Excel.' });
//   } catch (error) {
//     fs.unlinkSync(filePath);
//     console.error('Error processing file:', error.message);
//     res.status(500).json({ error: 'Failed to process file.' });
//   }
// });

// app.use((err, req, res, next) => {
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log('Server started on port', PORT);
// });

// ------------------------------------------------------------------
// // pdf wala
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client with updated puppeteer args for debugging
// const client = new Client({
//     authStrategy: new LocalAuth(),
//     puppeteer: {
//         headless: false, // This makes the browser window visible
//         args: [
//             '--no-sandbox',
//             '--disable-setuid-sandbox',
//             '--disable-dev-shm-usage',
//             '--disable-accelerated-2d-canvas',
//             '--no-first-run',
//             '--no-zygote',
//             // '--single-process', // IMPORTANT: Uncomment this line if you are NOT on Windows
//             '--disable-gpu'
//         ],
//     }
// });


// client.on('qr', qr => {
//   console.log('Scan this QR code:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// // ADDED: Log loading progress
// client.on('loading_screen', (percent, message) => {
//     console.log('LOADING SCREEN', percent, message);
// });

// client.on('ready', () => {
//   console.log('WhatsApp Client is ready! You can now send messages.');
// });

// client.on('authenticated', () => {
//   console.log('AUTHENTICATED: Session is valid. Waiting for the client to be ready...');
// });

// // ADDED: Listen for when the session is saved remotely. This is a good sign.
// client.on('remote_session_saved', () => {
//     console.log('REMOTE SESSION SAVED: This confirms the session is stored on WhatsApp servers. The client should be ready momentarily.');
// });

// client.on('auth_failure', (msg) => {
//   console.error('AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// const delay = ms => new Promise(res => setTimeout(res, ms));

// // API endpoint to upload Excel and send messages
// app.post('/send-whatsapp', upload.single('file'), async (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Scan QR and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row.Mobile) {
//         console.log(`Skipping row ${i + 1}: No Number`);
//         continue;
//       }
//       const phoneRaw = `91${row.Mobile.toString().replace(/\D/g, '')}`;
//       const number = phoneRaw.endsWith('@c.us') ? phoneRaw : `${phoneRaw}@c.us`;
//       const name = row.Name || row.name || '';
//       const message = row.Message || `TEAM MARKET QUALTIY`;
//       const imageUrl = row.ImageUrl ;

//       try {
//         if (imageUrl) {
//           const { MessageMedia } = require('whatsapp-web.js');
//           const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//           console.log(`Sent image to ${row.Mobile}`);
//         } else {
//           await client.sendMessage(number, message);
//           console.log(`Sent message to ${row.Mobile}`);
//         }
//       } catch (err) {
//         console.error(`Error sending to ${row.Mobile}:`, err.message);
//       }

//       await delay(2000);
//     }

//     fs.unlinkSync(filePath);
//     res.json({ status: 'Messages sent (or attempted) to all numbers in Excel.' });
//   } catch (error) {
//     if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//     }
//     console.error('Error processing file:', error.message);
//     res.status(500).json({ error: 'Failed to process file.' });
//   }
// });

// app.use((err, req, res, next) => {
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log('Server started on port', PORT);
// });



// ------------------------------------------------------\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// // Import MessageMedia at the top
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client with puppeteer args for compatibility
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: {
//     headless: true,
//     args: [
//       '--no-sandbox',
//       '--disable-setuid-sandbox'
//     ]
//   }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code to link your WhatsApp:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('✅ WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('✅ Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('❌ AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// // Helper function for randomized delay to seem more human
// const randomDelay = (min, max) => {
//   const ms = Math.floor(Math.random() * (max - min + 1) + min);
//   return new Promise(res => setTimeout(res, ms));
// };

// // Main function to process the Excel file in the background
// async function processFileInBackground(filePath) {
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//     const totalRows = rows.length;

//     console.log(`\n🚀 Starting to process ${totalRows} contacts...`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       const progressPrefix = `[${i + 1}/${totalRows}]`;

//       if (!row.Mobile) {
//         console.log(`${progressPrefix} 🟡 Skipping: No mobile number found.`);
//         continue;
//       }
      
//       // Improved number formatting
//       let phoneRaw = row.Mobile.toString().replace(/\D/g, '');
//       if (phoneRaw.length > 10 && phoneRaw.startsWith('91')) {
//          // Number already has country code, do nothing
//       } else if (phoneRaw.length === 10) {
//         phoneRaw = `91${phoneRaw}`; // Add country code
//       } else {
//         console.log(`${progressPrefix} 🟡 Skipping: Invalid mobile number length for ${row.Mobile}.`);
//         continue;
//       }
//       const number = `${phoneRaw}@c.us`;

//       const message = row.Message || ``;
//       const fileUrl = row.FileUrl; // Use generic "FileUrl" for images, PDFs, etc.

//       console.log(`${progressPrefix} ▶️  Processing number: ${row.Mobile}...`);

//       try {
//         if (fileUrl) {
//           const media = await MessageMedia.fromUrl(fileUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//           console.log(`${progressPrefix} ✅ Success: Sent file to ${row.Mobile}`);
//         } else if (message) {
//           await client.sendMessage(number, message);
//           console.log(`${progressPrefix} ✅ Success: Sent message to ${row.Mobile}`);
//         } else {
//           console.log(`${progressPrefix} 🟡 Skipping: No message or file for ${row.Mobile}.`);
//         }
//       } catch (err) {
//         console.error(`${progressPrefix} ❌ Error sending to ${row.Mobile}: ${err.message}`);
//       }

//       // Using a safer, randomized delay
//       await randomDelay(4000, 10000); // Waits between 4 and 10 seconds
//     }

//     console.log("\n🎉 Finished processing all contacts!");
//   } catch (error) {
//     console.error('Error processing file in background:', error.message);
//   } finally {
//     // Always clean up the uploaded file
//     fs.unlinkSync(filePath);
//     console.log(`Cleaned up temporary file: ${filePath}`);
//   }
// }

// // API endpoint now responds immediately and processes in the background
// app.post('/send-whatsapp', upload.single('file'), (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Please wait a moment and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
  
//   // Start the background processing
//   processFileInBackground(filePath);

//   // Respond to the client immediately
//   res.json({ status: 'Processing started. Messages are being sent in the background. Check the server console for progress.' });
// });

// // Generic error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// // Serve the frontend for any other GET request
// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
// });

// -----------------------------------------------------------------------------------


// const express = require('express');
// const cors = require('cors');
// const multer = require('multer');
// // Import MessageMedia at the top
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcodeTerminal = require('qrcode-terminal');
// const xlsx = require('xlsx');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(express.static(path.join(__dirname, 'client/build')));
// app.use(cors());

// const upload = multer({ dest: 'uploads/' });

// // WhatsApp client with puppeteer args for compatibility
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: {
//     headless: true,
//     args: [
//       '--no-sandbox',
//       '--disable-setuid-sandbox'
//     ]
//   }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code to link your WhatsApp:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('✅ WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('✅ Authenticated!');
// });

// client.on('auth_failure', (msg) => {
//   console.error('❌ AUTH FAILURE', msg);
// });

// client.on('disconnected', (reason) => {
//   console.log('Client disconnected', reason);
// });

// client.initialize();

// // Helper function for randomized delay to seem more human
// const randomDelay = (min, max) => {
//   const ms = Math.floor(Math.random() * (max - min + 1) + min);
//   return new Promise(res => setTimeout(res, ms));
// };

// // Main function to process the Excel file in the background
// async function processFileInBackground(filePath) {
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//     const totalRows = rows.length;

//     console.log(`\n🚀 Starting to process ${totalRows} contacts...`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       const progressPrefix = `[${i + 1}/${totalRows}]`;

//       if (!row.Mobile) {
//         console.log(`${progressPrefix} 🟡 Skipping: No mobile number found.`);
//         continue;
//       }
      
//       // Improved number formatting
//       let phoneRaw = row.Mobile.toString().replace(/\D/g, '');
//       if (phoneRaw.length > 10 && phoneRaw.startsWith('91')) {
//          // Number already has country code
//       } else if (phoneRaw.length === 10) {
//         phoneRaw = `91${phoneRaw}`; // Add country code
//       } else {
//         console.log(`${progressPrefix} 🟡 Skipping: Invalid mobile number length for ${row.Mobile}.`);
//         continue;
//       }
//       const number = `${phoneRaw}@c.us`;

//       const message = row.Message || '';
//       const fileUrl = row.FileUrl;
//       const name = row.Name || 'Valued Customer'; // Get the name with a fallback

//       console.log(`${progressPrefix} ▶️  Processing number: ${row.Mobile}...`);

//       try {
//         let primaryMessageSent = false;
//         // First, send the main message or file
//         if (fileUrl) {
//           const media = await MessageMedia.fromUrl(fileUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//           console.log(`${progressPrefix} ✅ Success: Sent file to ${row.Mobile}`);
//           primaryMessageSent = true;
//         } else if (message) {
//           await client.sendMessage(number, message);
//           console.log(`${progressPrefix} ✅ Success: Sent message to ${row.Mobile}`);
//           primaryMessageSent = true;
//         } else {
//           console.log(`${progressPrefix} 🟡 Skipping: No message or file for ${row.Mobile}.`);
//         }
        
//         // Then, send the personalized follow-up message if the first one was sent
//         if (primaryMessageSent) {
//           await randomDelay(1500, 3000); // Add a short delay (1.5 to 3 seconds)
          
//           const thankYouMessage = `Dear ${name} San ,                                                       Takeaways of MQVC 2.0 for you                                  Team Market Quality                                  This is an AI automated message`;
//           await client.sendMessage(number, thankYouMessage);
          
//           console.log(`${progressPrefix} ✅ Success: Sent follow-up message to ${row.Mobile}`);
//         }
        
//       } catch (err) {
//         console.error(`${progressPrefix} ❌ Error sending to ${row.Mobile}: ${err.message}`);
//       }

//       // Add the main delay between processing each contact
//       await randomDelay(4000, 10000); // Waits between 4 and 10 seconds
//     }

//     console.log("\n🎉 Finished processing all contacts!");
//   } catch (error) {
//     console.error('Error processing file in background:', error.message);
//   } finally {
//     // Always clean up the uploaded file
//     fs.unlinkSync(filePath);
//     console.log(`Cleaned up temporary file: ${filePath}`);
//   }
// }

// // API endpoint now responds immediately and processes in the background
// app.post('/send-whatsapp', upload.single('file'), (req, res) => {
//   if (!client.info || !client.info.wid) {
//     return res.status(503).json({ error: 'WhatsApp client not ready yet. Please wait a moment and try again.' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   const filePath = path.resolve(req.file.path);
  
//   // Start the background processing without waiting for it to finish
//   processFileInBackground(filePath);

//   // Respond to the client immediately
//   res.json({ status: 'Processing started. Messages are being sent in the background. Check the server console for progress.' });
// });

// // Generic error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Internal Server Error', details: err.message });
// });

// // Serve the frontend for any other GET request
// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
// });

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
// });



// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++



// import express from 'express';
// import cors from 'cors';
// import multer from 'multer';
// import pkg from 'whatsapp-web.js';
// import qrcodeTerminal from 'qrcode-terminal';
// import xlsx from 'xlsx';
// import fs from 'fs';
// import path from 'path';
// import dotenv from 'dotenv';
// import { fileURLToPath } from 'url';
// const { Client, LocalAuth, MessageMedia } = pkg;
// dotenv.config();

// /* ------------------ FIX __dirname FOR ES MODULES ------------------ */
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// /* ------------------ APP SETUP ------------------ */
// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(cors());
// app.use(express.static(path.join(__dirname, 'client/build')));

// const upload = multer({ dest: 'uploads/' });

// /* ------------------ WHATSAPP CLIENT ------------------ */
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: {
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
//   }
// });

// client.on('qr', qr => {
//   console.log('Scan this QR code to link your WhatsApp:');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('✅ WhatsApp Client is ready!');
// });

// client.on('authenticated', () => {
//   console.log('✅ Authenticated!');
// });

// client.on('auth_failure', msg => {
//   console.error('❌ AUTH FAILURE', msg);
// });

// client.on('disconnected', reason => {
//   console.log('Client disconnected:', reason);
// });

// client.initialize();

// /* ------------------ HELPER: HUMAN-LIKE DELAY ------------------ */
// const randomDelay = (min, max) => {
//   const ms = Math.floor(Math.random() * (max - min + 1) + min);
//   return new Promise(resolve => setTimeout(resolve, ms));
// };

// /* ------------------ MAIN BACKGROUND PROCESS ------------------ */
// async function processFileInBackground(filePath) {
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//     const totalRows = rows.length;

//     console.log(`\n Starting to process ${totalRows} contacts...`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       const progress = `[${i + 1}/${totalRows}]`;

//       if (!row.Mobile) {
//         console.log(`${progress} Skipping: No mobile number`);
//         continue;
//       }

//       let phoneRaw = row.Mobile.toString().replace(/\D/g, '');

//       if (phoneRaw.length === 10) {
//         phoneRaw = `91${phoneRaw}`;
//       } else if (!(phoneRaw.length > 10 && phoneRaw.startsWith('91'))) {
//         console.log(`${progress}  Invalid mobile: ${row.Mobile}`);
//         continue;
//       }

//       const number = `${phoneRaw}@c.us`;
//       const message = row.Message || '';
//       const fileUrl = row.FileUrl;
//       const name = row.Name || 'Valued Customer';

//       try {
//         let primarySent = false;

//         if (fileUrl) {
//           const media = await MessageMedia.fromUrl(fileUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//           primarySent = true;
//         } else if (message) {
//           await client.sendMessage(number, message);
//           primarySent = true;
//         }

//         if (primarySent) {
//           await randomDelay(1500, 3000);

//           const thankYouMessage =
//             `Dear ${name} San,\n\n` +
//             `Takeaways of MQVC 2.0 for you\n` +
//             `Team Market Quality\n\n` +
//             `This is an AI automated message`;

//           await client.sendMessage(number, thankYouMessage);
//         }

//       } catch (err) {
//         console.error(`${progress} ❌ Error:`, err.message);
//       }

//       await randomDelay(4000, 10000);
//     }

//     console.log('\n Finished processing all contacts!');
//   } catch (err) {
//     console.error('Processing error:', err.message);
//   } finally {
//     fs.unlinkSync(filePath);
//     console.log(` Cleaned up file: ${filePath}`);
//   }
// }

// /* ------------------ API ENDPOINT ------------------ */
// app.post('/send-whatsapp', upload.single('file'), (req, res) => {
//   if (!client.info?.wid) {
//     return res.status(503).json({
//       error: 'WhatsApp client not ready'
//     });
//   }

//   if (!req.file) {
//     return res.status(400).json({
//       error: 'No file uploaded'
//     });
//   }

//   const filePath = path.resolve(req.file.path);
//   processFileInBackground(filePath);

//   res.json({
//     status: 'Processing started in background'
//   });
// });

// /* ------------------ ERROR HANDLER ------------------ */
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({
//     error: 'Internal Server Error',
//     details: err.message
//   });
// });

// /* ------------------ FRONTEND ROUTING ------------------ */
// app.use(express.static(path.join(__dirname, 'frontend/Frontend/dist')));

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend/Frontend/dist/index.html'));
// });



// /* ------------------ START SERVER ------------------ */
// app.listen(PORT, () => {
//   console.log(`🚀 Server started on port ${PORT}`);
// });
// ---------------------------------------------------------------------------------------------------

// import express from 'express';
// import cors from 'cors';
// import multer from 'multer';
// import pkg from 'whatsapp-web.js';
// import qrcodeTerminal from 'qrcode-terminal';
// import xlsx from 'xlsx';
// import fs from 'fs';
// import path from 'path';
// import dotenv from 'dotenv';
// import { fileURLToPath } from 'url';

// const { Client, LocalAuth, MessageMedia } = pkg;
// dotenv.config();

// /* ------------------ FIX __dirname ------------------ */
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// /* ------------------ APP SETUP ------------------ */
// const PORT = process.env.PORT || 8000;
// const app = express();

// app.use(cors());
// app.use(express.json());

// /* ------------------ MULTER ------------------ */
// const upload = multer({ dest: 'uploads/' });

// /* ------------------ WHATSAPP CLIENT ------------------ */
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: {
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
//   }
// });

// client.on('qr', qr => {
//   console.log('📱 Scan this QR to connect WhatsApp');
//   qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => {
//   console.log('✅ WhatsApp Client Ready');
// });

// client.on('authenticated', () => {
//   console.log('🔐 WhatsApp Authenticated');
// });

// client.on('auth_failure', msg => {
//   console.error('❌ Auth failure:', msg);
// });

// client.on('disconnected', reason => {
//   console.log('⚠️ Client disconnected:', reason);
// });

// client.initialize();

// /* ------------------ HELPER DELAY ------------------ */
// const randomDelay = (min, max) =>
//   new Promise(resolve =>
//     setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
//   );

// /* ------------------ EXCEL PROCESSOR ------------------ */
// async function processExcel(filePath) {
//   try {
//     const workbook = xlsx.readFile(filePath);
//     const sheet = workbook.SheetNames[0];
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

//     console.log(`📄 Processing ${rows.length} rows`);

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];

//       if (!row.Mobile) continue;

//       let phone = row.Mobile.toString().replace(/\D/g, '');

//       if (phone.length === 10) phone = `91${phone}`;
//       if (!phone.startsWith('91')) continue;

//       const number = `${phone}@c.us`;
//       const name = row.Name || 'Guest';
//       const message = row.Message || '';
//       const fileUrl = row.FileUrl;

//       try {
//         if (fileUrl) {
//           const media = await MessageMedia.fromUrl(fileUrl, { unsafeMime: true });
//           await client.sendMessage(number, media, { caption: message });
//         } else if (message) {
//           await client.sendMessage(number, message);
//         }

//         await randomDelay(1500, 3000);

//         const thankYou =
//           `Dear ${name},\n\n` +
//           `Thank you for attending MQVC 2.0.\n\n` +
//           `— Team Market Quality\n\n` +
//           `This is an AI automated message`;

//         await client.sendMessage(number, thankYou);

//       } catch (err) {
//         console.error(`❌ Error sending to ${phone}:`, err.message);
//       }

//       await randomDelay(4000, 8000);
//     }

//     console.log('✅ Excel processing complete');

//   } catch (err) {
//     console.error('Excel error:', err.message);
//   } finally {
//     fs.unlinkSync(filePath);
//   }
// }

// /* ------------------ API: EXCEL UPLOAD ------------------ */
// app.post('/send-whatsapp', upload.single('file'), (req, res) => {
//   if (!client.info?.wid) {
//     return res.status(503).json({ error: 'WhatsApp not ready' });
//   }

//   if (!req.file) {
//     return res.status(400).json({ error: 'No file uploaded' });
//   }

//   processExcel(path.resolve(req.file.path));
//   res.json({ status: 'Processing started' });
// });

// /* ------------------ API: SEND AFTER FACE RECOGNITION ------------------ */
// app.post('/send-thankyou', async (req, res) => {
//   try {
//     const { name, phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({ error: 'Phone missing' });
//     }

//     const number = phone.endsWith('@c.us') ? phone : `${phone}@c.us`;

//     const msg =
//       `Dear ${name || 'Guest'},\n\n` +
//       `Thank you for attending MQVC 2.0.\n\n` +
//       `— Team Market Quality\n\n` +
//       `This is an AI automated message`;

//     await client.sendMessage(number, msg);

//     res.json({ status: 'sent' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// /* ------------------ FRONTEND (VITE DIST) ------------------ */
// app.use(express.static(path.join(__dirname, 'frontend/Frontend/dist')));

// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, 'frontend/Frontend/dist/index.html'));
// });

// /* ------------------ START SERVER ------------------ */
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
// ----------------------------------------------------------------------------------------------------------------


// import express from "express";
// import cors from "cors";
// import multer from "multer";
// import xlsx from "xlsx";
// import fs from "fs";
// import path from "path";
// import fetch from "node-fetch";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// app.use(cors());
// app.use(express.json());

// const upload = multer({ dest: "uploads/" });

// const FACE_DB = path.join(__dirname, "../face_service/faces");
// const META_FILE = path.join(FACE_DB, "meta.json");

// if (!fs.existsSync(FACE_DB)) fs.mkdirSync(FACE_DB, { recursive: true });
// if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// app.post("/upload-excel", upload.single("file"), async (req, res) => {
//   try {
//     const workbook = xlsx.readFile(req.file.path);
//     const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
//     const meta = JSON.parse(fs.readFileSync(META_FILE));

//     for (const row of rows) {
//       if (!row.Name || !row.Phone || !row.ImageURL) continue;

//       const personDir = path.join(FACE_DB, row.Name);
//       fs.mkdirSync(personDir, { recursive: true });

//       const imgPath = path.join(personDir, "1.jpg");
//       const response = await fetch(row.ImageURL);
//       const buffer = await response.arrayBuffer();
//       fs.writeFileSync(imgPath, Buffer.from(buffer));

//       meta[row.Name] = row.Phone.toString();
//     }

//     fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
//     fs.unlinkSync(req.file.path);

//     res.json({ status: "Faces registered successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.listen(8000, () => console.log("Backend running on 8000"));
// ___________________________________________________________________________________________________



// import express from "express";
// import cors from "cors";
// import multer from "multer";
// import xlsx from "xlsx";
// import fs from "fs";
// import path from "path";
// import fetch from "node-fetch";
// import { fileURLToPath } from "url";
// import FormData from 'form-data';
// import qrcodeTerminal from 'qrcode-terminal';

// // Fixed WhatsApp imports for ES Modules
// import pkg from 'whatsapp-web.js';
// const { Client, LocalAuth, MessageMedia } = pkg;

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// // ... the rest of your code ...

// const app = express();
// app.use(cors());
// app.use(express.json());

// const upload = multer({ dest: "uploads/" });

// // --- WhatsApp Setup ---
// const client = new Client({
//     authStrategy: new LocalAuth(),
//     puppeteer: { headless: true, args: ['--no-sandbox'] }
// });

// client.on('qr', qr => qrcodeTerminal.generate(qr, { small: true }));
// client.on('ready', () => console.log('✅ WhatsApp Client is ready!'));
// client.initialize();

// // --- Folders & Meta ---
// const FACE_DB = path.join(__dirname, "../face_service/faces");
// const UNKNOWN_DB = path.join(__dirname, "unknown_guests");
// const META_FILE = path.join(FACE_DB, "meta.json");

// if (!fs.existsSync(UNKNOWN_DB)) fs.mkdirSync(UNKNOWN_DB);

// // --- Routes ---

// // 1. Enrollment (Excel Upload)
// app.post("/upload-excel", upload.single("file"), async (req, res) => {
//     try {
//         const workbook = xlsx.readFile(req.file.path);
//         const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
//         const meta = JSON.parse(fs.readFileSync(META_FILE));

//         for (const row of rows) {
//             if (!row.Name || !row.Phone || !row.ImageURL) continue;
//             const personDir = path.join(FACE_DB, row.Name);
//             if (!fs.existsSync(personDir)) fs.mkdirSync(personDir, { recursive: true });

//             const response = await fetch(row.ImageURL);
//             const buffer = await response.arrayBuffer();
//             fs.writeFileSync(path.join(personDir, `${row.Name}.jpg`), Buffer.from(buffer));
//             meta[row.Name] = row.Phone.toString();
//         }

//         fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
//         fs.unlinkSync(req.file.path);
//         res.json({ status: "Faces registered successfully" });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // 2. The Bridge: Recognize & Welcome
// app.post("/recognize-guest", upload.single("image"), async (req, res) => {
//     try {
//         if (!req.file) return res.status(400).json({ error: "No image captured" });

//         // Forward image to Python Flask server (Port 5001)
//         const form = new FormData();
//         form.append('image', fs.createReadStream(req.file.path));

//         const pyResponse = await fetch('http://localhost:5001/recognize', {
//             method: 'POST',
//             body: form
//         });

//         const data = await pyResponse.json();

//         if (data.match) {
//             // Found a match! Send WhatsApp
//             const chatId = `${data.phone}@c.us`;
//             const welcomeMsg = `Welcome to the event, ${data.name}! We are glad to have you with us.`;

//             await client.sendMessage(chatId, welcomeMsg);
//             console.log(`✅ Welcome sent to ${data.name} (${data.phone})`);

//             res.json({ status: "Match found, message sent", name: data.name });
//         } else {
//             // No match found: Save to unknown folder
//             const unknownPath = path.join(UNKNOWN_DB, `unknown_${Date.now()}.jpg`);
//             fs.renameSync(req.file.path, unknownPath);
//             console.log("🟡 Unknown guest detected. Photo saved.");
//             res.json({ status: "Unknown guest", savedPath: unknownPath });
//         }
//     } catch (err) {
//         console.error("Error in bridge:", err.message);
//         res.status(500).json({ error: "Recognition bridge failed" });
//     } finally {
//         if (fs.existsSync(req.file?.path)) fs.unlinkSync(req.file.path);
//     }
// });

// app.listen(8000, () => console.log("🚀 Node Backend running on 8000"));


// ___________________________________________________________________________________________



// import express from "express";
// import cors from "cors";
// import multer from "multer";
// import xlsx from "xlsx";
// import fs from "fs";
// import path from "path";
// import fetch from "node-fetch";
// import { fileURLToPath } from "url";
// import FormData from 'form-data';
// import qrcodeTerminal from 'qrcode-terminal';

// // Fixed WhatsApp imports for ES Modules
// // 1. Import the default package
// import pkg from 'whatsapp-web.js';
// // Extract all three required classes from the pkg object
// const { Client, LocalAuth, MessageMedia } = pkg;
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// app.use(cors());
// app.use(express.json());

// const upload = multer({ dest: "uploads/" });

// // --- WhatsApp Setup ---
// const client = new Client({
//     authStrategy: new LocalAuth(),
//     puppeteer: { 
//         headless: true, 
//         args: ['--no-sandbox', '--disable-setuid-sandbox'] 
//     }
// });

// client.on('qr', qr => {
//     console.log('Scan this QR code to link WhatsApp:');
//     qrcodeTerminal.generate(qr, { small: true });
// });

// client.on('ready', () => console.log('✅ WhatsApp Client is ready!'));
// client.initialize();

// // --- Folders & Meta Setup ---
// const FACE_DB = path.join(__dirname, "face_service", "faces");
// const UNKNOWN_DB = path.join(__dirname, "unknown_guests");
// const META_FILE = path.join(FACE_DB, "meta.json");

// if (!fs.existsSync(FACE_DB)) fs.mkdirSync(FACE_DB, { recursive: true });
// if (!fs.existsSync(UNKNOWN_DB)) fs.mkdirSync(UNKNOWN_DB);
// if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, "{}");

// // --- Routes ---

// // 1. Enrollment via Excel
// app.post("/upload-excel", upload.single("file"), async (req, res) => {
//     try {
//         const workbook = xlsx.readFile(req.file.path);
//         const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
//         const meta = JSON.parse(fs.readFileSync(META_FILE));

//         for (const row of rows) {
//             if (!row.Name || !row.Phone || !row.ImageURL) continue;
//             const personDir = path.join(FACE_DB, row.Name);
//             if (!fs.existsSync(personDir)) fs.mkdirSync(personDir, { recursive: true });

//             const response = await fetch(row.ImageURL);
//             const buffer = await response.arrayBuffer();
//             fs.writeFileSync(path.join(personDir, `${row.Name}.jpg`), Buffer.from(buffer));
//             meta[row.Name] = row.Phone.toString();
//         }

//         fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
//         fs.unlinkSync(req.file.path);
//         res.json({ status: "Faces registered successfully" });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// // 2. Recognition Bridge
// // Replace your recognize-guest route with this
// app.post("/recognize-guest", upload.single("image"), async (req, res) => {
//     try {
//         if (!req.file) return res.status(400).json({ error: "No image" });

//         // Forward to Python AI
//         const form = new FormData();
//         form.append('image', fs.createReadStream(req.file.path));

//         const pyRes = await fetch('http://localhost:5001/recognize', { 
//             method: 'POST', 
//             body: form 
//         });
//         const data = await pyRes.json();
//         console.log("AI Result:", data);

//         if (data.match === true) {
//             try {
//                 // 1. Clean number (digits only) and add suffix
//                 const cleanNumber = data.phone.toString().replace(/\D/g, ''); 
//                 const chatId = `${cleanNumber}@c.us`;

//                 // 2. FORCE FETCH: This resolves the "No LID" error by making 
//                 // the WA browser find the contact on the server
//                 const contact = await client.getContactById(chatId);

//                 // 3. Prepare Media & Caption
//                 const media = MessageMedia.fromFilePath(req.file.path);
//                 const welcomeMsg = `Welcome, ${data.name}! 📸 Captured at entry. Team Market Quality greets you!`;

//                 // 4. Send using the verified internal ID (_serialized)
//                 await client.sendMessage(contact.id._serialized, media, { caption: welcomeMsg });

//                 console.log(`✅ Success for ${data.name}`);
//                 if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//                 return res.json({ status: "Matched", name: data.name });

//             } catch (waError) {
//                 console.error("WhatsApp Error:", waError.message);
//                 return res.json({ status: "Matched", name: data.name, warning: "WhatsApp failed" });
//             }
//         } else {
//             const unknownPath = path.join(UNKNOWN_DB, `unknown_${Date.now()}.jpg`);
//             fs.renameSync(req.file.path, unknownPath);
//             return res.json({ status: "Unknown guest" });
//         }
//     } catch (err) {
//         console.error("Bridge Error:", err.message);
//         if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//         res.status(500).json({ error: "Bridge failed" });
//     }
// });
// // 3. Fetch Guest List
// app.get("/guests", (req, res) => {
//     try {
//         const meta = JSON.parse(fs.readFileSync(META_FILE));
//         // Convert the object into an array for the frontend table
//         const guestList = Object.keys(meta).map(name => ({
//             name: name,
//             phone: meta[name]
//         }));
//         res.json(guestList);
//     } catch (err) {
//         res.status(500).json({ error: "Could not fetch guest list" });
//     }
// });
// app.listen(8000, () => console.log("🚀 Node Backend running on 8000"));
