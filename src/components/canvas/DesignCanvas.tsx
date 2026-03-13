'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { CanvasAnnotation, CanvasToolType, CanvasStroke, CanvasTextAnnotation, CanvasArrow, CanvasCircle } from '@/types/mockup';

interface DesignCanvasProps {
  backgroundImage?: string;
  mode: 'annotate' | 'edit';
  onAnnotationsChange?: (annotations: CanvasAnnotation[]) => void;
  onExportImage?: (dataUrl: string) => void;
  className?: string;
}

const COLORS = ['#ff3333', '#3388ff', '#33cc33', '#000000', '#ffffff', '#ffcc00'];
const uid = () => `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export default function DesignCanvas({ backgroundImage, mode, onAnnotationsChange, onExportImage, className }: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<CanvasToolType>('pen');
  const [color, setColor] = useState('#ff3333');
  const [lineWidth, setLineWidth] = useState(3);
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [circleCenter, setCircleCenter] = useState<{ x: number; y: number } | null>(null);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');

  const W = 640;
  const H = 960;

  // Load background image
  useEffect(() => {
    if (!backgroundImage) { bgImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { bgImgRef.current = img; redraw(); };
    img.src = backgroundImage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImage]);

  // Redraw everything
  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Background
    if (bgImgRef.current) {
      const img = bgImgRef.current;
      const scale = Math.min(W / img.width, H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff20';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Draw your design here', W / 2, H / 2);
    }

    // Draw all annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann);
    }
  }, [annotations]);

  useEffect(() => { redraw(); }, [redraw]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: CanvasAnnotation) => {
    ctx.save();
    if (ann.tool === 'pen') {
      const s = ann as CanvasStroke;
      if (s.points.length < 2) { ctx.restore(); return; }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    } else if (ann.tool === 'text') {
      const t = ann as CanvasTextAnnotation;
      ctx.font = `bold ${t.fontSize}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = 'left';
      // Background for readability
      const metrics = ctx.measureText(t.text);
      ctx.fillStyle = '#00000088';
      ctx.fillRect(t.x - 2, t.y - t.fontSize, metrics.width + 4, t.fontSize + 4);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    } else if (ann.tool === 'arrow') {
      const a = ann as CanvasArrow;
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.lineWidth;
      ctx.beginPath();
      ctx.moveTo(a.from.x, a.from.y);
      ctx.lineTo(a.to.x, a.to.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(a.to.y - a.from.y, a.to.x - a.from.x);
      const headLen = 12;
      ctx.beginPath();
      ctx.moveTo(a.to.x, a.to.y);
      ctx.lineTo(a.to.x - headLen * Math.cos(angle - 0.4), a.to.y - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(a.to.x - headLen * Math.cos(angle + 0.4), a.to.y - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    } else if (ann.tool === 'circle') {
      const c = ann as CanvasCircle;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.lineWidth;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Get canvas-relative coordinates
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);

    if (tool === 'pen') {
      setIsDrawing(true);
      setCurrentPoints([pos]);
    } else if (tool === 'text') {
      setTextPos(pos);
      setTextInput('');
    } else if (tool === 'arrow') {
      if (!arrowStart) {
        setArrowStart(pos);
      } else {
        const newAnn: CanvasArrow = { id: uid(), tool: 'arrow', from: arrowStart, to: pos, color, lineWidth };
        updateAnnotations([...annotations, newAnn]);
        setArrowStart(null);
      }
    } else if (tool === 'circle') {
      if (!circleCenter) {
        setCircleCenter(pos);
      } else {
        const dx = pos.x - circleCenter.x;
        const dy = pos.y - circleCenter.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const newAnn: CanvasCircle = { id: uid(), tool: 'circle', center: circleCenter, radius, color, lineWidth };
        updateAnnotations([...annotations, newAnn]);
        setCircleCenter(null);
      }
    } else if (tool === 'eraser') {
      // Remove annotation nearest to click
      const threshold = 30;
      let nearest = -1;
      let minDist = Infinity;
      annotations.forEach((ann, i) => {
        let dist = Infinity;
        if (ann.tool === 'pen') {
          for (const p of (ann as CanvasStroke).points) {
            const d = Math.hypot(p.x - pos.x, p.y - pos.y);
            if (d < dist) dist = d;
          }
        } else if (ann.tool === 'text') {
          const t = ann as CanvasTextAnnotation;
          dist = Math.hypot(t.x - pos.x, t.y - pos.y);
        } else if (ann.tool === 'arrow') {
          const a = ann as CanvasArrow;
          dist = Math.min(Math.hypot(a.from.x - pos.x, a.from.y - pos.y), Math.hypot(a.to.x - pos.x, a.to.y - pos.y));
        } else if (ann.tool === 'circle') {
          const c = ann as CanvasCircle;
          dist = Math.abs(Math.hypot(c.center.x - pos.x, c.center.y - pos.y) - c.radius);
        }
        if (dist < minDist) { minDist = dist; nearest = i; }
      });
      if (nearest >= 0 && minDist < threshold) {
        updateAnnotations(annotations.filter((_, i) => i !== nearest));
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== 'pen') return;
    const pos = getPos(e);
    setCurrentPoints(prev => [...prev, pos]);

    // Live preview
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && currentPoints.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const last = currentPoints[currentPoints.length - 1];
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && tool === 'pen' && currentPoints.length > 1) {
      const newAnn: CanvasStroke = { id: uid(), tool: 'pen', color, lineWidth, points: currentPoints };
      updateAnnotations([...annotations, newAnn]);
    }
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const addTextAnnotation = () => {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    const newAnn: CanvasTextAnnotation = { id: uid(), tool: 'text', text: textInput.trim(), x: textPos.x, y: textPos.y, color, fontSize: 16 };
    updateAnnotations([...annotations, newAnn]);
    setTextPos(null);
    setTextInput('');
  };

  const updateAnnotations = (next: CanvasAnnotation[]) => {
    setAnnotations(next);
    onAnnotationsChange?.(next);
    // Auto-export flattened image
    setTimeout(() => {
      if (canvasRef.current) {
        onExportImage?.(canvasRef.current.toDataURL('image/jpeg', 0.85));
      }
    }, 50);
  };

  const undo = () => {
    if (annotations.length === 0) return;
    updateAnnotations(annotations.slice(0, -1));
  };

  const clearAll = () => {
    updateAnnotations([]);
  };

  const tools: { key: CanvasToolType; label: string; icon: string }[] = [
    { key: 'pen', label: 'Draw', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    { key: 'text', label: 'Text', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { key: 'arrow', label: 'Arrow', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },
    { key: 'circle', label: 'Circle', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'eraser', label: 'Erase', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  ];

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-secondary p-2 border border-border">
        {/* Tools */}
        <div className="flex gap-1">
          {tools.map(t => (
            <button
              key={t.key}
              onClick={() => { setTool(t.key); setArrowStart(null); setCircleCenter(null); setTextPos(null); }}
              className={`rounded-md p-1.5 transition-colors ${tool === t.key ? 'bg-purple-500/30 text-purple-400' : 'text-text-muted hover:bg-bg-hover'}`}
              title={t.label}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Line width */}
        <div className="flex gap-1">
          {[2, 4, 8].map(w => (
            <button
              key={w}
              onClick={() => setLineWidth(w)}
              className={`flex items-center justify-center rounded-md px-2 py-1 text-[10px] ${lineWidth === w ? 'bg-purple-500/20 text-purple-400' : 'text-text-muted hover:bg-bg-hover'}`}
            >
              {w === 2 ? 'S' : w === 4 ? 'M' : 'L'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Undo / Clear */}
        <button onClick={undo} disabled={annotations.length === 0} className="rounded-md px-2 py-1 text-[10px] text-text-muted hover:bg-bg-hover disabled:opacity-30">
          Undo
        </button>
        <button onClick={clearAll} disabled={annotations.length === 0} className="rounded-md px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-30">
          Clear
        </button>
      </div>

      {/* Status hint */}
      <div className="text-[10px] text-text-muted text-center">
        {tool === 'pen' && 'Draw freehand to sketch details'}
        {tool === 'text' && 'Click on the image to place a text label'}
        {tool === 'arrow' && (arrowStart ? 'Click to set arrow end point' : 'Click to set arrow start point')}
        {tool === 'circle' && (circleCenter ? 'Click to set circle edge' : 'Click to set circle center')}
        {tool === 'eraser' && 'Click near an annotation to remove it'}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full cursor-crosshair"
          style={{ touchAction: 'none', aspectRatio: `${W}/${H}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Text input overlay */}
        {textPos && (
          <div
            className="absolute z-10"
            style={{ left: `${(textPos.x / W) * 100}%`, top: `${(textPos.y / H) * 100}%` }}
          >
            <div className="flex gap-1">
              <input
                autoFocus
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTextAnnotation(); if (e.key === 'Escape') setTextPos(null); }}
                placeholder={mode === 'edit' ? 'e.g. remove this' : 'e.g. pocket here'}
                className="rounded border border-purple-500/40 bg-black/80 px-2 py-1 text-xs text-white outline-none w-40"
              />
              <button onClick={addTextAnnotation} className="rounded bg-purple-500 px-2 py-1 text-[10px] text-white font-bold">
                Add
              </button>
              <button onClick={() => setTextPos(null)} className="rounded bg-black/60 px-2 py-1 text-[10px] text-white/60">
                X
              </button>
            </div>
          </div>
        )}

        {/* Arrow/Circle start indicator */}
        {arrowStart && (
          <div
            className="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${(arrowStart.x / W) * 100}%`, top: `${(arrowStart.y / H) * 100}%` }}
          />
        )}
        {circleCenter && (
          <div
            className="absolute w-3 h-3 rounded-full bg-green-500 border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${(circleCenter.x / W) * 100}%`, top: `${(circleCenter.y / H) * 100}%` }}
          />
        )}
      </div>

      {/* Annotation count */}
      {annotations.length > 0 && (
        <p className="text-[10px] text-text-muted text-center">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          {annotations.filter(a => a.tool === 'text').length > 0 && ` (${annotations.filter(a => a.tool === 'text').length} text labels)`}
        </p>
      )}
    </div>
  );
}
