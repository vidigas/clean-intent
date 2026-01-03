import type { Intent, NormalizeResponse } from '../types/intentSchema.js';
import { SCHEMA_VERSION } from '../types/intentSchema.js';
import { parseIntent } from './intentParser.js';
import { detectConflicts } from './conflictDetector.js';
import { generateIRL } from './irlGenerator.js';
import { compilePrompt } from './promptCompiler.js';

export function normalize(input: string): NormalizeResponse {
  const parsed = parseIntent(input);

  const conflicts = detectConflicts(input);

  const requiresClarification = conflicts.some((c) => c.severity === 'blocking');

  const intent: Intent = {
    version: SCHEMA_VERSION,
    primaryGoal: parsed.primaryGoal,
    taskType: parsed.taskType,
    audience: parsed.audience,
    domain: parsed.domain,
    constraints: {
      hard: parsed.hardConstraints,
      soft: parsed.softConstraints,
    },
    outputExpectations: parsed.outputExpectations,
    conflicts,
    requiresClarification,
    rawInput: input,
    assumptions: parsed.assumptions,
  };

  const irl = generateIRL(intent);

  const compiled = compilePrompt(intent);

  return {
    intent,
    irl,
    compiled,
  };
}
