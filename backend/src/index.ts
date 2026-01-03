import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import normalizeRouter from './routes/normalize.js';
import adminRouter from './routes/admin.js';
import demoRouter from './routes/demo.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public demo endpoint (rate limited by IP, no API key)
app.use('/demo', demoRouter);

// API v1 routes (requires API key)
app.use('/v1/normalize', normalizeRouter);

// Admin routes (protected by ADMIN_SECRET)
app.use('/admin', adminRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(PORT, () => {
  console.log(`IRL API running on http://localhost:${PORT}`);
  console.log(`  POST /demo/normalize - Try it (no API key, rate limited)`);
  console.log(`  POST /v1/normalize   - Production (requires API key)`);
});
