import type { Constraint, OutputExpectation } from '../types/intentSchema.js';

interface ParsedIntent {
  primaryGoal: string;
  taskType: string | null;
  audience: string | null;
  domain: string | null;
  hardConstraints: Constraint[];
  softConstraints: Constraint[];
  outputExpectations: OutputExpectation | null;
  assumptions: string[];
}

const TASK_TYPE_PATTERNS: Record<string, RegExp[]> = {
  generate: [/\b(create|generate|build|make|write|produce|design)\b/i],
  analyze: [/\b(analyze|examine|review|evaluate|assess|audit)\b/i],
  explain: [/\b(explain|describe|clarify|elaborate|break down)\b/i],
  fix: [/\b(fix|repair|debug|solve|resolve|correct)\b/i],
  optimize: [/\b(optimize|improve|enhance|refactor|streamline)\b/i],
  convert: [/\b(convert|transform|translate|migrate|port)\b/i],
  summarize: [/\b(summarize|condense|tldr|brief|overview)\b/i],
};

const AUDIENCE_PATTERNS: Array<{ pattern: RegExp; audience: string }> = [
  { pattern: /\bfor\s+(beginners?|newbies?|novices?)\b/i, audience: 'beginners' },
  { pattern: /\bfor\s+(experts?|advanced users?|professionals?)\b/i, audience: 'experts' },
  { pattern: /\bfor\s+(developers?|devs?|engineers?|programmers?)\b/i, audience: 'developers' },
  { pattern: /\bfor\s+(managers?|executives?|leadership)\b/i, audience: 'managers' },
  { pattern: /\bfor\s+(designers?|ux|ui)\b/i, audience: 'designers' },
  { pattern: /\bfor\s+(students?|learners?)\b/i, audience: 'students' },
  { pattern: /\bfor\s+(customers?|users?|clients?)\b/i, audience: 'end users' },
  { pattern: /\bfor\s+(founders?|startups?|entrepreneurs?)\b/i, audience: 'startup founders' },
  { pattern: /\bfor\s+(children|kids)\b/i, audience: 'children' },
  { pattern: /\btechnical\s+audience\b/i, audience: 'technical audience' },
  { pattern: /\bnon-technical\b/i, audience: 'non-technical audience' },
];

const DOMAIN_PATTERNS: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /\b(web|website|frontend|react|vue|angular)\b/i, domain: 'web development' },
  { pattern: /\b(mobile|ios|android|app)\b/i, domain: 'mobile development' },
  { pattern: /\b(api|backend|server|database)\b/i, domain: 'backend development' },
  { pattern: /\b(ml|machine learning|ai|data science)\b/i, domain: 'machine learning' },
  { pattern: /\b(devops|ci\/cd|deployment|infrastructure)\b/i, domain: 'devops' },
  { pattern: /\b(marketing|seo|growth|analytics)\b/i, domain: 'marketing' },
  { pattern: /\b(finance|banking|trading|investment)\b/i, domain: 'finance' },
  { pattern: /\b(healthcare|medical|health)\b/i, domain: 'healthcare' },
  { pattern: /\b(e-?commerce|shopping|retail)\b/i, domain: 'e-commerce' },
  { pattern: /\b(education|learning|teaching)\b/i, domain: 'education' },
];

