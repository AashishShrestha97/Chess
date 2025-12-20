// src/utils/deepgramTTSService.ts
// Optimized Deepgram Text-to-Speech Service with Caching
// Supports both WAV and MP3 formats, with intelligent LRU cache

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

interface CacheEntry {
  buffer: AudioBuffer;
  timestamp: number;
  accessCount: number;
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

  // ✅ Audio cache with LRU eviction
  private audioCache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number = 25; // Cache up to 25 messages
  private maxCacheAge: number = 1000 * 60 * 30; // 30 minutes

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
      console.log("✅ AudioContext created");
    }
    
    if (this.audioContext.state === 'suspended') {
      console.log("⏸️ Resuming audio context...");
      try {
        await this.audioContext.resume();
        console.log("✅ Audio context resumed");
      } catch (err) {
        console.warn("⚠️ Could not resume audio context:", err);
        throw err;
      }
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
   * Register callback when speech ends
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
   * Generate cache key from text and voice
   */
  private getCacheKey(text: string, voice: string): string {
    // Create hash-like key from text + voice
    const normalized = text.toLowerCase().trim();
    return `${voice}:${normalized}`;
  }

  /**
   * Cache audio buffer with LRU eviction
   */
  private cacheAudioBuffer(key: string, buffer: AudioBuffer): void {
    // Check if we need to evict old entries
    if (this.audioCache.size >= this.maxCacheSize) {
      // Find least recently used entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      for (const [k, entry] of this.audioCache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.audioCache.delete(oldestKey);
        console.log("🗑️ Evicted old cache entry (LRU)");
      }
    }
    
    // Clean up expired entries
    this.cleanExpiredCache();
    
    // Add new entry
    this.audioCache.set(key, {
      buffer,
      timestamp: Date.now(),
      accessCount: 0,
    });
    
    console.log(`💾 Cached TTS audio (cache size: ${this.audioCache.size})`);
  }

  /**
   * Get cached audio buffer
   */
  private getCachedBuffer(key: string): AudioBuffer | null {
    const entry = this.audioCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.maxCacheAge) {
      console.log("🗑️ Removing expired cache entry");
      this.audioCache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.timestamp = Date.now();
    entry.accessCount++;
    
    console.log(`✅ Cache HIT (access count: ${entry.accessCount})`);
    return entry.buffer;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.audioCache.entries()) {
      if (now - entry.timestamp > this.maxCacheAge) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.audioCache.delete(key);
      console.log("🗑️ Removed expired cache entry");
    });
  }

  /**
   * Speak text using Deepgram TTS with intelligent caching
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

    // ✅ Check cache first
    const cacheKey = this.getCacheKey(text, voice);
    const cachedBuffer = this.getCachedBuffer(cacheKey);
    
    if (cachedBuffer) {
      console.log("⚡ Using cached TTS audio - instant playback!");
      
      // If already speaking, queue even cached audio
      if (this.isSpeaking) {
        console.log("📋 Queueing cached message");
        this.queueSpeak(options);
        return;
      }
      
      return this.playAudioBuffer(cachedBuffer, rate, volume, onStart, onEnd);
    }

    // If already speaking, queue
    if (this.isSpeaking) {
      console.log("📋 Queueing message:", text.substring(0, 40) + "...");
      this.queueSpeak(options);
      return;
    }

    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log("🔊 Fetching TTS from backend:", text.substring(0, 50) + "...");
        this.lastSpokenText = text;
        this.isSpeaking = true;
        onStart?.();

        // Fetch from backend
        const startTime = Date.now();
        const response = await fetch("http://localhost:8080/api/deepgram/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
          credentials: 'include'
        });

        const fetchTime = Date.now() - startTime;
        console.log(`📥 Backend response received in ${fetchTime}ms`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`TTS API error: ${response.status} - ${errorText}`);
        }

        // Get audio data
        const audioData = await response.arrayBuffer();
        console.log(`📦 Audio data size: ${(audioData.byteLength / 1024).toFixed(2)} KB`);

        // Initialize audio context
        await this.ensureAudioContextReady();

        // Decode audio
        const decodeStartTime = Date.now();
        let audioBuffer: AudioBuffer;
        
        try {
          audioBuffer = await this.audioContext!.decodeAudioData(audioData);
          const decodeTime = Date.now() - decodeStartTime;
          console.log(`✅ Audio decoded in ${decodeTime}ms (${audioBuffer.duration.toFixed(2)}s duration)`);
        } catch (decodeError) {
          console.warn("⚠️ Decode error - trying HTML5 Audio fallback:", decodeError);
          return await this.playViaAudioElement(audioData, rate, volume, onEnd, resolve, reject);
        }

        // ✅ Cache the decoded buffer (only short messages to save memory)
        if (text.length < 300) {
          this.cacheAudioBuffer(cacheKey, audioBuffer);
        } else {
          console.log("ℹ️ Message too long to cache (>300 chars)");
        }

        // Play the audio
        await this.playAudioBuffer(audioBuffer, rate, volume, onStart, onEnd);
        resolve();

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
   * Play pre-decoded audio buffer (used for both cached and fresh audio)
   */
  private async playAudioBuffer(
    audioBuffer: AudioBuffer,
    rate: number,
    volume: number,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      this.isSpeaking = true;
      onStart?.();

      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = 1.0; // Always 1.0 for stability

      const clampedVolume = Math.max(0, Math.min(1.0, volume));
      if (this.gainNode) {
        this.gainNode.gain.value = clampedVolume;
        source.connect(this.gainNode);
      } else {
        source.connect(this.audioContext!.destination);
      }

      source.onended = () => {
        this.isSpeaking = false;
        this.currentSource = null;
        console.log("✅ TTS playback finished");
        
        this.onSpeechEndCallbacks.forEach(cb => {
          try { cb(); } catch (err) {
            console.error("❌ Error in speech end callback:", err);
          }
        });
        
        onEnd?.();
        resolve();
        
        this.isProcessingQueue = false;
        this.processQueue();
      };

      this.currentSource = source;
      source.start(0);
      console.log("▶️ Audio playback started");
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
        console.log("🎵 Using HTML5 Audio element for playback");
        
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio();
        audio.src = url;
        audio.playbackRate = 1.0;
        audio.volume = Math.max(0, Math.min(1.0, volume));
        
        const handleEnd = () => {
          audio.removeEventListener('ended', handleEnd);
          audio.removeEventListener('error', handleError);
          URL.revokeObjectURL(url);
          this.isSpeaking = false;
          this.currentSource = null;
          console.log("✅ HTML5 Audio playback finished");
          
          this.onSpeechEndCallbacks.forEach(cb => {
            try { cb(); } catch (err) {
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
          console.error("❌ HTML5 Audio error:", err);
          reject?.(err);
          rej(err);
          
          this.isProcessingQueue = false;
          this.processQueue();
        };
        
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleError);
        
        audio.play().catch(handleError);
        console.log("▶️ HTML5 Audio playback started");
        
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
   * Stop current speech (let it finish naturally - no interruption)
   */
  stop(): void {
    console.log("⚠️ Stop requested but speech will complete naturally");
    // Do nothing - let speech finish
  }

  /**
   * Replay last spoken text
   */
  async replay(): Promise<void> {
    if (this.lastSpokenText) {
      console.log("🔁 Replaying:", this.lastSpokenText.substring(0, 50) + "...");
      return this.speak({ text: this.lastSpokenText });
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

  /**
   * Clear TTS cache
   */
  clearCache(): void {
    this.audioCache.clear();
    console.log("🗑️ TTS cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; entries: Array<{ text: string; accessCount: number }> } {
    const entries = Array.from(this.audioCache.entries()).map(([key, entry]) => ({
      text: key.split(':')[1]?.substring(0, 50) || key,
      accessCount: entry.accessCount,
    }));
    
    return {
      size: this.audioCache.size,
      maxSize: this.maxCacheSize,
      entries,
    };
  }
}

// Export singleton instance
export const deepgramTTSService = new DeepgramTTSService();
export default deepgramTTSService;