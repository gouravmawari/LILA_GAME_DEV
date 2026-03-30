"use strict";
/// <reference path="../nakama-common/index.d.ts" />
var OP_CODE_GAME_STATE = 1;
var OP_CODE_MOVE = 2;
var WIN_CONDITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];
function checkWinner(board) {
    for (var i = 0; i < WIN_CONDITIONS.length; i++) {
        var a = WIN_CONDITIONS[i][0];
        var b = WIN_CONDITIONS[i][1];
        var c = WIN_CONDITIONS[i][2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
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
function matchInit(ctx, logger, nk, params) {
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
            gameState.playerX = presence.userId;
            logger.info("Player X joined: " + presence.userId);
        }
        else if (!gameState.playerO) {
            gameState.playerO = presence.userId;
            gameState.currentTurn = gameState.playerX;
            logger.info("Player O joined: " + presence.userId);
            dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
        }
    }
    return { state: gameState };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    var gameState = state;
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        if (message.opCode !== OP_CODE_MOVE)
            continue;
        if (gameState.gameOver)
            continue;
        if (!gameState.playerX || !gameState.playerO)
            continue;
        if (message.sender.userId !== gameState.currentTurn) {
            logger.warn("Move rejected: not your turn. Player: " + message.sender.userId);
            continue;
        }
        var move;
        try {
            move = JSON.parse(nk.binaryToString(message.data));
        }
        catch (e) {
            logger.warn("Move rejected: invalid JSON");
            continue;
        }
        if (move.position < 0 || move.position > 8) {
            logger.warn("Move rejected: invalid position " + move.position);
            continue;
        }
        if (gameState.board[move.position] !== "") {
            logger.warn("Move rejected: cell already occupied at " + move.position);
            continue;
        }
        var symbol = message.sender.userId === gameState.playerX ? "X" : "O";
        gameState.board[move.position] = symbol;
        logger.info("Player " + symbol + " moved to position " + move.position);
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
            gameState.currentTurn = gameState.currentTurn === gameState.playerX
                ? gameState.playerO
                : gameState.playerX;
        }
        dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify(gameState), null, null, true);
    }
    return { state: gameState };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = state;
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        logger.info("Player left: " + presence.userId);
        if (!gameState.gameOver) {
            gameState.gameOver = true;
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
function createMatchRpc(ctx, logger, nk, payload) {
    var match = nk.matchCreate("tic-tac-toe", {});
    logger.info("Match created with ID: " + match);
    return JSON.stringify({ matchId: match });
}
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
function findMatchRpc(ctx, logger, nk, payload) {
    var storageKey = "waiting_match";
    var collection = "matchmaking";
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
        var waitingMatchId = objects[0].value.matchId;
        logger.info("Player 2 found waiting match: " + waitingMatchId);
        nk.storageDelete([{
                collection: collection,
                key: storageKey,
                userId: "00000000-0000-0000-0000-000000000000"
            }]);
        return JSON.stringify({ matchId: waitingMatchId, created: false });
    }
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
function matchmakerMatched(ctx, logger, nk, matches) {
    for (var i = 0; i < matches.length; i++) {
        logger.info("Matchmaker matched player: " + matches[i].presence.userId);
    }
    var matchId = nk.matchCreate("tic-tac-toe", {});
    logger.info("Matchmaker created match: " + matchId);
    return matchId;
}
function InitModule(ctx, logger, nk, initializer) {
    logger.info("=== Tic-Tac-Toe server starting ===");
    initializer.registerMatch("tic-tac-toe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLoop: matchLoop,
        matchLeave: matchLeave,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("create_match", createMatchRpc);
    initializer.registerRpc("join_match", joinMatchRpc);
    initializer.registerRpc("find_match", findMatchRpc);
    initializer.registerRpc("healthcheck", healthcheckRpc);
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info("Match handler and RPCs registered!");
}
