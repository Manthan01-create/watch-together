const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({
  url: 'file:' + path.join(__dirname, '../../dev.db')
});
const prisma = new PrismaClient({ adapter });
const app = express();
const server = http.createServer(app);

// Enable CORS for frontend connection (default Next.js runs on 3000)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json({ limit: '50mb' }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// REST route for file sharing upload (Alternative to Socket.IO base64)
app.post('/api/upload', (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // Decode base64 file data
    const base64Data = fileData.replace(/^data:.*;base64,/, "");
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Return relative URL for Next.js to serve
    return res.status(200).json({
      fileUrl: `/uploads/${uniqueFileName}`,
      fileName: fileName
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100mb limit for buffer transfer
});

// In-memory active room user mappings: roomId -> array of user objects { socketId, username, isHost, camera, mic }
const roomUsers = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join Room
  socket.on('join-room', async ({ roomId, username, password }) => {
    try {
      // Find or create room in DB
      let room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } }
      });

      if (!room) {
        // Room doesn't exist, create it (acts as the default public room creation)
        room = await prisma.room.create({
          data: {
            id: roomId,
            name: `Room ${roomId.substring(0, 6)}`,
            isPublic: true,
          },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } }
        });
      } else if (room.password && room.password !== password) {
        socket.emit('error-msg', 'Invalid room password.');
        return;
      }

      socket.join(roomId);

      // Manage room user lists
      if (!roomUsers[roomId]) {
        roomUsers[roomId] = [];
      }

      const isFirstUser = roomUsers[roomId].length === 0;
      
      const user = {
        socketId: socket.id,
        username: username || `Guest-${socket.id.substring(0, 4)}`,
        isHost: isFirstUser, // First user is default host
        camera: false,
        mic: false
      };

      roomUsers[roomId].push(user);

      // If room has no active host in DB, assign this user
      if (isFirstUser || !room.hostId) {
        await prisma.room.update({
          where: { id: roomId },
          data: { hostId: socket.id }
        });
        room.hostId = socket.id;
      }

      // Send initial states to joining user
      socket.emit('room-joined', {
        roomState: {
          activeVideoUrl: room.activeVideoUrl,
          activeVideoType: room.activeVideoType,
          videoPlaying: room.videoPlaying,
          videoTime: room.videoTime,
          pdfPage: room.pdfPage,
          hostId: room.hostId
        },
        users: roomUsers[roomId],
        messages: room.messages
      });

      // Notify others in room
      socket.to(roomId).emit('user-connected', user);
      io.to(roomId).emit('update-users', roomUsers[roomId]);

      console.log(`${user.username} joined room ${roomId}`);
    } catch (e) {
      console.error(e);
      socket.emit('error-msg', 'Database or server error joining room.');
    }
  });

  // Sync Playback Events (from host or co-host)
  socket.on('playback-control', async ({ roomId, action, time, url, type, page }) => {
    try {
      const updateData = {};
      if (url !== undefined) updateData.activeVideoUrl = url;
      if (type !== undefined) updateData.activeVideoType = type;
      if (time !== undefined) updateData.videoTime = parseFloat(time);
      if (action === 'play') updateData.videoPlaying = true;
      if (action === 'pause') updateData.videoPlaying = false;
      if (page !== undefined) updateData.pdfPage = parseInt(page);

      if (Object.keys(updateData).length > 0) {
        await prisma.room.update({
          where: { id: roomId },
          data: updateData
        });
      }

      // Broadcast changes to everyone in room except sender
      socket.to(roomId).emit('playback-updated', { action, time, url, type, page });
    } catch (e) {
      console.error('Error syncing playback:', e);
    }
  });

  // Host Change Request
  socket.on('claim-host', async ({ roomId }) => {
    try {
      if (roomUsers[roomId]) {
        // Remove host from others, assign to claimer
        roomUsers[roomId].forEach(u => {
          u.isHost = (u.socketId === socket.id);
        });

        await prisma.room.update({
          where: { id: roomId },
          data: { hostId: socket.id }
        });

        io.to(roomId).emit('update-users', roomUsers[roomId]);
        io.to(roomId).emit('host-changed', socket.id);
      }
    } catch (e) {
      console.error('Error claiming host:', e);
    }
  });

  // Chat message
  socket.on('send-message', async ({ roomId, senderName, content, fileUrl, fileName }) => {
    try {
      const msg = await prisma.message.create({
        data: {
          roomId,
          senderName,
          content,
          fileUrl,
          fileName
        }
      });

      io.to(roomId).emit('receive-message', msg);
    } catch (e) {
      console.error('Error saving message:', e);
    }
  });

  // Instant emoji reaction
  socket.on('send-reaction', ({ roomId, emoji, senderName }) => {
    io.to(roomId).emit('receive-reaction', { emoji, senderName });
  });

  // Toggle user audio/video states (for display on grid)
  socket.on('toggle-media-state', ({ roomId, camera, mic }) => {
    if (roomUsers[roomId]) {
      const user = roomUsers[roomId].find(u => u.socketId === socket.id);
      if (user) {
        if (camera !== undefined) user.camera = camera;
        if (mic !== undefined) user.mic = mic;
        io.to(roomId).emit('update-users', roomUsers[roomId]);
      }
    }
  });

  // WebRTC Peer-to-Peer Signaling Relay
  socket.on('signal', ({ targetSocketId, signalData }) => {
    io.to(targetSocketId).emit('signal', {
      senderSocketId: socket.id,
      signalData
    });
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find rooms the user was in
    for (const roomId in roomUsers) {
      const users = roomUsers[roomId];
      const index = users.findIndex(u => u.socketId === socket.id);

      if (index !== -1) {
        const user = users[index];
        users.splice(index, 1);

        console.log(`${user.username} left room ${roomId}`);

        // If room is empty, clean up memory (keep DB entry for history)
        if (users.length === 0) {
          delete roomUsers[roomId];
        } else {
          // If the disconnected user was the host, re-assign host to the first remaining user
          if (user.isHost) {
            const nextHost = users[0];
            nextHost.isHost = true;
            try {
              await prisma.room.update({
                where: { id: roomId },
                data: { hostId: nextHost.socketId }
              });
              io.to(roomId).emit('host-changed', nextHost.socketId);
            } catch (err) {
              console.error('Error updating new host in DB:', err);
            }
          }
          // Notify other peers of disconnect
          socket.to(roomId).emit('user-disconnected', socket.id);
          io.to(roomId).emit('update-users', users);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO Server running on port ${PORT}`);
});
