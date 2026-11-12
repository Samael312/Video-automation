export type Word = {word: string; start: number; end: number; speaker: string; score?: number};
export type Transcript = {video: string; duration: number; speakers: string[]; words: Word[]};

export type CutsFile = {video: string; duration: number; keeps: {start: number; end: number}[]};
