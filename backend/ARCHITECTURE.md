# Clean Intent - System Architecture

## Overview

Clean Intent is an intent normalization layer that sits between human language and AI execution. It transforms vague, ambiguous prompts into structured, explicit intent before sending to any AI system.

```
User Input → Clean Intent → Structured Intent → AI Tool (ChatGPT, Claude, etc.)
```

## Core Concept

**The Problem**: When users write prompts like "Write a simple but comprehensive guide to React hooks", they contain contradictory requirements ("simple" vs "comprehensive"). AI systems silently pick one direction, leading to unpredictable results.

**The Solution**: Clean Intent parses the input, detects these conflicts, surfaces them as explicit choices, and produces unambiguous intent.

---

## System Components

### 1. Intent Schema (`src/types/intentSchema.ts`)

Defines the structured format for parsed intent:

```typescript
Intent {
  version: string           // Schema version
  primaryGoal: string       // The main objective, clarified
  taskType: string | null   // generate, analyze, explain, fix, optimize, convert, summarize
  audience: string | null   // Who this is for
  domain: string | null     // Field/context
  constraints: {
    hard: Constraint[]      // Must-have requirements
    soft: Constraint[]      // Nice-to-have preferences
  }
  outputExpectations: {
    length: short | medium | long | any
    format: string | null   // JSON, Markdown, bullet points, etc.
    structure: string[]     // Structural elements to include
  }
  conflicts: Conflict[]     // Detected contradictions
  assumptions: string[]     // Ambiguities that required assumptions
  requiresClarification: boolean
  rawInput: string          // Original user input
}
```

### 2. LLM Normalizer (`src/modules/llmNormalizer.ts`)

The core processing engine. Uses Claude to parse natural language into structured intent.

#### Processing Pipeline:

```
Raw Input → Claude API → JSON Parsing → Intent Object → Three Outputs
```

#### Three Output Formats:

1. **Intent JSON** - Structured data for programmatic use
2. **IRL Text** - Human-readable intent representation language
3. **Compiled Prompt** - Optimized prompt ready for AI execution

---

## How Conflict Detection Works

### System Prompt Instructs Claude to Detect:

```
Contradictory requirements like:
- "simple" + "detailed"
- "short" + "comprehensive"
- "brief" + "thorough"
- "creative" + "strict"
- "casual" + "professional"
- "minimal" + "feature-rich"
```

### Conflict Schema:

```typescript
Conflict {
  type: 'constraint' | 'goal' | 'output'
  description: string       // Human-readable explanation
  severity: 'warning' | 'blocking'
  terms: string[]           // The conflicting terms ["simple", "comprehensive"]
}
```

### Severity Levels:

- **Warning**: Conflicts that can be resolved with reasonable defaults
- **Blocking**: Conflicts that require user clarification before proceeding

---

## How Follow-up Questions (Assumptions) Work

When the input is ambiguous, Claude generates assumptions. These become the basis for follow-up questions shown to users.

### Example Input:
```
"Write a guide to React hooks"
```

### Generated Assumptions:
```json
{
  "assumptions": [
    "Assuming intermediate developer audience",
    "Assuming comprehensive coverage of all common hooks",
    "Assuming code examples in JavaScript (not TypeScript)"
  ]
}
```

### UI Transformation:

These assumptions are transformed into choices in the UI:

```
Choose what you mean:
○ Quick overview (simple)
● Deep dive (comprehensive)
```

The frontend presents `assumptions` and `conflicts` as explicit choices the user must make before proceeding.

---

## Output Formats

### 1. Intent JSON

Structured data for API consumers:

```json
{
  "primaryGoal": "Write a comprehensive guide to React hooks",
  "taskType": "generate",
  "audience": "intermediate developers",
  "domain": "React/JavaScript",
  "constraints": {
    "hard": [{ "text": "Include code examples", "type": "hard" }],
    "soft": [{ "text": "Use practical examples", "type": "soft" }]
  },
  "conflicts": [{
    "type": "constraint",
    "description": "\"Simple\" and \"comprehensive\" point in different directions",
    "severity": "warning",
    "terms": ["simple", "comprehensive"]
  }],
  "assumptions": [
    "Choosing comprehensive over simple based on \"guide\" context"
  ]
}
```

### 2. IRL (Intent Representation Language)

Human-readable format inspired by configuration files:

```
@goal Write a comprehensive guide to React hooks
@task generate
@audience intermediate developers
@domain React/JavaScript

@constraints hard
- Include code examples

@preferences
- Use practical examples

@output
- Length: long
- Format: Markdown

@conflicts
- [WARNING] "Simple" and "comprehensive" point in different directions

@assumptions
- Choosing comprehensive over simple based on "guide" context
```

### 3. Compiled Prompt

Optimized, unambiguous prompt ready for AI:

```
Write a comprehensive guide to React hooks.

Target audience: intermediate developers. Domain: React/JavaScript.

Requirements:
- Include code examples
- Use practical examples

Provide a comprehensive, detailed response. Format the output as Markdown.
```

---

## API Endpoints

### Public Demo (`POST /demo/normalize`)
- No API key required
- Rate limited: 10 requests/minute per IP
- For landing page demo

### Production (`POST /v1/normalize`)
- Requires API key in `X-API-Key` header
- Rate limited based on plan
- Usage tracked for billing

