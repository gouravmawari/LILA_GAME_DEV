import { useState, useEffect, useRef } from "react";
import * as nakamajs from "@heroiclabs/nakama-js";

const NAKAMA_HOST = "nakama-system.run.place";
const NAKAMA_PORT = "443";
const NAKAMA_KEY  = "defaultkey";
const USE_SSL     = true;

const OP_CODE_GAME_STATE = 1;
const OP_CODE_MOVE       = 2;

interface GameState {
  board: string[];
  currentTurn: string;
  playerX: string;
  playerO: string;
  winner: string;
  gameOver: boolean;
}

type Screen = "login" | "lobby" | "waiting" | "game";

export default function App() {
  const clientRef   = useRef<nakamajs.Client | null>(null);
  const socketRef   = useRef<nakamajs.Socket | null>(null);
  const sessionRef  = useRef<nakamajs.Session | null>(null);
  const matchIdRef  = useRef<string>("");

  const [screen,    setScreen]    = useState<Screen>("login");
  const [username,  setUsername]  = useState("");
  const [userId,    setUserId]    = useState("");
  const [roomCode,  setRoomCode]  = useState("");
  const [joinCode,  setJoinCode]  = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mySymbol,  setMySymbol]  = useState<"X" | "O" | "">("");
  const [statusMsg, setStatusMsg] = useState("");
  const [error,     setError]     = useState("");

  useEffect(() => {
    clientRef.current = new nakamajs.Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, USE_SSL);
  }, []);

  function setupSocketListeners(socket: nakamajs.Socket, currentUserId: string) {
    socket.onmatchdata = (data) => {
      if (data.op_code === OP_CODE_GAME_STATE) {
        try {
          const raw  = data.data;
          const json = typeof raw === "string"
            ? atob(raw)
            : new TextDecoder().decode(
                raw instanceof Uint8Array
                  ? raw
                  : new Uint8Array(raw as ArrayBuffer)
              );
          const gs: GameState = JSON.parse(json);
          setGameState(gs);
          setScreen("game");
        } catch(e) {
          console.error("Failed to parse game state", e);
        }
      }
    };

    socket.onmatchmakermatched = async (matched: any) => {
      try {
        const mid = matched.match_id || matched.matchId || matched.match?.match_id;
        if (!mid) {
          console.error("No matchId in matchmakermatched", matched);
          return;
        }
        matchIdRef.current = mid;
        setStatusMsg("Opponent found! Joining match...");
        await socket.joinMatch(mid);
      } catch(e: any) {
        setError("Failed to join matched game: " + (e.message ?? e));
        setScreen("lobby");
      }
    };

    socket.onmatchpresence = (presence: any) => {
      if (presence.leaves && presence.leaves.length > 0) {
        setStatusMsg("Opponent disconnected");
      }
    };
  }

  async function handleLogin() {
    setError("");
    if (!username.trim()) { setError("Enter a username"); return; }
    try {
      const client   = clientRef.current!;
      const deviceId = "device-" + username.trim().toLowerCase().replace(/\s+/g, "-");
      const session  = await client.authenticateDevice(deviceId, true, username.trim());
      sessionRef.current = session;
      setUserId(session.user_id!);

      const socket = client.createSocket(USE_SSL, false);
      socketRef.current = socket;

      setupSocketListeners(socket, session.user_id!);

      await socket.connect(session, true);
      setScreen("lobby");
    } catch (e: any) {
      setError("Login failed: " + (e.message ?? e));
    }
  }

  useEffect(() => {
    if (!gameState || !userId) return;
    if (gameState.playerX === userId) setMySymbol("X");
    else if (gameState.playerO === userId) setMySymbol("O");
  }, [gameState, userId]);

  async function handleAutoMatch() {
    setError("");
    try {
      setScreen("waiting");
      setStatusMsg("Searching for opponent...");
      await socketRef.current!.addMatchmaker("*", 2, 2, {}, {});
    } catch (e: any) {
      setError("Matchmaking failed: " + (e.message ?? e));
      setScreen("lobby");
    }
  }

  async function handleCreateRoom() {
    setError("");
    try {
      const res  = await clientRef.current!.rpc(sessionRef.current!, "create_match", {});
      const data = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload;
      const mid  = data.matchId;

      matchIdRef.current = mid;

      const code = mid.split(".")[0];
      setRoomCode(code);

      await socketRef.current!.joinMatch(mid);
      setScreen("waiting");
      setStatusMsg("Waiting for opponent to join...");
    } catch (e: any) {
      setError("Create room failed: " + (e.message ?? e));
    }
  }

  async function handleJoinRoom() {
    setError("");
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    try {
      const fullMatchId = joinCode.trim().includes(".")
        ? joinCode.trim()
        : joinCode.trim() + ".nakama1";

      const res  = await clientRef.current!.rpc(
        sessionRef.current!,
        "join_match",
        { matchId: fullMatchId }
      );
      const data = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload;
      if (!data.success) { setError("Could not join match"); return; }

      matchIdRef.current = fullMatchId;

      await socketRef.current!.joinMatch(fullMatchId);

      setScreen("waiting");
      setStatusMsg("Joined! Waiting for game to start...");
    } catch (e: any) {
      setError("Join failed: " + (e.message ?? e));
    }
  }

  async function handleCellClick(position: number) {
    if (!gameState) return;
    if (gameState.gameOver) return;
    if (gameState.currentTurn !== userId) return;
    if (gameState.board[position] !== "") return;

    const mid = matchIdRef.current;
    if (!mid) return;

    try {
      const moveData = JSON.stringify({ position });
      await socketRef.current!.sendMatchState(mid, OP_CODE_MOVE, moveData);
    } catch (e: any) {
      setError("Move failed: " + (e.message ?? e));
    }
  }

  async function handleLeave() {
    try {
      const mid = matchIdRef.current;
      if (mid && socketRef.current) {
        await socketRef.current.leaveMatch(mid);
      }
    } catch (_) {}
    matchIdRef.current = "";
    setRoomCode("");
    setJoinCode("");
    setGameState(null);
    setMySymbol("");
    setStatusMsg("");
    setError("");
    setScreen("lobby");
  }

  function getResultText() {
    if (!gameState) return "";
    if (gameState.winner === "draw") return "It's a Draw!";
    if (gameState.winner === userId) return "You Win! 🎉";
    return "You Lose!";
  }

  function isMyTurn() {
    return gameState?.currentTurn === userId && !gameState?.gameOver;
  }

  if (screen === "login") return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Tic-Tac-Toe</h1>
        <p style={s.sub}>Multiplayer · Powered by Nakama</p>
        <input
          style={s.input}
          placeholder="Enter username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          autoFocus
        />
        <button style={s.btnPrimary} onClick={handleLogin}>Play</button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  );

  if (screen === "lobby") return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Hey, {username} 👋</h2>
        <p style={s.sub}>Choose how to play</p>

        <div style={s.section}>
          <h3 style={s.sectionTitle}>⚡ Quick Match</h3>
          <p style={s.hint}>Get matched with a random player automatically</p>
          <button style={s.btnPrimary} onClick={handleAutoMatch}>Find Match</button>
        </div>

        <div style={s.divider} />

        <div style={s.section}>
          <h3 style={s.sectionTitle}>🔒 Private Room</h3>
          <p style={s.hint}>Create a room and share code with a friend</p>
          <button style={s.btnSecondary} onClick={handleCreateRoom}>Create Room</button>
        </div>

        <div style={s.divider} />

        <div style={s.section}>
          <h3 style={s.sectionTitle}>🔗 Join Room</h3>
          <p style={s.hint}>Enter a room code shared by your friend</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Paste room code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
            />
            <button style={{ ...s.btnSecondary, width: "auto", padding: "0 16px" }} onClick={handleJoinRoom}>
              Join
            </button>
          </div>
        </div>

        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  );

  if (screen === "waiting") return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>⏳ Waiting...</h2>
        <p style={s.sub}>{statusMsg}</p>

        {roomCode && (
          <div style={s.roomCodeBox}>
            <p style={s.hint}>Share this code with your friend:</p>
            <div style={s.roomCode}>{roomCode}</div>
            <button
              style={s.btnSmall}
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
              }}
            >
              Copy Code
            </button>
          </div>
        )}

        <button style={{ ...s.btnSecondary, marginTop: 20 }} onClick={handleLeave}>
          Code
        </button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  );

  if (screen === "game" && gameState) {
    const isOver = gameState.gameOver;
    return (
      <div style={s.page}>
        <div style={s.card}>

          <div style={s.gameHeader}>
            <span style={s.badge}>You are <strong>{mySymbol}</strong></span>
            <span style={isOver ? s.resultText : isMyTurn() ? s.turnActive : s.turnWait}>
              {isOver
                ? getResultText()
                : isMyTurn()
                  ? "Your turn ✅"
                  : "Opponent's turn ⏳"}
            </span>
          </div>

          <div style={s.board}>
            {gameState.board.map((cell, i) => {
              const clickable = !isOver && isMyTurn() && cell === "";
              return (
                <div
                  key={i}
                  style={{
                    ...s.cell,
                    cursor: clickable ? "pointer" : "default",
                    color: cell === "X" ? "#e74c3c" : "#3498db",
                    background: clickable ? "#f8f9fa" : "#fff",
                    transform: clickable ? "scale(1)" : "scale(1)",
                  }}
                  onClick={() => handleCellClick(i)}
                  onMouseEnter={e => {
                    if (clickable) (e.currentTarget as HTMLDivElement).style.background = "#eee";
                  }}
                  onMouseLeave={e => {
                    if (clickable) (e.currentTarget as HTMLDivElement).style.background = "#f8f9fa";
                  }}
                >
                  {cell}
                </div>
              );
            })}
          </div>

          <div style={s.players}>
            <div style={gameState.currentTurn === gameState.playerX && !isOver ? s.playerActive : s.playerInactive}>
              ✕ {gameState.playerX === userId ? "You" : "Opponent"}
            </div>
            <div style={{ color: "#bbb", fontSize: 12 }}>vs</div>
            <div style={gameState.currentTurn === gameState.playerO && !isOver ? s.playerActive : s.playerInactive}>
              ○ {gameState.playerO === userId ? "You" : "Opponent"}
            </div>
          </div>

          {isOver && (
            <button style={{ ...s.btnPrimary, marginTop: 16 }} onClick={handleLeave}>
              Back to Lobby
            </button>
          )}

          {error && <p style={s.error}>{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2f5",
    fontFamily: "'Courier New', monospace",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "36px 40px",
    width: 400,
    boxShadow: "0 2px 16px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#111",
  },
  sub: {
    margin: 0,
    fontSize: 13,
    color: "#888",
  },
  hint: {
    margin: "0 0 6px",
    fontSize: 12,
    color: "#aaa",
  },
  input: {
    padding: "10px 14px",
    border: "1.5px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Courier New', monospace",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btnPrimary: {
    padding: "11px 0",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    width: "100%",
  },
  btnSecondary: {
    padding: "11px 0",
    background: "#fff",
    color: "#111",
    border: "1.5px solid #111",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    width: "100%",
  },
  btnSmall: {
    padding: "6px 14px",
    background: "#fff",
    color: "#555",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    marginTop: 8,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#333",
  },
  divider: {
    borderTop: "1px solid #f0f0f0",
  },
  error: {
    margin: 0,
    color: "#e74c3c",
    fontSize: 12,
  },
  roomCodeBox: {
    background: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    textAlign: "center",
    border: "1px dashed #ddd",
  },
  roomCode: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#111",
    fontFamily: "'Courier New', monospace",
    marginTop: 4,
    wordBreak: "break-all",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
  },
  cell: {
    height: 96,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 40,
    fontWeight: 700,
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    userSelect: "none",
    transition: "background 0.1s",
  },
  gameHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    background: "#f0f0f0",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 13,
    color: "#333",
  },
  turnActive: {
    fontSize: 13,
    fontWeight: 700,
    color: "#27ae60",
  },
  turnWait: {
    fontSize: 13,
    color: "#e67e22",
  },
  resultText: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111",
  },
  players: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    fontSize: 13,
    marginTop: 4,
  },
  playerActive: {
    fontWeight: 700,
    color: "#111",
    padding: "4px 12px",
    background: "#f0f0f0",
    borderRadius: 6,
  },
  playerInactive: {
    color: "#bbb",
    padding: "4px 12px",
  },
};
