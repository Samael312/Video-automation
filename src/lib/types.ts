export type Word = {word: string; start: number; end: number; speaker: string; score?: number};
export type Transcript = {video: string; duration: number; speakers: string[]; words: Word[]};
