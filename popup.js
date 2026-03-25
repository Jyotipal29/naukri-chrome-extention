// popup.js - Handles resume upload, status display, and manual trigger

const resumeFileInput = document.getElementById('resumeFileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const saveButton = document.getElementById('saveButton');
const testButton = document.getElementById('testButton');
const openNaukriButton = document.getElementById('openNaukriButton');
const toast = document.getElementById('toast');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const uploadCountEl = document.getElementById('uploadCount');
const lastUploadEl = document.getElementById('lastUpload');

let resumeBase64 = null;
let resumeFileName = null;

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

async function updateStatus() {
  const result = await chrome.storage.local.get(['resumeData', 'uploadCount', 'lastUpload']);

  if (result.resumeData) {
    statusDot.className = 'status-dot active';
    statusText.textContent = 'Active';
    testButton.disabled = false;
  } else {
    statusDot.className = 'status-dot inactive';
    statusText.textContent = 'Setup needed';
    testButton.disabled = true;
  }

  uploadCountEl.textContent = result.uploadCount || 0;

  if (result.lastUpload) {
    const date = new Date(result.lastUpload);
    const diffMs = Date.now() - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) lastUploadEl.textContent = 'Just now';
    else if (diffMins < 60) lastUploadEl.textContent = `${diffMins}m ago`;
    else if (diffHours < 24) lastUploadEl.textContent = `${diffHours}h ago`;
    else if (diffDays < 7) lastUploadEl.textContent = `${diffDays}d ago`;
    else lastUploadEl.textContent = date.toLocaleDateString();
  } else {
    lastUploadEl.textContent = '—';
  }
}

async function loadSavedData() {
  const result = await chrome.storage.local.get(['resumeFileName']);
  if (result.resumeFileName) {
    resumeFileName = result.resumeFileName;
    fileNameDisplay.textContent = `📎 ${resumeFileName}`;
    fileNameDisplay.classList.add('show');
  }
  await updateStatus();
}

function handleFileSelect(file) {
  if (file.size > 2 * 1024 * 1024) {
    showToast('File must be under 2MB', 'error');
    return;
  }
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(ext)) {
    showToast('Only PDF, DOC, or DOCX allowed', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    resumeBase64 = e.target.result;
    resumeFileName = file.name;
    fileNameDisplay.textContent = `📎 ${resumeFileName}`;
    fileNameDisplay.classList.add('show');
  };
  reader.onerror = () => showToast('Error reading file', 'error');
  reader.readAsDataURL(file);
}

// File input events
resumeFileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFileSelect(e.target.files[0]);
});

fileUploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileUploadArea.classList.add('dragover');
});

fileUploadArea.addEventListener('dragleave', () => {
  fileUploadArea.classList.remove('dragover');
});

fileUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  fileUploadArea.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});

fileUploadArea.addEventListener('click', () => resumeFileInput.click());

// Open Naukri login page
openNaukriButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.naukri.com/nlogin/login' });
});

// Save resume
saveButton.addEventListener('click', async () => {
  if (!resumeBase64) {
    showToast('Please select a resume file first', 'error');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    await chrome.storage.local.set({
      resumeData: resumeBase64,
      resumeFileName: resumeFileName
    });
    chrome.runtime.sendMessage({ action: 'REFRESH_ALARMS' });
    showToast('Resume saved! Uploads scheduled at 9 AM & 5 PM.', 'success');
    await updateStatus();
  } catch (err) {
    showToast('Error saving. Please try again.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save & Activate Schedule';
  }
});

// Test upload immediately
testButton.addEventListener('click', async () => {
  testButton.disabled = true;
  testButton.textContent = 'Starting...';
  await chrome.runtime.sendMessage({ action: 'TRIGGER_UPLOAD_NOW' });
  showToast('Upload triggered! Check the Naukri tab that opens.', 'success');
  setTimeout(() => window.close(), 1500);
});

loadSavedData();
