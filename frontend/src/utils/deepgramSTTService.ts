// src/utils/deepgramSTTService.ts
// Deepgram Speech-to-Text Service with real-time streaming
// Enhanced with better state management

export interface DeepgramSTTConfig {
  language?: string;
  model?: string;
  smartFormat?: boolean;
  punctuate?: boolean;
  interimResults?: boolean;
  onTranscript?: (
    transcript: string,
    isFinal: boolean,
    confidence: number
  ) => void;
  onError?: (error: string) => void;
  onListeningStart?: () => void;
  onListeningStop?: () => void;
}

class DeepgramSTTService {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private apiKey: string = "514598e9953aa63b766810b8e36ca4568df663fb";
  private isActive: boolean = false;
  private isListening: boolean = false;
  private isPaused: boolean = false;
  private config: DeepgramSTTConfig | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private isInitializing: boolean = false;

  /**
   * Initialize with API key from backend.
   * Guarded so we only fetch the token once.
   */
  async initialize(): Promise<void> {
    if (this.apiKey) {
      console.log("✅ Deepgram STT already initialized");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/deepgram/token");
      if (!response.ok) {
        throw new Error(`Failed to get Deepgram token: ${response.status}`);
      }
      const data = await response.json();
      this.apiKey = data.token;
      console.log("✅ Deepgram STT initialized");
    } catch (error) {
      console.error("❌ Failed to get Deepgram token:", error);
      throw error;
    }
  }

