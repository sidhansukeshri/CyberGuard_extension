// AI Content Guardian - Popup Script
// Handles the extension popup UI and settings management

// DOM elements
const mainToggle = document.getElementById('mainToggle');
const autoRephraseToggle = document.getElementById('autoRephraseToggle');
const showWarningsToggle = document.getElementById('showWarningsToggle');
const sensitivityLevel = document.getElementById('sensitivityLevel');
const resetBtn = document.getElementById('resetBtn');

// Statistics elements
const contentAnalyzedCount = document.getElementById('contentAnalyzedCount');
const harmfulContentCount = document.getElementById('harmfulContentCount');
const rephrasedContentCount = document.getElementById('rephrasedContentCount');

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  autoRephrase: true,
  showWarnings: true,
  sensitivityLevel: 'medium'
};

// Default stats
const DEFAULT_STATS = {
  analyzed: 0,
  harmful: 0,
  rephrased: 0
};

// Load settings and stats when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadSettingsAndStats();
  
  // Set up an interval to refresh statistics every 2 seconds while popup is open
  // This ensures the statistics are always up-to-date
  const statsRefreshInterval = setInterval(refreshStats, 2000);
  
  // Clear interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(statsRefreshInterval);
  });
});

// Function to load both settings and stats
function loadSettingsAndStats() {
  // Load settings
  chrome.storage.local.get('settings', (data) => {
    const settings = data.settings || DEFAULT_SETTINGS;
    
    // Update UI to match settings
    mainToggle.checked = settings.enabled;
    autoRephraseToggle.checked = settings.autoRephrase;
    showWarningsToggle.checked = settings.showWarnings;
    sensitivityLevel.value = settings.sensitivityLevel;
    
    // Update UI state based on main toggle
    updateUIState(settings.enabled);
  });
  
  // Refresh stats
  refreshStats();
}

// Function to refresh statistics from storage
function refreshStats() {
  // Request latest stats from background script
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (response && response.stats) {
      const stats = response.stats;
      
      // Update UI with formatted stats
      contentAnalyzedCount.textContent = stats.analyzed.toLocaleString();
      harmfulContentCount.textContent = stats.harmful.toLocaleString();
      rephrasedContentCount.textContent = stats.rephrased.toLocaleString();
      
      // Add last updated indicator
      const lastUpdated = new Date(stats.lastReset);
      const resetDate = document.getElementById('lastResetDate');
      if (resetDate) {
        resetDate.textContent = `Last reset: ${lastUpdated.toLocaleDateString()}`;
      }
    }
  });
}

// Event listeners for toggles and controls
mainToggle.addEventListener('change', () => {
  const enabled = mainToggle.checked;
  updateUIState(enabled);
  saveSettings();
});

autoRephraseToggle.addEventListener('change', saveSettings);
showWarningsToggle.addEventListener('change', saveSettings);
sensitivityLevel.addEventListener('change', saveSettings);

resetBtn.addEventListener('click', resetStatistics);

// Update UI state based on main toggle
function updateUIState(enabled) {
  const settingsContainer = document.querySelector('.settings-container');
  const statsContainer = document.querySelector('.stats-container');
  
  if (enabled) {
    settingsContainer.classList.remove('disabled');
    statsContainer.classList.remove('disabled');
    autoRephraseToggle.disabled = false;
    showWarningsToggle.disabled = false;
    sensitivityLevel.disabled = false;
  } else {
    settingsContainer.classList.add('disabled');
    statsContainer.classList.add('disabled');
    autoRephraseToggle.disabled = true;
    showWarningsToggle.disabled = true;
    sensitivityLevel.disabled = true;
  }
}

// Save settings to storage and notify content scripts
function saveSettings() {
  const settings = {
    enabled: mainToggle.checked,
    autoRephrase: autoRephraseToggle.checked,
    showWarnings: showWarningsToggle.checked,
    sensitivityLevel: sensitivityLevel.value
  };
  
  // Save to storage
  chrome.storage.local.set({ settings }, () => {
    console.log('Settings saved:', settings);
    
    // Notify all tabs about the settings change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings
        }).catch(err => {
          // Suppress errors from tabs that don't have content scripts
          console.log('Could not update tab:', tab.id);
        });
      });
    });
  });
}

// Reset statistics
function resetStatistics() {
  // Use the background script's reset function to ensure consistency
  chrome.runtime.sendMessage({ type: 'RESET_STATS' }, (response) => {
    if (response && response.success) {
      // Update UI
      contentAnalyzedCount.textContent = '0';
      harmfulContentCount.textContent = '0';
      rephrasedContentCount.textContent = '0';
      
      // Show confirmation
      resetBtn.textContent = 'Reset Complete!';
      setTimeout(() => {
        resetBtn.textContent = 'Reset Statistics';
      }, 2000);
    }
  });
}
