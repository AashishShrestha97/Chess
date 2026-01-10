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
   * Record a move
   */
  recordMove(moveInput: string | { from: string; to: string; promotion?: string }): boolean {
    try {
      const move = this.game.move(moveInput);
      if (!move) {
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
      return true;
    } catch (e) {
      console.error("Error recording move:", e);
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
   * Generate PGN (Portable Game Notation)
   */
  generatePGN(
    whitePlayer: string,
    blackPlayer: string,
    result: string,
    timeControl: string,
    gameType: string,
    terminationReason: string
  ): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0];

    let pgn = `[Event "Chess4Everyone"]
[Site "?"]
[Date "${date}"]
[Time "${time}"]
[Round "?"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${result}"]
[TimeControl "${timeControl}"]
[GameType "${gameType}"]
[TerminationReason "${terminationReason}"]
[Moves "${this.moves.length}"]

`;

    // Add moves in PGN format
    for (let i = 0; i < this.moves.length; i++) {
      if (i % 2 === 0) {
        pgn += `${Math.floor(i / 2) + 1}. `;
      }
      pgn += this.moves[i].san + " ";

      // Add comments with position evaluation every few moves
      if ((i + 1) % 10 === 0) {
        pgn += "\n";
      }
    }

    pgn += `\n\n${result}`;
    return pgn;
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
    return {
      totalMoves: this.moves.length,
      moveCount: Math.floor(this.moves.length / 2),
      whiteTimeUsedMs: Math.max(0, this.whiteTimeMs),
      blackTimeUsedMs: Math.max(0, this.blackTimeMs),
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
