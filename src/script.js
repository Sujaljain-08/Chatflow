class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isTyping = false;
        this.typingTimeout = null;
        this.soundEnabled = true;
        this.typingIndicatorEnabled = true;
        this.darkModeEnabled = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
    }

    initializeElements() {
        // Screens
        this.loginScreen = document.getElementById('loginScreen');
        this.chatInterface = document.getElementById('chatInterface');
        
        // Login elements
        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('usernameInput');
        
        // Chat elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.leaveBtn = document.getElementById('leaveBtn');
        
        // User interface
        this.currentUsernameSpan = document.getElementById('currentUsername');
        this.usersList = document.getElementById('usersList');
        this.userCount = document.getElementById('userCount');
        
        // Status and indicators
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.connectionText = document.getElementById('connectionText');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.typingText = document.getElementById('typingText');
        
        // Settings
        this.soundToggle = document.getElementById('soundToggle');
        this.typingToggle = document.getElementById('typingToggle');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Login form
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinChat();
        });

        // Message form
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Message input typing
        this.messageInput.addEventListener('input', () => {
            this.handleTyping();
        });

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Leave chat
        this.leaveBtn.addEventListener('click', () => {
            this.leaveChat();
        });

        // Settings
        this.soundToggle.addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        this.typingToggle.addEventListener('change', (e) => {
            this.typingIndicatorEnabled = e.target.checked;
            this.saveSettings();
        });

        this.darkModeToggle.addEventListener('change', (e) => {
            this.darkModeEnabled = e.target.checked;
            this.toggleDarkMode();
            this.saveSettings();
        });

        // Emoji button (placeholder)
        document.getElementById('emojiBtn').addEventListener('click', () => {
            this.insertEmoji('😊');
        });
    }

    joinChat() {
        const username = this.usernameInput.value.trim();
        
        if (!username) {
            this.showToast('Please enter a username', 'error');
            return;
        }

        if (username.length < 2) {
            this.showToast('Username must be at least 2 characters', 'error');
            return;
        }

        if (username.length > 20) {
            this.showToast('Username must be less than 20 characters', 'error');
            return;
        }

        this.currentUser = username;
        this.currentUsernameSpan.textContent = username;
        
        this.connectToServer();
        this.showChatInterface();
    }

    connectToServer() {
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.updateConnectionStatus('connected', 'Connected');
                this.socket.emit('join', this.currentUser);
                this.showToast(`Welcome to ChatFlow, ${this.currentUser}!`, 'success');
            });

            this.socket.on('disconnect', () => {
                this.updateConnectionStatus('disconnected', 'Disconnected');
                this.showToast('Connection lost. Trying to reconnect...', 'warning');
            });

            this.socket.on('userJoined', (data) => {
                this.addSystemMessage(`${data.username} joined the chat`);
                this.updateUsersList(data.users);
                this.playNotificationSound();
            });

            this.socket.on('userLeft', (data) => {
                this.addSystemMessage(`${data.username} left the chat`);
                this.updateUsersList(data.users);
                this.playNotificationSound();
            });

            this.socket.on('newMessage', (data) => {
                this.addMessage(data);
                this.playNotificationSound();
            });

            this.socket.on('usersList', (users) => {
                this.updateUsersList(users);
            });

            this.socket.on('userTyping', (data) => {
                if (data.username !== this.currentUser && this.typingIndicatorEnabled) {
                    this.showTypingIndicator(data.username);
                }
            });

            this.socket.on('userStoppedTyping', (data) => {
                if (data.username !== this.currentUser) {
                    this.hideTypingIndicator();
                }
            });

            this.socket.on('messageHistory', (messages) => {
                this.loadMessageHistory(messages);
            });

            this.socket.on('error', (error) => {
                this.showToast(error.message, 'error');
            });

        } catch (error) {
            this.updateConnectionStatus('disconnected', 'Connection failed');
            this.showToast('Failed to connect to server', 'error');
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) {
            return;
        }

        if (!this.socket || !this.socket.connected) {
            this.showToast('Not connected to server', 'error');
            return;
        }

        this.socket.emit('newMessage', {
            username: this.currentUser,
            message: message
        });

        this.messageInput.value = '';
        this.sendBtn.disabled = false;
        
        // Stop typing indicator
        if (this.isTyping) {
            this.socket.emit('stopTyping', { username: this.currentUser });
            this.isTyping = false;
        }
    }

    handleTyping() {
        if (!this.socket || !this.socket.connected || !this.typingIndicatorEnabled) {
            return;
        }

        if (!this.isTyping) {
            this.socket.emit('typing', { username: this.currentUser });
            this.isTyping = true;
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.socket.emit('stopTyping', { username: this.currentUser });
                this.isTyping = false;
            }
        }, 2000);
    }

    addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.username === this.currentUser ? 'own' : ''}`;
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-author">${data.username}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Remove welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        
        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    loadMessageHistory(messages) {
        // Clear welcome message
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        messages.forEach(msg => {
            if (msg.type === 'message') {
                this.addMessage(msg);
            } else if (msg.type === 'system') {
                this.addSystemMessage(msg.message);
            }
        });
    }

    updateUsersList(users) {
        this.usersList.innerHTML = '';
        this.userCount.textContent = users.length;

        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = `user-item ${user.username === this.currentUser ? 'current-user' : ''}`;
            
            const joinTime = new Date(user.joinedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            userDiv.innerHTML = `
                <div class="user-avatar">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                    <div class="user-name">${this.escapeHtml(user.username)}</div>
                    <div class="user-status">Joined ${joinTime}</div>
                </div>
            `;

            this.usersList.appendChild(userDiv);
        });
    }

    showTypingIndicator(username) {
        this.typingText.textContent = `${username} is typing...`;
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }

    updateConnectionStatus(status, text) {
        this.connectionIndicator.className = `status-indicator ${status}`;
        this.connectionText.textContent = text;
    }

    showChatInterface() {
        this.loginScreen.classList.add('hidden');
        this.chatInterface.classList.remove('hidden');
    }

    leaveChat() {
        if (this.socket) {
            this.socket.emit('leaveChat', { username: this.currentUser });
            this.socket.disconnect();
        }
        
        this.chatInterface.classList.add('hidden');
        this.loginScreen.classList.remove('hidden');
        
        // Reset form
        this.usernameInput.value = '';
        this.messageInput.value = '';
        this.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-rocket"></i>
                <h3>Welcome to ChatFlow!</h3>
                <p>Start chatting with friends in real-time</p>
            </div>
        `;
        
        this.showToast('You left the chat', 'success');
    }

    insertEmoji(emoji) {
        const cursorPos = this.messageInput.selectionStart;
        const textBefore = this.messageInput.value.substring(0, cursorPos);
        const textAfter = this.messageInput.value.substring(cursorPos);
        
        this.messageInput.value = textBefore + emoji + textAfter;
        this.messageInput.focus();
        this.messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }

    playNotificationSound() {
        if (this.soundEnabled) {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                    type === 'error' ? 'fas fa-exclamation-circle' : 
                    'fas fa-info-circle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 10);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleDarkMode() {
        if (this.darkModeEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    loadSettings() {
        const settings = localStorage.getItem('chatflow-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.soundEnabled = parsed.soundEnabled !== false;
            this.typingIndicatorEnabled = parsed.typingIndicatorEnabled !== false;
            this.darkModeEnabled = parsed.darkModeEnabled === true;
            
            this.soundToggle.checked = this.soundEnabled;
            this.typingToggle.checked = this.typingIndicatorEnabled;
            this.darkModeToggle.checked = this.darkModeEnabled;
            
            // Apply dark mode on load
            this.toggleDarkMode();
        }
    }

    saveSettings() {
        const settings = {
            soundEnabled: this.soundEnabled,
            typingIndicatorEnabled: this.typingIndicatorEnabled,
            darkModeEnabled: this.darkModeEnabled
        };
        localStorage.setItem('chatflow-settings', JSON.stringify(settings));
    }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
