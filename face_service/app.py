from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import os
import json
import uuid

# --- 1. Initialization (MUST BE BEFORE ROUTES) ---
app = Flask(__name__)
CORS(app)

# --- 2. Configuration ---
FACE_DB = "faces"
META_FILE = os.path.join(FACE_DB, "meta.json")

@app.route("/recognize", methods=["POST"])
def recognize():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    img_file = request.files["image"]
    temp_path = f"temp_{uuid.uuid4()}.jpg"
    img_file.save(temp_path)

    try:
        # Check if database exists
        if not os.path.exists(FACE_DB) or not os.listdir(FACE_DB):
            return jsonify({"match": False, "error": "Database empty"})

        # Run DeepFace Search
        result = DeepFace.find(
            img_path=temp_path,
            db_path=FACE_DB,
            model_name="ArcFace",
            detector_backend="opencv",
            enforce_detection=False,
            align=True
        )

        if os.path.exists(temp_path):
            os.remove(temp_path)

        # Check for matches
        if len(result) > 0 and not result[0].empty:
            # Get the best match
            match = result[0].iloc[0]
            identity = match["identity"]
            
            # Identify the distance column (e.g., 'distance' or 'ArcFace_cosine')
            dist_col = [c for c in result[0].columns if 'cosine' in c or 'distance' in c][0]
            distance = match[dist_col]

            # Extract Name from folder
            name = os.path.basename(os.path.dirname(identity))
            print(f"🔍 Found: {name} | Distance: {distance:.4f}")

            # TUNING: ArcFace is strict. 0.68 is standard, 0.75 is more relaxed.
            if distance < 0.60:
                phone = None
                if os.path.exists(META_FILE):
                    with open(META_FILE, 'r') as f:
                        phone = json.load(f).get(name)
                
                return jsonify({"match": True, "name": name, "phone": phone, "distance": float(distance)})
        
        print("🟡 Face scanned but no confident match found.")
        return jsonify({"match": False})

    except Exception as e:
        print(f"❌ AI ERROR: {str(e)}")
        if os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    if not os.path.exists(FACE_DB):
        os.makedirs(FACE_DB)
    print(f"🚀 Python AI Service running on http://127.0.0.1:5001")
    app.run(port=5001, debug=False)