"use strict";
// /// <reference path="../nakama-common/index.d.ts" />
/// <reference path="../nakama-common/index.d.ts" />
// Nakama op codes
var OP_CODE_GAME_STATE = 1; // server → clients (broadcast state)
var OP_CODE_MOVE = 2; // client → server (player makes a move)
// Win conditions — all possible winning lines on a 3x3 board
var WIN_CONDITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
];
// =====================
// GAME LOGIC FUNCTIONS
// =====================
function checkWinner(board) {
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
function checkDraw(board) {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === "")
            return false;
    }
    return true;
}
// =====================
// MATCH HANDLERS
// =====================
function matchInit(ctx, logger, nk, params) {
    logger.info("Match created!");
    var state = {
        board: ["", "", "", "", "", "", "", "", ""],
        currentTurn: "",
        playerX: "",
        playerO: "",
        winner: "",
        gameOver: false,
    };
    return { state: state, tickRate: 1, label: "tic-tac-toe" };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var gameState = state;
    // Reject if game already has 2 players or is over
    if (gameState.playerX && gameState.playerO) {
        return { state: state, accept: false, rejectMessage: "Match is full" };
    }
    if (gameState.gameOver) {
        return { state: state, accept: false, rejectMessage: "Game is over" };
    }
    return { state: state, accept: true };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = state;
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        if (!gameState.playerX) {
            // First player gets X
            gameState.playerX = presence.userId;
            logger.info("Player X joined: " + presence.userId);
        }
        else if (!gameState.playerO) {
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
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    var gameState = state;
    // Process each incoming message
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        // Only handle move messages
        if (message.opCode !== OP_CODE_MOVE)
            continue;
        // Game already over — ignore moves
        if (gameState.gameOver)
            continue;
        // Not enough players yet
        if (!gameState.playerX || !gameState.playerO)
            continue;
        // VALIDATION 1: Is it this player's turn?
        if (message.sender.userId !== gameState.currentTurn) {
            logger.warn("Move rejected: not your turn. Player: " + message.sender.userId);
            continue;
        }
        // Parse the move
        var move;
        try {
            move = JSON.parse(nk.binaryToString(message.data));
        }
        catch (e) {
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
        }
        else if (checkDraw(gameState.board)) {
            gameState.winner = "draw";
            gameState.gameOver = true;
            logger.info("Game over! It's a draw.");
        }
        else {
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
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = state;
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
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state) {
    return { state: state };
}
// =====================
// RPC FUNCTIONS
// =====================
// Create a brand new private room — Player shares the matchId with a friend
function createMatchRpc(ctx, logger, nk, payload) {
    var match = nk.matchCreate("tic-tac-toe", {});
    logger.info("Match created with ID: " + match);
    return JSON.stringify({ matchId: match });
}
// Join a specific match by matchId (room code) — used by Player 2 when friend shares code
function joinMatchRpc(ctx, logger, nk, payload) {
    var data;
    try {
        data = JSON.parse(payload);
    }
    catch (e) {
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
function findMatchRpc(ctx, logger, nk, payload) {
    var storageKey = "waiting_match";
    var collection = "matchmaking";
    // Step 1: Check if there's a waiting match in storage
    var objects;
    try {
        objects = nk.storageRead([{
                collection: collection,
                key: storageKey,
                userId: "00000000-0000-0000-0000-000000000000"
            }]);
    }
    catch (e) {
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
function healthcheckRpc(ctx, logger, nk, payload) {
    return JSON.stringify({ status: "ok", message: "Server is running!" });
}
// =====================
// MATCHMAKER HANDLER
// Nakama calls this automatically when 2 players are found in the queue
// Triggered when clients call: socket.addMatchmaker("*", 2, 2, {}, {})
// =====================
function matchmakerMatched(ctx, logger, nk, matches) {
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
function InitModule(ctx, logger, nk, initializer) {
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
    initializer.registerRpc("create_match", createMatchRpc); // create private room
    initializer.registerRpc("join_match", joinMatchRpc); // join by room code
    initializer.registerRpc("find_match", findMatchRpc); // auto find open match
    initializer.registerRpc("healthcheck", healthcheckRpc); // health check
    // Built-in matchmaker — pairs players automatically via WebSocket queue
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info("Match handler and RPCs registered!");
}
