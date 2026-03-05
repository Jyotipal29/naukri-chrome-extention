// popup.js - Popup logic for saving credentials, resume, and showing stats

// DOM elements
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const resumeFileInput = document.getElementById('resumeFileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const saveButton = document.getElementById('saveButton');
const toast = document.getElementById('toast');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const uploadCountEl = document.getElementById('uploadCount');
const lastUploadEl = document.getElementById('lastUpload');

// State
let resumeBase64 = null;
let resumeFileName = null;

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/**
 * Update status indicator
 */
async function updateStatus() {
  const result = await chrome.storage.local.get(['credentials', 'resumeData']);
  
  if (result.credentials?.email && result.credentials?.password && result.resumeData) {
    statusDot.classList.remove('inactive');
    statusDot.classList.add('active');
    statusText.textContent = 'Active';
  } else {
    statusDot.classList.remove('active');
    statusDot.classList.add('inactive');
    statusText.textContent = 'Setup needed';
  }
}

/**
 * Load saved data from storage
 */
async function loadSavedData() {
  const result = await chrome.storage.local.get([
    'credentials',
    'resumeData',
    'resumeFileName',
    'uploadCount',
    'lastUpload'
  ]);
  
  // Pre-fill credentials
  if (result.credentials) {
    emailInput.value = result.credentials.email || '';
    passwordInput.value = result.credentials.password || '';
  }
  
  // Show resume filename if exists
  if (result.resumeFileName) {
    resumeFileName = result.resumeFileName;
    fileNameDisplay.textContent = resumeFileName;
    fileNameDisplay.classList.add('show');
  }
  
  // Update stats
  uploadCountEl.textContent = result.uploadCount || 0;
  
  if (result.lastUpload) {
    const date = new Date(result.lastUpload);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    let timeStr = '';
    if (diffMins < 1) {
      timeStr = 'Just now';
    } else if (diffMins < 60) {
      timeStr = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      timeStr = `${diffHours}h ago`;
    } else if (diffDays < 7) {
      timeStr = `${diffDays}d ago`;
    } else {
      timeStr = date.toLocaleDateString();
    }
    
    lastUploadEl.textContent = timeStr;
    lastUploadEl.style.fontSize = '12px';
  } else {
    lastUploadEl.textContent = '—';
  }
  
  // Update status
  await updateStatus();
}

/**
 * Handle file selection
 */
function handleFileSelect(file) {
  // Validate file size (2MB = 2 * 1024 * 1024 bytes)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File size must be less than 2MB', 'error');
    return;
  }
  
  // Validate file type
  const validTypes = ['.pdf', '.doc', '.docx'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  if (!validTypes.includes(fileExtension)) {
    showToast('Please select a PDF, DOC, or DOCX file', 'error');
    return;
  }
  
  // Read file as base64
  const reader = new FileReader();
  reader.onload = (e) => {
    resumeBase64 = e.target.result;
    resumeFileName = file.name;
    
    // Update UI
    fileNameDisplay.textContent = resumeFileName;
    fileNameDisplay.classList.add('show');
  };
  
  reader.onerror = () => {
    showToast('Error reading file', 'error');
  };
  
  reader.readAsDataURL(file);
}

/**
 * File input change handler
 */
resumeFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFileSelect(file);
  }
});

/**
 * Drag and drop handlers
 */
fileUploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileUploadArea.classList.add('dragover');
});

fileUploadArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  fileUploadArea.classList.remove('dragover');
});

fileUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  fileUploadArea.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    resumeFileInput.files = files;
    handleFileSelect(files[0]);
  }
});

/**
 * Click on upload area to trigger file input
 */
fileUploadArea.addEventListener('click', () => {
  resumeFileInput.click();
});

/**
 * Save button click handler
 */
saveButton.addEventListener('click', async () => {
  // Validate email
  const email = emailInput.value.trim();
  if (!email) {
    showToast('Please enter your email', 'error');
    return;
  }
  
  // Validate password
  const password = passwordInput.value.trim();
  if (!password) {
    showToast('Please enter your password', 'error');
    return;
  }
  
  // Validate resume
  if (!resumeBase64) {
    showToast('Please select a resume file', 'error');
    return;
  }
  
  // Disable button and show saving state
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';
  
  try {
    // Save to storage
    await chrome.storage.local.set({
      credentials: {
        email: email,
        password: password
      },
      resumeData: resumeBase64,
      resumeFileName: resumeFileName
    });
    
    // Refresh alarms in background
    chrome.runtime.sendMessage({ action: 'REFRESH_ALARMS' });
    
    // Show success toast
    showToast('Settings saved successfully!', 'success');
    
    // Update status
    await updateStatus();
    
    // Re-enable button
    saveButton.disabled = false;
    saveButton.textContent = 'Save & Activate Schedule';
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings. Please try again.', 'error');
    saveButton.disabled = false;
    saveButton.textContent = 'Save & Activate Schedule';
  }
});

// Load saved data on popup open
loadSavedData();
