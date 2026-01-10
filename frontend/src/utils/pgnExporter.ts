/**
 * Utility to export chess games in PGN format
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
}

/**
 * Generate PGN format string from game data
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

  // Validate and clean moves
  const cleanMoves = (moveStr: string): string[] => {
    if (!moveStr || !moveStr.trim()) return [];
    
    // Remove any brackets and their contents (annotations, headers, etc)
    let cleaned = moveStr.replace(/\s*\[[^\]]*\]\s*/g, " ");
    
    // Remove result markers from middle of moves (1-0, 0-1, 1/2-1/2, *)
    cleaned = cleaned.replace(/\s+(1-0|0-1|1\/2-1\/2|\*)\s+/g, " ");
    
    // Split by whitespace and filter
    const moves = cleaned
      .trim()
      .split(/\s+/)
      .filter(m => {
        // Keep valid chess moves (contain letters/numbers for pieces/files)
        // Filter out brackets, headers, and non-move text
        if (!m) return false;
        // Valid move patterns: e4, Nf3, O-O, dxe5, e8=Q+, Qd5+, etc
        return /^[a-hNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?[\+#]?$/.test(m);
      });
    
    return moves;
  };

  const pgnLines = [
    `[Event "${data.event || "Chess Game"}"]`,
    `[Site "${data.site || "Chess4Everyone"}"]`,
    `[Date "${formatDate(data.date)}"]`,
    `[Round "${data.round || "?"}"]`,
    `[White "${data.white}"]`,
    `[Black "${data.black}"]`,
    `[Result "${formatResult(data.result)}"]`,
    `[TimeControl "${data.timeControl || "?"}"]`,
    `[Termination "${data.termination || "Normal"}"]`,
  ];

  if (data.eco) {
    pgnLines.push(`[ECO "${data.eco}"]`);
  }

  if (data.opening) {
    pgnLines.push(`[Opening "${data.opening}"]`);
  }

  // Add blank line before moves
  pgnLines.push("");
  
  // Format moves in standard PGN format
  const moves = cleanMoves(data.moves);
  let moveNumber = 1;
  let currentLine = "";
  let moveIndex = 0;

  while (moveIndex < moves.length) {
    const whiteMove = moves[moveIndex];
    const blackMove = moves[moveIndex + 1];

    if (!whiteMove) break;

    // Format: 1. e4 e5 2. Nf3 Nc6 (etc)
    currentLine += `${moveNumber}. ${whiteMove} `;

    if (blackMove && !blackMove.match(/^(1-0|0-1|1\/2-1\/2|\*)$/)) {
      currentLine += `${blackMove} `;
      moveIndex += 2;
    } else {
      moveIndex += 1;
    }

    moveNumber++;

    // Add line break every 12 half-moves (6 full moves) for readability
    if (moveNumber % 6 === 1 && currentLine.length > 60) {
      pgnLines.push(currentLine.trim());
      currentLine = "";
    }
  }

  // Add remaining moves
  if (currentLine.trim()) {
    pgnLines.push(currentLine.trim());
  }

  // Add result at the end (on a new line, as per PGN standard)
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
