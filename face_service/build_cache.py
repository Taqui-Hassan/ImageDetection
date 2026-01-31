import os
from deepface import DeepFace

# Path to your faces folder
db_path = "faces"

print(f"📂 Looking for photos in: {os.path.abspath(db_path)}")

# 1. Find ANY image (Scanning sub-folders too)
img_path = None
for root, dirs, files in os.walk(db_path):
    for file in files:
        if file.lower().endswith(('.jpg', '.jpeg', '.png')):
            img_path = os.path.join(root, file)
            print(f"📸 Found trigger image: {img_path}")
            break
    if img_path:
        break

if img_path:
    print("⏳ Building AI Cache (This takes 1-2 minutes)...")
    try:
        # This forces DeepFace to scan ALL folders and create the .pkl file
        DeepFace.find(img_path=img_path, db_path=db_path, model_name="ArcFace", detector_backend="opencv")
        print("✅ SUCCESS! Cache file generated.")
    except Exception as e:
        print(f"⚠️ Process finished: {e}")
        print("Check your 'faces' folder. You should see a .pkl file now.")
else:
    print("❌ STILL NO IMAGES FOUND.")
    print("Make sure your images are inside 'face_service/faces/'")