  /**
   * Start listening for voice input with real-time streaming
   */
  async startListening(config: DeepgramSTTConfig): Promise<void> {
    // Prevent duplicate listeners
    if (this.isActive || this.isInitializing) {
      console.warn("⚠️ Deepgram STT already listening or initializing");
      return;
    }

    this.isInitializing = true;
    this.config = config;
    this.isActive = true;
    this.isPaused = false;
    this.reconnectAttempts = 0;

    try {
      // Ensure API key is initialized
      if (!this.apiKey || this.apiKey.includes("REPLACE")) {
        console.log("🔑 Initializing API key...");
        await this.initialize();
      }

      // Get microphone access
      console.log("🎤 Requesting microphone access...");
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("✅ Microphone access granted");

      // Create WebSocket connection to Deepgram backend proxy
      console.log("🔌 Creating WebSocket connection to backend proxy...");
      await this.connectWebSocket();

      // Setup audio recording / streaming
      this.setupAudioRecording(this.mediaStream);

      this.isListening = true;
      this.isInitializing = false;
      this.config?.onListeningStart?.();
      console.log("🎤 Deepgram STT listening started successfully");
    } catch (error) {
      console.error("❌ Error starting Deepgram STT:", error);
      this.isInitializing = false;
      this.cleanup();
      
      let errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes("Permission denied")) {
        errorMsg = "Microphone permission denied. Please allow microphone access.";
      } else if (errorMsg.includes("NotFoundError")) {
        errorMsg = "No microphone found. Please connect a microphone.";
      } else if (errorMsg.includes("WebSocket")) {
        errorMsg = "Failed to connect to backend proxy. Check your internet connection.";
      }
      
      this.config?.onError?.(errorMsg);
      throw error;
    }
  }

  /**
   * Connect to Deepgram WebSocket for real-time transcription
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const language = this.config?.language || "en-IN";
        const model = this.config?.model || "nova-2";
        const smartFormat = this.config?.smartFormat !== false;
        const punctuate = this.config?.punctuate !== false;
        const interimResults = this.config?.interimResults !== false;

        const queryParams = new URLSearchParams({
          language,
          model,
          smart_format: String(smartFormat),
          punctuate: String(punctuate),
          interim_results: String(interimResults),
          encoding: "linear16",
          sample_rate: "16000",
          channels: "1",
        });

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//localhost:8080/api/deepgram/listen?${queryParams.toString()}`;
        
        console.log("🔗 Connecting to backend WebSocket proxy...");

        this.socket = new WebSocket(wsUrl);

        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            console.error("❌ WebSocket connection timeout (10s)");
            if (this.socket) {
              this.socket.close();
            }
            reject(new Error("WebSocket connection timeout"));
          }
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log("✅ Backend WebSocket proxy connected successfully");
          console.log("🎙️ Ready to stream audio - speak now!");
          this.reconnectAttempts = 0;
          this.startKeepAlive();
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📨 Received message from backend:", data);

            if (data.type === "Results") {
              const alt = data.channel?.alternatives?.[0];
              const transcript: string = alt?.transcript || "";
              const confidence: number = alt?.confidence ?? 0;
              const isFinal: boolean = data.is_final || false;

              if (transcript) {
                console.log(
                  `📝 Transcript: "${transcript}" (final: ${isFinal}, confidence: ${confidence.toFixed(2)})`
                );
                this.config?.onTranscript?.(transcript, isFinal, confidence);
              }
            } else if (data.type === "Metadata") {
              console.log("ℹ️ Deepgram metadata:", data);
            } else {
              console.log("ℹ️ Other message type:", data.type);
            }
          } catch (error) {
            console.error("❌ Error parsing Deepgram response:", error);
            console.error("Raw message:", event.data);
          }
        };

        this.socket.onerror = (event) => {
          clearTimeout(connectionTimeout);
          console.error("❌ Backend WebSocket error:", event);
          this.config?.onError?.("WebSocket connection error");
          reject(new Error("WebSocket connection error"));
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(
            `🔌 Backend WebSocket closed (code=${event.code}, reason="${event.reason}")`
          );
          this.isListening = false;
          this.config?.onListeningStop?.();

          if (this.isActive && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}, delay: ${delay}ms)`);
            setTimeout(() => {
              if (this.isActive) {
                this.connectWebSocket().catch((err) => {
                  console.error("❌ Reconnect failed:", err);
                });
              }
            }, delay);
          }
        };
      } catch (error) {
        console.error("❌ Error setting up WebSocket:", error);
        reject(error);
      }
    });
  }

  /**
   * Setup audio recording and streaming to Deepgram
   */
  private setupAudioRecording(stream: MediaStream): void {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);

    this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    let audioChunksCount = 0;

    this.audioProcessor.onaudioprocess = (e) => {
      if (
        !this.isActive ||
        !this.isListening ||
        this.isPaused ||
        !this.socket ||
        this.socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert float32 to int16
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        audioChunksCount++;
        if (audioChunksCount % 50 === 0) {
          console.log(`📤 Audio chunk ${audioChunksCount} sent (${int16Data.byteLength} bytes)`);
        }
        this.socket.send(int16Data.buffer);
      }
    };

    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext.destination);
    
    console.log("🔊 Audio recording setup complete - streaming started");
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isActive = false;
    this.isListening = false;
    this.isPaused = false;
    this.isInitializing = false;

    this.stopKeepAlive();

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      this.socket = null;
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    console.log("🛑 Stopping Deepgram STT...");
    this.cleanup();
    this.config?.onListeningStop?.();
  }

  /**
   * Pause listening (e.g., during TTS playback)
   */
  pauseListening(): void {
    if (!this.isActive || !this.isListening) return;
    this.isPaused = true;
    console.log("⏸️ Deepgram STT paused");
  }

  /**
   * Resume listening (after TTS finishes)
   */
  resumeListening(): void {
    if (!this.isActive) return;
    this.isPaused = false;
    this.isListening = true;
    console.log("▶️ Deepgram STT resumed");
  }

  /**
   * Start keep-alive pings
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, 5000);
  }

  /**
   * Stop keep-alive pings
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Check if currently listening
   */
  isListeningNow(): boolean {
    return this.isListening && !this.isPaused;
  }

  /**
   * Check if service is active
   */
  isServiceActive(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const deepgramSTTService = new DeepgramSTTService();
export default deepgramSTTService;