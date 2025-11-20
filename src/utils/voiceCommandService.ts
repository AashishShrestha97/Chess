/**
 * Enhanced Voice Command Recognition Service
 * Supports full navigation flow for chess game setup
 */

export interface VoiceCommand {
  intent: string;
  confidence: number;
  originalText: string;
  metadata?: any;
}

export interface VoiceCommandCallback {
  (command: VoiceCommand): void;
}

export interface VoiceCommandServiceConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onListeningStart?: () => void;
  onListeningStop?: () => void;
  onError?: (error: string) => void;
  onCommand?: VoiceCommandCallback;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
}

// Command patterns - clean and essential
const COMMAND_PATTERNS: { [key: string]: string[] } = {
  // Game mode selection
  START_VOICE_CHESS: [
    "voice chess",
    "start voice chess",
    "play voice chess",
  ],
  START_CLASSIC_CHESS: [
    "classic chess",
    "start classic chess",
    "play classic chess",
  ],

  // Specific Bullet time controls
  SELECT_BULLET_1_0: [
    "bullet 1+0",
    "bullet 1 plus 0",
    "bullet 1 0",
    "bullet one plus zero",
    "bullet one zero",
  ],
  SELECT_BULLET_1_1: [
    "bullet 1+1",
    "bullet 1 plus 1",
    "bullet 1 1",
    "bullet one plus one",
    "bullet one one",
  ],
  SELECT_BULLET_2_1: [
    "bullet 2+1",
    "bullet 2 plus 1",
    "bullet 2 1",
    "bullet two plus one",
    "bullet two one",
  ],
  SELECT_BULLET_2_0: [
    "bullet 2+0",
    "bullet 2 plus 0",
    "bullet 2 0",
    "bullet two plus zero",
    "bullet two zero",
  ],
  SELECT_BULLET_30_0: [
    "bullet 30 seconds",
    "bullet 30+0",
    "bullet 30 plus 0",
    "bullet thirty seconds",
  ],

  // Specific Blitz time controls
  SELECT_BLITZ_3_0: [
    "blitz 3+0",
    "blitz 3 plus 0",
    "blitz 3 0",
    "blitz three plus zero",
    "blitz three zero",
  ],
  SELECT_BLITZ_3_2: [
    "blitz 3+2",
    "blitz 3 plus 2",
    "blitz 3 2",
    "blitz three plus two",
    "blitz three two",
  ],
  SELECT_BLITZ_5_0: [
    "blitz 5+0",
    "blitz 5 plus 0",
    "blitz 5 0",
    "blitz five plus zero",
    "blitz five zero",
  ],
  SELECT_BLITZ_5_3: [
    "blitz 5+3",
    "blitz 5 plus 3",
    "blitz 5 3",
    "blitz five plus three",
    "blitz five three",
  ],
  SELECT_BLITZ_4_2: [
    "blitz 4+2",
    "blitz 4 plus 2",
    "blitz 4 2",
    "blitz four plus two",
    "blitz four two",
  ],

  // Specific Rapid time controls
  SELECT_RAPID_10_0: [
    "rapid 10+0",
    "rapid 10 plus 0",
    "rapid 10 0",
    "rapid ten plus zero",
    "rapid ten zero",
  ],
  SELECT_RAPID_10_5: [
    "rapid 10+5",
    "rapid 10 plus 5",
    "rapid 10 5",
    "rapid ten plus five",
    "rapid ten five",
  ],
  SELECT_RAPID_15_10: [
    "rapid 15+10",
    "rapid 15 plus 10",
    "rapid 15 10",
    "rapid fifteen plus ten",
    "rapid fifteen ten",
  ],
  SELECT_RAPID_15_0: [
    "rapid 15+0",
    "rapid 15 plus 0",
    "rapid 15 0",
    "rapid fifteen plus zero",
    "rapid fifteen zero",
  ],
  SELECT_RAPID_25_10: [
    "rapid 25+10",
    "rapid 25 plus 10",
    "rapid 25 10",
    "rapid twenty five plus ten",
  ],

  // Specific Classical time controls
  SELECT_CLASSICAL_90_30: [
    "classical 90+30",
    "classical 90 plus 30",
    "classical 90 30",
    "classical ninety plus thirty",
  ],
  SELECT_CLASSICAL_60_0: [
    "classical 60+0",
    "classical 60 plus 0",
    "classical 60 0",
    "classical sixty plus zero",
    "classical sixty zero",
  ],
  SELECT_CLASSICAL_60_30: [
    "classical 60+30",
    "classical 60 plus 30",
    "classical 60 30",
    "classical sixty plus thirty",
  ],
  SELECT_CLASSICAL_120_30: [
    "classical 120+30",
    "classical 120 plus 30",
    "classical 120 30",
    "classical one twenty plus thirty",
  ],
  SELECT_CLASSICAL_90_40_30: [
    "classical 90/40+30",
    "classical 90 40 plus 30",
    "classical ninety forty plus thirty",
  ],

  // Time control info inquiry
  TIME_CONTROLS_BULLET: [
    "time controls bullet",
    "bullet time controls",
    "what are bullet time controls",
    "tell me bullet time controls",
  ],
  TIME_CONTROLS_BLITZ: [
    "time controls blitz",
    "blitz time controls",
    "what are blitz time controls",
    "tell me blitz time controls",
  ],
  TIME_CONTROLS_RAPID: [
    "time controls rapid",
    "rapid time controls",
    "what are rapid time controls",
    "tell me rapid time controls",
  ],
  TIME_CONTROLS_CLASSICAL: [
    "time controls classical",
    "classical time controls",
    "what are classical time controls",
    "tell me classical time controls",
  ],

  // Opponent selection
  SELECT_RANDOM: [
    "random",
    "play random",
    "random opponent",
    "play against random",
  ],
  SELECT_FRIENDS: [
    "friends",
    "play with friends",
    "play friends",
    "with friends",
  ],

  // Navigation
  GO_BACK: [
    "back",
    "go back",
  ],

  // Control
  STOP_LISTENING: [
    "stop listening",
    "stop voice",
  ],

  // Help
  SHOW_COMMANDS: [
    "show commands",
    "help",
    "voice commands",
    "what can i say",
  ],
};

