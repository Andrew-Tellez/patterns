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
 * A shorter cut for the README. The steps are picked by index rather than sliced,
 * because the interesting ones are not the first ones: slicing the first two showed
 * the problem and then an `import` line, so the cut never contained the line that
 * applies the pattern. Pick the beats that carry the idea.
 */
const readmeCut = (script: PatternScript, keep: number[]): PatternScript => ({
  ...script,
  steps: keep.map((index) => ({ ...script.steps[index], seconds: 4 })),
});

/** Singleton: the painful version, the one line that fixes it, the call sites. */
const singletonReadme = readmeCut(singletonTypeScript, [0, 2, 3]);

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
      durationInFrames={durationInFrames(singletonReadme, FPS)}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ script: singletonReadme }}
    />
  </>
);
