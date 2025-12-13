// src/utils/deepgramTTSService.ts
// Deepgram Text-to-Speech Service - NO INTERRUPTION VERSION
// Users MUST hear complete messages before speaking

export interface DeepgramTTSOptions {
  text: string;
  voice?: string;
  rate?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  priority?: 'high' | 'normal' | 'low';
}

interface QueueItem extends DeepgramTTSOptions {
  id: string;
}

class DeepgramTTSService {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isSpeaking: boolean = false;
  private lastSpokenText: string = "";
  private speechQueue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private isSoundEnabled: boolean = true;
  private gainNode: GainNode | null = null;
  private onSpeechEndCallbacks: (() => void)[] = [];

  constructor() {
    // Initialize audio context lazily
  }

  /**
   * Initialize audio context (async to handle resume)
   */
  private async ensureAudioContextReady(): Promise<void> {
    if (!this.audioContext) {
      console.log("🔧 Creating new AudioContext...");
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      console.log("✅ AudioContext created and gainNode connected");
    }
    
    // Resume audio context if suspended (required by modern browsers)
    if (this.audioContext.state === 'suspended') {
      console.log("⏸️ Audio context is suspended, attempting to resume...");
      try {
        await this.audioContext.resume();
        console.log("✅ Audio context resumed successfully");
      } catch (err) {
        console.warn("⚠️ Could not resume audio context:", err);
        throw err;
      }
    } else {
      console.log("✅ Audio context is already running (state:", this.audioContext.state, ")");
    }
  }

  /**
   * Check if browser supports audio
   */
  isSupportedBrowser(): boolean {
    return typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined";
  }

  /**
   * Check if currently speaking
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get last spoken text
   */
  getCurrentText(): string {
    return this.lastSpokenText;
  }

  /**
   * Register callback when speech ends (for pausing/resuming STT)
   */
  onSpeechEnd(callback: () => void): void {
    this.onSpeechEndCallbacks.push(callback);
  }

  /**
   * Clear all speech end callbacks
   */
  clearSpeechEndCallbacks(): void {
    this.onSpeechEndCallbacks = [];
  }

