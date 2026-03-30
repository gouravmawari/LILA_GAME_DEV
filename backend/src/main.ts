
// /// <reference path="../nakama-common/index.d.ts" />

// // =====================
// // TYPES & INTERFACES
// // =====================

// interface GameState {
//   board: string[];        // 9 cells: "", "X", or "O"
//   currentTurn: string;    // userId of who should move next
//   playerX: string;        // userId of X player
//   playerO: string;        // userId of O player
//   winner: string;         // userId of winner, "draw", or ""
//   gameOver: boolean;
// }

// interface MoveMessage {
//   position: number;       // 0-8 (board index)
// }

// // Nakama op codes
// var OP_CODE_GAME_STATE = 1;   // server → clients (broadcast state)
// var OP_CODE_MOVE = 2;         // client → server (player makes a move)

// // Win conditions — all possible winning lines on a 3x3 board
// var WIN_CONDITIONS = [
//   [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
//   [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
//   [0, 4, 8], [2, 4, 6]             // diagonals
// ];

// // =====================
// // GAME LOGIC FUNCTIONS
// // =====================

// function checkWinner(board: string[]): string {
//   for (var i = 0; i < WIN_CONDITIONS.length; i++) {
//     var a = WIN_CONDITIONS[i][0];
//     var b = WIN_CONDITIONS[i][1];
//     var c = WIN_CONDITIONS[i][2];
//     if (board[a] && board[a] === board[b] && board[a] === board[c]) {
//       return board[a]; // returns "X" or "O"
//     }
//   }
//   return "";
// }

// function checkDraw(board: string[]): boolean {
//   for (var i = 0; i < board.length; i++) {
//     if (board[i] === "") return false;
//   }
//   return true;
// }

// // =====================
// // MATCH HANDLERS
// // =====================

// function matchInit(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   params: {[key: string]: string}
// ): {state: nkruntime.MatchState, tickRate: number, label: string} {

//   logger.info("Match created!");

//   var state: GameState = {
//     board: ["", "", "", "", "", "", "", "", ""],
//     currentTurn: "",
//     playerX: "",
//     playerO: "",
//     winner: "",
//     gameOver: false,
//   };

//   return { state: state, tickRate: 1, label: "tic-tac-toe" };
// }

// function matchJoinAttempt(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState,
//   presence: nkruntime.Presence,
//   metadata: {[key: string]: any}
// ): {state: nkruntime.MatchState, accept: boolean, rejectMessage?: string} {

//   var gameState = state as GameState;

//   // Reject if game already has 2 players or is over
//   if (gameState.playerX && gameState.playerO) {
//     return { state: state, accept: false, rejectMessage: "Match is full" };
//   }
//   if (gameState.gameOver) {
//     return { state: state, accept: false, rejectMessage: "Game is over" };
//   }

//   return { state: state, accept: true };
// }

// function matchJoin(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState,
//   presences: nkruntime.Presence[]
// ): {state: nkruntime.MatchState} | null {

//   var gameState = state as GameState;

//   for (var i = 0; i < presences.length; i++) {
//     var presence = presences[i];
//     if (!gameState.playerX) {
//       // First player gets X
//       gameState.playerX = presence.userId;
//       logger.info("Player X joined: " + presence.userId);
//     } else if (!gameState.playerO) {
//       // Second player gets O
//       gameState.playerO = presence.userId;
//       gameState.currentTurn = gameState.playerX; // X always goes first
//       logger.info("Player O joined: " + presence.userId);

//       // Both players joined — broadcast initial state
//       dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
//     }
//   }

//   return { state: gameState };
// }

// function matchLoop(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState,
//   messages: nkruntime.MatchMessage[]
// ): {state: nkruntime.MatchState} | null {

//   var gameState = state as GameState;

//   // Process each incoming message
//   for (var i = 0; i < messages.length; i++) {
//     var message = messages[i];

