import React from 'react';
import { Composition } from 'remotion';
import { PatternVideo, durationInFrames } from './PatternVideo';
import {
  singletonCSharp,
  singletonGo,
  singletonKotlin,
  singletonPython,
  singletonTypeScript,
} from './scripts/singleton';
import type { PatternScript } from './types';

const FPS = 30;

/**
 * One composition per pattern per language. The id is what `remotion render` takes
 * and what the MP4 is named, so it stays kebab-case.
 */
const scripts: { id: string; script: PatternScript }[] = [
  { id: 'singleton-typescript', script: singletonTypeScript },
  { id: 'singleton-python', script: singletonPython },
  { id: 'singleton-kotlin', script: singletonKotlin },
  { id: 'singleton-csharp', script: singletonCSharp },
  { id: 'singleton-go', script: singletonGo },
];

/**
 * A shorter cut for the README: the problem, the two steps that carry the idea, and
 * the result. Long enough to explain, short enough to be a GIF GitHub will play.
 */
const readmeCut = (script: PatternScript): PatternScript => ({
  ...script,
  steps: script.steps.slice(0, 2).map((step) => ({ ...step, seconds: 4.5 })),
});

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
    <Composition
      id="singleton-typescript-readme"
      component={PatternVideo}
      durationInFrames={durationInFrames(readmeCut(singletonTypeScript), FPS)}
      fps={FPS}
      width={1280}
      height={720}
      defaultProps={{ script: readmeCut(singletonTypeScript) }}
    />
  </>
);