  /**
   * Speak text using Deepgram TTS - NO INTERRUPTION
   */
  async speak(options: DeepgramTTSOptions): Promise<void> {
    const {
      text,
      voice = "aura-asteria-en",
      rate = 1.0,
      volume = 1.0,
      onStart,
      onEnd,
      onError,
      priority = 'normal'
    } = options;

    if (!text || !text.trim()) {
      return;
    }

    if (!this.isSoundEnabled) {
      console.log("🔇 Sound disabled, skipping TTS");
      return;
    }

    if (!this.isSupportedBrowser()) {
      const msg = "Browser does not support Web Audio API.";
      console.warn(msg);
      onError?.(msg);
      return;
    }

    // If already speaking, ALWAYS queue - NO INTERRUPTION
    if (this.isSpeaking) {
      console.log("📋 Queueing message (already speaking):", text.substring(0, 40) + "...");
      this.queueSpeak({ text, voice, rate, volume, onStart, onEnd, onError, priority });
      return;
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log("🔊 Starting Deepgram TTS:", text.substring(0, 50) + "...");
        this.lastSpokenText = text;
        this.isSpeaking = true;
        onStart?.();

        console.log("🔌 Fetching audio from backend...");
        
        // NO ABORT CONTROLLER - Let request complete naturally
        let response: Response;
        try {
          response = await fetch("http://localhost:8080/api/deepgram/speak", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ text, voice }),
            credentials: 'include'
          });
        } catch (fetchError) {
          const fetchErrMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          console.error("❌ Fetch failed:", fetchErrMsg);
          throw new Error(`Failed to fetch audio from backend: ${fetchErrMsg}`);
        }

        console.log("📥 Backend response received - Status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Backend error response:", errorText);
          throw new Error(`TTS API error: ${response.status} - ${errorText}`);
        }

        // Get audio data as array buffer
        console.log("📦 Reading audio data from response...");
        const audioData = await response.arrayBuffer();

        // Initialize audio context and ensure it's ready
        console.log("🎵 Initializing audio context...");
        await this.ensureAudioContextReady();

        console.log("📊 Audio data size:", audioData.byteLength, "bytes");

        // Decode audio data (WAV format)
        let audioBuffer: AudioBuffer;
        try {
          console.log("🔄 Decoding WAV audio...");
          audioBuffer = await this.audioContext!.decodeAudioData(audioData);
          console.log("✅ Audio decoded successfully (WAV format)");
          console.log("   Duration:", audioBuffer.duration, "seconds");
          console.log("   Channels:", audioBuffer.numberOfChannels);
          console.log("   Sample rate:", audioBuffer.sampleRate, "Hz");
        } catch (decodeError) {
          console.warn("⚠️ Decode error - trying audio element fallback:", decodeError);
          return await this.playViaAudioElement(audioData, rate, volume, onEnd, resolve, reject);
        }

        // Validate audio buffer
        if (!audioBuffer || audioBuffer.duration === 0) {
          throw new Error("Audio buffer is empty or invalid");
        }

        // Create source
        console.log("🎛️ Creating audio source...");
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        
        // Apply rate (always 1.0 for stability)
        source.playbackRate.value = 1.0;
        console.log("🎚️ Playback rate set to: 1.0 (fixed for stability)");
        
        // Apply volume
        const clampedVolume = Math.max(0, Math.min(1.0, volume));
        if (this.gainNode) {
          this.gainNode.gain.value = clampedVolume;
          source.connect(this.gainNode);
          console.log("🔊 Volume set to:", clampedVolume, "(via gainNode)");
        } else {
          source.connect(this.audioContext!.destination);
          console.log("🔊 Volume set to: default (direct connect)");
        }

        // Handle completion
        source.onended = () => {
          console.log("🏁 Audio ended event fired");
          this.isSpeaking = false;
          this.currentSource = null;
          console.log("✅ Deepgram TTS finished (buffer)");
          
          // Call all speech end callbacks (for resuming STT)
          this.onSpeechEndCallbacks.forEach(cb => {
            try {
              cb();
            } catch (err) {
              console.error("❌ Error in speech end callback:", err);
            }
          });
          
          onEnd?.();
          resolve();

          // Process next item in queue
          this.isProcessingQueue = false;
          this.processQueue();
        };

        // Store current source
        this.currentSource = source;

        // Start playback
        console.log("▶️ Starting audio playback from buffer...");
        console.log("📍 Audio context state:", this.audioContext!.state);
        console.log("📍 Current time:", this.audioContext!.currentTime);
        source.start(0);
        console.log("▶️ Speech started - audio should be playing now");

      } catch (error) {
        this.isSpeaking = false;
        this.currentSource = null;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ Deepgram TTS error:", errMsg);
        console.error("❌ Full error:", error);
        onError?.(errMsg);
        reject(error);

        this.isProcessingQueue = false;
        this.processQueue();
      }
    });
  }

  /**
   * Play audio via HTML audio element (fallback for MP3)
   */
  private playViaAudioElement(
    audioData: ArrayBuffer,
    rate: number,
    volume: number,
    onEnd?: () => void,
    resolve?: (value: void | PromiseLike<void>) => void,
    reject?: (reason?: any) => void
  ): Promise<void> {
    return new Promise((res, rej) => {
      try {
        console.log("🎵 Using HTML5 audio element for playback (MP3 fallback)");
        
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio();
        audio.src = url;
        audio.playbackRate = 1.0; // Force normal speed
        
        const clampedVolume = Math.max(0, Math.min(1.0, volume));
        audio.volume = clampedVolume;
        
        console.log("🎚️ Audio element playback rate: 1.0 (fixed for MP3)");
        console.log("🔊 Audio element volume:", clampedVolume);
        
        const handleEnd = () => {
          audio.removeEventListener('ended', handleEnd);
          audio.removeEventListener('error', handleError);
          URL.revokeObjectURL(url);
          this.isSpeaking = false;
          this.currentSource = null;
          console.log("✅ Deepgram TTS finished (audio element)");
          
          // Call speech end callbacks
          this.onSpeechEndCallbacks.forEach(cb => {
            try {
              cb();
            } catch (err) {
              console.error("❌ Error in speech end callback:", err);
            }
          });
          
          onEnd?.();
          resolve?.();
          res();
          
          this.isProcessingQueue = false;
          this.processQueue();
        };
        
        const handleError = (err: any) => {
          audio.removeEventListener('ended', handleEnd);
          audio.removeEventListener('error', handleError);
          URL.revokeObjectURL(url);
          this.isSpeaking = false;
          this.currentSource = null;
          console.error("❌ Audio element error:", err);
          reject?.(err);
          rej(err);
          
          this.isProcessingQueue = false;
          this.processQueue();
        };
        
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleError);
        
        console.log("▶️ Audio element playback starting...");
        audio.play().catch((err) => {
          console.error("❌ Failed to play audio:", err);
          handleError(err);
        });
        
        console.log("▶️ Audio element playback requested");
      } catch (err) {
        console.error("❌ Error in playViaAudioElement:", err);
        reject?.(err);
        rej(err);
        
        this.isProcessingQueue = false;
        this.processQueue();
      }
    });
  }

  /**
   * Stop current speech - REMOVED FUNCTIONALITY
   * We don't allow interruption anymore
   */
  stop(): void {
    console.log("⚠️ Stop requested but interruption is disabled - speech will complete");
    // Do nothing - let speech finish naturally
  }

  /**
   * Replay last spoken text
   */
  async replay(): Promise<void> {
    if (this.lastSpokenText) {
      console.log("🔁 Replaying last message:", this.lastSpokenText.substring(0, 50) + "...");
      return this.speak({ 
        text: this.lastSpokenText
      });
    }
  }

  /**
   * Get last spoken text
   */
  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  /**
   * Queue speech to be played after current speech finishes
   */
  queueSpeak(options: DeepgramTTSOptions): string {
    const id = `queue-${Date.now()}-${Math.random()}`;
    const queueItem: QueueItem = { ...options, id };
    
    this.speechQueue.push(queueItem);
    
    if (!this.isSpeaking && !this.isProcessingQueue) {
      this.processQueue();
    }
    
    return id;
  }

  /**
   * Process speech queue
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.speechQueue.length === 0 || this.isSpeaking) {
      return;
    }

    const nextItem = this.speechQueue.shift();
    if (nextItem) {
      this.isProcessingQueue = true;
      this.speak(nextItem);
    }
  }

  /**
   * Clear entire queue
   */
  clearQueue(): void {
    this.speechQueue = [];
    console.log("🗑️ Speech queue cleared");
  }

  /**
   * Remove specific item from queue
   */
  removeFromQueue(id: string): void {
    const index = this.speechQueue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.speechQueue.splice(index, 1);
      console.log("🗑️ Removed item from queue:", id);
    }
  }

  /**
   * Get queue status
   */
  getQueueLength(): number {
    return this.speechQueue.length;
  }

  /**
   * Check if queue is empty
   */
  isQueueEmpty(): boolean {
    return this.speechQueue.length === 0;
  }

  /**
   * Enable/disable sound
   */
  setSoundEnabled(enabled: boolean): void {
    this.isSoundEnabled = enabled;
    console.log(`🔊 Sound ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if sound is enabled
   */
  isSoundOn(): boolean {
    return this.isSoundEnabled;
  }
}

// Export singleton instance
export const deepgramTTSService = new DeepgramTTSService();
export default deepgramTTSService;