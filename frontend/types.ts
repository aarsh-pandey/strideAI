
export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface ResolutionData {
  goal: string;
  category: string;
  deadline: string;
  motivation: string;
}

export interface StoredRoadmap {
  goal: string;
  category: string;
  deadline: string;
  feedback: string;
  full_plan: string;
  timestamp: number;
}
