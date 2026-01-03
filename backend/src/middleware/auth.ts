import { Request, Response, NextFunction } from 'express';
import {
  validateApiKey,
  checkRateLimit,
  checkMonthlyLimit,
  logUsage,
  type ApiKey,
} from '../modules/apiKeys.js';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      startTime?: number;
    }
  }
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let key: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    key = authHeader.slice(7);
  } else if (apiKeyHeader) {
    key = apiKeyHeader;
  }

  if (!key) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Pass via Authorization: Bearer <key> or X-API-Key header.',
    });
    return;
  }

  const apiKey = validateApiKey(key);

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or revoked API key.',
    });
    return;
  }

  req.apiKey = apiKey;
  req.startTime = Date.now();
  next();
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    next();
    return;
  }

  const { allowed, remaining } = checkRateLimit(req.apiKey.id);

  res.setHeader('X-RateLimit-Limit', req.apiKey.rate_limit);
  res.setHeader('X-RateLimit-Remaining', remaining);

  if (!allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Rate limit of ${req.apiKey.rate_limit} requests per minute exceeded. Try again later.`,
    });
    return;
  }

  const monthly = checkMonthlyLimit(req.apiKey.id);
  res.setHeader('X-MonthlyLimit-Remaining', monthly.remaining);

  if (!monthly.allowed) {
    res.status(429).json({
      error: 'Monthly limit exceeded',
      message: `Monthly limit of ${req.apiKey.monthly_limit} requests exceeded. Upgrade your plan.`,
    });
    return;
  }

  next();
}

export function trackUsage(endpoint: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      const latencyMs = req.startTime ? Date.now() - req.startTime : 0;
      const success = res.statusCode >= 200 && res.statusCode < 400;

      // Rough token estimation (actual tokens would come from Claude response)
      const inputTokens = Math.ceil(JSON.stringify(req.body || {}).length / 4);
      const outputTokens = Math.ceil(JSON.stringify(body || {}).length / 4);

      logUsage(req.apiKey!.id, endpoint, inputTokens, outputTokens, latencyMs, success);

      return originalJson(body);
    };

    next();
  };
}
