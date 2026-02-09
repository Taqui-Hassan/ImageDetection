from flask import Flask, request, send_file, jsonify
from rembg import remove
from PIL import Image
import io
import os

app = Flask(__name__)

# --- CONFIGURATION ---
# Ensure this file exists in the same directory!
BACKGROUND_IMAGE_PATH = "bg.png"

@app.route('/composite', methods=['POST'])
def composite_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    
    try:
        # 1. Load the Input Image (Person)
        input_image = Image.open(file.stream).convert("RGBA")
        
        # 2. Remove Background (The heavy lifting)
        print("✂️  Removing background...")
        # 'u2net_human_seg' is optimized for people
        foreground = remove(input_image, model='u2net_human_seg') 
        
        # 3. Load Event Background
        if not os.path.exists(BACKGROUND_IMAGE_PATH):
            print("⚠️  No background.jpg found! Returning transparent PNG.")
            # Fallback: Return the cutout without a background
            img_io = io.BytesIO()
            foreground.save(img_io, 'PNG')
            img_io.seek(0)
            return send_file(img_io, mimetype='image/png')

        background = Image.open(BACKGROUND_IMAGE_PATH).convert("RGBA")
        
        # 4. Smart Resize: Fit Person into Background
        bg_w, bg_h = background.size
        fg_w, fg_h = foreground.size
        
        # Scale person to 85% of background height
        target_height = int(bg_h * 0.85)
        aspect_ratio = fg_w / fg_h
        target_width = int(target_height * aspect_ratio)
        
        resized_foreground = foreground.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # 5. Position: Bottom Center
        x_pos = (bg_w - target_width) // 2
        y_pos = bg_h - target_height # Align to bottom
        
        # 6. Paste!
        final_image = background.copy()
        final_image.paste(resized_foreground, (x_pos, y_pos), resized_foreground)
        
        # 7. Convert to RGB for WhatsApp (JPEG)
        final_rgb = final_image.convert("RGB")
        
        # 8. Return
        print("✅ Composite created!")
        img_io = io.BytesIO()
        final_rgb.save(img_io, 'JPEG', quality=95)
        img_io.seek(0)
        
        return send_file(img_io, mimetype='image/jpeg')

    except Exception as e:
        print(f"❌ Error in BG Removal: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # ⚡ RUNNING ON PORT 5001 TO AVOID CONFLICT WITH AI ⚡
    print(f"🎨 Background Service running on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001)