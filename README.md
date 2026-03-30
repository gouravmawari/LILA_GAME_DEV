# Lila Tic-Tac-Toe

A real-time multiplayer Tic-Tac-Toe game built with React frontend and Nakama backend.

## 🎮 Features

- **Real-time multiplayer** gameplay via WebSocket
- **Multiple game modes**: Quick Match, Private Rooms, Join by Code
- **Turn-based validation** and game state synchronization
- **Win/draw detection** with instant results
- **Responsive design** with modern UI
- **Player disconnection** handling

## 🏗️ Architecture

### Backend (Nakama Server)
- **Language**: TypeScript
- **Framework**: Nakama (multiplayer game server)
- **Game Logic**: Server-side validation and state management
- **Real-time**: WebSocket-based communication
- **Matchmaking**: Built-in matchmaker + custom RPC endpoints

### Frontend (React App)
- **Language**: TypeScript
- **Framework**: React 19
- **Styling**: Inline CSS with modern design
- **Real-time**: Nakama JS SDK for WebSocket connection
- **State Management**: React hooks (useState, useEffect, useRef)

### Communication Flow
```
Frontend ↔ Nakama WebSocket ↔ Game Logic (Server)
```

## 🚀 Setup and Installation

### Prerequisites
- Node.js (v16 or higher)
- Docker (optional, for containerized deployment)
- Git

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd lila-tictactoe
```

### 2. Backend Setup

#### Option A: Local Development
```bash
cd backend
npm install
```

#### Option B: Docker Deployment
```bash
cd backend
docker-compose up
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Environment Configuration

#### Backend (.env - if needed)
```
NAKAMA_HOST=localhost
NAKAMA_PORT=7350
NAKAMA_KEY=defaultkey
```

#### Frontend Configuration
The frontend is pre-configured for localhost development:
- Host: `localhost`
- Port: `7350`
- SSL: `false`

## 🎯 How to Run

### 1. Start Nakama Server
```bash
# Option A: Local
cd backend
npm run start

# Option B: Docker
cd backend
docker-compose up
```

### 2. Start Frontend
```bash
cd frontend
npm start
```

### 3. Access Game
- Frontend: http://localhost:3000
- Nakama Admin: http://localhost:7351 (admin/admin)

## 🧪 Testing Multiplayer Functionality

### 1. Single Device Testing
1. Open two browser tabs/windows
2. In Tab 1: Login and create a private room
3. Copy the room code
4. In Tab 2: Login with different username and join room
5. Test gameplay between tabs

### 2. Multiple Device Testing
1. Ensure devices are on same network
2. Find host machine's IP address
3. Update frontend config in `App.tsx`:
   ```typescript
   const NAKAMA_HOST = "YOUR_IP_ADDRESS"; // e.g., "192.168.1.100"
   ```
4. Access game from multiple devices using host IP

### 3. Quick Match Testing
1. Open two browser tabs
2. Both users select "Quick Match"
3. Verify automatic pairing
4. Test gameplay

### 4. Test Scenarios

#### Basic Gameplay
- ✅ Players can only move on their turn
- ✅ Moves are validated (empty cells only)
- ✅ Win detection works (rows, columns, diagonals)
- ✅ Draw detection works (board full)

#### Connection Handling
- ✅ Player reconnection works
- ✅ Opponent disconnect shows message
- ✅ Room creation and joining works
- ✅ Invalid room codes are rejected

#### Edge Cases
- ✅ Multiple moves in same turn rejected
- ✅ Moves after game end rejected
- ✅ Invalid positions rejected
- ✅ Empty room codes rejected

## 🎮 Game Modes

### Quick Match
- Automatic matchmaking via Nakama queue
- Pairs 2 players randomly
- Real-time connection establishment

### Private Room
- Create private match with shareable code
- Room code format: UUID prefix (e.g., "a1b2c3d4")
- Host waits for opponent to join

### Join Room
- Enter room code shared by friend
- Validate match exists and has space
- Immediate game start if valid

## 🔧 Technical Details

### Game State Structure
```typescript
interface GameState {
  board: string[];        // 9 cells: "", "X", or "O"
  currentTurn: string;    // userId of who should move next
  playerX: string;        // userId of X player
  playerO: string;        // userId of O player
  winner: string;         // userId of winner, "draw", or ""
  gameOver: boolean;
}
```

### WebSocket Communication
- **OP_CODE_GAME_STATE (1)**: Server → Client (broadcast state)
- **OP_CODE_MOVE (2)**: Client → Server (player makes move)

### RPC Endpoints
- `create_match`: Create private room
- `join_match`: Join by room code
- `find_match`: Auto-matchmaking
- `healthcheck`: Server status

### Match Handlers
- `matchInit`: Initialize new game
- `matchJoinAttempt`: Validate join requests
- `matchJoin`: Handle player joining
- `matchLoop`: Process moves and game logic
- `matchLeave`: Handle player disconnection

## 🐛 Troubleshooting

### Common Issues

#### Connection Failed
- Check Nakama server is running
- Verify host/port configuration
- Check firewall settings

#### Matchmaking Not Working
- Ensure both players are connected
- Check WebSocket connection status
- Verify Nakama console for errors

#### Room Code Invalid
- Ensure full match ID is used
- Check room hasn't expired
- Verify server logs for join attempts

### Debug Mode
Enable browser console to see:
- WebSocket connection status
- Game state updates
- Error messages
- Network requests

## 📦 Deployment

### Production Deployment
1. Update frontend configuration for production host
2. Build frontend: `npm run build`
3. Deploy Nakama server (Docker recommended)
4. Configure reverse proxy (nginx) for frontend
5. Set up SSL certificates

### Docker Deployment
```bash
# Production
docker-compose -f docker-compose.prod.yml up -d

# With SSL
docker-compose -f docker-compose.ssl.yml up -d
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check troubleshooting section
- Review Nakama documentation
- Create GitHub issue with details

---

**Built with ❤️ using React and Nakama**
