from fastapi import FastAPI, HTTPException, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import joblib
import pandas as pd
import numpy as np
import json
import os
import io
from typing import List
from fastapi import Query
from fuzzywuzzy import process
from fastapi import Body
from fastapi import UploadFile, File
import re
import spacy
from textblob import TextBlob
import pytesseract
from PIL import Image
import pdfplumber
import shap

ner_nlp = spacy.load("en_core_web_sm")
def humanize_feature_name(feat):
    return feat.replace('_', ' ').replace('-', ' ').capitalize()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8001", "http://localhost:8001", "*"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["Content-Type", "Authorization", "*"],
    expose_headers=["*"]
)

current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, "models", "disease_prediction_model.pkl")
label_mapping_path = os.path.join(current_dir, "models", "label_mapping.json")
feature_names_path = os.path.join(current_dir, "models", "feature_names.csv")

print(f"\nModel path: {model_path}")
print(f"Label mapping path: {label_mapping_path}")
print(f"Features path: {feature_names_path}")


try:
    print("\nLoading model...")
    model = joblib.load(model_path)
    print("✅ Model loaded successfully")
    
    print("\nLoading label mapping...")
    with open(label_mapping_path) as f:
        label_mapping = json.load(f)
    print(f"✅ Loaded {len(label_mapping)} diseases")
    
    print("\nLoading features...")
    X = pd.read_csv(os.path.join(current_dir, "../data/X_processed.csv"))
    features = list(X.columns)
    print(f"✅ Loaded {len(features)} features from X_processed.csv")
    print("Sample features:", features[:5])
    
    
except Exception as e:
    print(f"❌ Error loading model files: {e}")
    raise
# SHAP Explainer (build once at startup)
try:
    shap_explainer = shap.TreeExplainer(model)
    print("✅ SHAP explainer loaded")
except Exception as e:
    shap_explainer = None
    print("❌ SHAP explainer error: ", e)

synonym_file = os.path.join(current_dir, "../data/symptom_synonyms.json")
with open(synonym_file) as f:
    synonym_dict = json.load(f)
symptom_terms = []
term_to_main = {}
for main, syns in synonym_dict.items():
    symptom_terms.append(main)
    term_to_main[main.lower()] = main
    for syn in syns:
        symptom_terms.append(syn)
        term_to_main[syn.lower()] = main

print(f"\nLoaded {len(term_to_main)} symptom mappings")

frontend_path = os.path.abspath(os.path.join(current_dir, "..", "frontend"))
print(f"\nLooking for frontend at: {frontend_path}")

