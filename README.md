# Naukri Resume Auto-Uploader Chrome Extension

A Chrome Extension (Manifest V3) that automatically uploads your resume to your Naukri.com profile twice daily at **9:00 AM** and **5:00 PM**.

## Features

- Automatic resume uploads twice daily (9 AM & 5 PM)
- Uses your existing Naukri browser session — no password storage
- Drag-and-drop resume upload (PDF, DOC, DOCX, max 2MB)
- Upload count and last upload time tracking
- Desktop notifications on success
- "Test Upload Now" button to verify setup instantly

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `naukri-chrome-extention` folder
5. The extension icon will appear in your Chrome toolbar

## Setup

1. Click the extension icon to open the popup
2. Click **"Open Naukri to Login"** — log in to Naukri.com in the tab that opens
3. Come back to the popup and upload your resume file
4. Click **"Save & Activate Schedule"**
5. Click **"Test Upload Now"** to verify it works

That's it. The extension will upload your resume automatically every day at 9 AM and 5 PM as long as Chrome is running and you are logged into Naukri.

## How It Works

1. Chrome's `alarms` API triggers at 9 AM and 5 PM daily
2. The background service worker opens `naukri.com/mnjuser/profile` in a new tab
3. If the dashboard loads first, the script clicks **"View profile"** to navigate to the profile page
4. The script finds the hidden `#attachCV` file input in the resume section
5. It assigns your saved resume file and triggers Naukri's upload handler
6. After ~20 seconds the tab closes automatically and you get a success notification

The extension uses your existing logged-in Naukri session — no credentials are stored.

## File Structure

```
naukri-chrome-extention/
├── manifest.json       # Extension configuration (MV3)
├── background.js       # Service worker — alarms, scheduling, script injection
├── content.js          # Minimal content script (upload handled by background)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic — resume save, test trigger, status
└── icons/              # Extension icons (16, 48, 128px)
```

## Privacy & Security

- Resume file is stored locally using `chrome.storage.local` — never sent to any external server
- No passwords or credentials are stored anywhere
- The extension only has access to `https://*.naukri.com/*`

## Troubleshooting

- **Upload not happening**: Make sure you are logged into Naukri in Chrome. Click "Open Naukri to Login" in the popup to check.
- **Tab opens but nothing happens**: Naukri may have updated their page structure. Open an issue with a screenshot of `naukri.com/mnjuser/profile`.
- **Notifications not showing**: Go to Chrome Settings → Notifications and make sure the extension is allowed.
- **Alarms not firing**: Reload the extension from `chrome://extensions/` to reset the alarm schedule.
