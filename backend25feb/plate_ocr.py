# backend/plate_ocr.py
import os
import cv2
import numpy as np
import base64
import easyocr
import re
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
YOLO_MODEL_PATH = os.path.join(BASE_DIR, "yolov8n.pt")

try:
    _plate_detector = YOLO(YOLO_MODEL_PATH)
except Exception as e:
    print(f"❌ Custom model failed: {e}. Falling back to default yolov8n.pt")
    _plate_detector = YOLO("yolov8n.pt")

# Initialize EasyOCR
_ocr_reader = easyocr.Reader(['en'], gpu=False)

def clean_indian_plate(raw_text):
    """
    Hunts for the specific Indian License Plate pattern inside messy text.
    """
    # Remove everything except letters and numbers
    cleaned_text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
    
    # Strip IND watermark/logo if attached
    cleaned_text = cleaned_text.replace("IND", "")
    
    # Strict Regex for Indian Plates (e.g., DL 01 AB 1234)
    # Allows for common OCR confusions (like '0' instead of 'O')
    pattern = r'([A-Z]{2}[0-9OIZSB]{1,2}[A-Z0-9]{0,3}[0-9OIZSB]{3,4})'
    match = re.search(pattern, cleaned_text)
    
    if match:
        extracted = match.group(1)
        return extracted[:10] # Cap at 10 chars
        
    # If the regex fails but the isolated string is the exact right length
    if 8 <= len(cleaned_text) <= 11:
        return cleaned_text
        
    return ""

def extract_plate_from_frame(img):
    best_plate_text = ""
    
    try:
        # 1. ATTEMPT YOLO CROP
        results = _plate_detector.predict(img, conf=0.25, verbose=False)
        for r in results:
            for box in r.boxes:
                b = box.xyxy[0].cpu().numpy().astype(int)
                crop = img[b[1]:b[3], b[0]:b[2]]
                
                if crop.size > 0:
                    ocr_res = _ocr_reader.readtext(crop)
                    raw_text = "".join([t[1] for t in ocr_res])
                    cleaned = clean_indian_plate(raw_text)
                    if cleaned:
                        best_plate_text = cleaned
                        break
            if best_plate_text:
                break
    except Exception as e:
        print(f"YOLO Processing Warning: {e}")

    # 2. FULL-FRAME FALLBACK 
    # If standard YOLO didn't find a plate box, scan the whole image
    if not best_plate_text:
        print("⚠️ YOLO missed plate crop. Running full-frame fallback OCR...")
        ocr_res = _ocr_reader.readtext(img)
        
        # Join all text blocks found in the image
        full_raw_text = "".join([t[1] for t in ocr_res])
        best_plate_text = clean_indian_plate(full_raw_text)

    print(f"🔍 Final Extracted Plate Text: '{best_plate_text}'")
    return best_plate_text

def extract_plate_from_base64(image_b64):
    try:
        if not image_b64:
            return ""
            
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]
            
        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        return extract_plate_from_frame(img)
    except Exception as e:
        print(f"OCR Base64 Decoding Error: {e}")
        return ""