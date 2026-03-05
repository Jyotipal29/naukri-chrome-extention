// background.js - Service worker for alarms, scheduling, and tab orchestration

/**
 * Calculate the next alarm time for a given hour and minute
 * If the time has already passed today, schedule for tomorrow
 */
function getNextAlarmTime(hour, minute) {
  const now = new Date();
  const alarm = new Date();
  alarm.setHours(hour, minute, 0, 0);
  
  // If the alarm time has already passed today, schedule for tomorrow
  if (alarm <= now) {
    alarm.setDate(alarm.getDate() + 1);
  }
  
  return alarm.getTime();
}

/**
 * Setup two daily alarms: 9 AM and 5 PM
 */
async function setupAlarms() {
  // Clear all existing alarms
  const existingAlarms = await chrome.alarms.getAll();
  for (const alarm of existingAlarms) {
    if (alarm.name.startsWith('naukri_upload_')) {
      await chrome.alarms.clear(alarm.name);
    }
  }
  
  // Create morning alarm (9:00 AM)
  const morningTime = getNextAlarmTime(9, 0);
  chrome.alarms.create('naukri_upload_morning', {
    when: morningTime,
    periodInMinutes: 1440 // 24 hours
  });
  
  // Create evening alarm (5:00 PM)
  const eveningTime = getNextAlarmTime(17, 0);
  chrome.alarms.create('naukri_upload_evening', {
    when: eveningTime,
    periodInMinutes: 1440 // 24 hours
  });
  
  console.log('Alarms set up: Morning at 9:00 AM, Evening at 5:00 PM');
}

/**
 * Show a notification to the user
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: title,
    message: message
  });
}

/**
 * Trigger resume upload process
 */
async function triggerResumeUpload(timeLabel) {
  // Read credentials and resume data from storage
  const result = await chrome.storage.local.get(['credentials', 'resumeData', 'resumeFileName']);
  
  if (!result.credentials || !result.resumeData) {
    showNotification(
      'Naukri Upload — Action Required',
      'Please set your credentials and upload your resume in the extension popup.'
    );
    return;
  }
  
  // Show starting notification
  showNotification(
    'Naukri Resume Upload Starting',
    `Starting scheduled upload at ${timeLabel}...`
  );
  
  // Open profile page in background tab
  const tab = await chrome.tabs.create({
    url: 'https://www.naukri.com/mnjuser/profile',
    active: false
  });
  
  // Wait for tab to load, then send message to content script
  const listener = (tabId, changeInfo) => {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      
      // Send message to content script to start upload
      chrome.tabs.sendMessage(tab.id, {
        action: 'START_UPLOAD',
        credentials: result.credentials,
        resumeData: result.resumeData,
        resumeFileName: result.resumeFileName,
        timeLabel: timeLabel
      }).catch(err => {
        console.error('Failed to send message to content script:', err);
        chrome.tabs.remove(tab.id);
        showNotification(
          '❌ Upload Failed',
          'Could not communicate with Naukri page. Please try again.'
        );
      });
    }
  };
  
  chrome.tabs.onUpdated.addListener(listener);
}

// Install/startup handler
chrome.runtime.onInstalled.addListener(() => {
  setupAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
});

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'naukri_upload_morning') {
    triggerResumeUpload('9:00 AM');
  } else if (alarm.name === 'naukri_upload_evening') {
    triggerResumeUpload('5:00 PM');
  }
});

// Message handler from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'UPLOAD_SUCCESS') {
    // Update stats
    chrome.storage.local.get(['uploadCount'], (result) => {
      const newCount = (result.uploadCount || 0) + 1;
      chrome.storage.local.set({
        uploadCount: newCount,
        lastUpload: new Date().toISOString()
      });
    });
    
    // Show success notification
    const timestamp = new Date().toLocaleString();
    showNotification(
      '✅ Resume Uploaded!',
      `Your resume was successfully updated on Naukri at ${timestamp}`
    );
    
    // Close the tab
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
    
    sendResponse({ success: true });
  } else if (msg.action === 'UPLOAD_FAILED') {
    // Show failure notification
    showNotification(
      '❌ Upload Failed',
      msg.reason || 'Unknown error occurred'
    );
    
    // Close the tab
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
    
    sendResponse({ success: false });
  } else if (msg.action === 'REFRESH_ALARMS') {
    // Re-setup alarms (e.g., after user saves new settings)
    setupAlarms();
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});
