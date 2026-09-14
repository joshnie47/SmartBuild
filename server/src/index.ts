import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import { connectDB } from './config/db';
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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
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

// Start server after DB connects
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket running on ws://localhost:${PORT}`);
  });
});
