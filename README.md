# Naukri Resume Auto-Uploader Chrome Extension

A Chrome Extension (Manifest V3) that automatically uploads your resume to your Naukri.com profile twice daily at **9:00 AM** and **5:00 PM**.

## Features

- ✅ Automatic resume uploads twice daily (9 AM & 5 PM)
- ✅ Secure local storage of credentials (never sent to external servers)
- ✅ Beautiful dark-themed UI
- ✅ Drag-and-drop resume upload
- ✅ Upload statistics tracking
- ✅ Desktop notifications for upload status
- ✅ Automatic login handling

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `naukri-chrome-extention` folder
5. The extension icon should appear in your Chrome toolbar

## Setup

1. Click the extension icon in your Chrome toolbar
2. Enter your Naukri.com email and password
3. Upload your resume file (PDF, DOC, or DOCX, max 2MB)
4. Click "Save & Activate Schedule"
5. The extension will automatically upload your resume at the scheduled times

## How It Works

- The extension uses Chrome's `alarms` API to schedule daily uploads
- When an alarm fires, it opens Naukri.com in a background tab
- The content script automatically logs in (if needed) and uploads your resume
- You'll receive a notification when the upload completes or fails

## File Structure

```
naukri-extension/
├── manifest.json       # Extension configuration
├── background.js       # Service worker - alarms & scheduling
├── content.js          # Content script - login & upload automation
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
└── icons/              # Extension icons
```

## Privacy & Security

- All credentials and resume data are stored locally on your device using `chrome.storage.local`
- No data is sent to external servers
- The extension only accesses `https://*.naukri.com/*` domains

## Troubleshooting

- **Upload fails**: Check that your Naukri credentials are correct and your resume file is valid
- **Notifications not showing**: Ensure Chrome notifications are enabled for the extension
- **Alarms not firing**: The extension sets up alarms on install and browser startup. If issues persist, try reloading the extension

## Development

To regenerate icons:
```bash
python3 generate_icons.py
```

## License

This extension is provided as-is for personal use.