### Admin (`POST /admin/keys`)
- Requires `ADMIN_SECRET`
- Manage API keys

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│         "Write a simple but comprehensive guide..."              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Normalizer                                │
│                                                                  │
│  1. Send to Claude with system prompt                           │
│  2. Claude returns structured JSON                               │
│  3. Parse and validate against schema                            │
│  4. Generate IRL text format                                     │
│  5. Compile optimized prompt                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Object                               │
│                                                                  │
│  {                                                               │
│    intent: { ... },     // Structured intent                    │
│    irl: "...",          // IRL text format                      │
│    compiled: "..."      // Ready-to-use prompt                  │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend UI                                 │
│                                                                  │
│  • Shows conflicts as choices                                    │
│  • Shows assumptions as clarification options                    │
│  • User selects preferences                                      │
│  • Final intent is explicit and unambiguous                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interactive Clarification Agent

The Clarification Agent provides a conversational flow to help users refine their prompts before sending to AI.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: User enters initial prompt                             │
│  "Write a guide to React hooks"                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Clarification Agent analyzes & asks questions          │
│                                                                  │
│  "Who is this guide for?"                                        │
│  ○ Beginners new to React                                        │
│  ○ Intermediate developers                                       │
│  ○ Advanced developers                                           │
│                                                                  │
│  "How comprehensive should it be?"                               │
│  ○ Quick overview (10 min read)                                  │
│  ○ Detailed deep-dive (30+ min)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Generate refined prompt + intent breakdown             │
│                                                                  │
│  ┌─ REFINED PROMPT ────────────────────────────────── [Copy] ─┐ │
│  │ Write a comprehensive guide to React hooks for             │ │
│  │ intermediate developers. Include useState, useEffect...    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ INTENT BREAKDOWN ─────────────────────────────────────────┐ │
│  │ @goal        Guide to React hooks                          │ │
│  │ @audience    Intermediate developers                       │ │
│  │ @scope       Comprehensive deep-dive                       │ │
│  │ @format      Markdown with code examples                   │ │
│  │ @constraints                                               │ │
│  │   - Include useState, useEffect, useContext                │ │
│  │   - Real-world examples only                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Clarification Agent Module (`src/modules/clarificationAgent.ts`)

Two main functions:

#### 1. `generateClarificationQuestions(input: string)`

Analyzes the user's prompt and returns 2-4 targeted questions about:
- **Purpose**: What will they use this output for?
- **Audience**: Who is this for? What's their knowledge level?
- **Format**: What format/structure do they need?
- **Scope**: How detailed/comprehensive should it be?
- **Constraints**: Any specific requirements or things to avoid?

Returns:
```typescript
{
  originalInput: string;
  summary: string;        // Brief summary of understood intent
  questions: [
    {
      id: string;
      question: string;
      why: string;        // Why this matters (shown to user)
      options: [{ value: string, label: string }];
      allowCustom: boolean;
    }
  ]
}
```

#### 2. `refinePromptWithAnswers(originalInput, answers)`

Takes the original prompt and user's answers, produces:

```typescript
{
  originalInput: string;
  refinedPrompt: string;      // Natural prose, ready to paste
  intentBreakdown: {
    goal: string;
    audience?: string;
    scope?: string;
    format?: string;
    constraints?: string[];
  };
  explanation: string;        // What was clarified
}
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /demo/clarify` | Step 1: Returns clarification questions |
| `POST /demo/refine` | Step 2: Returns refined prompt + breakdown |

### Why Two Output Formats?

| Format | Purpose |
|--------|---------|
| **Refined Prompt** | Natural prose for pasting directly into ChatGPT/Claude |
| **Intent Breakdown** | Structured IRL format for quick verification |

The dual-view lets users:
1. **Verify** their intent is captured correctly (IRL breakdown)
2. **Copy** a ready-to-use prompt (refined prose)

---

## Key Design Decisions

### Why LLM-based parsing?
Regex/rule-based parsing can't handle natural language nuance. LLMs understand context, synonyms, and implied meaning.

### Why three output formats?
- **JSON**: For programmatic integration
- **IRL**: For human readability and debugging
- **Compiled**: For direct AI consumption

### Why surface assumptions?
Every AI system makes assumptions. Making them explicit gives users control and produces predictable results.

### Why separate hard/soft constraints?
Hard constraints are requirements. Soft constraints are preferences. This distinction helps prioritize when trade-offs are needed.

---

## Future Enhancements

1. ~~**Interactive Clarification**: Multi-turn conversation to resolve blocking conflicts~~ ✅ Done
2. **Browser Extension**: Inject Clean Intent directly into ChatGPT, Claude, and other AI tools
3. **Intent Templates**: Reusable patterns for common tasks
4. **Learning from Choices**: Personalized defaults based on user history
5. **Cross-tool Consistency**: Same intent, same results across ChatGPT, Claude, etc.

---

## Browser Extension (Planned)

A Chrome/Firefox extension that brings Clean Intent directly into AI chat interfaces.

### Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  ChatGPT / Claude Interface                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Write a simple but comprehensive guide to React hooks       ││
│  │                                                             ││
│  │                              [Clean Intent ✨] [Send →]     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                    User clicks "Clean Intent"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Popup: Clarification Questions                                 │
│                                                                  │
│  "Who is this for?"                                              │
│  ○ Beginners  ● Intermediate  ○ Advanced                        │
│                                                                  │
│  "How detailed?"                                                 │
│  ○ Quick overview  ● Deep dive                                   │
│                                                                  │
│                                        [Cancel] [Apply ✓]       │
└─────────────────────────────────────────────────────────────────┘
                              │
                    User clicks "Apply"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ChatGPT / Claude Interface                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Write a comprehensive guide to React hooks for intermediate ││
│  │ developers. Include detailed explanations, code examples... ││
│  │                                                             ││
│  │                                               [Send →]      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Technical Approach

| Component | Technology |
|-----------|------------|
| Extension | Chrome Extension Manifest V3 |
| Content Script | Injects UI into ChatGPT/Claude pages |
| Popup UI | React (same components as web app) |
| API Calls | Fetch to Clean Intent backend |

### Target Platforms

- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Cursor (cursor.sh)
- Any text input on any page (optional)
