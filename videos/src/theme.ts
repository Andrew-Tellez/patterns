/** One place for the look, so every video is recognisably the same series. */
export const theme = {
  background: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  dim: '#8b949e',
  caret: '#58a6ff',
  accent: '#58a6ff',
  bad: '#f85149',
  good: '#3fb950',
  syntax: {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    comment: '#8b949e',
    number: '#79c0ff',
    fn: '#d2a8ff',
    plain: '#e6edf3',
  },
  mono: '"SF Mono", "Menlo", "DejaVu Sans Mono", monospace',
  sans: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;
