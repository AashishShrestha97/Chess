import http from "./http";
import type { VoiceCommandDto } from "./admin";

/**
 * Service to load voice commands from database for the voice parser
 * This allows admins to manage voice commands dynamically without code changes
 */
class VoiceCommandDatabaseService {
  /**
   * Cache for voice commands to avoid repeated API calls
   */
  private cache: VoiceCommandDto[] | null = null;
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  public async getActiveCommands(): Promise<VoiceCommandDto[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (
      this.cache &&
      now - this.cacheTimestamp < this.cacheTTL
    ) {
      console.log("📦 Using cached voice commands");
      return this.cache;
    }

    try {
      console.log("🔄 Fetching voice commands from database...");
      const response = await http.get<VoiceCommandDto[]>(
        "/api/admin/voice-commands/active"
      );
      this.cache = response.data;
      this.cacheTimestamp = now;
      console.log(`✅ Loaded ${response.data.length} voice commands from database`);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to load voice commands from database:", error);
      // Return empty array on error to allow app to continue
      return [];
    }
  }

  public async getCommandsByIntent(intent: string): Promise<VoiceCommandDto[]> {
    try {
      const response = await http.get<VoiceCommandDto[]>(
        `/api/admin/voice-commands/intent/${intent}`
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to load ${intent} commands:`, error);
      return [];
    }
  }

  public invalidateCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
    console.log("🔄 Voice command cache invalidated");
  }

  public convertToParserFormat(commands: VoiceCommandDto[]): Record<string, string> {
    const result: Record<string, string> = {};

    commands.forEach((cmd) => {
      // Add mapping for each pattern to the command name
      cmd.patterns.forEach((pattern) => {
        result[pattern.toLowerCase()] = cmd.commandName;
      });
    });

    return result;
  }
}

export default new VoiceCommandDatabaseService();
