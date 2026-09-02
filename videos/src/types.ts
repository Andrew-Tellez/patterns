/** A step is one thing you type on screen, plus the line said while typing it. */
export type Step = {
  /** The caption shown at the bottom — the narration line, verbatim. */
  caption: string;
  /** What the file looks like *after* this step. The diff is what gets typed. */
  code: string;
  /** Seconds for this step: typing plus the pause to read it. */
  seconds: number;
};

export type Terminal = {
  /** The command, shown as it would be run. */
  command: string;
  /** The output lines. */
  lines: string[];
  /** Colours the last line: the bug (red) or the fix (green). */
  verdict: 'bad' | 'good';
};

export type PatternScript = {
  /** Pattern name, as it appears in the catalog. */
  title: string;
  /** One line saying what the video is about. */
  subtitle: string;
  language: 'TypeScript' | 'Python';
  /** The file name shown in the editor chrome. */
  fileName: string;
  /** The terminal that opens the video: the bug reproducing. */
  problem: Terminal;
  steps: Step[];
  /** The terminal that closes it: the same command, fixed. */
  outcome: Terminal;
};