class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private config: VoiceCommandServiceConfig = {};
  private currentTranscript = "";
  private finalTranscript = "";
  private restartAttempts = 0;
  private maxRestartAttempts = 5;
  private lastCommandTime = 0;
  private commandCooldown = 500; // ms between commands

  constructor() {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn(
        "Speech Recognition not supported. Please use Chrome or Edge."
      );
      return;
    }

    this.recognition = new SpeechRecognitionClass();
    this.setupRecognition();
  }

  private setupRecognition() {
    if (!this.recognition) return;

    const rec = this.recognition;

    rec.continuous = this.config.continuous ?? true;
    rec.interimResults = this.config.interimResults ?? true;
    rec.lang = this.config.language ?? "en-US";
    rec.maxAlternatives = this.config.maxAlternatives ?? 5;

    rec.onstart = () => {
      this.isListening = true;
      this.currentTranscript = "";
      this.finalTranscript = "";
      this.restartAttempts = 0;
      console.log("🎤 Voice listening started");
      this.config.onListeningStart?.();
    };

    rec.onend = () => {
      console.log("🎤 Voice listening ended");
      
      // Auto-restart if continuous mode is enabled and we haven't exceeded max attempts
      if (this.config.continuous && this.restartAttempts < this.maxRestartAttempts) {
        console.log("🔄 Auto-restarting voice recognition...");
        this.restartAttempts++;
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.log("Recognition already started or error:", e);
            }
          }
        }, 100);
      } else {
        this.isListening = false;
        this.config.onListeningStop?.();
      }
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      
      // Handle specific errors
      if (event.error === "no-speech") {
        console.log("No speech detected, continuing to listen...");
      } else if (event.error === "aborted") {
        console.log("Recognition aborted");
        this.isListening = false;
      } else if (event.error === "network") {
        this.config.onError?.("Network error. Please check your connection.");
      } else {
        this.config.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    rec.onresult = (event: any) => {
      let interimTranscript = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update interim transcript
      if (interimTranscript) {
        this.currentTranscript = interimTranscript;
        this.config.onTranscript?.(interimTranscript, false);
      }

      // Process final transcript
      if (finalText) {
        this.finalTranscript = finalText.trim().toLowerCase();
        console.log("✅ Final transcript:", this.finalTranscript);
        this.config.onTranscript?.(this.finalTranscript, true);

        // Check command cooldown to prevent duplicate commands
        const now = Date.now();
        if (now - this.lastCommandTime < this.commandCooldown) {
          console.log("⏱️ Command cooldown active, skipping");
          return;
        }

        // Match command intent
        const command = this.matchCommand(this.finalTranscript);
        if (command) {
          console.log("🎯 Command matched:", command.intent, "Confidence:", command.confidence);
          this.lastCommandTime = now;
          this.config.onCommand?.(command);
        } else {
          console.log("❌ No command matched for:", this.finalTranscript);
        }

        // Reset for next command
        this.currentTranscript = "";
      }
    };
  }

  private matchCommand(transcript: string): VoiceCommand | null {
    const normalizedText = transcript.trim().toLowerCase();

    // Try to find the best matching command
    let bestMatch: VoiceCommand | null = null;
    let highestConfidence = 0;

    for (const [intent, patterns] of Object.entries(COMMAND_PATTERNS)) {
      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase();
        
        // Exact match - highest confidence
        if (normalizedText === patternLower) {
          return {
            intent,
            originalText: normalizedText,
            confidence: 1.0,
          };
        }
        
        // Contains match - high confidence
        if (normalizedText.includes(patternLower)) {
          const confidence = 0.85;
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = {
              intent,
              originalText: normalizedText,
              confidence,
            };
          }
        }
        
        // Fuzzy match - check if pattern words are in transcript
        const patternWords = patternLower.split(" ");
        const transcriptWords = normalizedText.split(" ");
        const matchedWords = patternWords.filter(word => 
          transcriptWords.some(tw => {
            // Check if words match or are very similar
            return tw === word || tw.includes(word) || word.includes(tw);
          })
        );
        
        // Require at least 60% of pattern words to match
        if (matchedWords.length >= Math.ceil(patternWords.length * 0.6)) {
          const confidence = 0.5 + (matchedWords.length / patternWords.length) * 0.3;
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = {
              intent,
              originalText: normalizedText,
              confidence,
            };
          }
        }
      }
    }

    // Only return matches with confidence above 0.5
    if (bestMatch && bestMatch.confidence >= 0.5) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Start listening for voice commands
   */
  startListening(config?: Partial<VoiceCommandServiceConfig>): void {
    if (!this.recognition) {
      console.warn("Speech Recognition not supported");
      this.config.onError?.("Speech Recognition not supported in this browser");
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
      this.setupRecognition();
    }

    if (this.isListening) {
      console.log("Already listening");
      return;
    }

    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      this.isListening = false;
      this.config.onError?.("Failed to start voice recognition");
    }
  }

  /**
   * Stop listening for voice commands
   */
  stopListening(): void {
    if (!this.recognition || !this.isListening) return;
    
    this.restartAttempts = this.maxRestartAttempts; // Prevent auto-restart
    this.isListening = false;
    
    try {
      this.recognition.stop();
    } catch (e) {
      console.error("Error stopping speech recognition:", e);
    }
  }

  /**
   * Abort listening and reset state
   */
  abort(): void {
    if (!this.recognition) return;
    
    this.restartAttempts = this.maxRestartAttempts; // Prevent auto-restart
    this.isListening = false;
    
    try {
      this.recognition.abort();
    } catch (e) {
      console.error("Error aborting speech recognition:", e);
    }
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get the current interim transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  /**
   * Get the last final transcript
   */
  getFinalTranscript(): string {
    return this.finalTranscript;
  }

  /**
   * Check if Speech Recognition is supported
   */
  static isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }
}

export default new VoiceCommandService();