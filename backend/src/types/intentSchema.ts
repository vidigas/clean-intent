import { z } from 'zod';

export const SCHEMA_VERSION = '0.1.0';

export const ConflictSchema = z.object({
  type: z.enum(['constraint', 'goal', 'output']),
  description: z.string(),
  severity: z.enum(['warning', 'blocking']),
  terms: z.array(z.string()),
});

export const ConstraintSchema = z.object({
  text: z.string(),
  type: z.enum(['hard', 'soft']),
});

export const OutputExpectationSchema = z.object({
  length: z.enum(['short', 'medium', 'long', 'any']).nullable(),
  format: z.string().nullable(),
  structure: z.array(z.string()).nullable(),
});

export const IntentSchema = z.object({
  version: z.string().default(SCHEMA_VERSION),
  primaryGoal: z.string(),
  taskType: z.string().nullable(),
  audience: z.string().nullable(),
  domain: z.string().nullable(),
  constraints: z.object({
    hard: z.array(ConstraintSchema),
    soft: z.array(ConstraintSchema),
  }),
  outputExpectations: OutputExpectationSchema.nullable(),
  conflicts: z.array(ConflictSchema),
  requiresClarification: z.boolean(),
  rawInput: z.string(),
  assumptions: z.array(z.string()),
});

export type Conflict = z.infer<typeof ConflictSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type OutputExpectation = z.infer<typeof OutputExpectationSchema>;
export type Intent = z.infer<typeof IntentSchema>;

export const NormalizeRequestSchema = z.object({
  text: z.string().min(1, 'Input text is required'),
});

export const NormalizeResponseSchema = z.object({
  intent: IntentSchema,
  irl: z.string(),
  compiled: z.string(),
});

export type NormalizeRequest = z.infer<typeof NormalizeRequestSchema>;
export type NormalizeResponse = z.infer<typeof NormalizeResponseSchema>;
