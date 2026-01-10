/**
 * Utility to export chess games in PGN format
 * Compatible with Lichess, Chess.com, and standard PGN readers
 */

interface PGNExportData {
  event?: string;
  site?: string;
  date: string;
  round?: string;
  white: string;
  black: string;
  result: string;
  timeControl?: string;
  termination?: string;
  eco?: string;
  opening?: string;
  moves: string;
  whiteRating?: number;
  blackRating?: number;
  gameType?: string;
}

/**
 * Generate PGN format string from game data
 * Fully compliant with PGN standard for universal compatibility
 */
export const generatePGN = (data: PGNExportData): string => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const formatResult = (result: string): string => {
    switch (result.toUpperCase()) {
      case "WIN":
        return "1-0";
      case "LOSS":
        return "0-1";
      case "DRAW":
        return "1/2-1/2";
      default:
        return "*";
    }
  };

  // Extract moves from either PGN string or move list
  const extractMoves = (moveStr: string): string[] => {
    if (!moveStr || !moveStr.trim()) return [];
    
    // Remove PGN headers [...]
    let cleaned = moveStr.replace(/\s*\[[^\]]*\]\s*/g, " ");
    
    // Remove comments {...}
    cleaned = cleaned.replace(/\s*\{[^}]*\}\s*/g, " ");
    
    // Remove variations and parentheses
    cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, " ");
    
    // Split by whitespace
    const tokens = cleaned.trim().split(/\s+/);
    
    const moves: string[] = [];
    for (const token of tokens) {
      // Skip empty tokens
      if (!token) continue;
      
      // Skip move numbers (1., 2., etc)
      if (/^\d+[.]{1,3}$/.test(token)) continue;
      
      // Skip result markers if found in middle
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
      
      // Valid move patterns in algebraic notation
      // Examples: e4, Nf3, O-O, dxe5, e8=Q+, Qd5#, Nxc6+, etc
      if (/^[a-hNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?[\+#!?]*$/.test(token)) {
        moves.push(token);
      }
    }
    
    return moves;
  };

  const pgnLines: string[] = [];

  // Add mandatory PGN headers
  pgnLines.push(`[Event "${data.event || "Chess Game"}"]`);
  pgnLines.push(`[Site "${data.site || "Chess4Everyone"}"]`);
  pgnLines.push(`[Date "${formatDate(data.date)}"]`);
  pgnLines.push(`[Round "${data.round || "?"}"]`);
  pgnLines.push(`[White "${data.white}"]`);
  pgnLines.push(`[Black "${data.black}"]`);
  pgnLines.push(`[Result "${formatResult(data.result)}"]`);
  
  // Add optional headers
  if (data.whiteRating) {
    pgnLines.push(`[WhiteElo "${data.whiteRating}"]`);
  }
  
  if (data.blackRating) {
    pgnLines.push(`[BlackElo "${data.blackRating}"]`);
  }
  
  pgnLines.push(`[TimeControl "${data.timeControl || "?"}"]`);
  
  if (data.eco) {
    pgnLines.push(`[ECO "${data.eco}"]`);
  }
  
  if (data.opening) {
    pgnLines.push(`[Opening "${data.opening}"]`);
  }
  
  pgnLines.push(`[Termination "${data.termination || "Normal"}"]`);
  
  if (data.gameType) {
    pgnLines.push(`[GameType "${data.gameType}"]`);
  }
  
  // Blank line before moves (required by PGN standard)
  pgnLines.push("");
  
  // Extract and format moves
  const moves = extractMoves(data.moves);
  
  if (moves.length === 0) {
    // No moves, just add result
    pgnLines.push(formatResult(data.result));
    return pgnLines.join("\n");
  }
  
  // Format moves in standard PGN format with line breaks every 12 half-moves (6 full moves)
  let currentLine = "";
  
  for (let i = 0; i < moves.length; i++) {
    const moveNumber = Math.floor(i / 2) + 1;
    const isWhiteMove = i % 2 === 0;
    
    // Add move number before white's move
    if (isWhiteMove) {
      currentLine += `${moveNumber}. `;
    }
    
    // Add the move
    currentLine += `${moves[i]} `;
    
    // Add line break every 6 full moves (after black's move) for readability
    // PGN files typically have 80-character line limit
    if (!isWhiteMove && currentLine.length > 60) {
      pgnLines.push(currentLine.trim());
      currentLine = "";
    }
  }
  
  // Add any remaining moves
  if (currentLine.trim()) {
    pgnLines.push(currentLine.trim());
  }
  
  // Add result marker at the end (PGN standard requires this)
  pgnLines.push(formatResult(data.result));
  
  return pgnLines.join("\n");
};

/**
 * Download PGN as a file
 */
export const downloadPGN = (pgnContent: string, filename: string = "game.pgn") => {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(pgnContent)
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/**
 * Export game to PGN and trigger download
 */
export const exportGamePGN = (
  gameId: string,
  whitePlayer: string,
  blackPlayer: string,
  result: string,
  playedAt: string,
  moves: string,
  timeControl?: string,
  termination?: string,
  opening?: string
) => {
  const pgnData: PGNExportData = {
    event: "Chess4Everyone Online Game",
    date: playedAt,
    white: whitePlayer,
    black: blackPlayer,
    result: result,
    moves: moves,
    timeControl: timeControl,
    termination: termination,
    opening: opening,
  };

  const pgnContent = generatePGN(pgnData);
  const timestamp = new Date(playedAt).toISOString().split("T")[0];
  const filename = `chess_${whitePlayer}_vs_${blackPlayer}_${timestamp}_${gameId}.pgn`;

  downloadPGN(pgnContent, filename);
};
