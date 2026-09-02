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

One composition renders in about 30 seconds at 1920×1080. The first run downloads a headless
Chrome (~95 MB). `out/` is gitignored — the sources are the artefact, the MP4s are the build
output.

**Every composition is 1920×1080, on purpose.** Two things go wrong otherwise. A frame
narrower than the layout clips it, and because flexbox centring spills overflow to the left,
the clip lands on the *start* of every line — which is exactly how the first README GIF came
out with its first few characters cut off. And a smaller frame does not rescale the type, it
just fits less. So render at 1080p and use `--scale` to shrink the output: it scales the
rendering, not the layout, so nothing reflows.

**Pace lives in one constant.** `PACE` in `PatternVideo.tsx` multiplies every step's
`seconds`, and typing takes the first half of a step with the rest held for reading. Slowing
the whole series down is one number, not twenty edits.

## Rendered so far

Committed to [`../docs/videos`](../docs/videos), so GitHub can serve them:

| Video | Language | Length | What it argues |
| --- | --- | --- | --- |
| [singleton-typescript.mp4](../docs/videos/singleton-typescript.mp4) | TypeScript | 71s | One lazy shared instance, and why `reset()` saves your tests |
| [singleton-python.mp4](../docs/videos/singleton-python.mp4) | Python | 63s | The same, and when `functools.cache` is the better answer |
| [singleton-kotlin.mp4](../docs/videos/singleton-kotlin.mp4) | Kotlin | 67s | Eleven lines of hand-rolled ceremony against three, and why the Kotlin package ships no helper |
| [singleton-csharp.mp4](../docs/videos/singleton-csharp.mp4) | C# | 65s | The same, against `Lazy<T>` |
| [singleton-go.mp4](../docs/videos/singleton-go.mp4) | Go | 65s | The same, against `sync.OnceValue`, plus goroutine safety |
| [singleton-readme.gif](../docs/videos/singleton-readme.gif) | TypeScript | 34s | The short cut embedded in the READMEs |

**Why a GIF for the README.** GitHub does not play an `.mp4` referenced by a repository path —
it renders a link, and the file only gets a player in GitHub's own file viewer. An animated GIF
plays inline everywhere, including npm, PyPI and NuGet, which is why the front page embeds
`singleton-readme.gif` (472 KB) and links the MP4s.

**A note on scale.** Six megabytes of video in git is fine. A hundred and ten of them —
22 patterns times five languages — is not. When the count grows, move the MP4s to a GitHub
release and point the READMEs at the release URLs; the compositions stay the source of truth
either way.

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
