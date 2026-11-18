import { useCallback, useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"

import {
  VideoPlayer, VideoPlayerContent, VideoPlayerControlBar,
  VideoPlayerMuteButton, VideoPlayerPlayButton,
  VideoPlayerSeekBackwardButton, VideoPlayerSeekForwardButton,
  VideoPlayerTimeDisplay, VideoPlayerTimeRange, VideoPlayerVolumeRange,
} from "@/components/kibo-ui/video-player"

import {
  AlertCircle, CheckCircle2, Gauge, Info, Loader2,
  Radio, RefreshCw, Signal, SignalHigh, SignalLow,
  Tv, Wifi, WifiOff,
} from "lucide-react"

// ─── Config ───────────────────────────────────────────────────────────────────
const WS_URL = "ws://localhost:8081"
const MIME_TYPE = 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"'

const AUTO_THRESHOLDS = { "1080p": 400_000, "720p": 200_000, "480p": 80_000, "360p": 0 } as const

type Quality = "1080p" | "720p" | "480p" | "360p"
type QualityOption = Quality | "auto"
type Status = "disconnected" | "connecting" | "handshake" | "live" | "ended" | "error"

const QUALITY_OPTIONS: { value: QualityOption; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
]

interface LogEntry { id: number; time: string; level: "info" | "warn" | "error" | "success"; message: string }
let logId = 0
const makeLog = (level: LogEntry["level"], message: string): LogEntry =>
  ({ id: ++logId, time: new Date().toLocaleTimeString(), level, message })

const pickQuality = (bps: number): Quality =>
  bps >= AUTO_THRESHOLDS["1080p"] ? "1080p"
    : bps >= AUTO_THRESHOLDS["720p"] ? "720p"
      : bps >= AUTO_THRESHOLDS["480p"] ? "480p"
        : "360p"

// ─── Component ────────────────────────────────────────────────────────────────
export function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // MediaSource lives for the entire lifetime of the component.
  // We NEVER recreate it — only reset the SourceBuffer on quality switch.
  const msRef = useRef<MediaSource | null>(null)
  const sbRef = useRef<SourceBuffer | null>(null)
  const queue = useRef<ArrayBuffer[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // Session counter: incremented on every connectToQuality call.
  // All async callbacks capture their session at creation time and
  // bail out if sessionRef.current has moved on.
  const sessionRef = useRef(0)

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const bytesWindow = useRef(0)
  const activeQRef = useRef<Quality>("720p")
  const selectedQRef = useRef<QualityOption>("auto")

  const [status, setStatus] = useState<Status>("disconnected")
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>("auto")
  const [activeQuality, setActiveQuality] = useState<Quality>("720p")
  const [bytesReceived, setBytesReceived] = useState(0)
  const [chunkCount, setChunkCount] = useState(0)
  const [bandwidth, setBandwidth] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [showDebug, setShowDebug] = useState(false)

  const addLog = useCallback((level: LogEntry["level"], msg: string) =>
    setLogs(p => [makeLog(level, msg), ...p].slice(0, 100)), [])

  // ── flush ─────────────────────────────────────────────────────────────────
  // Always reads from refs — never captured in a stale closure.
  const flush = useCallback(() => {
    const sb = sbRef.current
    if (!sb || sb.updating || queue.current.length === 0) return
    if (videoRef.current?.error) { queue.current = []; return }
    try { sb.appendBuffer(queue.current.shift()!) }
    catch (e) { addLog("warn", `appendBuffer: ${e}`) }
  }, [addLog])

  // ── initMediaSourceOnce ──────────────────────────────────────────────────
  const initMediaSourceOnce = useCallback((session: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = videoRef.current
      if (!video) { addLog("error", "videoRef null"); resolve(false); return }

      if (!MediaSource.isTypeSupported(MIME_TYPE)) {
        addLog("error", `MIME not supported: ${MIME_TYPE}`)
        resolve(false); return
      }

      // ── Tear down old SourceBuffer ──────────────────────────────────────────
      const oldMs = msRef.current

      // ── Tear down old MediaSource ───────────────────────────────────────────
      if (oldMs) {
        // Null out the ref BEFORE removing listeners so any in-flight
        // event that fires during teardown hits a null ref and returns early
        msRef.current = null
        try { oldMs.removeEventListener("sourceopen", () => { }) } catch { /* ignore */ }
        try { oldMs.removeEventListener("sourceended", () => { }) } catch { /* ignore */ }
        try { oldMs.removeEventListener("sourceclosed", () => { }) } catch { /* ignore */ }
        if (oldMs.readyState === "open") {
          try { oldMs.endOfStream() } catch { /* ignore */ }
        }
      }

      // ── Detach from video ───────────────────────────────────────────────────
      video.pause()
      if (video.src) {
        try { URL.revokeObjectURL(video.src) } catch { /* ignore */ }
        video.removeAttribute("src")
      }
      queue.current = []

      // ── Small gap so browser finishes processing the old teardown ───────────
      setTimeout(() => {
        if (sessionRef.current !== session) { resolve(false); return }

        const ms = new MediaSource()
        msRef.current = ms

        // ── Named handlers so we can remove them precisely ──────────────────
        const onSourceEnded = () => {
          if (msRef.current !== ms) return   // stale — a newer MS exists
          addLog("info", "MediaSource ended.")
        }
        const onSourceClosed = () => {
          if (msRef.current !== ms) return
          addLog("warn", "MediaSource closed.")
        }
        const onSourceOpen = () => {
          // Clean up this one-time listener
          ms.removeEventListener("sourceopen", onSourceOpen)
          ms.removeEventListener("sourceended", onSourceEnded)
          ms.removeEventListener("sourceclosed", onSourceClosed)

          if (sessionRef.current !== session || msRef.current !== ms) {
            resolve(false); return
          }
          addLog("info", "MediaSource open.")

          try {
            const sb = ms.addSourceBuffer(MIME_TYPE)
            sbRef.current = sb
            let started = false

            // ── Named SourceBuffer handlers ─────────────────────────────────
            const onUpdateEnd = () => {
              // Bail if this sb has been superseded
              if (sbRef.current !== sb) return
              if (sessionRef.current !== session) return

              const video = videoRef.current
              if (video && video.buffered.length > 0) {
                const end = video.buffered.end(video.buffered.length - 1)
                const start = video.buffered.start(0)
                if (!started && end - start >= 1.5) {
                  started = true
                  video.currentTime = end - 0.5
                  video.play().catch(() => addLog("warn", "Autoplay blocked."))
                  addLog("success", `Playback started (${(end - start).toFixed(1)}s buffered).`)
                }
              }
              flush()
            }

            const onSbError = (e: Event) => {
              if (sbRef.current !== sb) return   // stale
              const v = videoRef.current
              addLog("error",
                `SourceBuffer error — ms.readyState=${msRef.current?.readyState}, ` +
                `video.error=${v?.error ? `${v.error.code}:${v.error.message}` : "none"}, ` +
                `buffered=${v && v.buffered.length ? `${v.buffered.start(0).toFixed(2)}-${v.buffered.end(v.buffered.length-1).toFixed(2)}` : "empty"}`
              )
            }

            sb.addEventListener("updateend", onUpdateEnd)
            sb.addEventListener("error", onSbError)

            addLog("info", `SourceBuffer ready for session ${session}.`)
            resolve(true)
          } catch (e) {
            addLog("error", `addSourceBuffer: ${e}`)
            resolve(false)
          }
        }

        ms.addEventListener("sourceopen", onSourceOpen)
        ms.addEventListener("sourceended", onSourceEnded)
        ms.addEventListener("sourceclosed", onSourceClosed)

        // Attach to video — triggers sourceopen
        video.src = URL.createObjectURL(ms)
        video.load()
      }, 80)  // 80ms gap is enough for the browser to process old MS teardown
    })
  }, [addLog, flush])

  // ── closeWS ───────────────────────────────────────────────────────────────
  const closeWS = useCallback(() => {
    const ws = wsRef.current
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    wsRef.current = null
  }, [])

  // ── connectToQuality ──────────────────────────────────────────────────────────
  const connectToQuality = useCallback(async (quality: Quality) => {
    const session = ++sessionRef.current
    addLog("info", `→ Connecting to ${quality} (session ${session})`)

    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
    if (autoTimer.current) { clearInterval(autoTimer.current); autoTimer.current = null }
    closeWS()

    activeQRef.current = quality
    setActiveQuality(quality)
    setStatus("connecting")
    setBytesReceived(0)
    setChunkCount(0)
    setBandwidth(0)
    bytesWindow.current = 0
    queue.current = []

    // Always do a full MediaSource reset — avoids ended/closed state issues
    const ok = await initMediaSourceOnce(session)
    if (!ok || sessionRef.current !== session) {
      addLog("warn", `Session ${session} aborted.`)
      return
    }

    const ws = new WebSocket(WS_URL)
    ws.binaryType = "arraybuffer"
    wsRef.current = ws

    ws.onopen = () => {
      if (sessionRef.current !== session) { ws.close(); return }
      setStatus("handshake")
      addLog("info", `WS open — requesting ${quality}`)
      ws.send(JSON.stringify({ role: "viewer", quality }))
    }

    ws.onmessage = (ev) => {
      if (sessionRef.current !== session) return

      if (typeof ev.data === "string") {
        try {
          const msg = JSON.parse(ev.data) as {
            status?: string; role?: string; event?: string; error?: string
          }
          if (msg.status === "ready" && msg.role === "viewer") {
            setStatus("live"); addLog("success", `Live at ${quality}.`); return
          }
          if (msg.event === "stream-ended") {
            setStatus("ended"); addLog("warn", "Stream ended."); return
          }
          if (msg.error) {
            addLog("error", `Server: ${msg.error}`); setStatus("error"); return
          }
        } catch { addLog("warn", `Unknown frame: ${ev.data}`) }
        return
      }

      const chunk = ev.data as ArrayBuffer
      bytesWindow.current += chunk.byteLength
      setBytesReceived(b => b + chunk.byteLength)
      setChunkCount(c => c + 1)
      queue.current.push(chunk)
      flush()
    }

    ws.onerror = () => {
      if (sessionRef.current !== session) return
      addLog("error", "WS error."); setStatus("error")
    }

    ws.onclose = () => {
      if (sessionRef.current !== session) return
      addLog("warn", "WS closed.")
      setStatus(s => s === "ended" ? "ended" : "disconnected")
      if (autoReconnect) {
        addLog("info", "Reconnecting in 3s…")
        reconnectTimer.current = setTimeout(
          () => connectToQuality(activeQRef.current), 3000)
      }
    }
  }, [addLog, autoReconnect, closeWS, flush, initMediaSourceOnce])

  // ── connect (public) ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const q: Quality = selectedQRef.current === "auto" ? "720p" : selectedQRef.current
    connectToQuality(q)
  }, [connectToQuality])

  // ── disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    ++sessionRef.current   // invalidate all callbacks
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
    if (autoTimer.current) { clearInterval(autoTimer.current); autoTimer.current = null }
    closeWS()
    queue.current = []
    setStatus("disconnected")
    addLog("info", "Disconnected.")
  }, [addLog, closeWS])

  // ── handleQualityChange ───────────────────────────────────────────────────
  const handleQualityChange = useCallback((value: QualityOption) => {
    selectedQRef.current = value
    setSelectedQuality(value)
    if (status === "live" || status === "connecting" || status === "handshake") {
      const q: Quality = value === "auto" ? activeQRef.current : value
      connectToQuality(q)
    }
  }, [status, connectToQuality])

  // ── Auto quality ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedQuality !== "auto" || status !== "live") return
    autoTimer.current = setInterval(() => {
      const bps = bytesWindow.current / 3
      bytesWindow.current = 0
      setBandwidth(Math.round(bps / 1024))
      const ideal = pickQuality(bps)
      if (ideal !== activeQRef.current) {
        addLog("info", `Auto: ${Math.round(bps / 1024)} KB/s → ${ideal}`)
        connectToQuality(ideal)
      }
    }, 3000)
    return () => { if (autoTimer.current) { clearInterval(autoTimer.current); autoTimer.current = null } }
  }, [selectedQuality, status, connectToQuality, addLog])

  useEffect(() => {
    let cancelled = false
    // Pass session 0 — just to open the MediaSource; connect() will do session 1
    // initMediaSourceOnce(0).then((ok) => {
    //   if (!cancelled && ok) connect()
    // }).catch(e => addLog("error", `Init failed: ${e}`))
    if(!cancelled) connect()
      
    return () => {
      cancelled = true
      ++sessionRef.current
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (autoTimer.current) clearInterval(autoTimer.current)
      closeWS()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isLive = status === "live"
  const canConnect = ["disconnected", "error", "ended"].includes(status)

  const badgeMap: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    disconnected: { label: "Disconnected", variant: "outline" },
    connecting: { label: "Connecting…", variant: "secondary" },
    handshake: { label: "Handshake…", variant: "secondary" },
    live: { label: "● LIVE", variant: "default" },
    ended: { label: "Stream Ended", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
  }
  const badge = badgeMap[status]

  const fmtBytes = (b: number) =>
    b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(2)} MB`

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tv className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Live Stream</h1>
              <p className="text-sm text-muted-foreground">WebSocket → MediaSource viewer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={badge.variant} className="gap-1.5">
              {status === "live" ? <Signal className="h-3.5 w-3.5" />
                : status === "connecting" || status === "handshake" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : status === "error" ? <AlertCircle className="h-3.5 w-3.5" />
                    : status === "ended" ? <SignalLow className="h-3.5 w-3.5" />
                      : <WifiOff className="h-3.5 w-3.5" />}
              {badge.label}
            </Badge>
            {canConnect
              ? <Button size="sm" onClick={connect}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Connect</Button>
              : <Button size="sm" variant="outline" onClick={disconnect}><WifiOff className="h-3.5 w-3.5 mr-1.5" />Disconnect</Button>}
          </div>
        </div>

        {/* Alerts */}
        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection failed</AlertTitle>
            <AlertDescription>
              Cannot reach <code className="text-xs">{WS_URL}</code>.
              Run: <code className="text-xs">npx tsx server/stream-server.ts</code>
            </AlertDescription>
          </Alert>
        )}
        {status === "ended" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Stream ended</AlertTitle>
            <AlertDescription>Broadcaster disconnected. Click Connect to wait for the next stream.</AlertDescription>
          </Alert>
        )}

        {/* Video — always mounted */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video bg-black">
              <VideoPlayer className="w-full h-full">
                <VideoPlayerContent ref={videoRef} slot="media" playsInline />
                <VideoPlayerControlBar>
                  <VideoPlayerPlayButton />
                  <VideoPlayerSeekBackwardButton seekOffset={10} />
                  <VideoPlayerSeekForwardButton seekOffset={10} />
                  <VideoPlayerTimeRange />
                  <VideoPlayerTimeDisplay />
                  <VideoPlayerMuteButton />
                  <VideoPlayerVolumeRange />
                </VideoPlayerControlBar>
              </VideoPlayer>

              {!isLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black z-10 pointer-events-none">
                  {status === "connecting" || status === "handshake" ? (
                    <><Loader2 className="h-10 w-10 text-white/40 animate-spin" /><p className="text-white/40 text-sm">Waiting for stream…</p></>
                  ) : (
                    <><Radio className="h-10 w-10 text-white/20" /><p className="text-white/30 text-sm">No stream</p></>
                  )}
                </div>
              )}

              {isLive && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-1 rounded-full pointer-events-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />LIVE
                </div>
              )}

              {isLive && (
                <div className="absolute bottom-12 right-3 z-20 bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded pointer-events-none">
                  {selectedQuality === "auto" ? `Auto · ${activeQuality}` : activeQuality}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><SignalHigh className="h-3.5 w-3.5" />Data received</div>
            <p className="text-2xl font-bold">{fmtBytes(bytesReceived)}</p>
            <p className="text-xs text-muted-foreground mt-1">{chunkCount} chunks</p>
          </CardContent></Card>

          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Gauge className="h-3.5 w-3.5" />Bandwidth</div>
            <p className="text-2xl font-bold">{bandwidth > 0 ? `${bandwidth} KB/s` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedQuality === "auto" ? "Measured every 3s" : "Manual mode"}</p>
          </CardContent></Card>

          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Wifi className="h-3.5 w-3.5" />Server</div>
            <p className="text-sm font-mono font-medium break-all">{WS_URL}</p>
            <p className="text-xs text-muted-foreground mt-1">fMP4 · H.264 + AAC</p>
          </CardContent></Card>

          <Card><CardContent className="pt-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quality</Label>
              <Select value={selectedQuality} onValueChange={v => handleQualityChange(v as QualityOption)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}{o.value === "auto" && <span className="ml-1.5 text-muted-foreground text-xs">(adaptive)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="ar" className="text-sm">Auto-reconnect</Label>
              <Switch id="ar" checked={autoReconnect} onCheckedChange={setAutoReconnect} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dbg" className="text-sm">Debug log</Label>
              <Switch id="dbg" checked={showDebug} onCheckedChange={setShowDebug} />
            </div>
          </CardContent></Card>
        </div>

        {/* Debug log */}
        {showDebug && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connection Log</CardTitle>
              <CardDescription className="text-xs">Last 100 events</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-56 px-4">
                <div className="space-y-1 py-2 font-mono">
                  {logs.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No events yet.</p>}
                  {logs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-xs">
                      <span className="text-muted-foreground shrink-0 w-20">{log.time}</span>
                      <span className={log.level === "error" ? "text-destructive shrink-0" : log.level === "warn" ? "text-yellow-500 shrink-0" : log.level === "success" ? "text-green-500 shrink-0" : "text-muted-foreground shrink-0"}>
                        {log.level === "success" ? <CheckCircle2 className="h-3 w-3 inline" /> : log.level === "error" ? <AlertCircle className="h-3 w-3 inline" /> : log.level === "warn" ? <AlertCircle className="h-3 w-3 inline" /> : <Info className="h-3 w-3 inline" />}
                      </span>
                      <span className="text-foreground/80">{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}

export default StreamPage