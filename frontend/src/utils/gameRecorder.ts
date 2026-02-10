import { Chess } from "chess.js";

export interface MoveRecord {
  moveNumber: number;
  san: string;
  fen: string;
  timestamp: number;
  whiteTimeMs: number;
  blackTimeMs: number;
}

export class GameRecorder {
  private game: Chess;
  private moves: MoveRecord[] = [];
  private startTime: number = Date.now();
  private whiteTimeMs: number = 0;
  private blackTimeMs: number = 0;

  constructor(timeControl: string) {
    this.game = new Chess();
    const [mainTime, increment] = this.parseTimeControl(timeControl);
    this.whiteTimeMs = mainTime * 60 * 1000; // Convert to milliseconds
    this.blackTimeMs = mainTime * 60 * 1000;
  }

  /**
   * Parse time control string (e.g., "3+0", "10+5")
   */
  private parseTimeControl(timeControl: string): [number, number] {
    const parts = timeControl.split("+");
    const mainTime = parseInt(parts[0], 10) || 0;
    const increment = parseInt(parts[1], 10) || 0;
    return [mainTime, increment];
  }

  /**
   * Record a move with validation
   */
  recordMove(moveInput: string | { from: string; to: string; promotion?: string }): boolean {
    try {
      const move = this.game.move(moveInput);
      if (!move) {
        console.error("❌ Invalid move rejected:", moveInput);
        return false;
      }

      const record: MoveRecord = {
        moveNumber: Math.floor(this.moves.length / 2) + 1,
        san: move.san,
        fen: this.game.fen(),
        timestamp: Date.now(),
        whiteTimeMs: this.whiteTimeMs,
        blackTimeMs: this.blackTimeMs,
      };

      this.moves.push(record);
      
      // Log every 10 moves for debugging
      if (this.moves.length % 10 === 0) {
        console.log(`✅ Recorded ${this.moves.length} moves (${Math.floor(this.moves.length / 2)} full moves)`);
      }
      
      return true;
    } catch (e) {
      console.error("❌ Error recording move:", e);
      return false;
    }
  }

  /**
   * Update remaining time for a player
   */
  updateTime(color: "white" | "black", remainingMs: number) {
    if (color === "white") {
      this.whiteTimeMs = Math.max(0, remainingMs);
    } else {
      this.blackTimeMs = Math.max(0, remainingMs);
    }
  }

  /**
   * Get all recorded moves
   */
  getMoves(): MoveRecord[] {
    return this.moves;
  }

  /**
   * Generate PGN (Portable Game Notation) - Standards Compliant
   * Generates valid PGN that can be imported into chess.com, lichess, etc.
   */
  generatePGN(
    whitePlayer: string,
    blackPlayer: string,
    result: string,
    timeControl: string,
    gameType: string,
    terminationReason: string
  ): string {
    // Validate moves exist
    if (!this.moves || this.moves.length === 0) {
      console.warn("⚠️ No moves recorded for PGN generation");
      return this._generateEmptyGamePGN(whitePlayer, blackPlayer, result, timeControl);
    }

    // Format date and time properly (ISO format)
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const time = now.toTimeString().substring(0, 8); // HH:MM:SS

    // Construct PGN headers (standard format)
    let pgn = `[Event "Chess4Everyone - ${gameType}"]
[Site "Chess4Everyone.com"]
[Date "${date}"]
[Time "${time}"]
[Round "?"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${this._mapResultToPGNResult(result)}"]
[TimeControl "${timeControl}"]
[Termination "${terminationReason}"]

`;

    // Add moves in proper PGN format (SAN notation)
    if (this.moves.length > 0) {
      let moveText = "";
      for (let i = 0; i < this.moves.length; i++) {
        const move = this.moves[i];
        
        // Add move number for white's moves
        if (i % 2 === 0) {
          if (i > 0) moveText += " ";
          moveText += `${Math.floor(i / 2) + 1}. `;
        } else {
          moveText += " ";
        }
        
        // Add the move in SAN notation
        moveText += move.san;
        
        // Add line breaks for readability (every 10 moves)
        if ((i + 1) % 20 === 0) {
          moveText += "\n";
        }
      }
      
      pgn += moveText.trim();
    }

    // Add result marker at the end
    pgn += ` ${this._mapResultToPGNResult(result)}\n`;

    return pgn;
  }

  /**
   * Map game result to PGN result format
   */
  private _mapResultToPGNResult(result: string): string {
    switch (result.toUpperCase()) {
      case "WIN":
        return "1-0"; // White wins
      case "LOSS":
        return "0-1"; // Black wins
      case "DRAW":
        return "1/2-1/2"; // Draw
      default:
        return "*"; // Undefined result
    }
  }

  /**
   * Generate PGN for a game with no moves (edge case)
   */
  private _generateEmptyGamePGN(
    whitePlayer: string,
    blackPlayer: string,
    result: string,
    timeControl: string
  ): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    
    return `[Event "Chess4Everyone"]
[Site "Chess4Everyone.com"]
[Date "${date}"]
[Round "?"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${this._mapResultToPGNResult(result)}"]
[TimeControl "${timeControl}"]

${this._mapResultToPGNResult(result)}
`;
  }

  /**
   * Convert moves to JSON for storage
   */
  getMovesAsJSON(): string {
    return JSON.stringify(this.moves, null, 2);
  }

  /**
   * Get game statistics
   */
  getGameStats() {
    const totalSans = this.moves.length;
    const fullMoves = Math.floor(totalSans / 2);
    
    return {
      totalMoves: totalSans,
      moveCount: fullMoves,
      whiteTimeUsedMs: Math.max(0, this.whiteTimeMs),
      blackTimeUsedMs: Math.max(0, this.blackTimeMs),
    };
  }

  /**
   * Validate that moves were properly recorded
   */
  validateMoves(): { valid: boolean; message: string; moveCount: number } {
    if (!this.moves || this.moves.length === 0) {
      return {
        valid: false,
        message: "❌ No moves recorded in this game!",
        moveCount: 0
      };
    }

    const moveCount = Math.floor(this.moves.length / 2);
    
    if (moveCount < 1) {
      return {
        valid: false,
        message: "❌ Game has less than 1 full move!",
        moveCount
      };
    }

    // Check for basic validity of moves
    let allMovesValid = true;
    for (const move of this.moves) {
      if (!move.san || move.san.length === 0) {
        allMovesValid = false;
        break;
      }
    }

    if (!allMovesValid) {
      return {
        valid: false,
        message: "❌ Some moves have invalid SAN notation!",
        moveCount
      };
    }

    return {
      valid: true,
      message: `✅ ${this.moves.length} moves recorded (${moveCount} full moves)`,
      moveCount
    };
  }

  /**
   * Reset recorder for a new game
   */
  reset(timeControl: string) {
    this.game = new Chess();
    this.moves = [];
    this.startTime = Date.now();
    const [mainTime, _] = this.parseTimeControl(timeControl);
    this.whiteTimeMs = mainTime * 60 * 1000;
    this.blackTimeMs = mainTime * 60 * 1000;
  }
}