if os.path.exists(frontend_path):
    print("✅ Found frontend directory")
    app.mount("/app", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    print(f"❌ Frontend directory not found at: {frontend_path}")
    print("Current directory structure:")
    print(os.listdir(os.path.dirname(current_dir)))

@app.options("/predict")
async def predict_options():
    return {"status": "ok"}

@app.post("/predict")
async def predict_disease(
    symptoms: str = Form(...),  # JSON string of symptoms
    age: str = Form(None),
    gender: str = Form(None),
    weight: str = Form(None),
    height: str = Form(None),
    lab_reports: List[UploadFile] = File(None)
):
    print(f"Received request: POST /predict")
    try:
        # Parse the symptoms JSON string
        symptoms_data = json.loads(symptoms)
        print("Received symptoms:", symptoms_data)
        
        if not isinstance(symptoms_data, list):
            raise HTTPException(400, "Invalid input format - 'symptoms' must be a JSON list")
        
        print("Processing symptoms:", symptoms_data)
        
        clean_features = [f.strip() for f in features]
        backend_symptoms = []
        unmatched = []
        
        for symptom in symptoms_data:
            mapped = term_to_main.get(symptom)
            converted = symptom.lower().replace(" ", "_")
            
            if mapped and mapped in clean_features:
                backend_symptoms.append(mapped)
            elif converted in clean_features:
                backend_symptoms.append(converted)
            else:
                unmatched.append(symptom)
        
        print("Mapped symptoms:", backend_symptoms)
        if unmatched:
            print("Unmapped symptoms:", unmatched)

        input_vector = [1 if symptom in backend_symptoms else 0 for symptom in clean_features]
        probabilities = model.predict_proba([input_vector])[0]
        
        predictions = []
        for i, prob in enumerate(probabilities):
            if prob > 0.01:
                predictions.append({
                    "disease": label_mapping[str(i)],
                    "probability": round(float(prob) * 100, 2)
                })
        
        predictions.sort(key=lambda x: x["probability"], reverse=True)

        explanation_text = ""
        top_features = []

        if shap_explainer:
            shap_vals = shap_explainer.shap_values(np.array([input_vector]))
            pred_class_idx = None
            if predictions and predictions[0]['disease']:
                for k, v in label_mapping.items():
                    if v == predictions[0]['disease']:
                        pred_class_idx = int(k)
                        break

            print("SHAP debugging info:")
            print("  shap_vals type:", type(shap_vals))
            if isinstance(shap_vals, list):
                print("  shap_vals len:", len(shap_vals))
                for idx, arr in enumerate(shap_vals):
                    print(f"  shap_vals[{idx}] shape:", np.shape(arr))
            else:
                print("  shap_vals shape:", np.shape(shap_vals))
            print("  pred_class_idx:", pred_class_idx)

            vals = None
            # Safe selection for multiclass OR binary SHAP output:
            if isinstance(shap_vals, list) and pred_class_idx is not None and pred_class_idx < len(shap_vals):
                vals = shap_vals[pred_class_idx][0]
            elif isinstance(shap_vals, list) and len(shap_vals) == 1:
                vals = shap_vals[0][0]  # single-class
            elif isinstance(shap_vals, np.ndarray):
                vals = shap_vals[0]
            else:
                explanation_text = "Model explanation is unavailable (internal)"
            
            def to_scalar(x):
                if isinstance(x, np.ndarray):
                    # If array has more than 1 element, just take the first (or fallback 0)
                    if x.size == 1:
                        return x.item()
                    else:
                        return float(x.flat[0])
                if isinstance(x, list):
                    return x[0]
                return x

            if vals is not None:
                # Get top positive (important) features
                top_idx = vals.argsort()[-3:][::-1].tolist()
                if top_idx and isinstance(top_idx[0], list):  # flatten if needed
                    top_idx = [item for sublist in top_idx for item in sublist]
                top_features = [
                    features[int(i)]
                    for i in top_idx
                    if to_scalar(input_vector[int(i)]) == 1 and to_scalar(vals[int(i)]) > 0
                ]
                if not top_features:
                    top_features = [features[int(i)] for i in top_idx]
                if top_features:
                    feat_nice = [humanize_feature_name(f) for f in top_features[:3]]
                    explanation_text = (
                        f"Most important symptoms for this prediction: "
                        + ", ".join(feat_nice)
                        + "."
                    )   
                else:
                    explanation_text = (
                        f"The prediction for <b>{predictions[0]['disease']}</b> was based on your provided symptoms."
                    )
            else:
                explanation_text = "Explanation is not available due to a server limitation."
        # Handle file uploads (optional processing)
        if lab_reports:
            print(f"Received {len(lab_reports)} lab report files")
            for file in lab_reports:
                print(f"File: {file.filename}, Size: {file.size} bytes")
                # Add file processing logic here if needed (e.g., save or analyze)

        return {
            "most_likely": predictions[0] if predictions else None,
            "possible": predictions[1:4],
            "matched_symptoms": backend_symptoms,
            "explanation": explanation_text
        }
        
    except json.JSONDecodeError as e:
        print("JSON decode error:", str(e))
        raise HTTPException(400, detail="Invalid JSON format for 'symptoms'")
    except Exception as e:
        print("Prediction error:", str(e))
        raise HTTPException(400, detail=str(e))

@app.get("/symptom_suggest")
def symptom_suggest(query: str = Query(...)):
    if not query: return {"suggestions": []}
    results = process.extractBests(query, symptom_terms, limit=6, score_cutoff=60)
    mains = []
    for res, score in results:
        canonical = term_to_main.get(res.lower(), res)
        if canonical not in mains:
            mains.append(canonical)
    return {"suggestions": mains[:5]}

@app.post("/extract_entities")
async def extract_entities(payload: dict = Body(...)):
    text = payload.get("text", "")
    doc = ner_nlp(text)
    symptoms, body_parts = [], []
    duration, sentiment = "", ""
    # Basic NER (expand labels for better results)
    for ent in doc.ents:
        if ent.label_ in ["SYMPTOM", "DISEASE", "NORP", "EVENT"]:
            symptoms.append(ent.text)
        if ent.label_ in ["ORG", "GPE", "LOC", "FAC"]:
            body_parts.append(ent.text)
        if ent.label_ == "DATE":
            duration = ent.text
    # Fallback: keyword search
    if not symptoms:
        for tok in doc:
            if any(word in tok.lemma_.lower() for word in ["ache", "pain", "cough", "fever", "tired", "fatigue", "nausea", "dizzy", "headache"]):
                symptoms.append(tok.text)

    # After/inside fallback symptom chunk extraction
    for chunk in doc.noun_chunks:
        text = chunk.text.lower().strip()
        # Fuzzy match against all symptoms
        best, score = process.extractOne(text, list(term_to_main.keys()))
        if score >= 85:   # or use 70 for more forgiving
            symptoms.append(term_to_main[best])

    # TextBlob sentiment
    try:
        sentpol = TextBlob(text).sentiment.polarity
        if sentpol < -0.2: sentiment = "Negative"
        elif sentpol > 0.2: sentiment = "Positive"
        else: sentiment = "Neutral"
    except:
        sentiment = "Neutral"
    return {"symptoms": list(set(symptoms)), "body_parts": list(set(body_parts)), "duration": duration, "sentiment": sentiment}

def ocr_image(file_bytes):
    image = Image.open(io.BytesIO(file_bytes))
    text = pytesseract.image_to_string(image)
    return text

def extract_text_pdf(file_bytes):
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        texts = [page.extract_text() for page in pdf.pages if page.extract_text()]
    return "\n".join(texts)

@app.post("/analyze_lab_report")
async def analyze_lab_report(file: UploadFile = File(...)):
    ext = file.filename.lower().split('.')[-1]
    raw_bytes = await file.read()
    try:
        if ext in ["jpg", "jpeg", "png"]:
            text = ocr_image(raw_bytes)
        elif ext == "pdf":
            text = extract_text_pdf(raw_bytes)
        else:
            return {"error": "Unsupported file type"}
    except Exception as e:
        return {"error": f"Failed to process file: {str(e)}"}

    # Basic extraction of "Test: Value Units (optional Ref Range)"
    pattern = re.compile(r'([A-Za-z \(\)\-/]+)\s*[:\-]?\s*([\d\.]+)\s*([^\s\d]+)?(?:.*?(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*)?', re.I)
    findings = []
    for match in pattern.findall(text):
        test, value, units, ref_lo, ref_hi = match
        if test and value:
            findings.append({
                "test_name": test.strip(),
                "value": value,
                "units": units.strip() if units else "",
                "reference_range": f"{ref_lo}-{ref_hi}" if ref_lo and ref_hi else ""
            })
    # Make a summary
    summary = "Extracted results:\n" + "\n".join(
        f"{f['test_name']}: {f['value']} {f['units']} (Ref: {f['reference_range']})" for f in findings
    )
    return {"findings": findings, "summary": summary, "raw": text[:1000]}  # limit raw for demo

if __name__ == "__main__":
    import uvicorn
    print("\nStarting server...")
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8001,
        reload=True,
        log_level="debug"
    )