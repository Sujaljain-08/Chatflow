const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Enhanced database with all our previous functionality
const db = {
    storage: new Map(),
    messageHistory: [],
    
    // Privacy settings
    privacySettings: {
        showHistoryToNewUsers: false, // Privacy-first: don't show old messages
        maxHistoryForNewUsers: 0      // Number of previous messages to show
    },
    
    // Helper function for case-insensitive username lookup
    findUser: function(username) {
        if (!username || typeof username !== 'string' || username.trim() === '') {
            return null;
        }
        const normalizedUsername = username.toLowerCase().trim();
        for (let [key, value] of this.storage) {
            if (key.toLowerCase() === normalizedUsername) {
                return { originalName: key, data: value };
            }
        }
        return null;
    },
    
    adduser: function (username) {
        // Input validation
        if (!username || typeof username !== 'string' || username.trim() === '') {
            throw new Error("Username must be a non-empty string");
        }
        
        const cleanUsername = username.trim();
        const existingUser = this.findUser(cleanUsername);
        
        if (!existingUser) {
            const userData = {
                joinedAt: new Date(),
                status: 'online',
                lastSeen: new Date(),
                socketId: null
            };
            this.storage.set(cleanUsername, userData);
            console.log(`✅ ${cleanUsername} joined the chat at ${userData.joinedAt.toLocaleTimeString()}`);
            return userData;
        } else {
            throw new Error(`User '${existingUser.originalName}' already has an active session`);
        }
    },
    
    removeuser: function (username) {
        if (!username || typeof username !== 'string' || username.trim() === '') {
            throw new Error("Username must be a non-empty string");
        }
        
        const existingUser = this.findUser(username);
        if (existingUser) {
            this.storage.delete(existingUser.originalName);
            console.log(`❌ ${existingUser.originalName} left the chat at ${new Date().toLocaleTimeString()}`);
            return true;
        } else {
            throw new Error(`No active user found with username '${username.trim()}'`);
        }
    },
    
    hasUser: function (username) {
        if (!username || typeof username !== 'string' || username.trim() === '') {
            throw new Error("Username must be a non-empty string");
        }
        
        const existingUser = this.findUser(username);
        if (existingUser) {
            // Update last seen
            existingUser.data.lastSeen = new Date();
            console.log(`✓ ${existingUser.originalName} has active session (last seen: ${existingUser.data.lastSeen.toLocaleTimeString()})`);
            return existingUser;
        } else {
            throw new Error(`User '${username.trim()}' has no active login`);
        }
    },
    
    updateSocketId: function(username, socketId) {
        const existingUser = this.findUser(username);
        if (existingUser) {
            existingUser.data.socketId = socketId;
            return true;
        }
        return false;
    },
    
    // New methods for enhanced functionality
    getActiveUsers: function() {
        const users = [];
        for (let [username, data] of this.storage) {
            users.push({
                username,
                joinedAt: data.joinedAt,
                status: data.status,
                lastSeen: data.lastSeen
            });
        }
        return users;
    },
    
    addMessage: function(username, message) {
        const messageObj = {
            id: this.messageHistory.length + 1,
            username,
            message,
            timestamp: new Date(),
            type: 'message',
            participants: this.getActiveUsernames() // Track who was present
        };
        this.messageHistory.push(messageObj);
        console.log(`💬 [${messageObj.timestamp.toLocaleTimeString()}] ${username}: ${message}`);
        return messageObj;
    },
    
    getActiveUsernames: function() {
        return Array.from(this.storage.keys());
    },
    
    // Get messages that a user should see (only messages after they joined)
    getMessagesForUser: function(username, joinTime, limit = 50) {
        if (!this.privacySettings.showHistoryToNewUsers) {
            return []; // Privacy-first: no history for new users
        }
        
        return this.messageHistory
            .filter(msg => {
                // Show system messages or messages where user was present
                return msg.type === 'system' || 
                       (msg.participants && msg.participants.includes(username)) ||
                       new Date(msg.timestamp) >= joinTime;
            })
            .slice(-limit);
    },
    
    getMessageHistory: function(limit = 50) {
        return this.messageHistory.slice(-limit);
    },
    
    addSystemMessage: function(message) {
        const systemMsg = {
            id: this.messageHistory.length + 1,
            message,
            timestamp: new Date(),
            type: 'system'
        };
        this.messageHistory.push(systemMsg);
        console.log(`📢 [SYSTEM] ${message}`);
        return systemMsg;
    }
};

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);
    
    // Handle user joining
    socket.on('join', (username) => {
        try {
            const userData = db.adduser(username);
            db.updateSocketId(username, socket.id);
            
            // Join the user to their socket
            socket.username = username;
            socket.joinTime = new Date();
            
            // Privacy-first approach: only show relevant messages
            const relevantMessages = db.getMessagesForUser(username, socket.joinTime);
            socket.emit('messageHistory', relevantMessages);
            
            // Add system message
            db.addSystemMessage(`${username} joined the chat`);
            
            // Broadcast to all users
            const activeUsers = db.getActiveUsers();
            io.emit('userJoined', {
                username: username,
                users: activeUsers
            });
            
            // Send current users list to the new user
            socket.emit('usersList', activeUsers);
            
            console.log(`👥 Active users (${activeUsers.length}): ${activeUsers.map(u => u.username).join(', ')}`);
            
        } catch (error) {
            socket.emit('error', { message: error.message });
            console.log(`❌ Join Error: ${error.message}`);
        }
    });
    
    // Handle new messages
    socket.on('newMessage', (data) => {
        try {
            const { username, message } = data;
            
            // Validate message content
            if (!message || typeof message !== 'string' || message.trim() === '') {
                throw new Error('Message cannot be empty');
            }
            
            // Verify user exists
            const user = db.hasUser(username);
            const messageObj = db.addMessage(user.originalName, message.trim());
            
            // Broadcast message to all users
            io.emit('newMessage', {
                id: messageObj.id,
                username: user.originalName,
                message: messageObj.message,
                timestamp: messageObj.timestamp
            });
            
        } catch (error) {
            socket.emit('error', { message: error.message });
            console.log(`❌ Message Error: ${error.message}`);
        }
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
        try {
            const { username } = data;
            const user = db.hasUser(username);
            
            // Broadcast typing indicator to other users
            socket.broadcast.emit('userTyping', {
                username: user.originalName
            });
            
            console.log(`⌨️  ${user.originalName} is typing...`);
            
        } catch (error) {
            console.log(`❌ Typing Error: ${error.message}`);
        }
    });
    
    // Handle stop typing
    socket.on('stopTyping', (data) => {
        try {
            const { username } = data;
            const user = db.hasUser(username);
            
            // Broadcast stop typing to other users
            socket.broadcast.emit('userStoppedTyping', {
                username: user.originalName
            });
            
        } catch (error) {
            console.log(`❌ Stop Typing Error: ${error.message}`);
        }
    });
    
    // Handle user leaving
    socket.on('leaveChat', (data) => {
        try {
            const { username } = data;
            db.removeuser(username);
            db.addSystemMessage(`${username} left the chat`);
            
            // Broadcast to all users
            const activeUsers = db.getActiveUsers();
            io.emit('userLeft', {
                username: username,
                users: activeUsers
            });
            
            console.log(`👥 Remaining users (${activeUsers.length}): ${activeUsers.map(u => u.username).join(', ') || 'None'}`);
            
        } catch (error) {
            console.log(`❌ Leave Error: ${error.message}`);
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
        
        if (socket.username) {
            try {
                db.removeuser(socket.username);
                db.addSystemMessage(`${socket.username} disconnected`);
                
                // Broadcast to remaining users
                const activeUsers = db.getActiveUsers();
                socket.broadcast.emit('userLeft', {
                    username: socket.username,
                    users: activeUsers
                });
                
                console.log(`👥 Remaining users (${activeUsers.length}): ${activeUsers.map(u => u.username).join(', ') || 'None'}`);
                
            } catch (error) {
                console.log(`❌ Disconnect Error: ${error.message}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ChatFlow Server running on http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://YOUR_IP:${PORT}`);
    console.log(`📱 Share the network URL with friends on same WiFi`);
    console.log(`🎯 Features: Real-time messaging, user management, typing indicators, message history`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