//     // Only handle move messages
//     if (message.opCode !== OP_CODE_MOVE) continue;

//     // Game already over — ignore moves
//     if (gameState.gameOver) continue;

//     // Not enough players yet
//     if (!gameState.playerX || !gameState.playerO) continue;

//     // VALIDATION 1: Is it this player's turn?
//     if (message.sender.userId !== gameState.currentTurn) {
//       logger.warn("Move rejected: not your turn. Player: " + message.sender.userId);
//       continue;
//     }

//     // Parse the move
//     var move: MoveMessage;
//     try {
//       move = JSON.parse(nk.binaryToString(message.data));
//     } catch (e) {
//       logger.warn("Move rejected: invalid JSON");
//       continue;
//     }

//     // VALIDATION 2: Is position valid (0-8)?
//     if (move.position < 0 || move.position > 8) {
//       logger.warn("Move rejected: invalid position " + move.position);
//       continue;
//     }

//     // VALIDATION 3: Is the cell empty?
//     if (gameState.board[move.position] !== "") {
//       logger.warn("Move rejected: cell already occupied at " + move.position);
//       continue;
//     }

//     // Apply the move
//     var symbol = message.sender.userId === gameState.playerX ? "X" : "O";
//     gameState.board[move.position] = symbol;
//     logger.info("Player " + symbol + " moved to position " + move.position);

//     // Check for winner
//     var winnerSymbol = checkWinner(gameState.board);
//     if (winnerSymbol) {
//       gameState.winner = winnerSymbol === "X" ? gameState.playerX : gameState.playerO;
//       gameState.gameOver = true;
//       logger.info("Game over! Winner: " + gameState.winner);
//     } else if (checkDraw(gameState.board)) {
//       gameState.winner = "draw";
//       gameState.gameOver = true;
//       logger.info("Game over! It's a draw.");
//     } else {
//       // Switch turns
//       gameState.currentTurn = gameState.currentTurn === gameState.playerX
//         ? gameState.playerO
//         : gameState.playerX;
//     }

//     // Broadcast updated state to ALL players
//     dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
//   }

//   return { state: gameState };
// }

// function matchLeave(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState,
//   presences: nkruntime.Presence[]
// ): {state: nkruntime.MatchState} | null {

//   var gameState = state as GameState;

//   for (var i = 0; i < presences.length; i++) {
//     var presence = presences[i];
//     logger.info("Player left: " + presence.userId);

//     // Mark game over if someone leaves mid-game
//     if (!gameState.gameOver) {
//       gameState.gameOver = true;
//       // The player who left loses — other player wins
//       gameState.winner = presence.userId === gameState.playerX
//         ? gameState.playerO
//         : gameState.playerX;
//       dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
//     }
//   }

//   return { state: gameState };
// }

// function matchTerminate(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState,
//   graceSeconds: number
// ): {state: nkruntime.MatchState} | null {
//   return { state: state };
// }

// function matchSignal(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   dispatcher: nkruntime.MatchDispatcher,
//   tick: number,
//   state: nkruntime.MatchState
// ): {state: nkruntime.MatchState, data?: string} | null {
//   return { state: state };
// }

// // =====================
// // RPC FUNCTIONS
// // =====================

// function createMatchRpc(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   payload: string
// ): string {
//   // Create a new match and return its ID to the client
//   var match = nk.matchCreate("tic-tac-toe", {});
//   logger.info("Match created with ID: " + match);
//   return JSON.stringify({ matchId: match });
// }

// function findMatchRpc(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   payload: string
// ): string {

//   var storageKey = "waiting_match";
//   var collection = "matchmaking";

//   // Step 1: Check if there's a waiting match in storage
//   var objects: nkruntime.StorageObject[];
//   try {
//     objects = nk.storageRead([{
//       collection: collection,
//       key: storageKey,
//       userId: "00000000-0000-0000-0000-000000000000"  // system user
//     }]);
//   } catch(e) {
//     objects = [];
//   }

