import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DemoScenario, VideoInspection } from "./types.js";
import { commandExists, run } from "./utils.js";

interface ProbeResult {
  streams: Array<{
    codec_type: "video" | "audio" | string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
  }>;
  format: { duration?: string };
}

export async function doctorBinaries() {
  await commandExists("ffmpeg");
  await commandExists("ffprobe");
}

export async function inspectVideo(path: string): Promise<VideoInspection> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate:format=duration",
    "-of",
    "json",
    path,
  ]);
  const probe = JSON.parse(stdout) as ProbeResult;
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) throw new Error(`No video stream found in ${path}`);
  return {
    path,
    duration: Number(probe.format.duration ?? 0),
    width: video.width,
    height: video.height,
    fps: parseRate(video.avg_frame_rate || video.r_frame_rate || "0/1"),
    videoCodec: video.codec_name ?? "unknown",
    hasAudio: probe.streams.some((stream) => stream.codec_type === "audio"),
  };
}

export async function composeFinal(rawTake: string, outputPath: string, scenario: DemoScenario) {
  const format = scenario.format ?? {};
  const width = format.width ?? 1080;
  const height = format.height ?? 1350;
  const fps = format.fps ?? 30;
  await mkdir(dirname(outputPath), { recursive: true });
  const filter =
    format.crop === "fit"
      ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p`
      : `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=28:1,eq=brightness=-0.22:saturation=0.85[bg];[0:v]scale=${Math.round(width * 0.52)}:${Math.round(height * 0.898)}:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${fps},format=yuv420p[v]`;

  const args =
    format.crop === "fit"
      ? [
          "-i",
          rawTake,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
          "-vf",
          filter,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
        ]
      : [
          "-i",
          rawTake,
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
          "-filter_complex",
          filter,
          "-map",
          "[v]",
          "-map",
          "1:a:0",
        ];

  await run("ffmpeg", [
    ...args,
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-shortest",
    "-y",
    outputPath,
  ]);
}

export async function generateFrameSheet(videoPath: string, frameSheetPath: string) {
  await mkdir(dirname(frameSheetPath), { recursive: true });
  await run("ffmpeg", [
    "-i",
    videoPath,
    "-vf",
    "fps=1/2,scale=216:-1,tile=5x6:padding=8:margin=8:color=white",
    "-frames:v",
    "1",
    "-y",
    frameSheetPath,
  ]);
}

export function assertVideoMatches(inspection: VideoInspection, scenario: DemoScenario) {
  const format = scenario.format ?? {};
  const expectedWidth = format.width ?? 1080;
  const expectedHeight = format.height ?? 1350;
  const expectedFps = format.fps ?? 30;
  if (inspection.width !== expectedWidth || inspection.height !== expectedHeight) {
    throw new Error(`Expected ${expectedWidth}x${expectedHeight}, got ${inspection.width}x${inspection.height}`);
  }
  if (Math.abs(inspection.fps - expectedFps) > 0.2) {
    throw new Error(`Expected ${expectedFps}fps, got ${inspection.fps.toFixed(2)}fps`);
  }
  const duration = format.duration;
  if (duration?.min !== undefined && inspection.duration < duration.min) {
    throw new Error(`Expected duration >= ${duration.min}s, got ${inspection.duration.toFixed(2)}s`);
  }
  if (duration?.max !== undefined && inspection.duration > duration.max) {
    throw new Error(`Expected duration <= ${duration.max}s, got ${inspection.duration.toFixed(2)}s`);
  }
}

function parseRate(rate: string) {
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return 0;
  return num / den;
}

export function defaultOutputPath(root: string, scenario: DemoScenario) {
  return resolve(root, scenario.output ?? `dist/demo/${scenario.name}.mp4`);
}
