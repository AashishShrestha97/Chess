// src/utils/deepgramVoiceCommandService.ts
// Enhanced Voice Command Service - NO TTS INTERRUPTION
// Users must hear full messages before speaking

import { deepgramSTTService } from "./deepgramSTTService";
import { deepgramTTSService } from "./deepgramTTSService";
import { GlobalVoiceParser, type ParsedCommand } from "./globalVoiceParser";

export interface VoiceCommandCallback {
  (command: ParsedCommand): void;
}

export interface DeepgramVoiceCommandConfig {
  language?: string;
  model?: string;
  onListeningStart?: () => void;
  onListeningStop?: () => void;
  onError?: (error: string) => void;
  onCommand?: VoiceCommandCallback;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
}

class DeepgramVoiceCommandService {
  private config: DeepgramVoiceCommandConfig | null = null;
  private isVoiceEnabled: boolean = true;
  private lastCommandTime: number = 0;
  private lastCommandText: string = "";
  private readonly COMMAND_COOLDOWN = 500; // ms
  private transcriptBuffer: string[] = [];
  private bufferTimeout: any = null;

  /**
   * Initialize Deepgram services
   */
  async initialize(): Promise<void> {
    try {
      await deepgramSTTService.initialize();
      console.log("✅ Deepgram Voice Command Service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Deepgram services:", error);
      throw error;
    }
  }

  /**
   * Start listening for voice commands
   * Enhanced for South Asian accents
   */
  async startListening(config: DeepgramVoiceCommandConfig): Promise<void> {
    this.config = config;

    if (!config) {
      const errMsg = "No config provided for voice command service";
      console.error("❌", errMsg);
      throw new Error(errMsg);
    }

    try {
      await deepgramSTTService.startListening({
        // Use Indian English model for better South Asian accent recognition
        language: config.language || "en-IN",
        // Nova-2 is best for conversational AI
        model: config.model || "nova-2",
        smartFormat: true,
        punctuate: true,
        // Enable interim results for faster response
        interimResults: true,
        
        onListeningStart: () => {
          console.log("🎤 Voice commands active (Deepgram with Indian English)");
          try {
            config.onListeningStart?.();
          } catch (e) {
            console.error("❌ Error in onListeningStart callback:", e);
          }
        },
        
        onListeningStop: () => {
          console.log("🛑 Voice commands stopped");
          try {
            config.onListeningStop?.();
          } catch (e) {
            console.error("❌ Error in onListeningStop callback:", e);
          }
        },
        
        onError: (error: string) => {
          console.error("❌ Voice error:", error);
          try {
            config.onError?.(error);
          } catch (e) {
            console.error("❌ Error in onError callback:", e);
          }
        },
        
        onTranscript: (transcript, isFinal, confidence) => {
          try {
            this.handleTranscript(transcript, isFinal, confidence);
          } catch (e) {
            console.error("❌ Error in handleTranscript:", e);
          }
        },
      });
    } catch (error) {
      const msg =
        error instanceof Error && typeof error === "object" ? error.message : String(error ?? "Unknown error");
      console.error("❌ Error starting voice commands:", msg);
      try {
        config.onError?.(msg);
      } catch (e) {
        console.error("❌ Error in onError callback:", e);
      }
      throw error;
    }
  }

