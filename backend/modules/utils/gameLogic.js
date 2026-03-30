import { WIN_CONDITIONS } from "../constants/game";
export function checkWinner(board) {
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
export function checkDraw(board) {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === "")
            return false;
    }
    return true;
}
