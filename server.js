const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors());
app.use(express.json());



// Socket.IO setup with CORS
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active meetings and participants
const meetings = new Map();
const participants = new Map();
const activeCalls = new Map(); // Track active calls by appointment ID

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeMeetings: meetings.size,
    activeParticipants: participants.size,
    activeCalls: activeCalls.size
  });
});

// Check if a specific call is active
app.get('/call-status/:appointmentId', (req, res) => {
  const { appointmentId } = req.params;
  const callInfo = activeCalls.get(appointmentId);
  
  res.json({
    appointmentId,
    isActive: !!callInfo,
    callInfo: callInfo || null
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Start a call (doctor initiates)
  socket.on('start-call', ({ appointmentId, meetingId, doctorName }) => {
    console.log(`📞 Doctor ${doctorName} started call for appointment ${appointmentId}`);
    
    // Mark call as active
    activeCalls.set(appointmentId, {
      meetingId,
      doctorName,
      startedAt: Date.now(),
      status: 'active'
    });
    
    // Broadcast to all clients that this call is now active
    io.emit('call-started', { appointmentId, meetingId, doctorName });
    
    socket.emit('call-start-confirmed', { appointmentId, meetingId });
  });
  
  // Check if call is active
  socket.on('check-call-status', ({ appointmentId }) => {
    const callInfo = activeCalls.get(appointmentId);
    socket.emit('call-status-response', {
      appointmentId,
      isActive: !!callInfo,
      callInfo: callInfo || null
    });
  });
  
  // End a call
  socket.on('end-call', ({ appointmentId }) => {
    console.log(`📞 Call ended for appointment ${appointmentId}`);
    activeCalls.delete(appointmentId);
    
    // Broadcast to all clients that this call has ended
    io.emit('call-ended', { appointmentId });
  });

  // Join a meeting room
  socket.on('join-meeting', ({ meetingId, participantId, participantName, isHost }) => {
    console.log(`\n👤 ${participantName} (${participantId}) joining meeting ${meetingId}`);
    console.log(`   Socket ID: ${socket.id}`);
    
    // Join the Socket.IO room
    socket.join(meetingId);
    
    // Store participant info
    participants.set(socket.id, {
      socketId: socket.id,
      participantId,
      participantName,
      meetingId,
      isHost,
      isAudioMuted: false,
      isVideoOff: false,
    });

    // Add to meeting
    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, new Set());
      console.log(`   📝 Created new meeting: ${meetingId}`);
    }
    meetings.get(meetingId).add(socket.id);

    // Notify others in the room
    const roomSize = meetings.get(meetingId).size;
    console.log(`   👥 Meeting ${meetingId} now has ${roomSize} participant(s)`);
    
    socket.to(meetingId).emit('participant-joined', {
      participantId,
      participantName,
      isHost
    });

    // Send current participants to the new joiner
    const currentParticipants = Array.from(meetings.get(meetingId))
      .map(sid => participants.get(sid))
      .filter(p => p && p.socketId !== socket.id);
    
    console.log(`   📤 Sending ${currentParticipants.length} existing participant(s) to ${participantName}`);
    socket.emit('existing-participants', currentParticipants);
    
    // Log all participants in this meeting
    console.log(`   📋 All participants in ${meetingId}:`);
    Array.from(meetings.get(meetingId)).forEach(sid => {
      const p = participants.get(sid);
      if (p) {
        console.log(`      - ${p.participantName} (${p.participantId})`);
      }
    });
  });

  // WebRTC Signaling: Offer
  socket.on('offer', ({ meetingId, toParticipantId, offer }) => {
    const sender = participants.get(socket.id);
    console.log(`Offer from ${sender?.participantName} to ${toParticipantId}`);
    
    // Find the target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === toParticipantId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('offer', {
        fromParticipantId: sender.participantId,
        fromParticipantName: sender.participantName,
        offer
      });
    }
  });

  // WebRTC Signaling: Answer
  socket.on('answer', ({ meetingId, toParticipantId, answer }) => {
    const sender = participants.get(socket.id);
    console.log(`Answer from ${sender?.participantName} to ${toParticipantId}`);
    
    // Find the target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === toParticipantId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('answer', {
        fromParticipantId: sender.participantId,
        answer
      });
    }
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', ({ meetingId, toParticipantId, candidate }) => {
    const sender = participants.get(socket.id);
    
    // Find the target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === toParticipantId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('ice-candidate', {
        fromParticipantId: sender.participantId,
        candidate
      });
    }
  });

  // Chat message
  socket.on('chat-message', ({ meetingId, message }) => {
    const sender = participants.get(socket.id);
    console.log(`Chat message from ${sender?.participantName} in meeting ${meetingId}`);
    
    // Broadcast to all OTHER participants in the meeting (exclude sender)
    socket.to(meetingId).emit('chat-message', message);
  });

  // Update participant state (audio/video)
  socket.on('update-participant-state', ({ meetingId, participantId, isAudioMuted, isVideoOff }) => {
    const participant = participants.get(socket.id);
    if (participant && participant.participantId === participantId) {
      // Update local state
      if (isAudioMuted !== undefined) participant.isAudioMuted = isAudioMuted;
      if (isVideoOff !== undefined) participant.isVideoOff = isVideoOff;
      
      // Broadcast to all participants
      io.to(meetingId).emit('participant-state-changed', {
        participantId,
        participantName: participant.participantName,
        isAudioMuted: participant.isAudioMuted,
        isVideoOff: participant.isVideoOff,
      });
    }
  });

  // Host mutes a participant
  socket.on('mute-participant', ({ meetingId, participantId }) => {
    const host = participants.get(socket.id);
    if (!host || !host.isHost) return;
    
    console.log(`Host ${host.participantName} muting ${participantId}`);
    
    // Find target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === participantId);
    
    if (targetSocket) {
      const [targetSocketId, targetParticipant] = targetSocket;
      targetParticipant.isAudioMuted = true;
      
      // Notify the participant they were muted
      io.to(targetSocketId).emit('muted-by-host');
      
      // Broadcast state change to all
      io.to(meetingId).emit('participant-state-changed', {
        participantId,
        participantName: targetParticipant.participantName,
        isAudioMuted: true,
        isVideoOff: targetParticipant.isVideoOff,
      });
    }
  });

  // Host unmutes a participant
  socket.on('unmute-participant', ({ meetingId, participantId }) => {
    const host = participants.get(socket.id);
    if (!host || !host.isHost) return;
    
    console.log(`Host ${host.participantName} unmuting ${participantId}`);
    
    // Find target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === participantId);
    
    if (targetSocket) {
      const [targetSocketId, targetParticipant] = targetSocket;
      targetParticipant.isAudioMuted = false;
      
      // Notify the participant they were unmuted
      io.to(targetSocketId).emit('unmuted-by-host');
      
      // Broadcast state change to all
      io.to(meetingId).emit('participant-state-changed', {
        participantId,
        participantName: targetParticipant.participantName,
        isAudioMuted: false,
        isVideoOff: targetParticipant.isVideoOff,
      });
    }
  });

  // Host removes a participant
  socket.on('remove-participant', ({ meetingId, participantId }) => {
    const host = participants.get(socket.id);
    if (!host || !host.isHost) return;
    
    console.log(`Host ${host.participantName} removing ${participantId}`);
    
    // Find target participant's socket
    const targetSocket = Array.from(participants.entries())
      .find(([_, p]) => p.participantId === participantId);
    
    if (targetSocket) {
      const [targetSocketId] = targetSocket;
      
      // Notify the participant they were removed
      io.to(targetSocketId).emit('removed-by-host');
      
      // Force disconnect after a short delay
      setTimeout(() => {
        const targetSocketObj = io.sockets.sockets.get(targetSocketId);
        if (targetSocketObj) {
          targetSocketObj.disconnect(true);
        }
      }, 1000);
    }
  });

  // Leave meeting
  socket.on('leave-meeting', ({ meetingId, participantId }) => {
    handleParticipantLeave(socket, meetingId, participantId);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const participant = participants.get(socket.id);
    
    if (participant) {
      handleParticipantLeave(socket, participant.meetingId, participant.participantId);
    }
  });
});

function handleParticipantLeave(socket, meetingId, participantId) {
  const participant = participants.get(socket.id);
  
  if (participant) {
    console.log(`${participant.participantName} left meeting ${meetingId}`);
    
    // Notify others
    socket.to(meetingId).emit('participant-left', {
      participantId: participant.participantId,
      participantName: participant.participantName
    });
    
    // Clean up
    socket.leave(meetingId);
    participants.delete(socket.id);
    
    if (meetings.has(meetingId)) {
      meetings.get(meetingId).delete(socket.id);
      
      // Remove meeting if empty
      if (meetings.get(meetingId).size === 0) {
        meetings.delete(meetingId);
        console.log(`Meeting ${meetingId} ended (no participants)`);
      }
    }
  }
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 WebRTC Signaling Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Server ready to accept connections`);
});
