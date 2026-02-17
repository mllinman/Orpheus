import React, { useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';

export default function TrackLane({ track, trackIndex, height, pixelsPerBeat, totalWidth }) {
  const canvasRef = useRef(null);
  const { selectedClipId, setSelectedClip, activeTool } = useUIStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = totalWidth;
    canvas.height = height;

    // Background
    ctx.fillStyle = trackIndex % 2 === 0 ? '#151524' : '#171729';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines (beats)
    for (let beat = 0; beat <= totalWidth / pixelsPerBeat; beat++) {
      const x = beat * pixelsPerBeat;
      const isBar = beat % 4 === 0;
      ctx.strokeStyle = isBar ? '#1e1e32' : '#17172a';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Muted overlay
    if (track.mute) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw clips
    for (const clip of track.clips) {
      drawClip(ctx, clip, track, pixelsPerBeat, height, selectedClipId === clip.id);
    }

    // Bottom border
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 0.5);
    ctx.lineTo(canvas.width, canvas.height - 0.5);
    ctx.stroke();

  }, [track, trackIndex, height, pixelsPerBeat, totalWidth, selectedClipId]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Find clicked clip
    for (const clip of track.clips) {
      const clipX = clip.startBeat * pixelsPerBeat;
      const clipW = clip.lengthBeats * pixelsPerBeat;
      if (x >= clipX && x <= clipX + clipW) {
        setSelectedClip(track.id, clip.id);
        return;
      }
    }
    // Click on empty space
    setSelectedClip(null, null);
  }, [track, pixelsPerBeat, setSelectedClip]);

  return (
    <div className="track-lane" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="track-lane-canvas"
        onClick={handleClick}
      />
    </div>
  );
}

function drawClip(ctx, clip, track, pxPerBeat, laneHeight, isSelected) {
  const x = clip.startBeat * pxPerBeat;
  const w = clip.lengthBeats * pxPerBeat;
  const y = 2;
  const h = laneHeight - 4;
  const r = 4;

  // Clip body with color
  const clipColor = clip.color || track.color;
  ctx.fillStyle = clip.type === 'midi' ? '#1a2840' : '#1e1e3a';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  // Colored top bar
  ctx.fillStyle = clipColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 18, [r, r, 0, 0]);
  ctx.fill();

  // Clip name
  ctx.fillStyle = '#fff';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(clip.name, x + 6, y + 13, w - 12);

  // Waveform or MIDI display
  const contentY = y + 20;
  const contentH = h - 22;

  if (clip.type === 'audio' && clip.waveformData) {
    drawWaveform(ctx, clip.waveformData, x + 2, contentY, w - 4, contentH, clipColor);
  } else if (clip.type === 'midi' && clip.notes) {
    drawMidiPreview(ctx, clip.notes, x + 2, contentY, w - 4, contentH, clip.lengthBeats, clipColor);
  }

  // Selection border
  if (isSelected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }
}

function drawWaveform(ctx, data, x, y, w, h, color) {
  const mid = y + h / 2;
  const step = data.length / w;

  ctx.fillStyle = color + '30';
  ctx.strokeStyle = color + '90';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, mid);

  for (let i = 0; i < w; i++) {
    const idx = Math.floor(i * step);
    const val = data[idx] || 0;
    const amplitude = val * (h / 2) * 0.9;
    ctx.lineTo(x + i, mid - amplitude);
  }

  for (let i = w - 1; i >= 0; i--) {
    const idx = Math.floor(i * step);
    const val = data[idx] || 0;
    const amplitude = val * (h / 2) * 0.9;
    ctx.lineTo(x + i, mid + amplitude);
  }

  ctx.closePath();
  ctx.fill();

  // Center line
  ctx.beginPath();
  ctx.moveTo(x, mid);
  for (let i = 0; i < w; i++) {
    const idx = Math.floor(i * step);
    const val = data[idx] || 0;
    ctx.lineTo(x + i, mid - val * (h / 2) * 0.9);
  }
  ctx.stroke();
}

function drawMidiPreview(ctx, notes, x, y, w, h, clipLength, color) {
  if (!notes.length) return;

  const minNote = Math.min(...notes.map(n => n.pitch)) - 1;
  const maxNote = Math.max(...notes.map(n => n.pitch)) + 1;
  const noteRange = maxNote - minNote || 1;

  for (const note of notes) {
    const nx = x + (note.startBeat / clipLength) * w;
    const nw = Math.max(2, (note.lengthBeats / clipLength) * w);
    const ny = y + ((maxNote - note.pitch) / noteRange) * h;
    const nh = Math.max(2, h / noteRange * 0.8);

    const alpha = Math.round((note.velocity / 127) * 200 + 55).toString(16).padStart(2, '0');
    ctx.fillStyle = color + alpha;
    ctx.fillRect(nx, ny, nw, nh);
  }
}
