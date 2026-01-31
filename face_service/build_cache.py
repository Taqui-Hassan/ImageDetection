import os
from deepface import DeepFace

# 1. Find ANY image to trigger the build
img_path = None
for root, dirs, files in os.walk("faces"):
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            img_path = os.path.join(root, file)
            break
    if img_path: break

if img_path:
    print(f"🚀 Found image: {img_path}")
    print("⏳ Generatng AI Cache (this takes time)...")
    
    # This command forces DeepFace to analyze all 15+ people and save the .pkl file
    try:
        DeepFace.find(img_path=img_path, db_path="faces", model_name="ArcFace", detector_backend="opencv")
        print("✅ SUCCESS! Cache file generated.")
    except Exception as e:
        print(f"⚠️ Error (don't worry if it says 'Face could not be detected', the cache still builds): {e}")
else:
    print("❌ No images found! Add photos to 'faces' folder first.")