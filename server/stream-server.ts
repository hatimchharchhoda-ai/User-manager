// npx tsx server/stream-server.ts

import { createServer } from "http"
import { WebSocket, WebSocketServer } from "ws"

const PORT = 8081

export type Quality = "1080p" | "720p" | "480p" | "360p"
export const QUALITIES: Quality[] = ["1080p", "720p", "480p", "360p"]

type Role = "broadcaster" | "viewer" | "pending"

interface Client {
  ws: WebSocket
  role: Role
  quality?: Quality
}

const clients = new Set<Client>()
const broadcasters = new Map<Quality, Client>()

// ─── Init segment cache ────────────────────────────────────────────────────────
// fMP4 streams start with an `empty_moov` box that tells the decoder
// the codec, resolution, timescale etc. Any viewer who joins mid-stream
// (or switches quality) must receive this before any live chunks.
//
// We collect chunks until we've seen at least INIT_CACHE_SIZE bytes —
// that's enough to always include the full moov box. After that we
// keep a small rolling window of recent chunks so a switching viewer
// can start decoding immediately without waiting for the next keyframe.

const KEYFRAME_WINDOW = 10           // keep last N chunks as "catch-up" buffer

interface QualityChannel {
  initCache: Buffer[]   // grows until INIT_CACHE_MIN_BYTES is reached, then locked
  initCacheLocked: boolean    // true once we have a complete init segment
  initCacheSize: number     // total bytes stored so far
  recentFragments: Buffer[]   // rolling window of last KEYFRAME_WINDOW chunks
  pendingMoof: Buffer | null
}

const channels = new Map<Quality, QualityChannel>()

function getChannel(quality: Quality): QualityChannel {
  if (!channels.has(quality)) {
    channels.set(quality, {
      initCache: [],
      initCacheLocked: false,
      initCacheSize: 0,
      recentFragments: [],
      pendingMoof: null,
    })
  }
  return channels.get(quality)!
}

function resetChannel(quality: Quality) {
  channels.set(quality, {
    initCache: [],
    initCacheLocked: false,
    initCacheSize: 0,
    recentFragments: [],
    pendingMoof: null,
  })
}

// Send cached init + recent chunks to a newly joined / switching viewer
function replayInitTo(ws: WebSocket, quality: Quality) {
  const ch = channels.get(quality)

  if (!ch || !ch.initCacheLocked) {
    console.log(`[replay] Init not ready for ${quality}`)
    return
  }

  // 1. ftyp + moov
  for (const box of ch.initCache) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(box)
    }
  }

  // 2. Complete moof + mdat fragments
  for (const fragment of ch.recentFragments) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(fragment)
    }
  }
}

// ─── HTTP server ───────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "*")

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "ok",
      viewers: [...clients].filter(c => c.role === "viewer").length,
      broadcasters: [...broadcasters.keys()],
      cached: Object.fromEntries(
        [...channels.entries()].map(([q, ch]) => [q, {
          initLocked: ch.initCacheLocked,
          initBytes: ch.initCacheSize,
          recentFragments: ch.recentFragments.length,
        }])
      ),
    }))
    return
  }
  res.writeHead(404)
  res.end()
})

// ─── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, verifyClient: () => true })

