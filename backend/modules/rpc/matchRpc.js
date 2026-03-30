export function createMatchRpc(ctx, logger, nk, payload) {
    var match = nk.matchCreate("tic-tac-toe", {});
    logger.info("Match created with ID: " + match);
    return JSON.stringify({ matchId: match });
}
export function joinMatchRpc(ctx, logger, nk, payload) {
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
export function findMatchRpc(ctx, logger, nk, payload) {
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
export function healthcheckRpc(ctx, logger, nk, payload) {
    return JSON.stringify({ status: "ok", message: "Server is running!" });
}
