# AI Doctor Assistant — Smart Health Prediction Web App

A full-stack AI-powered web application for smart, interactive preliminary health analysis. Users can enter their symptoms, personal info, and upload lab reports for instant ML-based disease predictions — all with a modern frontend and a FastAPI backend.

---

## 🚀 Features

- **AI-powered Disease Prediction System**
  - Intuitive symptom search with autocomplete, synonym, and typo handling
  - Multi-symptom selection and chip-style UI
  - Upload PDFs/images/scanned lab reports  
  - Optional personal info for demographic-aware analysis
- **End-to-End Machine Learning Pipeline**
  - Data collection, preprocessing, training, and explainability in modular notebooks
  - Model: Random Forest Classifier trained on real-world health data
- **Explainability**
  - Automatic model explanation using SHAP: "Why this prediction?"
- **Modern, Responsive Frontend**
  - Built with TailwindCSS, vanilla JS, and FontAwesome icons
  - Animated UI, smooth scrolling, copy/download/share options for reports

---

## 📦 Folder Structure
```
backend/
models/     # Trained model and feature metadata
app.py      # FastAPI backend web server
requirements.txt
...
data/         # Raw, processed, and lookup CSVs
frontend/
index.html
script.js
style.css
notebooks/    # Jupyter ML pipeline and analysis
.venv/        # (Not committed)

```
---

## 🖼️ Screenshots

<!-- Paste images here or drag-and-drop after first pushing to GitHub -->
**Landing Page**
<img width="3167" height="1466" alt="image" src="https://github.com/user-attachments/assets/a2e681e2-41de-4e33-a0b2-a76f7e45bd05" />

![AI Analysis Tool]
<img width="3170" height="1729" alt="image" src="https://github.com/user-attachments/assets/7d963fd9-8b1e-4acd-bf6b-e244903d404e" />

![Rest of the Webpage]
<img width="3166" height="1730" alt="image" src="https://github.com/user-attachments/assets/028bd6a4-928b-4fd8-9597-b9c8fd725372" />


![Results Example]
<img width="3168" height="1727" alt="image" src="https://github.com/user-attachments/assets/b22b3dd9-0bc1-42bc-a41b-e33ded41dc4d" />
<img width="3169" height="1193" alt="image" src="https://github.com/user-attachments/assets/a10a8c88-8d8d-4332-be37-fd203fd8c0b6" />
<img width="3164" height="1412" alt="image" src="https://github.com/user-attachments/assets/d3be615c-76ac-4838-af99-fb6e34210ee9" />



---

## 🔧 Setup & Usage

1. Clone the repo:
git clone https://github.com/your-username/ai-doctor-assistant.git
cd ai-doctor-assistant


2. Create and activate a Python virtual environment:
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate


3. Install dependencies:
pip install -r backend/requirements.txt


4. Run the FastAPI backend:
cd backend
uvicorn app:app --reload


5. Open the frontend:
- Open `frontend/index.html` in your browser directly.
- _or_ serve it with a static server (`python -m http.server` from inside the `frontend` folder), then open `http://localhost:8000/`.

---

## 📝 Notebooks

- `01_load_data.ipynb` - Load, clean, and explore raw data
- `02_preprocess_data.ipynb` - Feature engineering and dataset construction
- `03_train_models.ipynb` - Build and evaluate ML disease prediction models
- `04_model_explainability.ipynb` - SHAP and explainability analysis

---

## 🤖 Tech Stack

- **Frontend:** HTML, TailwindCSS, JS, FontAwesome
- **Backend:** Python, FastAPI, scikit-learn, SHAP, pandas
- **ML/Explainability:** Random Forest, SHAP
- **OCR/NLP:** Pytesseract, spaCy, fuzzywuzzy

---

## 📄 License

[MIT](LICENSE)  (add your license here!)

---
