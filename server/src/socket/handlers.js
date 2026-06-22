import jwt from 'jsonwebtoken';

// Track online players: { socketId -> { userId, username, x, y, mapId } }
const onlinePlayers = new Map();

export function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.user.userId}`);

    socket.on('player:join', ({ username, x, y, mapId, sprite }) => {
      onlinePlayers.set(socket.id, { userId: socket.user.userId, username, x, y, mapId, sprite });
      socket.join(mapId);
      socket.to(mapId).emit('player:joined', { socketId: socket.id, username, x, y, sprite });
      // Send current map players to the joining player
      const mapPlayers = [...onlinePlayers.entries()]
        .filter(([id, p]) => id !== socket.id && p.mapId === mapId)
        .map(([id, p]) => ({ socketId: id, ...p }));
      socket.emit('players:current', mapPlayers);
    });

    socket.on('player:move', ({ x, y }) => {
      const player = onlinePlayers.get(socket.id);
      if (!player) return;
      player.x = x;
      player.y = y;
      socket.to(player.mapId).emit('player:moved', { socketId: socket.id, x, y });
    });

    socket.on('chat:message', ({ text }) => {
      const player = onlinePlayers.get(socket.id);
      if (!player) return;
      io.to(player.mapId).emit('chat:message', { username: player.username, text, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      const player = onlinePlayers.get(socket.id);
      if (player) {
        socket.to(player.mapId).emit('player:left', { socketId: socket.id });
        onlinePlayers.delete(socket.id);
      }
    });
  });
}
