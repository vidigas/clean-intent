import type { Conflict } from '../types/intentSchema.js';

interface ConflictRule {
  terms: [string, string];
  description: string;
  severity: 'warning' | 'blocking';
  type: 'constraint' | 'goal' | 'output';
}

const CONFLICT_RULES: ConflictRule[] = [
  {
    terms: ['simple', 'detailed'],
    description: 'Request asks for both simple and detailed output',
    severity: 'warning',
    type: 'constraint',
  },
  {
    terms: ['short', 'comprehensive'],
    description: 'Request asks for both short and comprehensive output',
    severity: 'warning',
    type: 'output',
  },
  {
    terms: ['short', 'in-depth'],
    description: 'Request asks for both short and in-depth content',
    severity: 'warning',
    type: 'output',
  },
  {
    terms: ['brief', 'thorough'],
    description: 'Request asks for both brief and thorough output',
    severity: 'warning',
    type: 'output',
  },
  {
    terms: ['creative', 'strict'],
    description: 'Request asks for both creative and strict approach',
    severity: 'warning',
    type: 'constraint',
  },
  {
    terms: ['creative', 'formal'],
    description: 'Creative tone conflicts with formal style requirement',
    severity: 'warning',
    type: 'constraint',
  },
  {
    terms: ['casual', 'professional'],
    description: 'Casual tone conflicts with professional style',
    severity: 'warning',
    type: 'constraint',
  },
  {
    terms: ['fast', 'perfect'],
    description: 'Prioritizing speed may conflict with perfectionism',
    severity: 'warning',
    type: 'constraint',
  },
  {
    terms: ['minimal', 'feature-rich'],
    description: 'Minimal design conflicts with feature-rich requirements',
    severity: 'blocking',
    type: 'goal',
  },
  {
    terms: ['concise', 'exhaustive'],
    description: 'Concise output conflicts with exhaustive coverage',
    severity: 'warning',
    type: 'output',
  },
];

export function detectConflicts(text: string): Conflict[] {
  const lowerText = text.toLowerCase();
  const conflicts: Conflict[] = [];

  for (const rule of CONFLICT_RULES) {
    const [term1, term2] = rule.terms;
    const hasTerm1 = lowerText.includes(term1);
    const hasTerm2 = lowerText.includes(term2);

    if (hasTerm1 && hasTerm2) {
      conflicts.push({
        type: rule.type,
        description: rule.description,
        severity: rule.severity,
        terms: rule.terms,
      });
    }
  }

  return conflicts;
}