//   if (objects.length > 0) {
//     // Step 2: Found a waiting match — delete it from storage and return it to Player 2
//     var waitingMatchId = objects[0].value.matchId;
//     logger.info("Player 2 found waiting match: " + waitingMatchId);

//     // Delete from storage so no 3rd player grabs it
//     nk.storageDelete([{
//       collection: collection,
//       key: storageKey,
//       userId: "00000000-0000-0000-0000-000000000000"
//     }]);

//     return JSON.stringify({ matchId: waitingMatchId, created: false });
//   }

//   // Step 3: No waiting match — create one and store it for Player 2 to find
//   var newMatchId = nk.matchCreate("tic-tac-toe", {});
//   logger.info("Player 1 created match: " + newMatchId);

//   // Save to storage so Player 2 can find it
//   nk.storageWrite([{
//     collection: collection,
//     key: storageKey,
//     userId: "00000000-0000-0000-0000-000000000000",
//     value: { matchId: newMatchId },
//     permissionRead: 2,
//     permissionWrite: 0
//   }]);

//   return JSON.stringify({ matchId: newMatchId, created: true });
// }

// function healthcheckRpc(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   payload: string
// ): string {
//   return JSON.stringify({ status: "ok", message: "Server is running!" });
// }

// // =====================
// // INIT — Register everything
// // =====================

// function InitModule(
//   ctx: nkruntime.Context,
//   logger: nkruntime.Logger,
//   nk: nkruntime.Nakama,
//   initializer: nkruntime.Initializer
// ): Error | void {
//   logger.info("=== Tic-Tac-Toe server starting ===");

//   // Register the match handler
//   initializer.registerMatch("tic-tac-toe", {
//     matchInit: matchInit,
//     matchJoinAttempt: matchJoinAttempt,
//     matchJoin: matchJoin,
//     matchLoop: matchLoop,
//     matchLeave: matchLeave,
//     matchTerminate: matchTerminate,
//     matchSignal: matchSignal
//   });

//   // Register RPC functions
//   initializer.registerRpc("create_match", createMatchRpc);
//   initializer.registerRpc("find_match", findMatchRpc);
//   initializer.registerRpc("healthcheck", healthcheckRpc);

//   logger.info("Match handler and RPCs registered!");
// }
/// <reference path="../nakama-common/index.d.ts" />

// =====================
// TYPES & INTERFACES
// =====================

interface GameState {
  board: string[];        // 9 cells: "", "X", or "O"
  currentTurn: string;    // userId of who should move next
  playerX: string;        // userId of X player
  playerO: string;        // userId of O player
  winner: string;         // userId of winner, "draw", or ""
  gameOver: boolean;
}

interface MoveMessage {
  position: number;       // 0-8 (board index)
}

// Nakama op codes
var OP_CODE_GAME_STATE = 1;   // server → clients (broadcast state)
var OP_CODE_MOVE = 2;         // client → server (player makes a move)

// Win conditions — all possible winning lines on a 3x3 board
var WIN_CONDITIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

// =====================
// GAME LOGIC FUNCTIONS
// =====================

function checkWinner(board: string[]): string {
  for (var i = 0; i < WIN_CONDITIONS.length; i++) {
    var a = WIN_CONDITIONS[i][0];
    var b = WIN_CONDITIONS[i][1];
    var c = WIN_CONDITIONS[i][2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // returns "X" or "O"
    }
  }
  return "";
}

function checkDraw(board: string[]): boolean {
  for (var i = 0; i < board.length; i++) {
    if (board[i] === "") return false;
  }
  return true;
}

// =====================
// MATCH HANDLERS
// =====================

