import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import habitRoutes from './routes/habits.js';
import characterRoutes from './routes/characters.js';
import shopRoutes from './routes/shop.js';
import { registerSocketHandlers } from './socket/handlers.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/shop', shopRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
