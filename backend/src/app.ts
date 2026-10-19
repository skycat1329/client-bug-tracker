import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.router.js';
import { organizationsRouter } from './modules/organizations/organizations.router.js';
import { ticketsRouter } from './modules/tickets/tickets.router.js';
import { commentsRouter } from './modules/comments/comments.router.js';
import { attachmentsRouter, downloadRouter } from './modules/attachments/attachments.router.js';
import { routingRouter } from './modules/routing/routing.router.js';
import { auditRouter } from './modules/audit/audit.router.js';
import { integrationsRouter } from './modules/integrations/integrations.router.js';

export const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow browser frontend, local requests, tools, mobile
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 auth requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again later.' },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Client Bug Tracker API',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Mount Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/tickets/:ticketId/comments', commentsRouter);
app.use('/api/tickets/:ticketId/attachments', attachmentsRouter);
app.use('/api/attachments', downloadRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/routing-rules', routingRouter);
app.use('/api/audit', auditRouter);
app.use('/api/integrations', integrationsRouter);

// Serve React frontend in production if built
const candidateFrontendPaths = [
  path.resolve(process.cwd(), './frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), './public'),
  path.resolve(process.cwd(), './dist/public'),
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, './public'),
];

let frontendDist: string | null = null;
for (const p of candidateFrontendPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    frontendDist = p;
    break;
  }
}

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist!, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);