function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: {[key: string]: string}
): {state: nkruntime.MatchState, tickRate: number, label: string} {

  logger.info("Match created!");

  var state: GameState = {
    board: ["", "", "", "", "", "", "", "", ""],
    currentTurn: "",
    playerX: "",
    playerO: "",
    winner: "",
    gameOver: false,
  };

  return { state: state, tickRate: 1, label: "tic-tac-toe" };
}

function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: {[key: string]: any}
): {state: nkruntime.MatchState, accept: boolean, rejectMessage?: string} {

  var gameState = state as GameState;

  // Reject if game already has 2 players or is over
  if (gameState.playerX && gameState.playerO) {
    return { state: state, accept: false, rejectMessage: "Match is full" };
  }
  if (gameState.gameOver) {
    return { state: state, accept: false, rejectMessage: "Game is over" };
  }

  return { state: state, accept: true };
}

function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): {state: nkruntime.MatchState} | null {

  var gameState = state as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    if (!gameState.playerX) {
      // First player gets X
      gameState.playerX = presence.userId;
      logger.info("Player X joined: " + presence.userId);
    } else if (!gameState.playerO) {
      // Second player gets O
      gameState.playerO = presence.userId;
      gameState.currentTurn = gameState.playerX; // X always goes first
      logger.info("Player O joined: " + presence.userId);

      // Both players joined — broadcast initial state
      dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
    }
  }

  return { state: gameState };
}

function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): {state: nkruntime.MatchState} | null {

  var gameState = state as GameState;

  // Process each incoming message
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];

    // Only handle move messages
    if (message.opCode !== OP_CODE_MOVE) continue;

    // Game already over — ignore moves
    if (gameState.gameOver) continue;

    // Not enough players yet
    if (!gameState.playerX || !gameState.playerO) continue;

    // VALIDATION 1: Is it this player's turn?
    if (message.sender.userId !== gameState.currentTurn) {
      logger.warn("Move rejected: not your turn. Player: " + message.sender.userId);
      continue;
    }

    // Parse the move
    var move: MoveMessage;
    try {
      move = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      logger.warn("Move rejected: invalid JSON");
      continue;
    }

    // VALIDATION 2: Is position valid (0-8)?
    if (move.position < 0 || move.position > 8) {
      logger.warn("Move rejected: invalid position " + move.position);
      continue;
    }

    // VALIDATION 3: Is the cell empty?
    if (gameState.board[move.position] !== "") {
      logger.warn("Move rejected: cell already occupied at " + move.position);
      continue;
    }

    // Apply the move
    var symbol = message.sender.userId === gameState.playerX ? "X" : "O";
    gameState.board[move.position] = symbol;
    logger.info("Player " + symbol + " moved to position " + move.position);

    // Check for winner
    var winnerSymbol = checkWinner(gameState.board);
    if (winnerSymbol) {
      gameState.winner = winnerSymbol === "X" ? gameState.playerX : gameState.playerO;
      gameState.gameOver = true;
      logger.info("Game over! Winner: " + gameState.winner);
    } else if (checkDraw(gameState.board)) {
      gameState.winner = "draw";
      gameState.gameOver = true;
      logger.info("Game over! It's a draw.");
    } else {
      // Switch turns
      gameState.currentTurn = gameState.currentTurn === gameState.playerX
        ? gameState.playerO
        : gameState.playerX;
    }

    // Broadcast updated state to ALL players
    dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
  }

  return { state: gameState };
}

function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): {state: nkruntime.MatchState} | null {

  var gameState = state as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    logger.info("Player left: " + presence.userId);

    // Mark game over if someone leaves mid-game
    if (!gameState.gameOver) {
      gameState.gameOver = true;
      // The player who left loses — other player wins
      gameState.winner = presence.userId === gameState.playerX
        ? gameState.playerO
        : gameState.playerX;
      dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
    }
  }

  return { state: gameState };
}

function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): {state: nkruntime.MatchState} | null {
  return { state: state };
}

function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState
): {state: nkruntime.MatchState, data?: string} | null {
  return { state: state };
}

