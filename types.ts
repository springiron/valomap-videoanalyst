
export interface PlayerPosition {
  team: string; // e.g., "Red", "Green", "Blue", "Yellow"
  agentGuess?: string;
  x: number; // 0-100 relative to minimap
  y: number; // 0-100 relative to minimap
}

export interface MinimapBounds {
  ymin: number; // 0-1000 scale relative to image
  xmin: number; // 0-1000 scale relative to image
  ymax: number; // 0-1000 scale relative to image
  xmax: number; // 0-1000 scale relative to image
}

export interface AnalysisResult {
  mapName: string;
  minimapBounds: MinimapBounds;
  players: PlayerPosition[];
  summary: string;
}

export enum AppState {
  IDLE = 'IDLE',
  CROP = 'CROP',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type ModelProvider = 'gemini' | 'openai';
