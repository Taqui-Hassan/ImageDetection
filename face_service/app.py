import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)

# 🔧 FIX PATHS: Make them absolute so Render can't get lost
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FACES_DIR = os.path.join(BASE_DIR, "faces")

# Create the folder if it doesn't exist (safety check)
if not os.path.exists(FACES_DIR):
    os.makedirs(FACES_DIR)

print(f"📂 AI Service initialized. Looking for faces in: {FACES_DIR}")

@app.route('/', methods=['GET'])
def home():
    # Helper to see how many photos are actually on the server
    count = 0
    for root, dirs, files in os.walk(FACES_DIR):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                count += 1
    return jsonify({
        "status": "Online",
        "message": "Event AI Service Running",
        "photos_loaded": count,
        "faces_path": FACES_DIR
    })
@app.route('/recognize', methods=['POST'])
@app.route('/recognize-guest', methods=['POST'])
def recognize_guest():
    if 'image' not in request.files:
        return jsonify({"status": "error", "message": "No image uploaded"}), 400

    file = request.files['image']
    
    # 1. Save the incoming photo temporarily
    temp_path = os.path.join(BASE_DIR, "temp_scan.jpg")
    file.save(temp_path)

    try:
        print("📸 Scanning face...")
        
        # 2. RUN REAL AI CHECK
        # We use a lower threshold (0.65) to be a bit more forgiving
        results = DeepFace.find(
            img_path=temp_path, 
            db_path=FACES_DIR, 
            model_name="ArcFace", 
            detector_backend="opencv",
            distance_metric="cosine",
            enforce_detection=False
        )

        # 3. Process Result
        if len(results) > 0 and not results[0].empty:
            match = results[0].iloc[0]
            identity_path = match['identity']
            distance = match['distance']
            
            # Strictness check (Lower is better match)
            if distance < 0.40:
                # Extract Name from Folder (e.g., faces/Taqui/img.jpg -> Taqui)
                # We fix the slash direction for Linux (Render) vs Windows
                identity_path = identity_path.replace("\\", "/")
                matched_name = identity_path.split("/")[-2]

                print(f"✅ FOUND: {matched_name} (Score: {distance:.4f})")
                return jsonify({
                    "status": "matched",
                    "name": matched_name,
                    "distance": float(distance),
                    "seat": "Check List", # You can connect to DB later if needed
                    "entered": False
                })
            else:
                print(f"⚠️ Match found but too weak: {distance:.4f}")

        print("❌ No match found.")
        return jsonify({"status": "unknown"}), 200

    except Exception as e:
        print(f"🔥 AI CRASH: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)