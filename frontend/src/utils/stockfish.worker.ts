// Stockfish Web Worker
console.log('🔧 Stockfish worker starting...');

let Stockfish: any = null;
let engine: any = null;
let engineReady = false;

// Global error handlers to forward errors to the main thread with details
self.addEventListener('error', (ev: any) => {
  try {
    const msg = ev && ev.message ? ev.message : String(ev);
    console.error('🔥 Uncaught worker error:', ev);
    self.postMessage({ type: 'error', message: `Uncaught worker error: ${msg}` });
  } catch (e) {
    // best-effort
    self.postMessage({ type: 'error', message: 'Uncaught worker error (unknown)' });
  }
});

self.addEventListener('unhandledrejection', (ev: any) => {
  try {
    const reason = ev && ev.reason ? ev.reason : ev;
    console.error('🔥 Unhandled rejection in worker:', reason);
    const msg = reason && reason.message ? reason.message : String(reason);
    self.postMessage({ type: 'error', message: `Unhandled rejection: ${msg}` });
  } catch (e) {
    self.postMessage({ type: 'error', message: 'Unhandled rejection (unknown)' });
  }
});
// Load Stockfish by fetching and evaluating the wrapper JS file
async function loadStockfish() {
  try {
    console.log('📦 Attempting to load Stockfish wrapper...');
    
    // Try to fetch the wrapper JS files using fetch + eval
    // This avoids Vite's static module resolution issues
    const candidates = [
      // Use absolute URLs relative to the app root (node_modules gets served by dev server)
      '/node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js',
      '/node_modules/stockfish/src/stockfish-17.1-lite-51f59da.js',
      '/node_modules/stockfish/src/stockfish-17.1-single-a496a04.js',
      '/node_modules/stockfish/src/stockfish-17.1-8e4d048.js',
      'stockfish/src/stockfish-17.1-lite-single-03e3232.js',
      'stockfish/src/stockfish-17.1-lite-51f59da.js',
      'stockfish/src/stockfish-17.1-single-a496a04.js',
      'stockfish/src/stockfish-17.1-8e4d048.js'
    ];
    
    let mod: any = null;
    let lastErr: any = null;
    
    for (const url of candidates) {
      try {
        console.log(`📥 Fetching: ${url}`);
        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn(`⚠️ Fetch failed (${resp.status}): ${url}`);
          continue;
        }
        const jsText = await resp.text();
        console.log(`📝 Fetched ${jsText.length} bytes from ${url}, evaluating...`);
        
        // Evaluate the JS in worker context
        // The wrapper may set a global Stockfish variable
        // In a worker, 'globalThis' and 'self' both refer to the worker global scope
        (function(globalThis: any, self: any) {
          eval(jsText);
        }).call(self, self, self);
        
        // Check if Stockfish global was set or if it's available
        if (typeof (self as any).Stockfish === 'function') {
          mod = (self as any).Stockfish;
          console.log(`✅ Successfully loaded wrapper from ${url} - found Stockfish global`);
          break;
        } else if (typeof (globalThis as any).Stockfish === 'function') {
          mod = (globalThis as any).Stockfish;
          console.log(`✅ Successfully loaded wrapper from ${url} - found in globalThis`);
          break;
        } else {
          console.warn(`⚠️ Wrapper loaded but no Stockfish function found at ${url}`);
          // Continue to next candidate
        }
      } catch (e) {
        console.warn(`⚠️ Failed to load ${url}:`, e && (e as any).message ? (e as any).message : String(e));
        lastErr = e;
      }
    }
    
    if (!mod) {
      throw lastErr || new Error('Failed to load any Stockfish wrapper');
    }
    
    Stockfish = mod;
    console.log('✅ Stockfish wrapper loaded and ready');
    return Stockfish;
  } catch (err) {
    console.error('❌ Failed to load Stockfish:', err);
    console.error('❌ Error details:', err instanceof Error ? err.stack : String(err));
    self.postMessage({ type: 'error', message: `Failed to load stockfish: ${String(err)}` });
    throw err;
  }
}

// Check if SharedArrayBuffer is available
function hasSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

// Initialize engine
async function initEngine() {
  try {
    console.log('🚀 Initializing Stockfish engine...');
    
    // Check for SharedArrayBuffer support
    if (!hasSharedArrayBuffer()) {
      console.warn('⚠️ SharedArrayBuffer not available - Stockfish may have limited performance');
      console.warn('⚠️ Ensure server sends: Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp');
    }

    // Load Stockfish dynamically (JS wrapper)
    console.log('📥 Loading Stockfish JS wrapper...');
    const StockfishModule = await loadStockfish();

    console.log('🔨 Creating Stockfish instance...');
    // The JS wrapper returns a worker-like instance when called
    engine = StockfishModule();
    console.log('🎬 Stockfish instance created');
    
    // Listen for engine output (wrapper posts messages)
    if (typeof engine.addMessageListener === 'function') {
      engine.addMessageListener((line: string) => {
        self.postMessage({ type: 'engine', line });
      });
    } else if (typeof engine.onmessage !== 'undefined') {
      engine.onmessage = (ev: any) => {
        const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
        self.postMessage({ type: 'engine', line });
      };
    } else if (typeof engine.postMessage === 'function') {
      // Some wrappers behave like workers and require onmessage handler
      // Nothing to attach here; rely on engine to post messages via onmessage
    }

    engineReady = true;
    console.log('✅ Stockfish WASM loaded successfully');
    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.error('❌ Stockfish init error:', err);
    console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    self.postMessage({ type: 'error', message: String(err) });
  }
}

// Message handler
self.onmessage = (e: MessageEvent) => {
  const { type, fen, depth, command } = e.data;

  if (type === 'init') {
    initEngine();
  } else if (type === 'move' && engineReady && engine) {
    // Request best move
    engine.postMessage('position fen ' + fen);
    engine.postMessage('go depth ' + depth);
  } else if (type === 'command' && engineReady && engine) {
    // Send raw command
    engine.postMessage(command);
  }
};