wss.on("connection", (ws) => {
  const client: Client = { ws, role: "pending" }
  clients.add(client)
  const reassembler = new Mp4BoxReassembler()
  console.log(`[+] Client connected. Total: ${clients.size}`)

  ws.on("message", (data, isBinary) => {

    // ── Handshake ─────────────────────────────────────────────────────────────
    if (!isBinary && client.role === "pending") {
      try {
        const msg = JSON.parse(data.toString()) as { role: Role; quality?: Quality }

        if (msg.role === "broadcaster") {
          const q = msg.quality ?? "720p"
          if (broadcasters.has(q)) {
            ws.send(JSON.stringify({ error: `Broadcaster for ${q} already connected.` }))
            ws.close()
            return
          }
          client.role = "broadcaster"
          client.quality = q
          broadcasters.set(q, client)
          resetChannel(q)   // fresh cache for new broadcast session
          console.log(`[broadcast] Broadcaster connected for quality: ${q}`)
          ws.send(JSON.stringify({ status: "ready", role: "broadcaster", quality: q }))

        } else {
          // viewer
          const q = msg.quality ?? "720p"
          client.role = "viewer"
          client.quality = q
          console.log(`[viewer] Viewer connected for quality: ${q}`)
          ws.send(JSON.stringify({
            status: "ready",
            role: "viewer",
            quality: q,
            available: [...broadcasters.keys()],
          }))

          // Replay init + recent chunks immediately so they can start decoding
          replayInitTo(ws, q)
        }

      } catch {
        ws.send(JSON.stringify({ error: "Invalid handshake." }))
        ws.close()
      }
      return
    }

    // on binary message from broadcaster:
    if (isBinary && client.role === "broadcaster") {
      const q = client.quality!
      const ch = getChannel(q)
      const rawBuf = Buffer.from(data as Buffer)

      const completeBoxes = reassembler.push(rawBuf)

      for (const box of completeBoxes) {
        const type = box.toString("ascii", 4, 8)

        // Initialization
        if (!ch.initCacheLocked) {
          ch.initCache.push(box)

          if (type === "moov") {
            ch.initCacheLocked = true
          }
        }

        // Media fragment
        else {
          if (type === "moof") {
            ch.pendingMoof = box
          }

          if (type === "mdat" && ch.pendingMoof) {
            const fragment = Buffer.concat([ch.pendingMoof, box])

            ch.recentFragments.push(fragment)

            if (ch.recentFragments.length > KEYFRAME_WINDOW) {
              ch.recentFragments.shift()
            }

            ch.pendingMoof = null
          }
        }

        // Live fanout
        for (const c of clients) {
          if (
            c.role === "viewer" &&
            c.quality === q &&
            c.ws.readyState === WebSocket.OPEN
          ) {
            c.ws.send(box)
          }
        }
      }
    }
  })

  ws.on("close", () => {
    clients.delete(client)
    if (client.role === "broadcaster" && client.quality) {
      broadcasters.delete(client.quality)
      console.log(`[broadcast] Broadcaster for ${client.quality} disconnected.`)
      // Don't reset the channel cache here — viewers might still be
      // mid-decode. Cache is reset when the broadcaster reconnects.
      for (const c of clients) {
        if (c.role === "viewer" && c.quality === client.quality && c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(JSON.stringify({ event: "stream-ended", quality: client.quality }))
        }
      }
    }
    console.log(`[-] Client disconnected. Total: ${clients.size}`)
  })

  ws.on("error", (err) => console.error("[ws error]", err.message))
})

httpServer.listen(PORT, () => {
  console.log(`\n🟢 Stream server running`)
  console.log(`   WebSocket : ws://localhost:${PORT}`)
  console.log(`   Health    : http://localhost:${PORT}/health\n`)
})


// Reassembles arbitrary stdout byte chunks into complete top-level MP4 boxes
// (ftyp, moov, moof, mdat, etc.) before they're cached or replayed.
class Mp4BoxReassembler {
  private carry = Buffer.alloc(0)

  // Feed raw bytes, get back an array of COMPLETE boxes only.
  push(chunk: Buffer): Buffer[] {
    this.carry = Buffer.concat([this.carry, chunk])
    const boxes: Buffer[] = []

    while (this.carry.length >= 8) {
      const size = this.carry.readUInt32BE(0)
      // size===1 means 64-bit size follows; size===0 means "to EOF" — treat both as "wait for more data"
      if (size === 0 || size === 1) break
      if (this.carry.length < size) break // incomplete box, wait for more bytes

      boxes.push(this.carry.subarray(0, size))
      this.carry = this.carry.subarray(size)
    }
    return boxes
  }
}