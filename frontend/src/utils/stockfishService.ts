/**
 * Stockfish Service - AI Chess Engine Integration
 * Type-safe version with proper null checks
 */

// Type definitions for Stockfish communication
export interface StockfishMove {
  from: string;
  to: string;
  promotion?: string;
}

interface StockfishResponse {
  bestMove: StockfishMove | null;
  depth: number;
  evaluation: number;
}

class StockfishService {
  private worker: Worker | null = null;
  private isReady = false;
  private moveResolve: ((move: StockfishMove | null) => void) | null = null;

  /**
   * Initialize the Stockfish Web Worker
   * This must be called once on app startup
   */
  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      // Create inline worker to avoid file path issues
      const workerCode = `
        let engine = null;
        let engineReady = false;
        let pendingMessages = [];

        // Initialize Stockfish engine
        async function initEngine() {
          try {
            // Import Stockfish WASM module
            const Stockfish = await import('https://cdn.jsdelivr.net/npm/stockfish.wasm@0.11.0/+esm');
            engine = await Stockfish.default();
            
            engine.addMessageListener((line) => {
              // Forward engine messages to main thread
              self.postMessage({ type: 'engine', line });
            });

            engineReady = true;
            self.postMessage({ type: 'ready' });
            
            // Send any pending messages
            while (pendingMessages.length > 0) {
              const msg = pendingMessages.shift();
              engine.postMessage(msg);
            }
          } catch (err) {
            console.error('Stockfish init error:', err);
            self.postMessage({ type: 'error', message: err.toString() });
          }
        }

        // Message handler
        self.onmessage = async (e) => {
          const { type, fen, depth, command } = e.data;

          if (type === 'init') {
            initEngine();
          } else if (type === 'move' && engineReady && engine) {
            // Request best move
            engine.postMessage('position fen ' + fen);
            engine.postMessage('go depth ' + depth);
          } else if (type === 'command' && engineReady && engine) {
            // Send raw command to engine
            engine.postMessage(command);
          } else if (!engineReady) {
            // Queue message if engine not ready
            if (type === 'command') {
              pendingMessages.push(command);
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (e) => {
        if (e.data.type === 'ready') {
          this.isReady = true;
          console.log('✅ Stockfish engine ready');
          resolve();
        } else if (e.data.type === 'engine') {
          // Handle engine output
          const line = e.data.line;
          
          // Parse best move from UCI output
          if (line.startsWith('bestmove')) {
            const match = line.match(/bestmove ([a-h][1-8][a-h][1-8])([qrbn])?/);
            if (match && this.moveResolve) {
              const moveStr = match[1];
              const promotion = match[2];
              const from = moveStr.substring(0, 2);
              const to = moveStr.substring(2, 4);
              
              console.log('🤖 Stockfish move:', { from, to, promotion });
              this.moveResolve({ from, to, promotion });
              this.moveResolve = null;
            } else if (this.moveResolve) {
              // Invalid move format
              console.warn('Invalid bestmove format:', line);
              this.moveResolve(null);
              this.moveResolve = null;
            }
          }
        } else if (e.data.type === 'error') {
          console.error('❌ Stockfish error:', e.data.message);
          if (this.moveResolve) {
            this.moveResolve(null);
            this.moveResolve = null;
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('❌ Worker error:', error);
        if (this.moveResolve) {
          this.moveResolve(null);
          this.moveResolve = null;
        }
      };

      // Initialize the worker
      this.worker.postMessage({ type: 'init' });

      // Fallback timeout
      setTimeout(() => {
        if (!this.isReady) {
          console.warn('⚠️ Stockfish initialization timeout - using fallback');
          this.isReady = true;
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Get the best move from Stockfish
   * @param fen - Current board position in FEN notation
   * @param depth - Search depth (1-20, higher = stronger but slower)
   * @returns Promise that resolves to the best move {from, to, promotion?}
   */
  async getBestMove(fen: string, depth: number = 8): Promise<StockfishMove | null> {
    if (!this.worker || !this.isReady) {
      console.warn('⚠️ Stockfish not ready, returning null for random move');
      return null;
    }

    return new Promise((resolve) => {
      this.moveResolve = resolve;
      this.worker!.postMessage({ type: 'move', fen, depth });

      // Timeout after 5 seconds - return null to trigger random move
      setTimeout(() => {
        if (this.moveResolve) {
          console.warn('⚠️ Stockfish timeout, returning null for random move');
          this.moveResolve(null);
          this.moveResolve = null;
        }
      }, 5000);
    });
  }

  /**
   * Send raw UCI command to engine
   */
  sendCommand(command: string): void {
    if (this.worker && this.isReady) {
      this.worker.postMessage({ type: 'command', command });
    }
  }

  /**
   * Terminate the worker (cleanup)
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      console.log('🛑 Stockfish service terminated');
    }
  }
}

// Export singleton instance
export const stockfishService = new StockfishService();
export type { StockfishResponse };