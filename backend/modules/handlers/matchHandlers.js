import { OP_CODE_GAME_STATE, OP_CODE_MOVE } from "../constants/game";
import { checkWinner, checkDraw } from "../utils/gameLogic";
export function matchInit(ctx, logger, nk, params) {
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
export function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var gameState = state;
    if (gameState.playerX && gameState.playerO) {
        return { state: state, accept: false, rejectMessage: "Match is full" };
    }
    if (gameState.gameOver) {
        return { state: state, accept: false, rejectMessage: "Game is over" };
    }
    return { state: state, accept: true };
}
export function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
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
export function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
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
export function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
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
export function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
}
export function matchSignal(ctx, logger, nk, dispatcher, tick, state) {
    return { state: state };
}
