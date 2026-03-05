// content.js - Content script for login and resume upload automation

let uploadAttempted = false; // Guard to prevent duplicate upload attempts

// Store upload data for retry after redirect
const UPLOAD_DATA_KEY = 'naukri_upload_data';

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if user is logged in to Naukri
 */
function checkIfLoggedIn() {
  const selectors = [
    'a[href*="logout"]',
    '.nI-gNb-drawer__toggle',
    '.nI-gNb-icon--profile'
  ];
  
  return selectors.some(selector => {
    const element = document.querySelector(selector);
    return element !== null;
  });
}

/**
 * Perform login with provided credentials
 */
async function performLogin(credentials) {
  // Redirect to login page
  window.location.href = 'https://www.naukri.com/nlogin/login';
  await sleep(3000);
  
  // Find email input field
  const emailSelectors = [
    'input[type="text"][placeholder*="Email"]',
    'input[id="usernameField"]',
    'input[name="email"]',
    'input[type="text"][name*="email"]'
  ];
  
  let emailInput = null;
  for (const selector of emailSelectors) {
    emailInput = document.querySelector(selector);
    if (emailInput) break;
  }
  
  // Find password input field
  const passwordInput = document.querySelector('input[type="password"]');
  
  if (!emailInput || !passwordInput) {
    throw new Error('Could not find login fields');
  }
  
  // Fill in email
  emailInput.value = credentials.email;
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
  emailInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(500);
  
  // Fill in password
  passwordInput.value = credentials.password;
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(500);
  
  // Find and click submit button
  const submitSelectors = [
    'button[type="submit"]',
    '.loginButton',
    'button[class*="login"]',
    'input[type="submit"]'
  ];
  
  let submitButton = null;
  for (const selector of submitSelectors) {
    submitButton = document.querySelector(selector);
    if (submitButton) break;
  }
  
  if (!submitButton) {
    throw new Error('Could not find login submit button');
  }
  
  submitButton.click();
  await sleep(4000);
  
  // Verify login
  if (!checkIfLoggedIn()) {
    throw new Error('Login failed. Please verify your credentials.');
  }
}

/**
 * Convert base64 string to File object
 */
function base64ToFile(base64String, fileName) {
  // Detect mime type from file extension
  const extension = fileName.split('.').pop().toLowerCase();
  let mimeType = 'application/octet-stream';
  
  if (extension === 'pdf') {
    mimeType = 'application/pdf';
  } else if (extension === 'docx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (extension === 'doc') {
    mimeType = 'application/msword';
  }
  
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  // Decode base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create Blob and File
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Upload resume to Naukri profile
 */
async function uploadResume(resumeBase64, fileName) {
  await sleep(2000);
  
  // Find file input
  let fileInput = document.querySelector('input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"]');
  
  // If not found, try to find and click "Update Resume" button
  if (!fileInput) {
    const uploadButtonSelectors = [
      'button[class*="resume"]',
      '.upload-btn',
      '[class*="uploadResume"]'
    ];
    
    // Try selectors first
    for (const selector of uploadButtonSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        button.click();
        await sleep(1500);
        break;
      }
    }
    
    // Also try finding by text content
    if (!fileInput) {
      const allButtons = document.querySelectorAll('button');
      for (const button of allButtons) {
        const text = button.textContent.toLowerCase();
        if (text.includes('update resume') || text.includes('upload resume')) {
          button.click();
          await sleep(1500);
          break;
        }
      }
    }
    
    // Retry finding file input
    fileInput = document.querySelector('input[type="file"]');
  }
  
  if (!fileInput) {
    throw new Error('Could not find file upload input');
  }
  
  // Convert base64 to File object
  const file = base64ToFile(resumeBase64, fileName);
  
  // Use DataTransfer to assign file
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  
  // Dispatch change event
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  await sleep(3000);
  
  // Look for save/confirm button
  const saveButtonSelectors = [
    'button[class*="save"]',
    'button[class*="upload"]',
    '.saveBtn'
  ];
  
  let saveButton = null;
  for (const selector of saveButtonSelectors) {
    saveButton = document.querySelector(selector);
    if (saveButton && !saveButton.disabled) {
      break;
    }
  }
  
  // Also try finding by text content
  if (!saveButton || saveButton.disabled) {
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      const text = button.textContent.toLowerCase();
      if ((text.includes('save') || text.includes('upload')) && !button.disabled) {
        saveButton = button;
        break;
      }
    }
  }
  
  if (saveButton && !saveButton.disabled) {
    saveButton.click();
    await sleep(2000);
  }
  
  // Send success message
  chrome.runtime.sendMessage({ action: 'UPLOAD_SUCCESS' });
}

/**
 * Process upload with stored data
 */
async function processUpload(uploadData) {
  // Guard against duplicate runs
  if (uploadAttempted) {
    console.log('Upload already attempted, ignoring duplicate');
    return;
  }
  
  uploadAttempted = true;
  
  try {
    await sleep(2000); // Let page settle
    
    // Check if logged in
    if (!checkIfLoggedIn()) {
      await performLogin(uploadData.credentials);
      await sleep(4000);
    }
    
    // Check if on profile page
    if (!window.location.href.includes('/mnjuser/profile')) {
      // Store data for retry after redirect
      sessionStorage.setItem(UPLOAD_DATA_KEY, JSON.stringify(uploadData));
      window.location.href = 'https://www.naukri.com/mnjuser/profile';
      return;
    }
    
    // Clear stored data since we're on the right page
    sessionStorage.removeItem(UPLOAD_DATA_KEY);
    
    await sleep(3000);
    
    // Upload resume
    await uploadResume(uploadData.resumeData, uploadData.resumeFileName);
    
  } catch (error) {
    console.error('Upload error:', error);
    sessionStorage.removeItem(UPLOAD_DATA_KEY);
    chrome.runtime.sendMessage({
      action: 'UPLOAD_FAILED',
      reason: error.message
    });
  }
}

/**
 * Main message handler
 */
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === 'START_UPLOAD') {
    processUpload(msg);
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open
});

// Check for stored upload data on page load (for retry after redirect)
window.addEventListener('load', () => {
  setTimeout(() => {
    const storedData = sessionStorage.getItem(UPLOAD_DATA_KEY);
    if (storedData) {
      try {
        const uploadData = JSON.parse(storedData);
        processUpload(uploadData);
      } catch (error) {
        console.error('Error parsing stored upload data:', error);
        sessionStorage.removeItem(UPLOAD_DATA_KEY);
      }
    }
  }, 2000);
});
