// background.js - Handles alarms, scheduling, and resume upload via scripting API

function getNextAlarmTime(hour, minute) {
  const now = new Date();
  const alarm = new Date();
  alarm.setHours(hour, minute, 0, 0);
  if (alarm <= now) alarm.setDate(alarm.getDate() + 1);
  return alarm.getTime();
}

async function setupAlarms() {
  const existing = await chrome.alarms.getAll();
  for (const alarm of existing) {
    if (alarm.name.startsWith('naukri_upload_')) {
      await chrome.alarms.clear(alarm.name);
    }
  }
  chrome.alarms.create('naukri_upload_morning', {
    when: getNextAlarmTime(9, 0),
    periodInMinutes: 1440
  });
  chrome.alarms.create('naukri_upload_evening', {
    when: getNextAlarmTime(17, 0),
    periodInMinutes: 1440
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title,
    message
  });
}

// This function is injected and runs directly inside the Naukri page
async function naukriUploadScript(resumeBase64, resumeFileName) {
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function base64ToFile(base64String, fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeMap = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      rtf: 'application/rtf'
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    return new File([bytes], fileName, { type: mimeType });
  }

  // Step 1: Click "View profile" if on dashboard
  const viewProfileBtn = Array.from(document.querySelectorAll('a, button')).find(el =>
    /^view\s*profile$/i.test(el.textContent.trim())
  );
  if (viewProfileBtn) {
    console.log('[Naukri] Clicking View profile');
    viewProfileBtn.click();
    // Wait for profile page to render
    await sleep(4000);
  }

  // Step 2: Find the file input
  let fileInput = document.querySelector('#attachCV') ||
                  document.querySelector('input[type="file"].fileUpload') ||
                  document.querySelector('input[type="file"]');

  console.log('[Naukri] File input found:', !!fileInput);

  if (!fileInput) {
    return { success: false, reason: 'File input #attachCV not found on page' };
  }

  // Step 3: Assign the file
  const file = base64ToFile(resumeBase64, resumeFileName);
  const dt = new DataTransfer();
  dt.items.add(file);

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
  if (nativeSetter) {
    nativeSetter.call(fileInput, dt.files);
  } else {
    fileInput.files = dt.files;
  }

  console.log('[Naukri] Files set:', fileInput.files.length, fileInput.files[0]?.name);

  // Step 4: Trigger change event — try both native and jQuery
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));

  const jq = window.jQuery || window.$;
  if (jq) {
    console.log('[Naukri] Triggering via jQuery');
    jq(fileInput).trigger('change');
  }

  // Wait for Naukri's XHR upload to complete
  await sleep(8000);

  console.log('[Naukri] Upload flow done');
  return { success: true };
}

async function triggerUpload(timeLabel) {
  console.log('[Naukri BG] triggerUpload:', timeLabel);
  const { resumeData, resumeFileName } = await chrome.storage.local.get(['resumeData', 'resumeFileName']);

  if (!resumeData) {
    showNotification('Naukri Auto-Uploader', 'No resume saved. Open the extension popup to set up.');
    return;
  }

  showNotification('Naukri Auto-Uploader', `Starting upload (${timeLabel})...`);

  const tab = await chrome.tabs.create({
    url: 'https://www.naukri.com/mnjuser/profile',
    active: true
  });

  console.log('[Naukri BG] Tab created:', tab.id);

  // Wait for page to fully load
  await new Promise(resolve => {
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  console.log('[Naukri BG] Page loaded, injecting upload script');
  await new Promise(r => setTimeout(r, 1500));

  try {
    // Fire the script — don't await it (SW gets killed during the long wait)
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: naukriUploadScript,
      args: [resumeData, resumeFileName]
    });

    // Store tab ID so the alarm can close it later
    await chrome.storage.local.set({ pendingUploadTabId: tab.id });

    // Schedule tab close + notification after 20 seconds (upload takes ~12s)
    chrome.alarms.create('naukri_close_upload_tab', { delayInMinutes: 0.35 });
    console.log('[Naukri BG] Script fired, alarm set to close tab in 21s');

  } catch (err) {
    console.error('[Naukri BG] Script injection error:', err.message);
    showNotification('Naukri Upload Failed', err.message);
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

// Setup alarms on install and browser start
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'naukri_upload_morning') {
    triggerUpload('9:00 AM');
  } else if (alarm.name === 'naukri_upload_evening') {
    triggerUpload('5:00 PM');
  } else if (alarm.name === 'naukri_close_upload_tab') {
    // Close the upload tab and record success
    const { pendingUploadTabId } = await chrome.storage.local.get('pendingUploadTabId');
    if (pendingUploadTabId) {
      try { await chrome.tabs.remove(pendingUploadTabId); } catch (_) {}
      await chrome.storage.local.remove('pendingUploadTabId');
    }
    const { uploadCount } = await chrome.storage.local.get('uploadCount');
    await chrome.storage.local.set({
      uploadCount: (uploadCount || 0) + 1,
      lastUpload: new Date().toISOString()
    });
    showNotification('Resume Uploaded!', `Successfully updated on Naukri at ${new Date().toLocaleTimeString()}.`);
    console.log('[Naukri BG] Upload tab closed, stats updated');
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'REFRESH_ALARMS') {
    setupAlarms();
    sendResponse({ success: true });
  } else if (msg.action === 'TRIGGER_UPLOAD_NOW') {
    triggerUpload('Manual');
    sendResponse({ success: true });
  }
  return true;
});
