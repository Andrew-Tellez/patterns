import React from 'react';
import { theme } from './theme';
import { tokenize } from './highlight';

/**
 * The editor pane: chrome, line numbers, highlighted code and a blinking caret at
 * the end of what has been typed so far.
 */
export const CodeEditor: React.FC<{
  code: string;
  fileName: string;
  showCaret: boolean;
  frame: number;
}> = ({ code, fileName, showCaret, frame }) => {
  const lines = code.split('\n');
  const tokensPerLine = lines.map((line) => tokenize(line));
  const caretVisible = showCaret && Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          borderBottom: `1px solid ${theme.border}`,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#f85149' }} />
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#d29922' }} />
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#3fb950' }} />
        <span style={{ marginLeft: 12 }}>{fileName}</span>
      </div>

      <div
        style={{
          flex: 1,
          padding: '24px 28px',
          fontFamily: theme.mono,
          fontSize: 30,
          lineHeight: '44px',
          whiteSpace: 'pre',
          overflow: 'hidden',
        }}
      >
        {tokensPerLine.map((tokens, lineIndex) => (
          <div key={lineIndex} style={{ display: 'flex' }}>
            <span
              style={{
                width: 60,
                color: theme.border,
                userSelect: 'none',
                flexShrink: 0,
                textAlign: 'right',
                paddingRight: 24,
              }}
            >
              {lineIndex + 1}
            </span>
            <span>
              {tokens.map((token, i) => (
                <span key={i} style={{ color: token.color }}>
                  {token.text}
                </span>
              ))}
              {lineIndex === lines.length - 1 && caretVisible ? (
                <span style={{ color: theme.caret }}>▌</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
