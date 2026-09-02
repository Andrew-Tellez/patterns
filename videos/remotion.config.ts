import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
// 1920x1080 at 30fps is set per composition in src/Root.tsx.
Config.setOverwriteOutput(true);
// No audio track at all. Remotion adds a silent AAC stream by default; the videos
// carry their narration as captions, so the stream is dead weight.
Config.setMuted(true);
