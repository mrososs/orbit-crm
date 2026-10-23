/**
 * Frame-accurate capture via the Chrome DevTools screencast, assembled into a
 * constant-frame-rate H.264 MP4 with FFmpeg (variable frame timing preserved).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
export const FFMPEG = require('ffmpeg-static');

export async function startRecording(page, dir, { width, height, quality = 92 }) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const client = await page.context().newCDPSession(page);
  const frames = [];
  let writing = Promise.resolve();
  let index = 0;

  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    const file = join(dir, `f${String(index++).padStart(6, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    writing = writing.then(() => writeFile(file, Buffer.from(data, 'base64')));
  });

  await client.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  const started = Date.now() / 1000;

  return {
    started,
    async stop() {
      const end = Date.now() / 1000;
      await client.send('Page.stopScreencast');
      await writing;
      await client.detach().catch(() => undefined);
      return { frames, end };
    },
  };
}

/** Builds a concat list honouring real frame timing, then encodes CFR H.264. */
export function encode({ frames, end }, out, { width, height, fps = 30, crf = 18, trimStart = 0 }) {
  if (frames.length === 0) throw new Error('No frames captured');
  const start = frames[0].t + trimStart;
  const usable = frames.filter((f, i) => i === frames.length - 1 || frames[i + 1].t > start);
  const lines = [];
  usable.forEach((frame, i) => {
    const next = usable[i + 1]?.t ?? end;
    const duration = Math.max(1 / 1000, next - Math.max(frame.t, start));
    lines.push(`file '${frame.file.replace(/\\/g, '/')}'`, `duration ${duration.toFixed(4)}`);
  });
  lines.push(`file '${usable.at(-1).file.replace(/\\/g, '/')}'`);
  const list = `${out}.frames.txt`;
  writeFileSync(list, lines.join('\n'));

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${width}:${height}:flags=lanczos,fps=${fps},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-level', '4.1',
    '-r', String(fps), '-movflags', '+faststart', '-an', out,
  ];
  const result = spawnSync(FFMPEG, args, { stdio: 'inherit' });
  rmSync(list, { force: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed with code ${result.status}`);
}

/** Returns duration, size, codec and frame rate of an encoded file. */
export function probe(file) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const text = result.stderr;
  const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(text);
  const video = /Video: (\w+).*?, (\d+)x(\d+).*?, ([\d.]+) fps/.exec(text);
  return {
    seconds: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : NaN,
    codec: video?.[1],
    width: Number(video?.[2]),
    height: Number(video?.[3]),
    fps: Number(video?.[4]),
  };
}
