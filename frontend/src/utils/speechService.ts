// src/utils/speechService.ts
// Enhanced Speech Service with interruption support and better queue management

export interface SpeechOptions {
  text: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
  priority?: 'high' | 'normal' | 'low';
}

interface QueueItem extends SpeechOptions {
  id: string;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let lastSpokenText = "";
let speakingNow = false;
let speechQueue: QueueItem[] = [];
let isProcessingQueue = false;
let currentQueueId: string | null = null;

const speechService = {
  isSupportedBrowser(): boolean {
    return typeof window !== "undefined" && !!(window.speechSynthesis || (window as any).webkitSpeechSynthesis);
  },

  isSpeakingNow(): boolean {
    return speakingNow;
  },

  getCurrentText(): string {
    return lastSpokenText;
  },

  async speak(opts: SpeechOptions): Promise<void> {
    const { text, rate = 1.0, pitch = 1.0, volume = 1.0, onStart, onEnd, onError, priority = 'normal' } = opts;

    if (!text || !text.trim()) {
      return;
    }

    if (!this.isSupportedBrowser()) {
      const msg = "Browser does not support Web Speech API for TTS.";
      console.warn(msg);
      onError?.(msg);
      return;
    }

    // High priority messages interrupt current speech
    if (priority === 'high') {
      this.stop();
    }

    return new Promise<void>((resolve, reject) => {
      try {
        console.log("🔊 Starting TTS:", text.substring(0, 50) + "...");
        lastSpokenText = text;
        onStart?.();
        speakingNow = true;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.1, Math.min(2, rate));
        utterance.pitch = Math.max(0.1, Math.min(2, pitch));
        utterance.volume = Math.max(0, Math.min(1, volume));

        // Use a more natural voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          console.log("▶️ Speech started");
        };

        utterance.onend = () => {
          speakingNow = false;
          currentUtterance = null;
          console.log("✅ Speech finished");
          onEnd?.();
          resolve();
          
          // Process next item in queue
          isProcessingQueue = false;
          this.processQueue();
        };

        utterance.onerror = (event) => {
          speakingNow = false;
          currentUtterance = null;
          const errMsg = `Speech error: ${event.error}`;
          console.error(errMsg);
          onError?.(errMsg);
          reject(new Error(errMsg));
          
          isProcessingQueue = false;
          this.processQueue();
        };

        currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        speakingNow = false;
        currentUtterance = null;
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("TTS error:", errMsg);
        onError?.(errMsg);
        reject(e);
        
        isProcessingQueue = false;
        this.processQueue();
      }
    });
  },

  stop(): void {
    console.log("🛑 Stopping TTS immediately");
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance = null;
    }
    speakingNow = false;
    
    // Clear queue on stop
    speechQueue = [];
    isProcessingQueue = false;
    currentQueueId = null;
  },

  async replay(): Promise<void> {
    if (lastSpokenText) {
      console.log("🔁 Replaying last message:", lastSpokenText.substring(0, 50) + "...");
      return this.speak({ text: lastSpokenText, priority: 'high' });
    }
  },

  getLastSpokenText(): string {
    return lastSpokenText;
  },

  processQueue(): void {
    if (isProcessingQueue || speechQueue.length === 0 || speakingNow) {
      return;
    }

    const nextItem = speechQueue.shift();
    if (nextItem) {
      isProcessingQueue = true;
      currentQueueId = nextItem.id;
      this.speak(nextItem);
    }
  },

  // Queue speech to be played after current speech finishes
  queueSpeak(opts: SpeechOptions): string {
    const id = `queue-${Date.now()}-${Math.random()}`;
    const queueItem: QueueItem = { ...opts, id };
    
    speechQueue.push(queueItem);
    
    if (!speakingNow && !isProcessingQueue) {
      this.processQueue();
    }
    
    return id;
  },

  // Clear entire queue
  clearQueue(): void {
    speechQueue = [];
    console.log("🗑️ Speech queue cleared");
  },

  // Remove specific item from queue
  removeFromQueue(id: string): void {
    const index = speechQueue.findIndex(item => item.id === id);
    if (index !== -1) {
      speechQueue.splice(index, 1);
      console.log("🗑️ Removed item from queue:", id);
    }
  },

  // Get queue status
  getQueueLength(): number {
    return speechQueue.length;
  },

  isQueueEmpty(): boolean {
    return speechQueue.length === 0;
  }
};

export default speechService;