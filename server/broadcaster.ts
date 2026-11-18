// npx tsx server/broadcaster.ts

import { spawn } from "child_process"
import type { ChildProcessWithoutNullStreams } from "child_process"
import { exit } from "process"
import { WebSocket } from "ws"

const WS_URL = "ws://localhost:8081"
const INPUT_FILE = "C:/Users/hatim.chharchhoda/Videos/demo3.mp4"
const FFMPEG_PATH = "C:/Users/hatim.chharchhoda/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe"

// ── Quality profiles ──────────────────────────────────────────────────────────

type Quality = "1080p" | "720p" | "480p" | "360p"

interface QualityProfile {
  label: Quality
  width: number
  height: number
  videoBitrate: string
  audioBitrate: string
}

const QUALITY_PROFILES: QualityProfile[] = [
  { label: "1080p", width: 1920, height: 1080, videoBitrate: "4000k", audioBitrate: "192k" },
  { label: "720p", width: 1280, height: 720, videoBitrate: "2500k", audioBitrate: "128k" },
  { label: "480p", width: 854, height: 480, videoBitrate: "1000k", audioBitrate: "96k" },
  { label: "360p", width: 640, height: 360, videoBitrate: "600k", audioBitrate: "64k" },
]

// ── Build ffmpeg args for a quality profile ───────────────────────────────────

function buildArgs(profile: QualityProfile): string[] {
  return [
    "-re",
    "-stream_loop", "-1",
    "-i", INPUT_FILE,

    // Video
    "-c:v", "libx264",
    "-preset", "faster",
    "-tune", "zerolatency",
    "-b:v", profile.videoBitrate,
    "-maxrate", profile.videoBitrate,
    "-bufsize", `${parseInt(profile.videoBitrate) * 2}k`,
    "-vf", `scale=${profile.width}:${profile.height}`,
    "-g", "30",
    "-keyint_min", "30",
    "-sc_threshold", "0",
    "-bf", "0",

    // Audio
    "-c:a", "aac",
    "-b:a", profile.audioBitrate,
    "-ar", "44100",

    // fMP4 output
    "-f", "mp4",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",

    "pipe:1",
  ]
}

// ── Spawn one broadcaster per quality ─────────────────────────────────────────

function startQualityStream(profile: QualityProfile) {
  const ws = new WebSocket(WS_URL)
  ws.binaryType = "arraybuffer"

  ws.on("open", () => {
    console.log(`[${profile.label}] Connected — sending handshake.`)
    ws.send(JSON.stringify({ role: "broadcaster", quality: profile.label }))
  })

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as { status?: string; error?: string }
    if (msg.error) {
      console.error(`[${profile.label}] Server error: ${msg.error}`)
      ws.close()
      return
    }
    if (msg.status === "ready") {
      console.log(`[${profile.label}] Handshake complete — spawning ffmpeg.`)
      startFfmpeg(profile, ws)
    }
  })

  ws.on("error", (err) => console.error(`[${profile.label}] WS error:`, err.message))

  ws.on("close", () => {
    console.log(`[${profile.label}] WS closed — restarting in 3s…`)
    setTimeout(() => startQualityStream(profile), 3000)
  })
}

function startFfmpeg(profile: QualityProfile, ws: WebSocket) {
  let ffmpeg: ChildProcessWithoutNullStreams

  const spawn_ = () => {
    console.log(`[${profile.label}] Spawning ffmpeg…`)
    ffmpeg = spawn(FFMPEG_PATH, buildArgs(profile))

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
    })

    ffmpeg.stderr.on("data", (d: Buffer) => {
      // Only log errors, not progress
      const line = d.toString()
      if (line.includes("Error") || line.includes("error")) {
        process.stderr.write(`[${profile.label}] ${line}`)
      }
    })

    ffmpeg.on("close", (code) => {
      console.log(`[${profile.label}] ffmpeg exited (${code}) — restarting…`)
      if (ws.readyState === WebSocket.OPEN) spawn_()
    })
  }

  spawn_()

  process.on("SIGINT", () => {
    ffmpeg?.kill("SIGTERM")
    ws.close()
  })
}

// ── Start all quality streams ─────────────────────────────────────────────────

console.log("🎬 Starting broadcaster for all quality levels…\n")
for (const profile of QUALITY_PROFILES) {
  // Stagger starts by 500ms to avoid hammering the server
  setTimeout(() => startQualityStream(profile), QUALITY_PROFILES.indexOf(profile) * 500)
}