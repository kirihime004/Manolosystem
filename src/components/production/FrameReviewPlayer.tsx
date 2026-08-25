import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Play, Pause, ChevronLeft, ChevronRight, Pencil, Eraser, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getVersionMediaUrl } from "@/features/production/productionVersionsApi";
import type { AnnotationStroke, ProductionNote } from "@/types/database";

const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
const PEN_COLORS = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ffffff"];

function fileExtension(path: string): string {
  const clean = path.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

// A ShotGrid/Flow-style frame review player: frame-accurate scrubbing
// (video.currentTime = frame / fps), a draw layer for pen annotations on
// the current frame, and a note pinned to that frame + drawing. Strokes
// are stored as vector point paths in a 0..width/0..height space (not a
// baked raster), then rescaled to whatever size the player renders at.
export function FrameReviewPlayer({
  storagePath,
  fps,
  frameOffset,
  notes,
  canAnnotate,
  onCreateNote,
}: {
  storagePath: string | null;
  fps: number;
  /** The shot's own frame numbering (e.g. 1001) so frame 0 in the file displays as 1001. */
  frameOffset: number;
  notes: ProductionNote[];
  canAnnotate: boolean;
  onCreateNote: (input: { content: string; frameNumber: number; annotationData: AnnotationStroke[] | null; annotationWidth: number | null; annotationHeight: number | null }) => Promise<void>;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<[number, number][] | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);

  const isVideo = storagePath ? VIDEO_EXTENSIONS.includes(fileExtension(storagePath)) : false;
  const isImage = storagePath ? IMAGE_EXTENSIONS.includes(fileExtension(storagePath)) : false;

  useEffect(() => {
    if (!storagePath) return;
    let isMounted = true;
    getVersionMediaUrl(storagePath)
      .then((url) => { if (isMounted) setMediaUrl(url); })
      .catch((err) => { if (isMounted) setLoadError(err instanceof Error ? err.message : "Failed to load media"); });
    return () => { isMounted = false; };
  }, [storagePath]);

  const notesByFrame = useMemo(() => {
    const map = new Map<number, ProductionNote>();
    for (const n of notes) {
      if (n.frame_number != null && n.annotation_data) map.set(n.frame_number, n);
    }
    return map;
  }, [notes]);

  // The overlay for the current frame: whichever saved note lives on this
  // exact frame (read-only, shown while scrubbing), or the drawing still
  // in progress (editable, shown while actively annotating).
  const displayedNote = viewingNoteId ? notes.find((n) => n.id === viewingNoteId) : notesByFrame.get(currentFrame + frameOffset);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (s: AnnotationStroke, scaleX: number, scaleY: number) => {
      if (s.points.length < 2) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s.points[0][0] * scaleX, s.points[0][1] * scaleY);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * scaleX, y * scaleY);
      ctx.stroke();
    };

    if (drawMode) {
      for (const s of strokes) drawStroke(s, 1, 1);
      if (activeStroke) drawStroke({ color: penColor, width: 3, points: activeStroke }, 1, 1);
    } else if (displayedNote?.annotation_data && displayedNote.annotation_width && displayedNote.annotation_height) {
      const scaleX = canvas.width / displayedNote.annotation_width;
      const scaleY = canvas.height / displayedNote.annotation_height;
      for (const s of displayedNote.annotation_data) drawStroke(s, scaleX, scaleY);
    }
  };

  useEffect(redraw, [strokes, activeStroke, displayedNote, drawMode]);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw();
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl]);

  const frameFromTime = (t: number) => Math.round(t * fps);

  const seekToFrame = (frame: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(totalFrames, frame));
    if (video) video.currentTime = clamped / fps;
    setCurrentFrame(clamped);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setTotalFrames(frameFromTime(video.duration));
    resizeCanvas();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentFrame(frameFromTime(video.currentTime));
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); } else { video.pause(); setIsPlaying(false); }
  };

  const stepFrame = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    seekToFrame(currentFrame + delta);
  };

  const pointFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    setActiveStroke([pointFromEvent(e)]);
    setViewingNoteId(null);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !activeStroke) return;
    setActiveStroke((prev) => (prev ? [...prev, pointFromEvent(e)] : prev));
  };

  const handlePointerUp = () => {
    if (!drawMode || !activeStroke) return;
    if (activeStroke.length > 1) setStrokes((prev) => [...prev, { color: penColor, width: 3, points: activeStroke }]);
    setActiveStroke(null);
  };

  const clearDrawing = () => setStrokes([]);

  const handleSaveNote = async () => {
    if (!noteText.trim()) { toast.error("Write a note before saving"); return; }
    const canvas = canvasRef.current;
    setSubmitting(true);
    try {
      await onCreateNote({
        content: noteText,
        frameNumber: currentFrame + frameOffset,
        annotationData: strokes.length > 0 ? strokes : null,
        annotationWidth: strokes.length > 0 && canvas ? canvas.width : null,
        annotationHeight: strokes.length > 0 && canvas ? canvas.height : null,
      });
      toast.success("Note saved");
      setNoteText("");
      setStrokes([]);
      setDrawMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  };

  if (!storagePath) {
    return <p className="text-sm text-muted-foreground">No media file attached to this version.</p>;
  }
  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }
  if (!mediaUrl) {
    return <p className="text-sm text-muted-foreground">Loading media…</p>;
  }
  if (!isVideo && !isImage) {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Download className="h-4 w-4" /> Download {storagePath.split("/").pop()}
      </a>
    );
  }

  const frameNotes = [...notes].filter((n) => n.frame_number != null).sort((a, b) => (a.frame_number ?? 0) - (b.frame_number ?? 0));

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="h-full w-full"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <img src={mediaUrl} alt="" className="h-full w-full object-contain" onLoad={resizeCanvas} />
        )}
        <canvas
          ref={canvasRef}
          className={cn("absolute inset-0 h-full w-full", drawMode ? "cursor-crosshair" : "pointer-events-none")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {isVideo && (
        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={() => stepFrame(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" onClick={() => stepFrame(1)}><ChevronRight className="h-4 w-4" /></Button>
          <input
            type="range"
            min={0}
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => seekToFrame(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {currentFrame + frameOffset} / {totalFrames + frameOffset}
          </span>
        </div>
      )}

      {canAnnotate && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          <Button type="button" size="sm" variant={drawMode ? "default" : "outline"} onClick={() => { setDrawMode((d) => !d); setViewingNoteId(null); }}>
            <Pencil className="mr-1.5 h-4 w-4" /> {drawMode ? "Drawing" : "Draw"}
          </Button>
          {drawMode && (
            <>
              <div className="flex items-center gap-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPenColor(c)}
                    className={cn("h-5 w-5 rounded-full border-2", penColor === c ? "border-foreground" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    aria-label={`Pen color ${c}`}
                  />
                ))}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={clearDrawing} disabled={strokes.length === 0}>
                <Eraser className="mr-1.5 h-4 w-4" /> Clear
              </Button>
            </>
          )}
          <div className="flex flex-1 items-center gap-2">
            <Textarea
              rows={1}
              placeholder={`Note on frame ${currentFrame + frameOffset}…`}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-0 flex-1 resize-none py-1.5"
            />
            <Button type="button" size="sm" onClick={handleSaveNote} disabled={submitting}>Save</Button>
          </div>
        </div>
      )}

      {frameNotes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frame notes</p>
          {frameNotes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => { seekToFrame((n.frame_number ?? frameOffset) - frameOffset); setViewingNoteId(n.id); setDrawMode(false); }}
              className={cn(
                "flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                viewingNoteId === n.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <span className="shrink-0 font-mono text-muted-foreground">#{n.frame_number}</span>
              <span className="flex-1 truncate text-foreground">{n.content}</span>
              {n.annotation_data && <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
