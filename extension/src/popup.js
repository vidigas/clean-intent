// Clean Intent - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  // Apply settings to UI
  document.getElementById('showBreakdown').checked = settings.showBreakdown !== false;

  // Save settings on change
  document.getElementById('showBreakdown').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: {
        ...settings,
        showBreakdown: e.target.checked
      }
    });
  });

  // Check current tab for supported site
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  updateSiteStatus(tab?.url);
});

function updateSiteStatus(url) {
  if (!url) return;

  const isChatGPT = url.includes('chat.openai.com') || url.includes('chatgpt.com');
  const isClaude = url.includes('claude.ai');

  const statusEl = document.querySelector('.status span');
  const statusDot = document.querySelector('.status-dot');

  if (isChatGPT || isClaude) {
    statusEl.textContent = `Active on ${isChatGPT ? 'ChatGPT' : 'Claude'}`;
    statusDot.style.background = '#22c55e';
  } else {
    statusEl.textContent = 'Not on a supported site';
    statusDot.style.background = '#666';
    document.querySelector('.status').style.background = 'rgba(100, 100, 100, 0.1)';
    document.querySelector('.status').style.borderColor = 'rgba(100, 100, 100, 0.2)';
    document.querySelector('.status').style.color = '#888';
  }
}
