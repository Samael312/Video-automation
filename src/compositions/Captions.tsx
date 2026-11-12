import React, {useMemo} from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

import type {Transcript, Word} from '../lib/types';
export type {Transcript, Word};
export type CaptionsProps = {
  videoSrc: string;
  transcript: Transcript | null;
  wordsPerPage: number;
  fontSize: number;
};

export const SPEAKER_COLORS = ['#FFD60A', '#4CC9F0', '#F72585', '#80ED99', '#FF9F1C'];

type Page = {words: Word[]; start: number; end: number};

// Agrupa palabras en paginas: corta por cantidad, por cambio de hablante o por pausa > 0.8 s
const paginate = (words: Word[], per: number): Page[] => {
  const pages: Page[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) pages.push({words: cur, start: cur[0].start, end: cur[cur.length - 1].end});
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && (cur.length >= per || prev.speaker !== w.speaker || w.start - prev.end > 0.8)) flush();
    cur.push(w);
  }
  flush();
  return pages;
};

const PageView: React.FC<{page: Page; speakers: string[]; fontSize: number}> = ({page, speakers, fontSize}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = page.start + frame / fps; // tiempo absoluto (la Sequence empieza en page.start)
  const color = SPEAKER_COLORS[Math.max(0, speakers.indexOf(page.words[0].speaker)) % SPEAKER_COLORS.length];
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '20%'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.05em 0.45em', maxWidth: '92%',
        fontFamily: 'Arial Black, Impact, sans-serif', fontSize, fontWeight: 900, textTransform: 'uppercase', textAlign: 'center'}}>
        {page.words.map((w, i) => {
          const active = t >= w.start && t < w.end;
          return (
            <span key={i} style={{
              display: 'inline-block',
              color: active ? color : '#fff',
              
              WebkitTextStroke: `${fontSize * 0.07}px #000`, paintOrder: 'stroke fill',
              textShadow: '0 6px 18px rgba(0,0,0,.6)',
            }}>{w.word}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<CaptionsProps> = ({videoSrc, transcript, wordsPerPage, fontSize}) => {
  const {fps} = useVideoConfig();
  const pages = useMemo(() => (transcript ? paginate(transcript.words, wordsPerPage) : []), [transcript, wordsPerPage]);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <OffthreadVideo src={staticFile(videoSrc)} />
      {transcript && pages.map((p, i) => {
        const from = Math.round(p.start * fps);
        // la pagina dura hasta el inicio de la siguiente (o su fin) para no parpadear entre palabras
        const next = pages[i + 1]?.start ?? p.end + 0.3;
        const dur = Math.max(1, Math.round(Math.min(next, p.end + 0.6) * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <PageView page={p} speakers={transcript.speakers} fontSize={fontSize} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
