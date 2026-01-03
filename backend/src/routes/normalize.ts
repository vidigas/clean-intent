import { Router, Request, Response } from 'express';
import { NormalizeRequestSchema } from '../types/intentSchema.js';
import { normalize } from '../modules/llmNormalizer.js';
import { requireApiKey, rateLimit, trackUsage } from '../middleware/auth.js';

const router = Router();

// Protected route: requires IRL API key, rate limited, usage tracked
router.post(
  '/',
  requireApiKey,
  rateLimit,
  trackUsage('/normalize'),
  async (req: Request, res: Response) => {
    try {
      const parseResult = NormalizeRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: parseResult.error.errors,
        });
        return;
      }

      const { text } = parseResult.data;

      // Use server's Anthropic API key (not user's)
      const result = await normalize(text);

      res.json(result);
    } catch (error) {
      console.error('Normalization error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
