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
let currentQuestionIndex = 0;

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

  // ChatGPT specific: find the RIGHT-side button container (mic/send buttons)
  let targetContainer = null;
  let insertBeforeElement = null;

  if (currentPlatform.name === 'chatgpt') {
    const form = document.querySelector('form');
    if (form) {
      // Look for the mic button or send button (they're on the right side)
      const micBtn = form.querySelector('button[aria-label*="Voice"], button[aria-label*="mic"], button[data-testid="voice-mode-button"]');
      const sendBtn = form.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');

      // Use mic button's parent if found, otherwise send button's parent
      const rightSideBtn = micBtn || sendBtn;
      if (rightSideBtn) {
        targetContainer = rightSideBtn.parentElement;
        insertBeforeElement = rightSideBtn; // Insert before the mic/send button
      }
    }
  }

  if (targetContainer) {
    // Insert before the mic/send button (so it appears to the left of them, but on the right side of input)
    targetContainer.insertBefore(button, insertBeforeElement);
    console.log('[Clean Intent] Button injected on right side');
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
    userAnswers = {};
    currentQuestionIndex = 0;
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
    const currentQ = data.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === data.questions.length - 1;

    // Build answered questions (collapsed)
    const answeredHtml = data.questions.slice(0, currentQuestionIndex).map((q, idx) => {
      const answer = userAnswers[q.id];
      const displayAnswer = answer?.startsWith('custom:')
        ? answer.slice(7)
        : q.options.find(o => o.value === answer)?.label || answer;
      return `
        <div class="clean-intent-answered">
          <span class="clean-intent-answered-num">${idx + 1}</span>
          <span class="clean-intent-answered-q">${q.question}</span>
          <span class="clean-intent-answered-a">${displayAnswer}</span>
        </div>
      `;
    }).join('');

    // Build current question
    const currentQuestionHtml = currentQ ? `
      <div class="clean-intent-question" data-id="${currentQ.id}">
        <div class="clean-intent-question-label">Question ${currentQuestionIndex + 1} of ${data.questions.length}</div>
        <div class="clean-intent-question-header">
          <span class="clean-intent-question-text">${currentQ.question}</span>
          <span class="clean-intent-question-why">${currentQ.why}</span>
        </div>
        <div class="clean-intent-options">
          ${currentQ.options.map(opt => `
            <label class="clean-intent-option">
              <input type="radio" name="${currentQ.id}" value="${opt.value}" ${userAnswers[currentQ.id] === opt.value ? 'checked' : ''}>
              <span>${opt.label}</span>
            </label>
          `).join('')}
          ${currentQ.allowCustom ? `
            <input type="text" class="clean-intent-custom" placeholder="Or type your own..." data-question="${currentQ.id}" value="${userAnswers[currentQ.id]?.startsWith('custom:') ? userAnswers[currentQ.id].slice(7) : ''}">
          ` : ''}
        </div>
      </div>
    ` : '';

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
          ${answeredHtml ? `<div class="clean-intent-answered-list">${answeredHtml}</div>` : ''}
          <div class="clean-intent-questions">
            ${currentQuestionHtml}
          </div>
        </div>
        <div class="clean-intent-modal-footer">
          <button class="clean-intent-cancel">Cancel</button>
          <button class="clean-intent-next">${isLastQuestion ? 'Apply Clean Intent' : 'Next'}</button>
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
  modalElement.querySelector('.clean-intent-next')?.addEventListener('click', handleNext);
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

// Handle Next button (step through questions one at a time)
function handleNext() {
  const currentQ = clarificationData.questions[currentQuestionIndex];

  // Get current answer
  const selectedRadio = modalElement.querySelector(`input[name="${currentQ.id}"]:checked`);
  const customInput = modalElement.querySelector(`.clean-intent-custom[data-question="${currentQ.id}"]`);

  let answer = null;
  if (selectedRadio) {
    answer = selectedRadio.value;
  } else if (customInput && customInput.value.trim()) {
    answer = `custom:${customInput.value.trim()}`;
  }

  if (!answer) {
    showNotification('Please select an answer');
    return;
  }

  // Store the answer
  userAnswers[currentQ.id] = answer;

  // Check if this was the last question
  if (currentQuestionIndex === clarificationData.questions.length - 1) {
    // All questions answered, refine
    handleApply();
  } else {
    // Move to next question
    currentQuestionIndex++;
    showModal('questions', clarificationData);
  }
}

// Handle Apply button (called after all questions answered)
async function handleApply() {
  try {
    showModal('refining');

    const response = await fetch(`${API_BASE}/demo/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalInput: clarificationData.originalInput,
        answers: userAnswers
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refine prompt');
    }

    const result = await response.json();

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
