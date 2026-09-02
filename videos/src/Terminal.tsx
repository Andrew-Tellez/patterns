import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from './theme';
import type { Terminal as TerminalData } from './types';

/** The terminal pane. Lines appear one at a time, so the output is readable. */
export const Terminal: React.FC<{ data: TerminalData; startFrame?: number }> = ({
  data,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame() - startFrame;
  const revealed = Math.max(0, Math.min(data.lines.length, Math.floor(frame / 12)));

  return (
    <div
      style={{
        background: '#010409',
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: '40px 44px',
        fontFamily: theme.mono,
        fontSize: 40,
        lineHeight: '62px',
        color: theme.text,
        whiteSpace: 'pre-wrap',
      }}
    >
      <div style={{ color: theme.dim }}>
        <span style={{ color: theme.good }}>$ </span>
        {data.command}
      </div>
      {data.lines.slice(0, revealed).map((line, i) => {
        const isLast = i === data.lines.length - 1;
        return (
          <div
            key={i}
            style={{
              color: isLast ? (data.verdict === 'bad' ? theme.bad : theme.good) : theme.text,
              fontWeight: isLast ? 600 : 400,
              opacity: interpolate(frame - i * 12, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
