import { useEffect, useState } from "react";
import { getAllVoiceCommands, type VoiceCommandDto } from "../api/admin";

/**
 * Custom hook to load and manage voice commands from the admin API
 * Provides caching to avoid repeated API calls
 */
export const useVoiceCommands = () => {
  const [voiceCommands, setVoiceCommands] = useState<VoiceCommandDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoiceCommands = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getAllVoiceCommands();
        // Only keep active commands
        const activeCommands = response.data.filter((cmd) => cmd.active);
        setVoiceCommands(activeCommands);
      } catch (err: any) {
        console.error("Failed to load voice commands:", err);
        setError(err.response?.data?.message || "Failed to load voice commands");
        // Set default commands if API fails
        setVoiceCommands(getDefaultVoiceCommands());
      } finally {
        setLoading(false);
      }
    };

    loadVoiceCommands();
  }, []);

  return { voiceCommands, loading, error };
};

/**
 * Get default voice commands as fallback
 */
export const getDefaultVoiceCommands = (): VoiceCommandDto[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      commandName: "Knight",
      patterns: ["knight", "night"],
      intent: "PIECE",
      description: "Select knight piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      commandName: "Bishop",
      patterns: ["bishop"],
      intent: "PIECE",
      description: "Select bishop piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      commandName: "Rook",
      patterns: ["rook", "castle"],
      intent: "PIECE",
      description: "Select rook piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      commandName: "Queen",
      patterns: ["queen"],
      intent: "PIECE",
      description: "Select queen piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 5,
      commandName: "King",
      patterns: ["king"],
      intent: "PIECE",
      description: "Select king piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 6,
      commandName: "Pawn",
      patterns: ["pawn"],
      intent: "PIECE",
      description: "Select pawn piece",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 7,
      commandName: "Undo",
      patterns: ["undo", "take back"],
      intent: "ACTION",
      description: "Undo the last move",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 8,
      commandName: "Resign",
      patterns: ["resign", "give up"],
      intent: "ACTION",
      description: "Resign from the game",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

/**
 * Find a voice command by pattern (case-insensitive)
 */
export const findVoiceCommand = (
  pattern: string,
  commands: VoiceCommandDto[]
): VoiceCommandDto | undefined => {
  const lowercasePattern = pattern.toLowerCase().trim();
  return commands.find((cmd) =>
    cmd.patterns.some((p) => p.toLowerCase() === lowercasePattern)
  );
};

/**
 * Group voice commands by intent
 */
export const groupCommandsByIntent = (
  commands: VoiceCommandDto[]
): { [key: string]: VoiceCommandDto[] } => {
  return commands.reduce(
    (acc, cmd) => {
      const intent = cmd.intent || "OTHER";
      if (!acc[intent]) {
        acc[intent] = [];
      }
      acc[intent].push(cmd);
      return acc;
    },
    {} as { [key: string]: VoiceCommandDto[] }
  );
};