  /**
   * Handle transcript from Deepgram
   * NO INTERRUPTION - transcripts queued during TTS playback
   */
  private handleTranscript(
    transcript: string,
    isFinal: boolean,
    confidence: number
  ): void {
    // Validate inputs
    if (!transcript || typeof transcript !== 'string') {
      console.warn("⚠️ Invalid transcript received:", transcript);
      return;
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      confidence = 0;
    }

    // Always send transcript to callback for UI updates
    this.config?.onTranscript?.(transcript, isFinal);

    // For interim results, show in UI but don't process yet
    if (!isFinal) {
      console.log(`📝 Interim: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
      return;
    }

    // Final transcript processing
    console.log(
      `📝 Final transcript: "${transcript}" (confidence: ${confidence.toFixed(2)})`
    );

    // CRITICAL CHANGE: Don't interrupt TTS
    // If TTS is speaking, ignore the transcript (user should wait)
    if (deepgramTTSService.isSpeakingNow()) {
      console.log("⏸️ TTS is speaking - ignoring transcript (user must wait for speech to finish)");
      return;
    }

    // Prevent duplicate commands
    const now = Date.now();
    if (
      now - this.lastCommandTime < this.COMMAND_COOLDOWN &&
      transcript.trim().toLowerCase() === this.lastCommandText.toLowerCase()
    ) {
      console.log("⏭️ Skipping duplicate command");
      return;
    }

    this.lastCommandTime = now;
    this.lastCommandText = transcript.trim();

    // Process the command
    this.processCommand(transcript, confidence);
  }

  /**
   * Process command with enhanced parsing
   */
  private processCommand(transcript: string, confidence: number): void {
    // Parse command using GlobalVoiceParser
    const command = GlobalVoiceParser.parseNavigationCommand(transcript);

    if (command) {
      console.log(
        `✅ Command detected: ${command.intent} (confidence: ${command.confidence})`
      );

      // ALWAYS process voice control commands
      if (command.intent === "VOICE_ON") {
        this.isVoiceEnabled = true;
        console.log("🔊 Voice commands ENABLED");
        this.config?.onCommand?.(command);
        return;
      }

      if (command.intent === "VOICE_OFF") {
        this.isVoiceEnabled = false;
        console.log("🔇 Voice commands DISABLED");
        this.config?.onCommand?.(command);
        return;
      }

      // Stop and repeat commands removed since we don't interrupt TTS
      // Users must wait for TTS to finish

      // Only process other commands if voice is enabled
      if (!this.isVoiceEnabled) {
        console.log("🔇 Voice disabled, ignoring command:", command.intent);
        return;
      }

      // Process regular commands
      this.config?.onCommand?.(command);
    } else {
      // No recognized command - pass raw transcript for chess move parsing
      console.log(`ℹ️ No navigation command recognized: "${transcript}"`);
      
      if (this.isVoiceEnabled) {
        // Create a proper ParsedCommand object for unrecognized input
        const unrecognizedCommand: ParsedCommand = {
          intent: "UNRECOGNIZED",
          confidence: confidence,
          originalText: transcript,
        };
        this.config?.onCommand?.(unrecognizedCommand);
      }
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    console.log("🛑 Stopping voice commands...");
    deepgramSTTService.stopListening();
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    this.transcriptBuffer = [];
  }

  /**
   * Pause listening (e.g., during TTS)
   */
  pauseListening(): void {
    deepgramSTTService.pauseListening();
  }

  /**
   * Resume listening (after TTS)
   */
  resumeListening(): void {
    deepgramSTTService.resumeListening();
  }

  /**
   * Check if currently listening
   */
  isListeningNow(): boolean {
    return deepgramSTTService.isListeningNow();
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return deepgramSTTService.isServiceActive();
  }

  /**
   * Get voice enabled status
   */
  getVoiceEnabled(): boolean {
    return this.isVoiceEnabled;
  }

  /**
   * Set voice enabled status
   */
  setVoiceEnabled(enabled: boolean): void {
    this.isVoiceEnabled = enabled;
    console.log(`🔊 Voice commands ${enabled ? "ENABLED" : "DISABLED"}`);
  }

  /**
   * Restart listening
   */
  async restartListening(): Promise<void> {
    if (!this.config) {
      console.warn("⚠️ No config available for restart");
      return;
    }

    console.log("🔄 Restarting voice commands...");
    this.stopListening();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await this.startListening(this.config);
  }
}

// Export singleton instance
export const deepgramVoiceCommandService = new DeepgramVoiceCommandService();
export default deepgramVoiceCommandService;