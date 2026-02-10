declare module 'stockfish.wasm' {
  interface StockfishEngine {
    addMessageListener(callback: (line: string) => void): void;
    postMessage(command: string): void;
  }

  function Stockfish(): Promise<StockfishEngine>;
  export default Stockfish;
}
