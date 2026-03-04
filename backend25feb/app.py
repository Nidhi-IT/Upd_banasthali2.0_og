# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import visits_collection, receipts_collection
from face_scanner import match_face_in_db
from datetime import datetime
from bson import ObjectId
import easyocr
import base64
import cv2
import numpy as np
import re

app = Flask(__name__)
CORS(app)

print("⏳ Loading EasyOCR...")
ocr_reader = easyocr.Reader(['en'], gpu=False)
print("✅ EasyOCR Loaded!")

def serialize_doc(doc):
    if doc:
        doc['_id'] = str(doc['_id'])
    return doc

def build_db_fuzzy_regex(db_plate):
    confusion_map = {
        '0': '[0ODQ]', 'O': '[0ODQ]', 'D': '[0ODQ]', 'Q': '[0ODQ]',
        '1': '[1ILT]', 'I': '[1ILT]', 'L': '[1ILT]', 'T': '[1ILT]',
        '8': '[8B]', 'B': '[8B]',
        '5': '[5S]', 'S': '[5S]',
        '2': '[2Z]', 'Z': '[2Z]',
        'A': '[A4H]', '4': '[A4HL]', 'H': '[A4H]', 
        'G': '[G6C]', '6': '[G6C]', 'C': '[CGO0]',
        'V': '[VUY]', 'U': '[VUY]', 'Y': '[VUY]'
    }
    
    clean_db_plate = re.sub(r'[^A-Z0-9]', '', db_plate.upper())
    regex_pattern = ""
    for char in clean_db_plate:
        regex_pattern += confusion_map.get(char, char) + r'.?' 
        
    return regex_pattern

def scan_full_image_for_text(base64_string):
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        cv2.imwrite("debug_webcam_capture.jpg", img)

        results = ocr_reader.readtext(img)
        raw_text = "".join([t[1] for t in results])
        cleaned_text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
        return cleaned_text
    except Exception as e:
        print(f"Error scanning image: {e}")
        return ""

@app.route("/api/visits", methods=["POST", "GET"])
def handle_visits():
    if request.method == "GET":
        try:
            visits = list(visits_collection.find().sort("_id", -1).limit(50))
            return jsonify([serialize_doc(v) for v in visits]), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == "POST":
        try:
            data = request.json
            if not data:
                return jsonify({"error": "No JSON data provided"}), 400

            image_b64 = data.get("vehicleNoPhoto")
            if image_b64:
                data["vehiclePlateDetails"] = {"text": scan_full_image_for_text(image_b64)}

            data["status"] = data.get("status", "pending_review")
            data["submittedAt"] = datetime.utcnow()

            result = visits_collection.insert_one(data)
            print(f"✅ Saved to gate_passes DB with ID: {result.inserted_id}")
            return jsonify({"message": "Success", "id": str(result.inserted_id)}), 201

        except Exception as e:
            print(f"❌ Database Error: {e}")
            return jsonify({"error": "Failed to save to database", "details": str(e)}), 500

@app.route("/api/receipts", methods=["GET", "POST", "OPTIONS"])
def handle_receipts_route():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200
    if request.method == "POST":
        try:
            data = request.json
            result = receipts_collection.insert_one(data)
            return jsonify({"message": "Receipt created", "id": str(result.inserted_id)}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    if request.method == "GET":
        try:
            receipts = list(receipts_collection.find().sort("_id", -1).limit(50))
            return jsonify([serialize_doc(r) for r in receipts]), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route("/api/admin/scan", methods=["POST"])
def live_entry_test():
    data = request.json or {}
    live_frame_b64 = data.get("liveFrame")
    
    if not live_frame_b64:
        return jsonify({"error": "No live frame provided"}), 400

    match_found = False
    matched_visitor = None
    match_reason = ""

    detected_plate_text = scan_full_image_for_text(live_frame_b64)
    
    if len(detected_plate_text) > 4:
        visitors = list(visits_collection.find({"vehicleNo": {"$exists": True, "$ne": ""}}))
        for visitor in visitors:
            db_plate = visitor.get("vehicleNo", "")
            if not db_plate:
                continue
            fuzzy_regex = build_db_fuzzy_regex(db_plate)
            if re.search(fuzzy_regex, detected_plate_text):
                match_found = True
                matched_visitor = serialize_doc(visitor)
                match_reason = f"Matched Vehicle Plate: {db_plate} (Camera detected: {detected_plate_text})"
                break
                
    if not match_found:
        visitors_with_faces = list(visits_collection.find({
            "members.photo": {"$exists": True, "$ne": None}
        }))
        matched_face_doc = match_face_in_db(live_frame_b64, visitors_with_faces)
        if matched_face_doc:
            match_found = True
            matched_visitor = serialize_doc(matched_face_doc)
            match_reason = "Matched via Face Recognition"

    if match_found:
        return jsonify({"success": True, "message": match_reason, "visitor": matched_visitor}), 200
    else:
        return jsonify({"success": False, "message": "No matching visitor found in the database. Entry denied."}), 404

@app.route("/api/admin/status/<visitor_id>", methods=["PUT"])
def update_visitor_status(visitor_id):
    data = request.json or {}
    new_status = data.get("status")
    
    if not new_status:
        return jsonify({"error": "No status provided"}), 400
    try:
        result = visits_collection.update_one(
            {"_id": ObjectId(visitor_id)},
            {"$set": {"status": new_status}}
        )
        if result.modified_count == 1 or result.matched_count == 1:
            receipts_collection.update_many({"visitorId": visitor_id}, {"$set": {"status": new_status}})
            return jsonify({"success": True, "message": f"Status updated to {new_status}"}), 200
        else:
            return jsonify({"success": False, "error": "Visitor not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/admin/visitors", methods=["GET"])
def get_visitors():
    try:
        visitors = list(visits_collection.find().sort("_id", -1).limit(100))
        return jsonify([serialize_doc(v) for v in visitors]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- NEW CRUD OPERATIONS FOR ADMIN ---
@app.route("/api/admin/visitors/<visitor_id>", methods=["PUT", "DELETE"])
def manage_visitor(visitor_id):
    try:
        if request.method == "DELETE":
            result = visits_collection.delete_one({"_id": ObjectId(visitor_id)})
            if result.deleted_count == 1:
                receipts_collection.delete_many({"visitorId": visitor_id})
                return jsonify({"success": True, "message": "Visitor deleted successfully"}), 200
            return jsonify({"success": False, "error": "Visitor not found"}), 404

        if request.method == "PUT":
            data = request.json
            if "_id" in data:
                del data["_id"] # prevent mongo immutable id error
            result = visits_collection.update_one({"_id": ObjectId(visitor_id)}, {"$set": data})
            return jsonify({"success": True, "message": "Visitor updated successfully"}), 200
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)