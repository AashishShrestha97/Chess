declare module 'stockfish' {
  interface StockfishEngine {
    addMessageListener?: (cb: (line: string) => void) => void;
    postMessage(command: string): void;
    onmessage?: (ev: any) => void;
  }

  function Stockfish(): StockfishEngine;
  export default Stockfish;
}
