// src/utils/deepgramTTSService.ts
// Deepgram Text-to-Speech Service

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

  constructor() {
    // Initialize audio context lazily
  }

  /**
   * Initialize audio context
   */
  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
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
   * Speak text using Deepgram TTS
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

    // High priority messages interrupt current speech
    if (priority === 'high') {
      this.stop();
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log("🔊 Starting Deepgram TTS:", text.substring(0, 50) + "...");
        this.lastSpokenText = text;
        this.isSpeaking = true;
        onStart?.();

        // Fetch audio from backend
        const response = await fetch("http://localhost:8080/api/deepgram/speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text, voice })
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status}`);
        }

        // Get audio data as array buffer
        const audioData = await response.arrayBuffer();

        // Initialize audio context
        this.initAudioContext();

        // Decode audio data
        const audioBuffer = await this.audioContext!.decodeAudioData(audioData);

        // Create source
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        
        // Apply rate (playback speed)
        source.playbackRate.value = Math.max(0.5, Math.min(2.0, rate));
        
        // Apply volume
        if (this.gainNode) {
          this.gainNode.gain.value = Math.max(0, Math.min(1.0, volume));
          source.connect(this.gainNode);
        } else {
          source.connect(this.audioContext!.destination);
        }

        // Handle completion
        source.onended = () => {
          this.isSpeaking = false;
          this.currentSource = null;
          console.log("✅ Deepgram TTS finished");
          onEnd?.();
          resolve();

          // Process next item in queue
          this.isProcessingQueue = false;
          this.processQueue();
        };

        // Store current source
        this.currentSource = source;

        // Start playback
        source.start(0);
        console.log("▶️ Speech started");

      } catch (error) {
        this.isSpeaking = false;
        this.currentSource = null;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("❌ Deepgram TTS error:", errMsg);
        onError?.(errMsg);
        reject(error);

        this.isProcessingQueue = false;
        this.processQueue();
      }
    });
  }

  /**
   * Stop current speech immediately
   */
  stop(): void {
    console.log("🛑 Stopping Deepgram TTS immediately");
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Ignore errors when stopping
      }
      this.currentSource = null;
    }
    
    this.isSpeaking = false;
    
    // Clear queue
    this.speechQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Replay last spoken text
   */
  async replay(): Promise<void> {
    if (this.lastSpokenText) {
      console.log("🔁 Replaying last message:", this.lastSpokenText.substring(0, 50) + "...");
      return this.speak({ 
        text: this.lastSpokenText, 
        priority: 'high' 
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