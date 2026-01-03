import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ClarificationQuestion {
  id: string;
  question: string;
  why: string;
  options: {
    value: string;
    label: string;
  }[];
  allowCustom: boolean;
}

export interface ClarificationResponse {
  originalInput: string;
  needsClarification: boolean;
  summary: string;
  questions: ClarificationQuestion[];
}

export interface IntentBreakdown {
  goal: string;
  audience?: string;
  scope?: string;
  format?: string;
  constraints?: string[];
}

export interface RefinedPromptResponse {
  originalInput: string;
  refinedPrompt: string;
  intentBreakdown: IntentBreakdown;
  explanation: string;
}

const QUESTION_GENERATION_PROMPT = `You are a prompt clarification consultant. Your job is to determine if a prompt needs clarification and, if so, ask smart clarifying questions.

FIRST, analyze the prompt to determine if clarification would add value:
- Is the intent clear and unambiguous?
- Is there enough context for an AI to produce a good response?
- Are there conflicting requirements?
- Is important information missing (audience, scope, format, constraints)?

For SIMPLE, CLEAR prompts like:
- "who was albert einstein?" → No clarification needed
- "what is photosynthesis?" → No clarification needed
- "translate 'hello' to Spanish" → No clarification needed

For COMPLEX or AMBIGUOUS prompts where clarification adds value:
- "write a guide on React hooks" → Missing: audience, scope, format
- "help me with my presentation" → Missing: topic, audience, purpose
- "write a simple but comprehensive tutorial" → Conflicting: simple vs comprehensive

If clarification is NOT needed, respond with:
{
  "needsClarification": false,
  "summary": "Brief summary confirming the clear intent",
  "questions": []
}

If clarification IS needed, respond with:
{
  "needsClarification": true,
  "summary": "Brief summary of what you understand they want",
  "questions": [
    {
      "id": "unique_id",
      "question": "The question to ask",
      "why": "Brief explanation of why this matters (shown to user)",
      "options": [
        { "value": "option1", "label": "Display label for option 1" },
        { "value": "option2", "label": "Display label for option 2" },
        { "value": "option3", "label": "Display label for option 3" }
      ],
      "allowCustom": true
    }
  ]
}

Only ask 2-4 questions that are truly RELEVANT. Don't ask generic questions if the prompt is already clear on that aspect.`;

const REFINEMENT_PROMPT = `You are a prompt refinement specialist. Given a user's original prompt and their answers to clarifying questions, create a refined, clear, and comprehensive prompt.

The refined prompt should:
1. Be clear and unambiguous
2. Include all the context from their answers
3. Be ready to send to any AI tool (ChatGPT, Claude, etc.)
4. Not include meta-instructions like "write a prompt" - just be the actual prompt
5. Be natural and well-written

Also provide a structured breakdown of the intent for easy scanning.

Respond with JSON only:
{
  "refinedPrompt": "The complete refined prompt ready to use",
  "intentBreakdown": {
    "goal": "The main objective in a few words",
    "audience": "Who this is for (optional, omit if not relevant)",
    "scope": "How comprehensive/detailed (optional)",
    "format": "Expected output format (optional)",
    "constraints": ["Specific requirement 1", "Specific requirement 2"]
  },
  "explanation": "Brief explanation of what was clarified/improved"
}`;

export async function generateClarificationQuestions(
  input: string
): Promise<ClarificationResponse> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: QUESTION_GENERATION_PROMPT,
      },
      {
        role: 'user',
        content: `Analyze this prompt and generate clarifying questions:\n\n"${input}"`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  return {
    originalInput: input,
    needsClarification: parsed.needsClarification ?? (parsed.questions?.length > 0),
    summary: parsed.summary || '',
    questions: parsed.questions || [],
  };
}

export async function refinePromptWithAnswers(
  originalInput: string,
  answers: Record<string, string>
): Promise<RefinedPromptResponse> {
  const answersText = Object.entries(answers)
    .map(([questionId, answer]) => `- ${questionId}: ${answer}`)
    .join('\n');

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content: REFINEMENT_PROMPT,
      },
      {
        role: 'user',
        content: `Original prompt:\n"${originalInput}"\n\nUser's clarifications:\n${answersText}\n\nCreate the refined prompt.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  return {
    originalInput,
    refinedPrompt: parsed.refinedPrompt || '',
    intentBreakdown: parsed.intentBreakdown || { goal: '' },
    explanation: parsed.explanation || '',
  };
}
