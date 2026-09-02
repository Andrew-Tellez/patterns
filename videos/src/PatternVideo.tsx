import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { theme } from './theme';
import type { PatternScript } from './types';

const TITLE_SECONDS = 4;
const PROBLEM_SECONDS = 8;
const OUTCOME_SECONDS = 9;

/**
 * Global pace. Every step's `seconds` is multiplied by this, so the whole series
 * slows down or speeds up from one number instead of twenty edits.
 */
const PACE = 1.4;

/** Total frames for a script, so the composition and the render agree. */
export const durationInFrames = (script: PatternScript, fps: number): number =>
  Math.round(
    (TITLE_SECONDS +
      PROBLEM_SECONDS +
      script.steps.reduce((total, step) => total + step.seconds * PACE, 0) +
      OUTCOME_SECONDS) *
      fps,
  );

/**
 * Types the difference between two versions of the file: delete back to the common
 * prefix, then type forward. Deletions animate too, which is what makes a refactor
 * read as a refactor rather than a jump cut.
 */
const typedCode = (previous: string, next: string, progress: number): string => {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) {
    prefix += 1;
  }
  const toDelete = previous.length - prefix;
  const toType = next.length - prefix;
  const done = Math.round(progress * (toDelete + toType));
  if (done < toDelete) return previous.slice(0, previous.length - done);
  return next.slice(0, prefix + (done - toDelete));
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const PatternVideo: React.FC<{ script: PatternScript }> = ({ script }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const titleFrames = TITLE_SECONDS * fps;
  const problemFrames = PROBLEM_SECONDS * fps;
  const stepFrames = script.steps.map((step) => Math.round(step.seconds * PACE * fps));
  const stepsStart = titleFrames + problemFrames;
  const stepsTotal = stepFrames.reduce((a, b) => a + b, 0);

  // Which step are we in, and how far through its typing?
  let elapsed = frame - stepsStart;
  let index = 0;
  while (index < stepFrames.length - 1 && elapsed >= stepFrames[index]) {
    elapsed -= stepFrames[index];
    index += 1;
  }
  const inSteps = frame >= stepsStart && frame < stepsStart + stepsTotal;
  const step = script.steps[index];
  const previous = index === 0 ? '' : script.steps[index - 1].code;
  // Type over the first half of the step, then hold so it can be read.
  const typingFrames = Math.max(1, Math.round(stepFrames[index] * 0.5));
  const progress = Math.min(1, Math.max(0, elapsed / typingFrames));
  const code = typedCode(previous, step.code, progress);

  return (
    <AbsoluteFill style={{ background: theme.background, fontFamily: theme.sans }}>
      <Sequence durationInFrames={titleFrames}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, color: theme.accent, letterSpacing: 6 }}>
              GOF-PATTERNS · {script.language.toUpperCase()}
            </div>
            <div style={{ fontSize: 110, fontWeight: 700, color: theme.text, margin: '24px 0' }}>
              {script.title}
            </div>
            <div style={{ fontSize: 40, color: theme.dim, maxWidth: '80%', margin: '0 auto' }}>
              {script.subtitle}
            </div>
          </div>
        </Card>
      </Sequence>

      <Sequence from={titleFrames} durationInFrames={problemFrames}>
        <Card>
          <div style={{ width: '80%', maxWidth: 1600 }}>
            <div style={{ fontSize: 44, color: theme.bad, marginBottom: 28, fontWeight: 700 }}>
              El problema
            </div>
            <Terminal data={script.problem} startFrame={0} />
          </div>
        </Card>
      </Sequence>

      {inSteps ? (
        <AbsoluteFill style={{ padding: 60, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
            <span style={{ fontSize: 34, fontWeight: 700, color: theme.text }}>{script.title}</span>
            <span style={{ fontSize: 26, color: theme.dim }}>
              paso {index + 1} de {script.steps.length}
            </span>
          </div>

          <CodeEditor
            code={code}
            fileName={script.fileName}
            showCaret={progress < 1}
            frame={frame}
          />

          <div
            style={{
              background: theme.panel,
              borderLeft: `6px solid ${theme.accent}`,
              padding: '26px 32px',
              fontSize: 36,
              lineHeight: '52px',
              color: theme.text,
              borderRadius: 8,
              minHeight: 120,
            }}
          >
            {step.caption}
          </div>
        </AbsoluteFill>
      ) : null}

      <Sequence from={stepsStart + stepsTotal} durationInFrames={OUTCOME_SECONDS * fps}>
        <Card>
          <div style={{ width: '80%', maxWidth: 1600 }}>
            <div style={{ fontSize: 44, color: theme.good, marginBottom: 28, fontWeight: 700 }}>
              Con el patrón
            </div>
            <Terminal data={script.outcome} startFrame={0} />
          </div>
        </Card>
      </Sequence>
    </AbsoluteFill>
  );
};
