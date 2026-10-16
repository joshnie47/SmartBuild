import dotenv from 'dotenv';
import path from 'path';

// Load .env from process CWD and fallback to server directory
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import dns from 'dns';
// Force IPv4-first globally — fixes ENETUNREACH errors on networks without IPv6
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Use system default DNS
}
import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { connectDB, getDBStatus } from './config/db';
import { createChatGateway } from './websocket/ChatGateway';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import contractorsRouter from './routes/contractors';
import bidsRouter from './routes/bids';
import reviewsRouter from './routes/reviews';
import notificationsRouter from './routes/notifications';
import adminRouter from './routes/admin';
import conversationsRouter from './routes/conversations';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

// Root welcome & status endpoint
app.get('/', (_req, res) => {
  const db = getDBStatus();
  res.status(200).json({
    status: 'ok',
    message: 'SmartBuild Backend API is running',
    version: '1.0.0',
    database: {
      connected: db.connected,
      status: db.connected ? 'connected' : 'disconnected',
    },
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      api: '/api',
    },
    timestamp: new Date().toISOString(),
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use(healthRouter);
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/contractors', contractorsRouter);
app.use('/api/contractor', contractorsRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/conversations', conversationsRouter);

// ── HTTP server + WebSocket on the same port ──────────────────────────────────
// We wrap Express in a plain http.Server so the WebSocketServer can share the
// same port. WebSocket connections hit ws://host:PORT?token=<jwt>
const server = http.createServer(app);

const wss = new WebSocketServer({ server });
createChatGateway(wss);

// Start HTTP server immediately so /api/health and all endpoints are responsive
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket running on port ${PORT}`);
});

// Connect to MongoDB Atlas asynchronously in the background
connectDB().catch((err) => {
  console.error('❌ Failed to initialize MongoDB connection:', err);
});

