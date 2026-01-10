// src/utils/voiceCommandService.ts
// Enhanced Voice Command Service with better stability and interruption support

import { GlobalVoiceParser, type ParsedCommand } from './globalVoiceParser';
import speechService from './speechService';
import beepService from './beepService';

export interface VoiceCommandCallback {
  (command: ParsedCommand): void;
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
  onSpeechStart?: () => void;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let recognition: any = null;
let voiceConfig: VoiceCommandServiceConfig | null = null;
let isActive = false;
let isVoiceEnabled = true;
let isListening = false;
let restartTimeout: number | null = null;
let lastCommandTime = 0;
let lastCommandText = "";
const COMMAND_COOLDOWN = 500; // Reduced for better responsiveness
const RESTART_DELAY = 300; // Delay before restarting recognition

// Debounce timer for listening state
let listeningDebounceTimer: number | null = null;

const voiceCommandService = {
  isActive(): boolean {
    return isActive;
  },

  isListeningNow(): boolean {
    return isListening;
  },

  isVoiceEnabled(): boolean {
    return isVoiceEnabled;
  },

  setVoiceEnabled(enabled: boolean): void {
    isVoiceEnabled = enabled;
    console.log(`🔊 Voice commands ${enabled ? "ENABLED" : "DISABLED"}`);
  },

  // Debounced setter to prevent flickering
  setListeningState(listening: boolean): void {
    if (listeningDebounceTimer) {
      clearTimeout(listeningDebounceTimer);
    }

    listeningDebounceTimer = window.setTimeout(() => {
      isListening = listening;
      if (listening) {
        voiceConfig?.onListeningStart?.();
      } else {
        voiceConfig?.onListeningStop?.();
      }
      listeningDebounceTimer = null;
    }, 100);
  },

  async startListening(config: VoiceCommandServiceConfig): Promise<void> {
    if (isActive) {
      console.log("⚠️ Already listening, stopping first...");
      this.stopListening();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!SpeechRecognition) {
      const msg = "Speech Recognition API not supported in this browser.";
      console.error(msg);
      config.onError?.(msg);
      return;
    }

    voiceConfig = config;
    isActive = true;

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = config.continuous ?? true;
      recognition.interimResults = config.interimResults ?? true;
      // Use Indian English for better South Asian accent support
      recognition.lang = config.language || "en-IN";
      recognition.maxAlternatives = config.maxAlternatives || 3;

      recognition.onstart = () => {
        console.log("🎤 Voice recognition started");
        // Play beep to indicate user's turn to speak
        beepService.playTurnBeep().catch(err => console.warn("⚠️ Beep error:", err));
        this.setListeningState(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        let isFinal = false;
        let hasInterimResults = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          transcript += result[0].transcript;
          
          if (result.isFinal) {
            isFinal = true;
          } else {
            hasInterimResults = true;
          }
        }

        console.log(`📝 Transcript: "${transcript}" (final: ${isFinal}, interim: ${hasInterimResults})`);
        
        // Smart interrupt: Stop TTS when user starts speaking (even interim results)
        if (hasInterimResults && speechService.isSpeakingNow()) {
          console.log("🎤 User speaking - stopping TTS to listen");
          speechService.stop();
        }
        
        // Send transcript to callback
        config.onTranscript?.(transcript, isFinal);

        if (isFinal) {
          // Prevent duplicate commands
          const now = Date.now();
          if (now - lastCommandTime < COMMAND_COOLDOWN && transcript.trim() === lastCommandText) {
            console.log("⏭️ Skipping duplicate command");
            return;
          }

          lastCommandTime = now;
          lastCommandText = transcript.trim();

          // Parse command using GlobalVoiceParser
          const command = GlobalVoiceParser.parseNavigationCommand(transcript);
          
          if (command) {
            console.log(`✅ Command detected: ${command.intent} (confidence: ${command.confidence})`);

            // ALWAYS process voice on/off commands, even when voice is disabled
            if (command.intent === "VOICE_ON") {
              isVoiceEnabled = true;
              console.log("🔊 Voice commands ENABLED");
              config.onCommand?.(command);
              return;
            }

            if (command.intent === "VOICE_OFF") {
              isVoiceEnabled = false;
              console.log("🔇 Voice commands DISABLED");
              config.onCommand?.(command);
              return;
            }

            // ALWAYS process stop command immediately
            if (command.intent === "VOICE_STOP") {
              console.log("🛑 Stop command - halting speech");
              speechService.stop();
              config.onCommand?.(command);
              return;
            }

            // ALWAYS process repeat command
            if (command.intent === "VOICE_REPEAT") {
              console.log("🔁 Repeat command");
              config.onCommand?.(command);
              return;
            }

            // Only process other commands if voice is enabled
            if (!isVoiceEnabled) {
              console.log("🔇 Voice disabled, ignoring command:", command.intent);
              return;
            }

            // Process regular commands
            config.onCommand?.(command);
          } else {
            // No recognized command - pass raw transcript to handler for potential chess move parsing
            console.log(`ℹ️ No recognized command: "${transcript}"`);
            if (isVoiceEnabled) {
              config.onCommand?.({
                intent: "UNRECOGNIZED",
                confidence: 0,
                originalText: transcript,
              });
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error("❌ Voice recognition error:", event.error);
        
        // Don't report "no-speech" as error, just restart
        if (event.error !== "no-speech") {
          config.onError?.(`Voice error: ${event.error}`);
        }
        
        this.setListeningState(false);
      };

      recognition.onend = () => {
        console.log("🛑 Voice recognition ended");
        this.setListeningState(false);

        // Auto-restart if still active and continuous mode
        if (isActive && config.continuous) {
          if (restartTimeout) {
            clearTimeout(restartTimeout);
          }
          
          restartTimeout = window.setTimeout(() => {
            if (isActive && recognition) {
              try {
                console.log("🔄 Restarting voice recognition...");
                recognition.start();
              } catch (e) {
                console.warn("⚠️ Could not restart recognition:", e);
              }
            }
          }, RESTART_DELAY);
        }
      };

      // Start recognition
      recognition.start();
      console.log("✅ Voice recognition initialized");

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("❌ Error starting recognition:", errorMsg);
      config.onError?.(errorMsg);
      isActive = false;
    }
  },

  stopListening(): void {
    console.log("🛑 Stopping voice recognition...");

    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }

    if (listeningDebounceTimer) {
      clearTimeout(listeningDebounceTimer);
      listeningDebounceTimer = null;
    }

    if (recognition) {
      try {
        recognition.stop();
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
      } catch (e) {
        console.warn("⚠️ Error stopping recognition:", e);
      }
      recognition = null;
    }

    isActive = false;
    isListening = false;
    voiceConfig?.onListeningStop?.();
  },

  pauseListening(): void {
    if (recognition && isListening) {
      try {
        recognition.stop();
        this.setListeningState(false);
        console.log("⏸️ Voice recognition paused");
      } catch (e) {
        console.warn("⚠️ Could not pause recognition:", e);
      }
    }
  },

  resumeListening(): void {
    if (recognition && !isListening && isActive) {
      try {
        recognition.start();
        this.setListeningState(true);
        console.log("▶️ Voice recognition resumed");
      } catch (e) {
        console.warn("⚠️ Could not resume recognition:", e);
      }
    }
  },

  // Force restart recognition
  async restartListening(): Promise<void> {
    if (!voiceConfig) {
      console.warn("⚠️ No config available for restart");
      return;
    }

    console.log("🔄 Force restarting voice recognition...");
    this.stopListening();
    await new Promise(resolve => setTimeout(resolve, 300));
    await this.startListening(voiceConfig);
  }
};

export default voiceCommandService;