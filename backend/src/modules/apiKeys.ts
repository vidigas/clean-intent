import { nanoid } from 'nanoid';
import db from '../db/index.js';

export interface ApiKey {
  id: number;
  key: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  rate_limit: number;
  monthly_limit: number;
}

export interface UsageLog {
  id: number;
  api_key_id: number;
  timestamp: string;
  endpoint: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: number;
}

export function generateApiKey(name: string, rateLimit = 100, monthlyLimit = 10000): ApiKey {
  const key = `irl_${nanoid(32)}`;

  const stmt = db.prepare(`
    INSERT INTO api_keys (key, name, rate_limit, monthly_limit)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(key, name, rateLimit, monthlyLimit);

  return getApiKeyById(result.lastInsertRowid as number)!;
}

export function getApiKeyById(id: number): ApiKey | null {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
  return stmt.get(id) as ApiKey | null;
}

export function validateApiKey(key: string): ApiKey | null {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE key = ? AND revoked_at IS NULL');
  return stmt.get(key) as ApiKey | null;
}

export function revokeApiKey(id: number): boolean {
  const stmt = db.prepare('UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function listApiKeys(): ApiKey[] {
  const stmt = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
  return stmt.all() as ApiKey[];
}

export function logUsage(
  apiKeyId: number,
  endpoint: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  success: boolean
): void {
  const stmt = db.prepare(`
    INSERT INTO usage_logs (api_key_id, endpoint, input_tokens, output_tokens, latency_ms, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(apiKeyId, endpoint, inputTokens, outputTokens, latencyMs, success ? 1 : 0);
}

export function getUsageForKey(apiKeyId: number, since?: Date): UsageLog[] {
  let query = 'SELECT * FROM usage_logs WHERE api_key_id = ?';
  const params: (number | string)[] = [apiKeyId];

  if (since) {
    query += ' AND timestamp >= ?';
    params.push(since.toISOString());
  }

  query += ' ORDER BY timestamp DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as UsageLog[];
}

export function getUsageStats(apiKeyId: number): {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  calls_this_month: number;
} {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END), 0) as calls_this_month
    FROM usage_logs
    WHERE api_key_id = ?
  `);

  return stmt.get(startOfMonth.toISOString(), apiKeyId) as {
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    calls_this_month: number;
  };
}

export function checkRateLimit(apiKeyId: number, windowMs = 60000): { allowed: boolean; remaining: number } {
  const apiKey = getApiKeyById(apiKeyId);
  if (!apiKey) {
    return { allowed: false, remaining: 0 };
  }

  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM usage_logs
    WHERE api_key_id = ? AND timestamp >= ?
  `);

  const result = stmt.get(apiKeyId, windowStart) as { count: number };
  const remaining = Math.max(0, apiKey.rate_limit - result.count);

  return {
    allowed: result.count < apiKey.rate_limit,
    remaining,
  };
}

export function checkMonthlyLimit(apiKeyId: number): { allowed: boolean; remaining: number } {
  const apiKey = getApiKeyById(apiKeyId);
  if (!apiKey) {
    return { allowed: false, remaining: 0 };
  }

  const stats = getUsageStats(apiKeyId);
  const remaining = Math.max(0, apiKey.monthly_limit - stats.calls_this_month);

  return {
    allowed: stats.calls_this_month < apiKey.monthly_limit,
    remaining,
  };
}
