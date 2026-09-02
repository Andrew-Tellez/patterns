# videos — the pattern videos, rendered from code

[Remotion](https://remotion.dev) compositions that render an MP4 per pattern per language:
the code being typed, with the narration as on-screen captions.

There is no screen recording and no audio stream at all — `Config.setMuted(true)`, because the
narration is on screen. The video is generated from data, which is the point: fixing a typo in
a caption is an edit and a re-render, not a re-take.

```bash
cd videos
npm install
npm run studio          # preview and scrub in the browser
npm run render-all      # every composition to out/
```

One composition renders in about 20-30 seconds at 1920×1080. The first run downloads a
headless Chrome (~95 MB). `out/` is gitignored — the sources are the artefact, the MP4s are
the build output.

## What a video is made of

Each video is one `PatternScript` in `src/scripts/`. Adding a pattern is a data file, not a
component:

```ts
export const singletonTypeScript: PatternScript = {
  title: 'Singleton',
  subtitle: '…',
  language: 'TypeScript',
  fileName: 'config.ts',
  problem: { command: 'node …/before.ts', lines: [...], verdict: 'bad' },
  steps: [{ caption: 'the narration line', code: 'the file after this step', seconds: 7 }],
  outcome: { command: 'node …/after.ts', lines: [...], verdict: 'good' },
};
```

The structure is the same in every video, so the series is recognisable:

1. **Title card** — pattern, language, one line on what it is.
2. **The problem** — a terminal replaying the bug, last line in red.
3. **The steps** — the editor, with the diff between one step's `code` and the next typed on
   screen, caption underneath. Deletions animate too, so a refactor reads as a refactor.
4. **With the pattern** — the same command, last line in green.

## Two rules that keep them honest

**Terminal output is copied from a real run.** The `problem` and `outcome` lines in
`src/scripts/` are the actual stdout of the matching files in [`../examples`](../examples),
which CI executes. A video cannot claim an output the code does not produce.

**Captions come from the script.** Each `caption` is a line from the pattern's `SCRIPT.md`,
so the video and the written guide say the same thing.

## Rendering options worth knowing

```bash
# One composition
npx remotion render src/index.ts singleton-typescript out/singleton.mp4

# A single frame, to check a change without waiting for a render
npx remotion still src/index.ts singleton-typescript out/frame.png --frame=400

# Vertical, for shorts — override the composition size
npx remotion render src/index.ts singleton-typescript out/short.mp4 --height=1920 --width=1080
```

The last one reflows rather than crops, because the layout is flexbox, but the code pane gets
narrow — a vertical cut wants its own shorter snippets.

## Adding a pattern

1. Write the example first, in [`../examples`](../examples), and run it. The terminal output
   you paste here has to come from that run.
2. Add `src/scripts/<pattern>.ts` exporting one `PatternScript` per language.
3. Register it in `src/Root.tsx`.
4. `npx remotion still …` to check a frame, then render.

Keep each `code` step under about 14 lines. At video size that is what fits without shrinking
the font to something unreadable on a phone.