// =====================
// RPC FUNCTIONS
// =====================

// Create a brand new private room — Player shares the matchId with a friend
function createMatchRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var match = nk.matchCreate("tic-tac-toe", {});
  logger.info("Match created with ID: " + match);
  return JSON.stringify({ matchId: match });
}

// Join a specific match by matchId (room code) — used by Player 2 when friend shares code
function joinMatchRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var data: {matchId: string};
  try {
    data = JSON.parse(payload);
  } catch(e) {
    throw new Error("Invalid payload — expected { matchId: string }");
  }

  if (!data.matchId) {
    throw new Error("matchId is required");
  }

  // Check match exists and has space (0 or 1 current players)
  var matches = nk.matchList(100, true, "tic-tac-toe", 0, 1, "");
  var found = false;
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].matchId === data.matchId) {
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error("Match not found or already full");
  }

  logger.info("Player joining match by room code: " + data.matchId);
  return JSON.stringify({ matchId: data.matchId, success: true });
}

// Auto matchmaking via storage — finds an open match or creates one
// Used as a fallback. Prefer socket.addMatchmaker() for real-time pairing.
function findMatchRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {

  var storageKey = "waiting_match";
  var collection = "matchmaking";

  // Step 1: Check if there's a waiting match in storage
  var objects: nkruntime.StorageObject[];
  try {
    objects = nk.storageRead([{
      collection: collection,
      key: storageKey,
      userId: "00000000-0000-0000-0000-000000000000"
    }]);
  } catch(e) {
    objects = [];
  }

  if (objects.length > 0) {
    // Found a waiting match — delete it and return to Player 2
    var waitingMatchId = objects[0].value.matchId;
    logger.info("Player 2 found waiting match: " + waitingMatchId);

    nk.storageDelete([{
      collection: collection,
      key: storageKey,
      userId: "00000000-0000-0000-0000-000000000000"
    }]);

    return JSON.stringify({ matchId: waitingMatchId, created: false });
  }

  // No waiting match — create one and store it for Player 2
  var newMatchId = nk.matchCreate("tic-tac-toe", {});
  logger.info("Player 1 created match: " + newMatchId);

  nk.storageWrite([{
    collection: collection,
    key: storageKey,
    userId: "00000000-0000-0000-0000-000000000000",
    value: { matchId: newMatchId },
    permissionRead: 2,
    permissionWrite: 0
  }]);

  return JSON.stringify({ matchId: newMatchId, created: true });
}

function healthcheckRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  return JSON.stringify({ status: "ok", message: "Server is running!" });
}

// =====================
// MATCHMAKER HANDLER
// Nakama calls this automatically when 2 players are found in the queue
// Triggered when clients call: socket.addMatchmaker("*", 2, 2, {}, {})
// =====================

function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {

  for (var i = 0; i < matches.length; i++) {
    logger.info("Matchmaker matched player: " + matches[i].presence.userId);
  }

  // Create match — Nakama sends this matchId to both players automatically
  var matchId = nk.matchCreate("tic-tac-toe", {});
  logger.info("Matchmaker created match: " + matchId);
  return matchId;
}

// =====================
// INIT — Register everything
// =====================

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): Error | void {
  logger.info("=== Tic-Tac-Toe server starting ===");

  // Register match handler (handles all game logic server-side)
  initializer.registerMatch("tic-tac-toe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });

  // RPC endpoints callable from the client
  initializer.registerRpc("create_match", createMatchRpc);  // create private room
  initializer.registerRpc("join_match", joinMatchRpc);       // join by room code
  initializer.registerRpc("find_match", findMatchRpc);       // auto find open match
  initializer.registerRpc("healthcheck", healthcheckRpc);    // health check

  // Built-in matchmaker — pairs players automatically via WebSocket queue
  initializer.registerMatchmakerMatched(matchmakerMatched);

  logger.info("Match handler and RPCs registered!");
}