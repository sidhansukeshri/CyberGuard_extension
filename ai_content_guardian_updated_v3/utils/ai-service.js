// AI Content Guardian - AI Service Utilities
// Provides helper functions for AI content analysis and rephrasing

/**
 * Handles text tokenization for processing large blocks of text
 * @param {string} text - The text to tokenize
 * @param {number} maxLength - Maximum token length
 * @return {Array} - Array of text chunks
 */
function tokenizeText(text, maxLength = 500) {
  // Simple tokenization by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed max length, store current chunk and start a new one
    if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    currentChunk += sentence + ' ';
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Calculates the toxicity score of text based on keywords and patterns
 * Used as a fallback when the AI service is unavailable
 * @param {string} text - The text to analyze
 * @return {Object} - Analysis result with score and category
 */
function calculateLocalToxicityScore(text) {
  const lowerText = text.toLowerCase();
  
  // Define patterns for different categories
  const patterns = {
    harmful: [
      /how to (make|create|build) (bomb|explosive|weapon)/i,
      /suicide method/i,
      /kidnap/i,
      /\bkill\b.*\bpeople\b/i,
    ],
    offensive: [
      /\bf[*\w]ck\b/i,
      /\bs[*\w]it\b/i,
      /\ba[*\w]s\b/i,
      /\bb[*\w]tch\b/i,
      /\bn[*\w]gg[*\w]r\b/i,
      /\bc[*\w]nt\b/i,
    ],
    inappropriate: [
      /porn/i,
      /nude/i,
      /sex/i,
      /genital/i,
    ]
  };
  
  // Check for matches in each category
  for (const [category, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      if (regex.test(lowerText)) {
        return {
          isHarmful: true,
          category,
          confidence: 0.7, // Lower confidence for local detection
          explanation: `This content may contain ${category} material (detected locally)`
        };
      }
    }
  }
  
  // No matches found
  return {
    isHarmful: false,
    category: 'safe',
    confidence: 0.6,
    explanation: 'This content appears to be safe (analyzed locally)'
  };
}

/**
 * Performs basic rephrasing of harmful content
 * Used as a fallback when the AI service is unavailable
 * @param {string} text - The text to rephrase
 * @param {string} category - The harmful category
 * @return {string} - Rephrased text
 */
function localRephrase(text, category) {
  let rephrased = text;
  
  // Basic word replacements
  const replacements = {
    // Offensive words
    'fuck': '****',
    'shit': '****',
    'bitch': '*****',
    'ass': '***',
    // Harmful words
    'kill': 'harm',
    'bomb': 'device',
    'weapon': 'tool',
    // Inappropriate words
    'porn': 'content',
    'nude': 'unclothed',
    'sex': 'intimacy'
  };
  
  // Apply replacements
  for (const [word, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    rephrased = rephrased.replace(regex, replacement);
  }
  
  // For sentences with severe issues, add a replacement notice
  if (category === 'harmful') {
    rephrased = '[This content has been modified for safety reasons]';
  }
  
  return rephrased;
}

// Export utilities for use in other scripts
window.AIGuardianUtils = {
  tokenizeText,
  calculateLocalToxicityScore,
  localRephrase
};
