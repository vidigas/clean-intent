import { Router, Request, Response } from 'express';
import { NormalizeRequestSchema } from '../types/intentSchema.js';
import { normalize } from '../modules/llmNormalizer.js';
import {
  generateClarificationQuestions,
  refinePromptWithAnswers,
} from '../modules/clarificationAgent.js';

const router = Router();

// Simple in-memory rate limiting for demo endpoint
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const DEMO_RATE_LIMIT = 10; // requests per minute per IP
const WINDOW_MS = 60000;

function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequests.get(ip);

  if (!record || now > record.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= DEMO_RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Public demo endpoint - no API key required, but rate limited by IP
router.post('/normalize', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkDemoRateLimit(ip)) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Demo is limited to 10 requests per minute. Get an API key for higher limits.',
      });
      return;
    }

    const parseResult = NormalizeRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.errors,
      });
      return;
    }

    const { text } = parseResult.data;

    const result = await normalize(text);

    res.json(result);
  } catch (error) {
    console.error('Demo normalization error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Step 1: Generate clarification questions for a prompt
router.post('/clarify', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkDemoRateLimit(ip)) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Demo is limited to 10 requests per minute. Get an API key for higher limits.',
      });
      return;
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'text field is required',
      });
      return;
    }

    const result = await generateClarificationQuestions(text);
    res.json(result);
  } catch (error) {
    console.error('Clarification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Step 2: Refine prompt based on user's answers
router.post('/refine', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkDemoRateLimit(ip)) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Demo is limited to 10 requests per minute. Get an API key for higher limits.',
      });
      return;
    }

    const { originalInput, answers } = req.body;

    if (!originalInput || typeof originalInput !== 'string') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'originalInput field is required',
      });
      return;
    }

    if (!answers || typeof answers !== 'object') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'answers field is required',
      });
      return;
    }

    const result = await refinePromptWithAnswers(originalInput, answers);
    res.json(result);
  } catch (error) {
    console.error('Refinement error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
