// AI Content Guardian - Background Script
// Handles communication between content scripts and API services

// Configuration settings
const DEFAULT_SETTINGS = {
  enabled: true,
  autoRephrase: true,
  showWarnings: true,
  sensitivityLevel: 'medium' // Options: low, medium, high
};

// Default statistics
const DEFAULT_STATS = {
  analyzed: 0,
  harmful: 0,
  rephrased: 0,
  lastReset: Date.now()
};

// Initialize settings and stats when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS
  });
  console.log('AI Content Guardian installed with default settings.');
});

// Track when tab URL changes to trigger content refresh
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only when URL changes and page is complete
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      if (settings.enabled) {
        // Notify content script to re-analyze the page content
        chrome.tabs.sendMessage(tabId, { type: 'PAGE_CHANGED' })
          .catch(error => {
            console.log('Content script not yet loaded on this page');
            // This is expected for pages where the content script hasn't loaded yet
          });
      }
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TEXT') {
    analyzeTextContent(message.text)
      .then(result => {
        // Update statistics if harmful content was found
        if (result && result.isHarmful) {
          updateStatistics('harmful');
        }
        // Always update analyzed count
        updateStatistics('analyzed');
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error analyzing text:', error);
        sendResponse({ error: 'Failed to analyze text' });
      });
    return true; // Indicates asynchronous response
  }
  
  if (message.type === 'REPHRASE_TEXT') {
    rephraseTextContent(message.text, message.category)
      .then(result => {
        // Update statistics for rephrased content
        if (result && !result.error) {
          updateStatistics('rephrased');
        }
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error rephrasing text:', error);
        sendResponse({ error: 'Failed to rephrase text' });
      });
    return true; // Indicates asynchronous response
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse({ settings: data.settings || DEFAULT_SETTINGS });
    });
    return true; // Indicates asynchronous response
  }
  
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get('stats', (data) => {
      sendResponse({ stats: data.stats || DEFAULT_STATS });
    });
    return true; // Indicates asynchronous response
  }
  
  if (message.type === 'RESET_STATS') {
    const newStats = { ...DEFAULT_STATS, lastReset: Date.now() };
    chrome.storage.local.set({ stats: newStats }, () => {
      sendResponse({ success: true, stats: newStats });
    });
    return true; // Indicates asynchronous response
  }
});

// Update statistics in storage
function updateStatistics(type) {
  chrome.storage.local.get('stats', (data) => {
    const stats = data.stats || DEFAULT_STATS;
    
    // Update the appropriate counter
    if (type === 'analyzed') {
      stats.analyzed += 1;
    } else if (type === 'harmful') {
      stats.harmful += 1;
    } else if (type === 'rephrased') {
      stats.rephrased += 1;
    }
    
    // Save updated stats
    chrome.storage.local.set({ stats: stats });
  });
}

// Function to analyze text for harmful content using our local BERT-based model
async function analyzeTextContent(text) {
  try {
    // Use our local API endpoint for content analysis
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text
      })
    });

    if (!response.ok) {
      console.error(`API request failed with status ${response.status}`);
      // Fall back to the local analysis if API is unavailable
      const localResult = window.AIGuardianUtils.calculateLocalToxicityScore(text);
      return {
        text,
        isHarmful: localResult.isHarmful,
        category: localResult.category,
        confidence: localResult.confidence,
        explanation: localResult.explanation
      };
    }

    const result = await response.json();
    
    // Return the analysis results directly from our server
    return result;
  } catch (error) {
    console.error('Error analyzing content:', error);
    // Fall back to the local analysis if an error occurred
    const localResult = window.AIGuardianUtils.calculateLocalToxicityScore(text);
    return {
      text,
      isHarmful: localResult.isHarmful,
      category: localResult.category,
      confidence: localResult.confidence,
      explanation: localResult.explanation
    };
  }
}

// Function to rephrase harmful content using our local model
async function rephraseTextContent(text, category) {
  try {
    // Use our local API endpoint for content rephrasing
    const response = await fetch('http://localhost:5000/rephrase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        category: category
      })
    });

    if (!response.ok) {
      console.error(`API request failed with status ${response.status}`);
      // Fall back to the local rephrasing if API is unavailable
      const rephrased = window.AIGuardianUtils.localRephrase(text, category);
      return {
        original: text,
        rephrased: rephrased
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error rephrasing content:', error);
    // Fall back to the local rephrasing if an error occurred
    const rephrased = window.AIGuardianUtils.localRephrase(text, category);
    return {
      original: text,
      rephrased: rephrased
    };
  }
}

// Function to generate explanations based on content category
function generateExplanation(category, confidence) {
  const explanations = {
    'harmful': 'This content may cause harm or promote harmful activities.',
    'offensive': 'This content contains offensive language or sentiments.',
    'inappropriate': 'This content contains inappropriate material that may be unsuitable.',
    'safe': 'This content appears to be safe.'
  };
  
  const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'moderate' : 'low';
  
  return `${explanations[category]} (${confidenceLevel} confidence)`;
}
