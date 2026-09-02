import React from 'react';
import { Composition } from 'remotion';
import { PatternVideo, durationInFrames } from './PatternVideo';
import { singletonPython, singletonTypeScript } from './scripts/singleton';
import type { PatternScript } from './types';

const FPS = 30;

const scripts: { id: string; script: PatternScript }[] = [
  { id: 'singleton-typescript', script: singletonTypeScript },
  { id: 'singleton-python', script: singletonPython },
];

export const Root: React.FC = () => (
  <>
    {scripts.map(({ id, script }) => (
      <Composition
        key={id}
        id={id}
        component={PatternVideo}
        durationInFrames={durationInFrames(script, FPS)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ script }}
      />
    ))}
  </>
);
