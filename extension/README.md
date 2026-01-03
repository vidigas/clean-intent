# Clean Intent - Browser Extension

Bring Clean Intent directly into ChatGPT, Claude, and other AI chat interfaces.

## Features

- **One-click clarification**: Click "Clean Intent" button before sending your prompt
- **Smart questions**: Get 2-4 targeted questions to clarify your intent
- **Dual output**: See both refined prompt and intent breakdown
- **Auto-inject**: Replaces your prompt with the refined version

## Supported Sites

- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder

## Usage

1. Go to ChatGPT or Claude
2. Type your prompt in the chat input
3. Click the purple "Clean Intent" button (appears next to send button)
4. Answer the clarifying questions in the popup
5. Click "Apply Clean Intent"
6. Review your refined prompt
7. Click "Use this prompt" to apply it

## Development

### File Structure

```
extension/
├── manifest.json          # Extension configuration
├── src/
│   ├── content.js         # Injected into ChatGPT/Claude pages
│   ├── injected.css       # Styles for injected UI
│   ├── background.js      # Service worker for API calls
│   ├── popup.html         # Extension popup
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
└── icons/                 # Extension icons (16, 48, 128px)
```

### API Endpoints

The extension calls your Clean Intent backend:

- `POST /demo/clarify` - Get clarification questions
- `POST /demo/refine` - Get refined prompt

### Configuration

Default API endpoint: `http://localhost:3001`

To change, update `API_BASE` in:
- `src/content.js`
- `src/background.js`

## Building for Production

1. Update API endpoint to production URL
2. Add proper icons (16x16, 48x48, 128x128 PNG)
3. Zip the extension folder
4. Submit to Chrome Web Store

## Icons

Create icons in these sizes:
- `icons/icon16.png` - 16x16px (toolbar)
- `icons/icon48.png` - 48x48px (extensions page)
- `icons/icon128.png` - 128x128px (Chrome Web Store)

Recommended: Use the Clean Intent logo with purple gradient background.
