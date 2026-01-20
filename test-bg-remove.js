// Save this as test-removebg.js (replace your current file)
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

async function removeBg(imageUrl) {
  try {
    console.log('Starting background removal for image:', imageUrl);
    
    // First, fetch the image from the URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.buffer();
    console.log('Image fetched successfully, size:', imageBuffer.length, 'bytes');

    // Use form-data package
    const formData = new FormData();
    formData.append("size", "auto");
    formData.append("image_file", imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });

    console.log('Sending request to Remove.bg API...');
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { 
        "X-Api-Key": REMOVE_BG_API_KEY,
        ...formData.getHeaders()
      },
      body: formData,
    });

    console.log('Remove.bg API response status:', response.status);

    if (response.ok) {
      const resultBuffer = await response.buffer();
      console.log('Background removal successful, result size:', resultBuffer.length, 'bytes');
      return resultBuffer;
    } else {
      const errorText = await response.text();
      console.error('Remove.bg API Error:', response.status, errorText);
      throw new Error(`Remove.bg API Error ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('Background removal failed:', error.message);
    throw error;
  }
}

async function testRemoveBg() {
  console.log('Testing Remove.bg API...');
  console.log('API Key:', REMOVE_BG_API_KEY ? `${REMOVE_BG_API_KEY.substring(0, 10)}...` : 'NOT SET');

  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'xxxxxxxxxxx') {
    console.error('❌ Remove.bg API key not set or invalid');
    console.log('Make sure your .env file has: REMOVE_BG_API_KEY=your_actual_api_key');
    return;
  }

  try {
    // Test 1: Check account info
    console.log('\n1. Checking account info...');
    const accountResponse = await fetch('https://api.remove.bg/v1.0/account', {
      headers: { 'X-Api-Key': REMOVE_BG_API_KEY }
    });

    if (accountResponse.ok) {
      const accountInfo = await accountResponse.json();
      console.log('✅ Account info:', accountInfo);
    } else {
      const error = await accountResponse.text();
      console.log('❌ Account check failed:', accountResponse.status, error);
      return;
    }

    // Test 2: Remove background from test image
    console.log('\n2. Testing background removal...');
    const testImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500';
    
    const resultBuffer = await removeBg(testImageUrl);
    fs.writeFileSync('test-result.png', resultBuffer);
    console.log('✅ Background removal successful! Saved as test-result.png');
    console.log(`   File size: ${resultBuffer.length} bytes`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRemoveBg();