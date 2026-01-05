// Clean Intent - Content Script
// Injects Clean Intent button into ChatGPT and Claude interfaces

const API_BASE = 'http://localhost:3001';

// Platform-specific selectors (updated for latest UIs)
const PLATFORMS = {
  chatgpt: {
    host: ['chat.openai.com', 'chatgpt.com'],
    inputSelector: '#prompt-textarea, [id^="prompt-textarea"], div[contenteditable="true"][data-placeholder], textarea[placeholder*="Message"]',
    containerSelector: 'form, [data-testid="composer-parent"], .relative.flex',
    buttonContainerSelector: 'form button[data-testid="send-button"], form button[aria-label*="Send"], form > div > div > button',
    getInputValue: (el) => el.value || el.textContent || el.innerText,
    setInputValue: (el, value) => {
      if (el.tagName === 'TEXTAREA') {
        el.value = value;
      } else {
        el.textContent = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },
  claude: {
    host: ['claude.ai'],
    inputSelector: '[contenteditable="true"], .ProseMirror, div[data-placeholder]',
    containerSelector: 'form, [data-testid="composer"], fieldset',
    buttonContainerSelector: 'button[aria-label*="Send"], button[type="submit"]',
    getInputValue: (el) => el.textContent || el.innerText,
    setInputValue: (el, value) => {
      el.textContent = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
};

// Detect current platform
function detectPlatform() {
  const host = window.location.hostname;
  for (const [name, config] of Object.entries(PLATFORMS)) {
    if (config.host.some(h => host.includes(h))) {
      return { name, config };
    }
  }
  return null;
}

// State
let currentPlatform = null;
let clarificationData = null;
let modalElement = null;
let userAnswers = {};

// Initialize
function init() {
  currentPlatform = detectPlatform();
  if (!currentPlatform) return;

  console.log('[Clean Intent] Detected platform:', currentPlatform.name);

  // Watch for input field and inject button
  observeInputField();
}

// Observe for input field changes (SPAs reload content dynamically)
function observeInputField() {
  const observer = new MutationObserver(() => {
    const input = document.querySelector(currentPlatform.config.inputSelector);
    if (input && !document.querySelector('.clean-intent-btn')) {
      injectButton(input);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also try immediately
  const input = document.querySelector(currentPlatform.config.inputSelector);
  if (input) {
    injectButton(input);
  }
}

// Inject Clean Intent button
function injectButton(inputElement) {
  // Check if button already exists anywhere on page
  if (document.querySelector('.clean-intent-btn')) return;

  const button = document.createElement('button');
  button.className = 'clean-intent-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <span>Clarify</span>
  `;
  button.type = 'button';

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCleanIntent(inputElement);
  });

  // ChatGPT specific: find the button container (the row with mic/send buttons)
  // Look for the parent that contains the voice/send buttons
  let buttonRow = null;

  if (currentPlatform.name === 'chatgpt') {
    // Try to find the row containing the send/voice buttons
    // ChatGPT uses a structure like: form > div > div > [buttons]
    const form = document.querySelector('form');
    if (form) {
      // Find the div that contains buttons with specific aria-labels
      const allButtons = form.querySelectorAll('button');
      for (const btn of allButtons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Send') || ariaLabel.includes('Voice') || btn.querySelector('svg')) {
          // Found a button, get its parent row
          buttonRow = btn.parentElement;
          break;
        }
      }
    }
  }

  if (buttonRow) {
    // Insert at the end of the button row (right side)
    buttonRow.appendChild(button);
    console.log('[Clean Intent] Button injected in button row');
  } else {
    // Fallback: create floating button
    button.style.position = 'fixed';
    button.style.bottom = '100px';
    button.style.right = '20px';
    button.style.zIndex = '999999';
    document.body.appendChild(button);
    console.log('[Clean Intent] Button injected as floating button (fallback)');
  }
}

// Handle Clean Intent button click
async function handleCleanIntent(inputElement) {
  const text = currentPlatform.config.getInputValue(inputElement);

  if (!text.trim()) {
    showNotification('Please enter a prompt first');
    return;
  }

  try {
    showModal('loading');

    // Step 1: Get clarification questions
    const response = await fetch(`${API_BASE}/demo/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze prompt');
    }

    clarificationData = await response.json();
    showModal('questions', clarificationData);
  } catch (error) {
    console.error('[Clean Intent] Error:', error);
    showModal('error', error.message);
  }
}

// Show modal
function showModal(state, data = null) {
  // Remove existing modal
  if (modalElement) {
    modalElement.remove();
  }

  modalElement = document.createElement('div');
  modalElement.className = 'clean-intent-modal-overlay';

  let content = '';

  if (state === 'loading') {
    content = `
      <div class="clean-intent-modal">
        <div class="clean-intent-modal-header">
          <h3>Analyzing your prompt...</h3>
        </div>
        <div class="clean-intent-modal-body">
          <div class="clean-intent-loading">
            <div class="clean-intent-spinner"></div>
            <p>Finding the right questions to ask</p>
          </div>
        </div>
      </div>
    `;
  } else if (state === 'questions') {
    const questionsHtml = data.questions.map(q => `
      <div class="clean-intent-question" data-id="${q.id}">
        <div class="clean-intent-question-header">
          <span class="clean-intent-question-text">${q.question}</span>
          <span class="clean-intent-question-why">${q.why}</span>
        </div>
        <div class="clean-intent-options">
          ${q.options.map(opt => `
            <label class="clean-intent-option">
              <input type="radio" name="${q.id}" value="${opt.value}">
              <span>${opt.label}</span>
            </label>
          `).join('')}
          ${q.allowCustom ? `
            <input type="text" class="clean-intent-custom" placeholder="Or type your own..." data-question="${q.id}">
          ` : ''}
        </div>
      </div>
    `).join('');

    content = `
      <div class="clean-intent-modal">
        <div class="clean-intent-modal-header">
          <h3>Clarify your intent</h3>
          <button class="clean-intent-close">&times;</button>
        </div>
        <div class="clean-intent-modal-body">
          <div class="clean-intent-summary">
            <span class="clean-intent-summary-label">We understood:</span>
            <p>${data.summary}</p>
          </div>
          <div class="clean-intent-questions">
            ${questionsHtml}
          </div>
        </div>
        <div class="clean-intent-modal-footer">
          <button class="clean-intent-cancel">Cancel</button>
          <button class="clean-intent-apply">Apply Clean Intent</button>
        </div>
      </div>
    `;
  } else if (state === 'refining') {
    content = `
      <div class="clean-intent-modal">
        <div class="clean-intent-modal-header">
          <h3>Refining your prompt...</h3>
        </div>
        <div class="clean-intent-modal-body">
          <div class="clean-intent-loading">
            <div class="clean-intent-spinner"></div>
            <p>Creating your refined prompt</p>
          </div>
        </div>
      </div>
    `;
  } else if (state === 'result') {
    // Build Q&A summary HTML
    const qaHtml = clarificationData && clarificationData.questions.length > 0 ? `
      <div class="clean-intent-qa-summary">
        <div class="clean-intent-result-label">YOUR ANSWERS</div>
        <div class="clean-intent-qa-list">
          ${clarificationData.questions.map(q => {
            const answer = userAnswers[q.id];
            const displayAnswer = answer?.startsWith('custom:')
              ? answer.slice(7)
              : q.options.find(o => o.value === answer)?.label || answer;
            return `
              <div class="clean-intent-qa-item">
                <span class="clean-intent-qa-question">${q.question}</span>
                <span class="clean-intent-qa-answer">${displayAnswer || 'N/A'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    content = `
      <div class="clean-intent-modal">
        <div class="clean-intent-modal-header">
          <h3>Your refined prompt</h3>
          <button class="clean-intent-close">&times;</button>
        </div>
        <div class="clean-intent-modal-body">
          ${qaHtml}
          <div class="clean-intent-result-prompt">
            <div class="clean-intent-result-label">REFINED PROMPT</div>
            <p>${data.refinedPrompt}</p>
          </div>
          <div class="clean-intent-result-breakdown">
            <div class="clean-intent-result-label">INTENT BREAKDOWN</div>
            <div class="clean-intent-irl">
              <div class="clean-intent-irl-line">
                <span class="clean-intent-irl-key">@goal</span>
                <span class="clean-intent-irl-value">${data.intentBreakdown.goal}</span>
              </div>
              ${data.intentBreakdown.audience ? `
                <div class="clean-intent-irl-line">
                  <span class="clean-intent-irl-key">@audience</span>
                  <span class="clean-intent-irl-value">${data.intentBreakdown.audience}</span>
                </div>
              ` : ''}
              ${data.intentBreakdown.scope ? `
                <div class="clean-intent-irl-line">
                  <span class="clean-intent-irl-key">@scope</span>
                  <span class="clean-intent-irl-value">${data.intentBreakdown.scope}</span>
                </div>
              ` : ''}
              ${data.intentBreakdown.format ? `
                <div class="clean-intent-irl-line">
                  <span class="clean-intent-irl-key">@format</span>
                  <span class="clean-intent-irl-value">${data.intentBreakdown.format}</span>
                </div>
              ` : ''}
              ${data.intentBreakdown.constraints?.length ? `
                <div class="clean-intent-irl-line clean-intent-irl-constraints">
                  <span class="clean-intent-irl-key">@constraints</span>
                  <ul class="clean-intent-irl-list">
                    ${data.intentBreakdown.constraints.map(c => `<li>${c}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="clean-intent-modal-footer">
          <button class="clean-intent-cancel">Cancel</button>
          <button class="clean-intent-use">Use this prompt</button>
        </div>
      </div>
    `;
  } else if (state === 'error') {
    content = `
      <div class="clean-intent-modal">
        <div class="clean-intent-modal-header">
          <h3>Error</h3>
          <button class="clean-intent-close">&times;</button>
        </div>
        <div class="clean-intent-modal-body">
          <p class="clean-intent-error">${data}</p>
        </div>
        <div class="clean-intent-modal-footer">
          <button class="clean-intent-cancel">Close</button>
        </div>
      </div>
    `;
  }

  modalElement.innerHTML = content;
  document.body.appendChild(modalElement);

  // Attach event listeners
  modalElement.querySelector('.clean-intent-close')?.addEventListener('click', closeModal);
  modalElement.querySelector('.clean-intent-cancel')?.addEventListener('click', closeModal);
  modalElement.querySelector('.clean-intent-apply')?.addEventListener('click', handleApply);
  modalElement.querySelector('.clean-intent-use')?.addEventListener('click', handleUsePrompt);
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) closeModal();
  });

  // Handle custom input
  modalElement.querySelectorAll('.clean-intent-custom').forEach(input => {
    input.addEventListener('input', (e) => {
      const questionId = e.target.dataset.question;
      // Uncheck radio buttons when custom is typed
      modalElement.querySelectorAll(`input[name="${questionId}"]`).forEach(radio => {
        radio.checked = false;
      });
    });
  });
}

// Close modal
function closeModal() {
  if (modalElement) {
    modalElement.remove();
    modalElement = null;
  }
}

// Handle Apply button
async function handleApply() {
  const answers = {};

  // Collect answers from radio buttons and custom inputs
  clarificationData.questions.forEach(q => {
    const selectedRadio = modalElement.querySelector(`input[name="${q.id}"]:checked`);
    const customInput = modalElement.querySelector(`.clean-intent-custom[data-question="${q.id}"]`);

    if (selectedRadio) {
      answers[q.id] = selectedRadio.value;
    } else if (customInput && customInput.value.trim()) {
      answers[q.id] = `custom:${customInput.value.trim()}`;
    }
  });

  // Check if all questions answered
  if (Object.keys(answers).length < clarificationData.questions.length) {
    showNotification('Please answer all questions');
    return;
  }

  try {
    showModal('refining');

    const response = await fetch(`${API_BASE}/demo/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalInput: clarificationData.originalInput,
        answers
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refine prompt');
    }

    const result = await response.json();

    // Store answers for display
    userAnswers = answers;

    showModal('result', result);

    // Store result for use
    window._cleanIntentResult = result;
  } catch (error) {
    console.error('[Clean Intent] Error:', error);
    showModal('error', error.message);
  }
}

// Handle Use Prompt button
function handleUsePrompt() {
  const result = window._cleanIntentResult;
  if (!result) return;

  const input = document.querySelector(currentPlatform.config.inputSelector);
  if (input) {
    currentPlatform.config.setInputValue(input, result.refinedPrompt);
    input.focus();
  }

  closeModal();
  showNotification('Prompt updated!');
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'clean-intent-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Start with delay to allow SPA to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
} else {
  setTimeout(init, 500);
}
