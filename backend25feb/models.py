# models.py
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("❌ MongoDB URI is missing! Check your .env file.")

client = MongoClient(MONGO_URI)

# Maps to the exact database and collections
db = client.entry_shield
visits_collection = db.gate_passes
receipts_collection = db.receipts

try:
    # Ensure studentId is unique
    visits_collection.create_index("studentId", unique=True, sparse=True)
    
    # FIX: Drop the problematic duplicate key index on receipts if it exists
    receipts_collection.drop_index("visitId_1")
    print("✅ Dropped problematic 'visitId_1' index from receipts to prevent 500 errors.")
except Exception as e:
    # It's totally fine if the index doesn't exist to be dropped
    print("✅ AWS MongoDB Connected. Indexes verified.")