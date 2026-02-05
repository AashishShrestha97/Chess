import { useEffect, useState } from "react";
import { getAllGameModes, type GameModeDto } from "../api/admin";

/**
 * Custom hook to load and manage game modes from the admin API
 * Provides caching to avoid repeated API calls
 */
export const useGameModes = () => {
  const [gameModes, setGameModes] = useState<GameModeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameModes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getAllGameModes();
        setGameModes(response.data);
      } catch (err: any) {
        console.error("Failed to load game modes:", err);
        setError(err.response?.data?.message || "Failed to load game modes");
        // Set default modes if API fails
        setGameModes(getDefaultGameModes());
      } finally {
        setLoading(false);
      }
    };

    loadGameModes();
  }, []);

  return { gameModes, loading, error };
};

/**
 * Get default game modes as fallback
 */
export const getDefaultGameModes = (): GameModeDto[] => [
  {
    id: 1,
    name: "BULLET",
    displayName: "Bullet",
    description: "Ultra-fast chess matches",
    minTimeMinutes: 1,
    maxTimeMinutes: 2,
    incrementSeconds: 1,
    icon: "⚡",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "BLITZ",
    displayName: "Blitz",
    description: "Fast-paced chess battles",
    minTimeMinutes: 3,
    maxTimeMinutes: 5,
    incrementSeconds: 2,
    icon: "🔥",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: "RAPID",
    displayName: "Rapid",
    description: "Medium-paced chess games",
    minTimeMinutes: 10,
    maxTimeMinutes: 25,
    incrementSeconds: 5,
    icon: "⏳",
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: "CLASSICAL",
    displayName: "Classical",
    description: "Traditional chess with ample time",
    minTimeMinutes: 60,
    maxTimeMinutes: 120,
    incrementSeconds: 30,
    icon: "🕰",
    createdAt: new Date().toISOString(),
  },
];

/**
 * Convert a GameModeDto to a time control string (e.g., "5+3")
 */
export const convertGameModeToTimeControl = (
  mode: GameModeDto
): string => {
  const minutes = mode.minTimeMinutes;
  const increment = mode.incrementSeconds;
  return `${minutes}+${increment}`;
};

/**
 * Parse a time control string (e.g., "5+3") and get the mode details
 */
export const parseTimeControl = (
  timeControl: string
): { minutes: number; increment: number } => {
  const [minutes, increment] = timeControl.split("+").map(Number);
  return { minutes: minutes || 5, increment: increment || 0 };
};
