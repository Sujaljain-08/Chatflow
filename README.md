# ChatFlow

A modern, real-time chat application built with Node.js and Socket.IO, featuring a clean and responsive interface.

## Project Structure

```
chatflow/
├── src/                    # Source files
│   ├── public/            # Static files
│   │   ├── css/           # Stylesheets
│   │   ├── js/            # Client-side JavaScript
│   │   └── index.html     # Main HTML file
│   ├── server.js          # Express server setup
│   └── socket/            # Socket.IO event handlers
├── .gitignore             # Git ignore rules
└── package.json           # Project configuration
```

## Features

- Real-time messaging with Socket.IO
- User presence indicators
- Responsive design for all devices
- Message read receipts
- Typing indicators
- Emoji support
- Message history
- User authentication (optional)
- Private messaging
- File sharing
- Message search
- Message reactions
- Dark/Light theme
- Push notifications
- End-to-end encryption (planned)

## Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chatflow.git
   cd chatflow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Development

### Available Scripts

- `npm start` - Start the development server
- `npm run dev` - Start in development mode with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run build` - Build for production

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

## Testing

Run the test suite:

```bash
npm test
```

## Deployment

### Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   NODE_ENV=production node src/server.js
   ```

### Docker

Build and run with Docker:

```bash
docker build -t chatflow .
docker run -p 3000:3000 chatflow
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Security

Please report any security issues to security@example.com

## Support

For support, email support@example.com or open an issue.

---

 2025 ChatFlow. All rights reserved.
