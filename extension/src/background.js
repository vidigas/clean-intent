// Clean Intent - Background Service Worker
// Handles API communication and storage

const API_BASE = 'http://localhost:3001';

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLARIFY') {
    handleClarify(message.text)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'REFINE') {
    handleRefine(message.originalInput, message.answers)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(sendResponse);
    return true;
  }
});

// API: Get clarification questions
async function handleClarify(text) {
  const response = await fetch(`${API_BASE}/demo/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to analyze prompt');
  }

  return response.json();
}

// API: Refine prompt with answers
async function handleRefine(originalInput, answers) {
  const response = await fetch(`${API_BASE}/demo/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalInput, answers })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to refine prompt');
  }

  return response.json();
}

// Get settings from storage
async function getSettings() {
  const result = await chrome.storage.sync.get(['settings']);
  return result.settings || {
    apiEndpoint: API_BASE,
    autoDetect: false,
    showBreakdown: true
  };
}

// Save settings to storage
async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
  return { success: true };
}

// On install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Clean Intent] Extension installed');
});
