# ai_server.py
import os
import face_recognition
import numpy as np
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from rembg import remove
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

# --- 1. SETUP FACE RECOGNITION DB ---
# (Assumes you have a 'faces' folder with subfolders for each person)
KNOWN_FACES_DIR = "face_service/faces"
known_face_encodings = []
known_face_names = []
known_face_phones = []

def load_face_database():
    print("📂 Loading Face Database...")
    if not os.path.exists(KNOWN_FACES_DIR):
        os.makedirs(KNOWN_FACES_DIR)
        
    for name in os.listdir(KNOWN_FACES_DIR):
        person_dir = os.path.join(KNOWN_FACES_DIR, name)
        if not os.path.isdir(person_dir):
            continue
            
        for filename in os.listdir(person_dir):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                filepath = os.path.join(person_dir, filename)
                try:
                    image = face_recognition.load_image_file(filepath)
                    encodings = face_recognition.face_encodings(image)
                    if len(encodings) > 0:
                        known_face_encodings.append(encodings[0])
                        known_face_names.append(name)
                        print(f"✅ Loaded: {name}")
                    else:
                        print(f"⚠️ No face found in: {filename}")
                except Exception as e:
                    print(f"❌ Error loading {filename}: {e}")

# Load DB on startup
load_face_database()

# --- ROUTE 1: RECOGNIZE ---
@app.route('/recognize', methods=['POST'])
def recognize_face():
    if 'image' not in request.files:
        return jsonify({"match": False, "error": "No image uploaded"}), 400

    file = request.files['image']
    try:
        # Load image for face_recognition
        image = face_recognition.load_image_file(file)
        unknown_encodings = face_recognition.face_encodings(image)

        if len(unknown_encodings) > 0:
            unknown_encoding = unknown_encodings[0]
            # Compare with DB
            matches = face_recognition.compare_faces(known_face_encodings, unknown_encoding, tolerance=0.5)
            face_distances = face_recognition.face_distance(known_face_encodings, unknown_encoding)
            
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                name = known_face_names[best_match_index]
                distance = float(face_distances[best_match_index])
                return jsonify({
                    "match": True,
                    "name": name,
                    "phone": "Unknown", # You can update this to look up phone from meta.json if needed
                    "distance": distance
                })

        return jsonify({"match": False, "name": "Unknown"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- ROUTE 2: COMPOSITE (BG REMOVAL) ---
BACKGROUND_IMAGE_PATH = "background.jpg"

@app.route('/composite', methods=['POST'])
def composite_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files['image']
    try:
        input_image = Image.open(file.stream).convert("RGBA")
        foreground = remove(input_image) # Remove BG

        # Load Background (or transparent fallback)
        if os.path.exists(BACKGROUND_IMAGE_PATH):
            background = Image.open(BACKGROUND_IMAGE_PATH).convert("RGBA")
            # Resize foreground to fit
            bg_w, bg_h = background.size
            fg_w, fg_h = foreground.size
            target_height = int(bg_h * 0.85)
            target_width = int(target_height * (fg_w / fg_h))
            resized_fg = foreground.resize((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Paste
            x_pos = (bg_w - target_width) // 2
            y_pos = bg_h - target_height
            final = background.copy()
            final.paste(resized_fg, (x_pos, y_pos), resized_fg)
            final_rgb = final.convert("RGB")
        else:
            final_rgb = foreground.convert("RGB") # Fallback

        img_io = io.BytesIO()
        final_rgb.save(img_io, 'JPEG', quality=95)
        img_io.seek(0)
        return send_file(img_io, mimetype='image/jpeg')

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Render provides a PORT env var, default to 5000 locally
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)