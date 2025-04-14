import os
import json
import nltk
import pandas as pd
import numpy as np
import re
from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Download necessary NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

app = Flask(__name__, static_folder='.')

# Load replacements from CSV
replacements_df = pd.read_csv('replacements_large.csv')
harmful_terms = replacements_df[replacements_df['category'] == 'harmful']['term'].tolist()
offensive_terms = replacements_df[replacements_df['category'] == 'offensive']['term'].tolist()
inappropriate_terms = replacements_df[replacements_df['category'] == 'inappropriate']['term'].tolist()

# Create training data
training_data = []
labels = []

for category, terms in [('harmful', harmful_terms), ('offensive', offensive_terms), ('inappropriate', inappropriate_terms)]:
    for term in terms:
        if category == 'harmful':
            training_data.extend([
                f"How to make a {term}",
                f"Instructions for creating {term}",
                f"Steps to build a {term}"
            ])
        elif category == 'offensive':
            training_data.extend([
                f"This is {term} terrible",
                f"I {term} hate this",
                f"You {term} idiot"
            ])
        elif category == 'inappropriate':
            training_data.extend([
                f"Watch {term} videos",
                f"Best {term} content",
                f"Free {term} online"
            ])
        labels.extend([category] * 3)

# Safe examples
safe_examples = [
    "How to bake a cake", "The weather is nice today", "I enjoyed reading that book",
    "Scientific research on climate change", "History of ancient civilizations",
    "Techniques for effective studying", "Tips for growing vegetables",
    "Benefits of regular exercise", "Latest technology innovations", "Travel destinations in Europe"
]
training_data.extend(safe_examples)
labels.extend(['safe'] * len(safe_examples))

# Create and train classifier
classifier = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
    ('clf', LogisticRegression(max_iter=1000))
])
classifier.fit(training_data, labels)

def analyze_text(text):
    if not text or len(text.strip()) < 5:
        return {"isHarmful": False, "category": "safe", "confidence": 1.0, "explanation": "Text is too short to analyze"}

    prediction = classifier.predict([text])[0]
    probs = classifier.predict_proba([text])[0]
    class_index = list(classifier.classes_).index(prediction)
    confidence = probs[class_index]

    explanations = {
        'harmful': 'This content may cause harm or promote harmful activities.',
        'offensive': 'This content contains offensive language or sentiments.',
        'inappropriate': 'This content contains inappropriate material that may be unsuitable.',
        'safe': 'This content appears to be safe.'
    }

    confidence_level = 'high' if confidence > 0.8 else 'moderate' if confidence > 0.6 else 'low'
    explanation = f"{explanations[prediction]} ({confidence_level} confidence)"

    return {
        "text": text,
        "isHarmful": prediction != 'safe',
        "category": prediction,
        "confidence": float(confidence),
        "explanation": explanation
    }

def rephrase_text(text, category):
    if category == 'safe':
        return {"original": text, "rephrased": text}

    filtered_df = replacements_df[replacements_df['category'] == category]
    rephrased = text
    original_length = len(text)

    for _, row in filtered_df.iterrows():
        term = re.escape(row['term'])
        replacement = row['replacement']
        rephrased = re.sub(r'\b' + term + r'\b', replacement, rephrased, flags=re.IGNORECASE)

    if len(rephrased.strip()) < original_length * 0.5:
        sentences = text.split('.')
        tag = {
            'harmful': ' (modified for safety)',
            'offensive': ' (offensive language removed)',
            'inappropriate': ' (inappropriate content modified)'
        }[category]
        rephrased = '. '.join([
            s.strip() + tag if any(term in s.lower() for term in filtered_df['term'].tolist()) else s
            for s in sentences if s.strip()
        ])

    if rephrased == text or not rephrased.strip():
        note = {
            'harmful': '[Note: This content has been identified as potentially harmful and should be approached with caution]',
            'offensive': '[Note: This content has been identified as containing offensive language]',
            'inappropriate': '[Note: This content has been identified as containing inappropriate material]'
        }[category]
        rephrased = text + " " + note

    return {
        "original": text,
        "rephrased": rephrased
    }

@app.route('/')
def index():
    with open('extension_simulator.html', 'r') as f:
        return f.read()

@app.route('/test_page.html')
def test_page():
    with open('test_page.html', 'r') as f:
        return f.read()

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    text = data.get('text', '')
    result = analyze_text(text)
    return jsonify(result)

@app.route('/rephrase', methods=['POST'])
def rephrase():
    data = request.json
    text = data.get('text', '')
    category = data.get('category', 'harmful')
    result = rephrase_text(text, category)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
