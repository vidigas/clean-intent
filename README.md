# Clean Intent

An AI-powered intent normalization layer that transforms vague prompts into clear, structured intents before sending them to AI systems like ChatGPT or Claude.

## The Problem

AI prompts are often ambiguous, contradictory, or underspecified. This leads to unpredictable responses and wasted back-and-forth.

**Before:**
> "Write me something about dogs that's not too long but comprehensive"

**After:**
> "Write a 300-400 word informative overview about dogs as pets, covering basic care needs and temperament, targeted at first-time pet owners considering adoption."

## How It Works

1. **Input** - User enters their raw, messy prompt
2. **Clarification** - System asks 2-4 targeted questions to resolve ambiguity
3. **Normalization** - Claude analyzes intent and extracts structured data
4. **Output** - Three formats: structured intent, IRL notation, and optimized prompt

## Features

- **Intent Parsing** - Extracts goal, task type, audience, domain, and constraints
- **Conflict Detection** - Identifies contradictory requirements (e.g., "short but comprehensive")
- **Assumption Tracking** - Records assumptions made about ambiguous parts
- **Clean Intent Format** - Human-readable intent notation
- **Browser Extension** - Integrates directly into ChatGPT and Claude interfaces

## Tech Stack

**Backend**
- Node.js + Express + TypeScript
- Anthropic Claude API (intent normalization)
- OpenAI API (clarification questions)
- SQLite (API keys + usage tracking)
- Zod (runtime validation)

**Frontend**
- React 19 + TypeScript
- Vite

**Extension**
- Chrome Manifest V3
- Supports ChatGPT and Claude

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── llmNormalizer.ts    # Claude integration
│   │   │   ├── clarificationAgent.ts # OpenAI clarification
│   │   │   ├── conflictDetector.ts  # Contradiction detection
│   │   │   ├── intentParser.ts      # Intent extraction
│   │   │   ├── irlGenerator.ts      # IRL format output
│   │   │   └── promptCompiler.ts    # Optimized prompt output
│   │   ├── routes/
│   │   │   ├── demo.ts              # Public demo endpoints
│   │   │   ├── normalize.ts         # Production API
│   │   │   └── admin.ts             # Key management
│   │   └── middleware/
│   │       └── auth.ts              # API key + rate limiting
│   └── data/
│       └── irl.db                   # SQLite database
├── frontend/
│   └── src/
│       ├── App.tsx                  # Demo interface
│       └── components/
│           └── LandingPage.tsx      # Landing + interactive demo
└── extension/
    └── src/
        ├── content.js               # Injected into AI chat pages
        ├── background.js            # Service worker
        └── popup.js                 # Extension popup
```

## API

### Demo Endpoints (Public, Rate Limited)

```bash
# Get clarification questions
POST /demo/clarify
{"prompt": "write something about dogs"}

# Refine prompt with answers
POST /demo/refine
{"prompt": "...", "answers": {...}}
```

### Production Endpoints (API Key Required)

```bash
# Normalize a prompt
POST /v1/normalize
Authorization: Bearer irl_xxxxx
{"prompt": "write something about dogs"}
```

### Response Format

```json
{
  "intent": {
    "primaryGoal": "Generate informative content about dogs",
    "taskType": "generate",
    "audience": "general",
    "constraints": {
      "hard": [],
      "soft": [{"type": "length", "value": "medium"}]
    },
    "conflicts": [],
    "assumptions": ["Assuming general pet ownership context"]
  },
  "irl": "@goal Generate informative content about dogs\n@task generate\n...",
  "compiledPrompt": "Write a medium-length informative piece about dogs..."
}
```

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key
- OpenAI API key

### Installation

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY and OPENAI_API_KEY to .env

# Frontend
cd ../frontend
npm install
```

### Running

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173

### Browser Extension

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

## Intent Schema

```typescript
interface Intent {
  version: "0.1.0";
  primaryGoal: string;
  taskType: "generate" | "analyze" | "explain" | "fix" | "optimize" | "convert" | "summarize";
  audience: string | null;
  domain: string | null;
  constraints: {
    hard: Constraint[];  // Must-have requirements
    soft: Constraint[];  // Nice-to-have preferences
  };
  outputExpectations: {
    length: "short" | "medium" | "long" | "any";
    format: string | null;
    structure: string[] | null;
  };
  conflicts: Conflict[];
  assumptions: string[];
  requiresClarification: boolean;
  rawInput: string;
}
```

## License

MIT
