import http from "./http";

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export interface UserManagementDto {
  id: number;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  enabled: boolean;
  createdAt: string;
}

export interface CreateUpdateUserRequest {
  name: string;
  email: string;
  phone?: string;
  enabled: boolean;
  roles: string[];
}

export async function getAllUsers() {
  return http.get<UserManagementDto[]>("/api/admin/users");
}

export async function getUser(userId: number) {
  return http.get<UserManagementDto>(`/api/admin/users/${userId}`);
}

export async function updateUser(userId: number, data: CreateUpdateUserRequest) {
  return http.put<UserManagementDto>(`/api/admin/users/${userId}`, data);
}

export async function deleteUser(userId: number) {
  return http.delete(`/api/admin/users/${userId}`);
}

export async function toggleUserStatus(userId: number) {
  return http.patch<UserManagementDto>(`/api/admin/users/${userId}/toggle-status`, {});
}

// ============================================================================
// VOICE COMMAND MANAGEMENT
// ============================================================================

export interface VoiceCommandDto {
  id: number;
  commandName: string;
  patterns: string[];
  intent: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUpdateVoiceCommandRequest {
  commandName: string;
  patterns: string[];
  intent: string;
  description?: string;
  active: boolean;
}

export async function getAllVoiceCommands() {
  return http.get<VoiceCommandDto[]>("/api/admin/voice-commands");
}

export async function getActiveVoiceCommands() {
  return http.get<VoiceCommandDto[]>("/api/admin/voice-commands/active");
}

export async function getCommandsByIntent(intent: string) {
  return http.get<VoiceCommandDto[]>(`/api/admin/voice-commands/intent/${intent}`);
}

export async function createVoiceCommand(data: CreateUpdateVoiceCommandRequest) {
  return http.post<VoiceCommandDto>("/api/admin/voice-commands", data);
}

export async function updateVoiceCommand(commandId: number, data: CreateUpdateVoiceCommandRequest) {
  return http.put<VoiceCommandDto>(`/api/admin/voice-commands/${commandId}`, data);
}

export async function deleteVoiceCommand(commandId: number) {
  return http.delete(`/api/admin/voice-commands/${commandId}`);
}

export async function toggleVoiceCommandStatus(commandId: number) {
  return http.patch<VoiceCommandDto>(`/api/admin/voice-commands/${commandId}/toggle-status`, {});
}

// ============================================================================
// GAME MODE MANAGEMENT
// ============================================================================

export interface GameModeDto {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  incrementSeconds: number;
  icon?: string;
  createdAt: string;
}

export interface CreateUpdateGameModeRequest {
  name: string;
  displayName: string;
  description?: string;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  incrementSeconds: number;
  icon?: string;
}

export async function getAllGameModes() {
  return http.get<GameModeDto[]>("/api/admin/game-modes");
}

export async function getGameMode(gameModeId: number) {
  return http.get<GameModeDto>(`/api/admin/game-modes/${gameModeId}`);
}

export async function createGameMode(data: CreateUpdateGameModeRequest) {
  return http.post<GameModeDto>("/api/admin/game-modes", data);
}

export async function updateGameMode(gameModeId: number, data: CreateUpdateGameModeRequest) {
  return http.put<GameModeDto>(`/api/admin/game-modes/${gameModeId}`, data);
}

export async function deleteGameMode(gameModeId: number) {
  return http.delete(`/api/admin/game-modes/${gameModeId}`);
}
