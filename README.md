# AI Content Guardian - Chrome Extension

A Chrome extension that uses AI to detect, warn about, and rephrase harmful web content in real-time, providing a safer browsing experience without completely blocking access to content.

## Features

- **Real-time Content Analysis:** Scans webpage content as you browse using a machine learning model
- **Multiple Detection Categories:** Identifies harmful, offensive, and inappropriate content
- **Visual Warning System:** Adds non-intrusive warning badges to flagged content
- **Automatic Content Rephrasing:** Replaces harmful content with safer alternatives (highlighted in yellow)
- **Customizable Settings:** Adjust sensitivity levels and choose which protections to enable
- **High Performance:** Optimized batch processing to minimize lag and browser slowdown
- **Dynamic Page Support:** Automatically analyzes content when navigating between pages
- **Usage Statistics:** Tracks how many pieces of content have been analyzed and modified

## Installation Guide

### Prerequisites
- Google Chrome browser (Version 88 or higher)
- Internet connection for using the ML model for content analysis

### Installation Steps

1. **Download the Extension:**
   - Download the ZIP file containing the extension
   - Extract the ZIP file to a location on your computer

2. **Install in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the extracted extension folder
   - The extension should now be installed and visible in your extensions list

3. **Start the Server:**
   - Open a terminal/command prompt
   - Navigate to the extension folder
   - Install required Python packages: `pip install flask nltk scikit-learn numpy`
   - Run the server: `python server.py`
   - The server will start on port 5000

4. **Using the Extension:**
   - Click the AI Content Guardian icon in your browser toolbar
   - Enable or disable protection using the toggle switch
   - Adjust settings as needed:
     - Auto-Rephrase: Automatically replace harmful content
     - Show Warnings: Display warning indicators near harmful content
     - Sensitivity Level: Choose between Low, Medium, or High

## Test Page

The extension comes with a test page to demonstrate its functionality:
- After starting the server, visit: http://localhost:5000/test_page.html
- This page contains various examples of harmful, offensive, and inappropriate content
- Enable the extension to see it detect and modify the content in real-time

## Privacy Considerations

This extension prioritizes user privacy:
- Analysis is performed locally when possible and via a local server
- No browsing history or user data is collected or stored
- All content analysis happens on your own device

## Troubleshooting

- **Extension Not Working:**
  - Make sure the server is running (`python server.py`)
  - Check that you're connected to the internet
  - Verify the extension is enabled in Chrome

- **Content Not Being Analyzed:**
  - Check if the extension is enabled via the popup
  - Some complex web pages may require a refresh to analyze all content
  - Very short text snippets (less than 10 characters) are not analyzed
  - UI elements and navigation items are ignored to improve performance

- **Performance Issues:**
  - If the extension feels slow, try setting a higher sensitivity level to reduce processing
  - The extension now uses batch processing to minimize lag
  - Analysis is prioritized based on content importance

## Customization

Advanced users can customize the extension:
- Edit `server.py` to adjust the ML model's thresholds and categories
- Modify detection patterns in `utils/ai-service.js` for local detection
- Create custom styling in `styles/content.css`

## License

This project is provided for educational purposes only. Use responsibly.

---

For questions or support, please open an issue on the project repository.