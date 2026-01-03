import Anthropic from '@anthropic-ai/sdk';
import type { Intent, NormalizeResponse } from '../types/intentSchema.js';
import { SCHEMA_VERSION } from '../types/intentSchema.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY not set. Create a .env file with your API key.');
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an intent normalization system. Your job is to parse human intent from natural language and produce structured, unambiguous representations.

When given user input, you must:
1. Extract the primary goal (the main thing they want to accomplish)
2. Identify the task type (generate, analyze, explain, fix, optimize, convert, summarize, or null)
3. Detect the target audience if mentioned
4. Identify the domain/context if apparent
5. Separate constraints into "hard" (must have, required) vs "soft" (preferences, nice-to-have)
6. Detect any conflicts or contradictions in the request
7. Note any assumptions you're making due to missing information
8. Generate output expectations based on any length/format/structure hints

For conflicts, look for contradictory requirements like:
- "simple" + "detailed"
- "short" + "comprehensive"
- "brief" + "thorough"
- "creative" + "strict"
- "casual" + "professional"
- "minimal" + "feature-rich"

Respond with valid JSON only, no markdown, no explanation.`;

const OUTPUT_SCHEMA = `{
  "primaryGoal": "string - the main objective, cleaned up and clarified",
  "taskType": "generate|analyze|explain|fix|optimize|convert|summarize|null",
  "audience": "string or null - who this is for",
  "domain": "string or null - the field/context",
  "constraints": {
    "hard": [{"text": "string", "type": "hard"}],
    "soft": [{"text": "string", "type": "soft"}]
  },
  "outputExpectations": {
    "length": "short|medium|long|any",
    "format": "string or null (e.g., JSON, Markdown, bullet points)",
    "structure": ["array of structural elements"] or null
  } or null,
  "conflicts": [{
    "type": "constraint|goal|output",
    "description": "what the conflict is",
    "severity": "warning|blocking",
    "terms": ["term1", "term2"]
  }],
  "assumptions": ["list of assumptions made due to ambiguity"]
}`;

function generateIRL(intent: Intent): string {
  const lines: string[] = [];

  lines.push(`@goal ${intent.primaryGoal}`);

  if (intent.taskType) {
    lines.push(`@task ${intent.taskType}`);
  }

  if (intent.audience) {
    lines.push(`@audience ${intent.audience}`);
  }

  if (intent.domain) {
    lines.push(`@domain ${intent.domain}`);
  }

  if (intent.constraints.hard.length > 0) {
    lines.push('');
    lines.push('@constraints hard');
    for (const constraint of intent.constraints.hard) {
      lines.push(`- ${constraint.text}`);
    }
  }

  if (intent.constraints.soft.length > 0) {
    lines.push('');
    lines.push('@preferences');
    for (const constraint of intent.constraints.soft) {
      lines.push(`- ${constraint.text}`);
    }
  }

  if (intent.outputExpectations) {
    lines.push('');
    lines.push('@output');
    if (intent.outputExpectations.length && intent.outputExpectations.length !== 'any') {
      lines.push(`- Length: ${intent.outputExpectations.length}`);
    }
    if (intent.outputExpectations.format) {
      lines.push(`- Format: ${intent.outputExpectations.format}`);
    }
    if (intent.outputExpectations.structure && intent.outputExpectations.structure.length > 0) {
      lines.push(`- Structure: ${intent.outputExpectations.structure.join(', ')}`);
    }
  }

  if (intent.conflicts.length > 0) {
    lines.push('');
    lines.push('@conflicts');
    for (const conflict of intent.conflicts) {
      const severity = conflict.severity === 'blocking' ? '[BLOCKING]' : '[WARNING]';
      lines.push(`- ${severity} ${conflict.description}`);
    }
  }

  if (intent.assumptions.length > 0) {
    lines.push('');
    lines.push('@assumptions');
    for (const assumption of intent.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  return lines.join('\n');
}

function compilePrompt(intent: Intent): string {
  const sections: string[] = [];

  sections.push(intent.primaryGoal);

  const contextParts: string[] = [];

  if (intent.audience) {
    contextParts.push(`Target audience: ${intent.audience}`);
  }

  if (intent.domain) {
    contextParts.push(`Domain: ${intent.domain}`);
  }

  if (contextParts.length > 0) {
    sections.push('');
    sections.push(contextParts.join('. ') + '.');
  }

  const allConstraints = [
    ...intent.constraints.hard.map((c) => c.text),
    ...intent.constraints.soft.map((c) => c.text),
  ];

  if (allConstraints.length > 0) {
    sections.push('');
    sections.push('Requirements:');
    for (const constraint of allConstraints) {
      sections.push(`- ${constraint}`);
    }
  }

  if (intent.outputExpectations) {
    const outputParts: string[] = [];

    if (intent.outputExpectations.length && intent.outputExpectations.length !== 'any') {
      const lengthMap: Record<string, string> = {
        short: 'Keep the response concise',
        medium: 'Provide a balanced, moderate-length response',
        long: 'Provide a comprehensive, detailed response',
      };
      outputParts.push(lengthMap[intent.outputExpectations.length] || '');
    }

    if (intent.outputExpectations.format) {
      outputParts.push(`Format the output as ${intent.outputExpectations.format}`);
    }

    if (intent.outputExpectations.structure && intent.outputExpectations.structure.length > 0) {
      outputParts.push(`Include: ${intent.outputExpectations.structure.join(', ')}`);
    }

    if (outputParts.length > 0) {
      sections.push('');
      sections.push(outputParts.filter(Boolean).join('. ') + '.');
    }
  }

  return sections.join('\n').trim();
}

export async function normalize(input: string): Promise<NormalizeResponse> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse the following user intent and respond with JSON matching this schema:

${OUTPUT_SCHEMA}

User input:
"""
${input}
"""

Respond with valid JSON only.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let parsed;
  try {
    parsed = JSON.parse(content.text);
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }

  const intent: Intent = {
    version: SCHEMA_VERSION,
    primaryGoal: parsed.primaryGoal || input,
    taskType: parsed.taskType || null,
    audience: parsed.audience || null,
    domain: parsed.domain || null,
    constraints: {
      hard: parsed.constraints?.hard || [],
      soft: parsed.constraints?.soft || [],
    },
    outputExpectations: parsed.outputExpectations || null,
    conflicts: parsed.conflicts || [],
    requiresClarification: (parsed.conflicts || []).some(
      (c: { severity: string }) => c.severity === 'blocking'
    ),
    rawInput: input,
    assumptions: parsed.assumptions || [],
  };

  const irl = generateIRL(intent);
  const compiled = compilePrompt(intent);

  return {
    intent,
    irl,
    compiled,
  };
}
