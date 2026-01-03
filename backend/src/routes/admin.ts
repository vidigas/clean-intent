import { Router, Request, Response, NextFunction } from 'express';
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  getUsageStats,
  getUsageForKey,
} from '../modules/apiKeys.js';

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin credentials.',
    });
    return;
  }

  next();
}

router.use(requireAdmin);

// List all API keys
router.get('/keys', (_req: Request, res: Response) => {
  const keys = listApiKeys();

  // Mask the actual key values for security
  const masked = keys.map((k) => ({
    ...k,
    key: k.key.slice(0, 8) + '...' + k.key.slice(-4),
  }));

  res.json({ keys: masked });
});

// Create a new API key
router.post('/keys', (req: Request, res: Response) => {
  const { name, rate_limit, monthly_limit } = req.body;

  if (!name) {
    res.status(400).json({
      error: 'Bad request',
      message: 'Name is required.',
    });
    return;
  }

  const apiKey = generateApiKey(name, rate_limit, monthly_limit);

  res.status(201).json({
    message: 'API key created. Store this key securely - it will not be shown again.',
    key: apiKey,
  });
});

// Revoke an API key
router.delete('/keys/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid key ID.',
    });
    return;
  }

  const revoked = revokeApiKey(id);

  if (revoked) {
    res.json({ message: 'API key revoked.' });
  } else {
    res.status(404).json({
      error: 'Not found',
      message: 'API key not found.',
    });
  }
});

// Get usage stats for a key
router.get('/keys/:id/usage', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid key ID.',
    });
    return;
  }

  const stats = getUsageStats(id);
  const recentLogs = getUsageForKey(id).slice(0, 100);

  res.json({
    stats,
    recent_logs: recentLogs,
  });
});

export default router;