const HARD_CONSTRAINT_PATTERNS: Array<{ pattern: RegExp; extract: (match: RegExpMatchArray) => string }> = [
  { pattern: /\bmust\s+(?:be\s+)?(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\brequired?(?:\s+to)?\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bhas\s+to\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bneed(?:s)?\s+to\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bensure\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bno\s+(.+?)(?:\.|,|$)/gi, extract: (m) => `no ${m[1].trim()}` },
  { pattern: /\bwithout\s+(.+?)(?:\.|,|$)/gi, extract: (m) => `without ${m[1].trim()}` },
];

const SOFT_CONSTRAINT_PATTERNS: Array<{ pattern: RegExp; extract: (match: RegExpMatchArray) => string }> = [
  { pattern: /\bpreferably\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bideally\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bshould\s+(?:be\s+)?(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bwould\s+be\s+nice\s+(?:to\s+)?(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\bif\s+possible[,\s]+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
  { pattern: /\boptionally\s+(.+?)(?:\.|,|$)/gi, extract: (m) => m[1].trim() },
];

const LENGTH_PATTERNS: Array<{ pattern: RegExp; length: 'short' | 'medium' | 'long' }> = [
  { pattern: /\b(brief|short|concise|quick|simple)\b/i, length: 'short' },
  { pattern: /\b(detailed|comprehensive|thorough|in-depth|exhaustive|long)\b/i, length: 'long' },
  { pattern: /\b(moderate|medium|balanced)\b/i, length: 'medium' },
];

function extractPrimaryGoal(text: string): string {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);

  const goalPatterns = [
    /^(?:i\s+want\s+(?:you\s+)?to\s+)?(.+)/i,
    /^(?:please\s+)?(.+)/i,
    /^(?:can\s+you\s+)?(.+)/i,
    /^(?:help\s+me\s+)?(.+)/i,
  ];

  if (sentences.length > 0) {
    let goal = sentences[0];

    goal = goal.replace(/^(i\s+want\s+(you\s+)?to\s+)/i, '');
    goal = goal.replace(/^(please\s+)/i, '');
    goal = goal.replace(/^(can\s+you\s+)/i, '');
    goal = goal.replace(/^(help\s+me\s+)/i, '');
    goal = goal.replace(/^(i\s+need\s+(you\s+)?to\s+)/i, '');

    return goal.charAt(0).toUpperCase() + goal.slice(1);
  }

  return text.trim();
}

function extractTaskType(text: string): string | null {
  for (const [type, patterns] of Object.entries(TASK_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
  }
  return null;
}

function extractAudience(text: string): string | null {
  for (const { pattern, audience } of AUDIENCE_PATTERNS) {
    if (pattern.test(text)) {
      return audience;
    }
  }
  return null;
}

function extractDomain(text: string): string | null {
  for (const { pattern, domain } of DOMAIN_PATTERNS) {
    if (pattern.test(text)) {
      return domain;
    }
  }
  return null;
}

function extractConstraints(text: string, patterns: typeof HARD_CONSTRAINT_PATTERNS, type: 'hard' | 'soft'): Constraint[] {
  const constraints: Constraint[] = [];
  const seen = new Set<string>();

  for (const { pattern, extract } of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const constraintText = extract(match);
      if (constraintText.length > 3 && constraintText.length < 100 && !seen.has(constraintText.toLowerCase())) {
        seen.add(constraintText.toLowerCase());
        constraints.push({ text: constraintText, type });
      }
    }
  }

  return constraints;
}

function extractOutputExpectations(text: string): OutputExpectation | null {
  let length: 'short' | 'medium' | 'long' | 'any' | null = null;

  for (const { pattern, length: len } of LENGTH_PATTERNS) {
    if (pattern.test(text)) {
      length = len;
      break;
    }
  }

  const formatPatterns: Array<{ pattern: RegExp; format: string }> = [
    { pattern: /\b(json|JSON)\b/, format: 'JSON' },
    { pattern: /\b(markdown|md)\b/i, format: 'Markdown' },
    { pattern: /\b(html|HTML)\b/, format: 'HTML' },
    { pattern: /\b(bullet\s*points?|bullets?|list)\b/i, format: 'bullet points' },
    { pattern: /\b(table|tabular)\b/i, format: 'table' },
    { pattern: /\b(code|snippet)\b/i, format: 'code' },
  ];

  let format: string | null = null;
  for (const { pattern, format: fmt } of formatPatterns) {
    if (pattern.test(text)) {
      format = fmt;
      break;
    }
  }

  const structurePatterns = [
    /\bwith\s+(sections?|parts?|chapters?)\b/i,
    /\binclude\s+(.+?)(?:\.|,|and|$)/gi,
  ];

  const structures: string[] = [];
  for (const pattern of structurePatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        structures.push(match[1].trim());
      }
    }
  }

  if (length || format || structures.length > 0) {
    return {
      length: length ?? 'any',
      format,
      structure: structures.length > 0 ? structures : null,
    };
  }

  return null;
}

function generateAssumptions(parsed: Partial<ParsedIntent>): string[] {
  const assumptions: string[] = [];

  if (!parsed.audience) {
    assumptions.push('Assuming general audience with moderate technical knowledge');
  }

  if (!parsed.outputExpectations?.length) {
    assumptions.push('Assuming medium-length output is acceptable');
  }

  if (!parsed.domain) {
    assumptions.push('No specific domain context detected');
  }

  return assumptions;
}

export function parseIntent(text: string): ParsedIntent {
  const primaryGoal = extractPrimaryGoal(text);
  const taskType = extractTaskType(text);
  const audience = extractAudience(text);
  const domain = extractDomain(text);
  const hardConstraints = extractConstraints(text, HARD_CONSTRAINT_PATTERNS, 'hard');
  const softConstraints = extractConstraints(text, SOFT_CONSTRAINT_PATTERNS, 'soft');
  const outputExpectations = extractOutputExpectations(text);

  const parsed: ParsedIntent = {
    primaryGoal,
    taskType,
    audience,
    domain,
    hardConstraints,
    softConstraints,
    outputExpectations,
    assumptions: [],
  };

  parsed.assumptions = generateAssumptions(parsed);

  return parsed;
}
