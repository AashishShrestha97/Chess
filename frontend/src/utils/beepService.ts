// src/utils/beepService.ts
// Simple Beep Service using Web Audio API
// Provides auditory feedback when user's turn to speak starts

class BeepService {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  /**
   * Initialize the Web Audio API context
   */
  private initAudioContext(): void {
    if (this.isInitialized && this.audioContext) return;

    try {
      const audioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (audioContextClass) {
        this.audioContext = new audioContextClass();
        this.isInitialized = true;
        console.log("✅ Beep Service initialized");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Web Audio API:", error);
    }
  }

  /**
   * Play a single beep sound
   * @param frequency - Frequency in Hz (default: 800)
   * @param duration - Duration in milliseconds (default: 150)
   * @param volume - Volume 0-1 (default: 0.3)
   */
  async playBeep(frequency: number = 800, duration: number = 150, volume: number = 0.3): Promise<void> {
    this.initAudioContext();

    if (!this.audioContext) {
      console.warn("⚠️ Web Audio API not available");
      return;
    }

    try {
      const ctx = this.audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Configure oscillator
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Configure gain (volume envelope)
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Play beep
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);

      console.log("🔊 Beep played");
    } catch (error) {
      console.error("❌ Error playing beep:", error);
    }
  }

  /**
   * Play a double beep (turn start notification)
   * Two short beeps to indicate user's turn to speak
   */
  async playTurnBeep(): Promise<void> {
    try {
      // First beep
      await this.playBeep(800, 100, 0.3);
      // Short delay between beeps
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Second beep (slightly higher pitch)
      await this.playBeep(1000, 100, 0.3);
      console.log("🔊 Turn beep played");
    } catch (error) {
      console.error("❌ Error playing turn beep:", error);
    }
  }

  /**
   * Play a success beep (command accepted)
   */
  async playSuccessBeep(): Promise<void> {
    try {
      await this.playBeep(1200, 200, 0.25);
      console.log("🔊 Success beep played");
    } catch (error) {
      console.error("❌ Error playing success beep:", error);
    }
  }

  /**
   * Play an error beep (command rejected)
   */
  async playErrorBeep(): Promise<void> {
    try {
      await this.playBeep(400, 250, 0.25);
      console.log("🔊 Error beep played");
    } catch (error) {
      console.error("❌ Error playing error beep:", error);
    }
  }
}

// Create singleton instance
const beepService = new BeepService();

export default beepService;
