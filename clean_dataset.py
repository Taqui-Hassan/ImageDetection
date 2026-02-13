import os
from PIL import Image

# --- CONFIGURATION ---
# Point this to your faces folder
FACES_DIR = "face_service/faces"

def clean_dataset():
    if not os.path.exists(FACES_DIR):
        print(f"❌ Error: Folder '{FACES_DIR}' not found.")
        return

    print(f"🧹 Scanning {FACES_DIR} for corrupt images...")
    
    deleted_count = 0
    checked_count = 0

    # Loop through all folders (e.g., "Rahul", "Priya")
    for person_name in os.listdir(FACES_DIR):
        person_folder = os.path.join(FACES_DIR, person_name)
        
        if os.path.isdir(person_folder):
            image_path = os.path.join(person_folder, "1.jpg")
            
            if os.path.exists(image_path):
                checked_count += 1
                try:
                    # 🔍 TRY TO OPEN IMAGE
                    with Image.open(image_path) as img:
                        img.verify() # Checks for corruption
                except Exception as e:
                    # 🗑️ IF IT FAILS, DELETE IT
                    print(f"❌ CORRUPT: {person_name} (Deleting...)")
                    os.remove(image_path)
                    deleted_count += 1
    
    print("-" * 30)
    print(f"✨ DONE!")
    print(f"🔍 Checked: {checked_count} faces")
    print(f"🗑️ Deleted: {deleted_count} corrupt files")
    print(f"👉 Now restart your Python AI.")

if __name__ == "__main__":
    clean_dataset()