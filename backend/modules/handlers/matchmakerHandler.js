export function matchmakerMatched(ctx, logger, nk, matches) {
    for (var i = 0; i < matches.length; i++) {
        logger.info("Matchmaker matched player: " + matches[i].presence.userId);
    }
    var matchId = nk.matchCreate("tic-tac-toe", {});
    logger.info("Matchmaker created match: " + matchId);
    return matchId;
}
