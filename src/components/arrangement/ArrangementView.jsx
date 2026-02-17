import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import TrackHeader from './TrackHeader';
import TrackLane from './TrackLane';
import TimelineRuler from './TimelineRuler';
import Playhead from './Playhead';

export default function ArrangementView() {
  const tracks = useProjectStore(s => s.tracks);
  const { horizontalZoom, verticalZoom, trackHeaderWidth } = useUIStore();
  const scrollRef = useRef(null);
  const headerScrollRef = useRef(null);

  const trackHeight = 80 * verticalZoom;
  const totalBars = 64;
  const totalBeats = totalBars * 4;
  const totalWidth = totalBeats * horizontalZoom;

  // Sync vertical scroll between headers and lanes
  const handleScroll = useCallback(() => {
    if (headerScrollRef.current && scrollRef.current) {
      headerScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const { zoomIn, zoomOut } = useUIStore.getState();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  }, []);

  return (
    <div className="arrangement-view" onWheel={handleWheel}>
      {/* Track Headers Column */}
      <div className="arrangement-headers" style={{ width: trackHeaderWidth }}>
        <div className="arrangement-header-spacer">
          <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>TRACKS</span>
        </div>
        <div className="arrangement-headers-scroll" ref={headerScrollRef}>
          {tracks.map(track => (
            <TrackHeader key={track.id} track={track} height={trackHeight} />
          ))}
          <AddTrackButton />
        </div>
      </div>

      {/* Resize handle */}
      <ResizeHandle />

      {/* Timeline + Lanes */}
      <div className="arrangement-content">
        <TimelineRuler
          totalBeats={totalBeats}
          pixelsPerBeat={horizontalZoom}
          scrollLeft={scrollRef.current?.scrollLeft || 0}
        />
        <div
          className="arrangement-lanes-scroll"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          <div className="arrangement-lanes" style={{ width: totalWidth, minWidth: '100%' }}>
            {tracks.map((track, i) => (
              <TrackLane
                key={track.id}
                track={track}
                trackIndex={i}
                height={trackHeight}
                pixelsPerBeat={horizontalZoom}
                totalWidth={totalWidth}
              />
            ))}
          </div>
          <Playhead pixelsPerBeat={horizontalZoom} totalHeight={tracks.length * trackHeight} />
        </div>
      </div>
    </div>
  );
}

function AddTrackButton() {
  const addTrack = useProjectStore(s => s.addTrack);
  const [open, setOpen] = useState(false);

  return (
    <div className="add-track-container">
      <button className="btn btn-ghost add-track-btn" onClick={() => setOpen(!open)}>
        + Add Track
      </button>
      {open && (
        <div className="dropdown-menu" style={{ position: 'relative', top: 0 }}>
          <div className="dropdown-item" onClick={() => { addTrack('audio'); setOpen(false); }}>
            <span>🎵 Audio Track</span>
          </div>
          <div className="dropdown-item" onClick={() => { addTrack('midi'); setOpen(false); }}>
            <span>🎹 MIDI Track</span>
          </div>
          <div className="dropdown-item" onClick={() => { addTrack('midi'); setOpen(false); }}>
            <span>🎸 Instrument Track</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResizeHandle() {
  const { trackHeaderWidth, setTrackHeaderWidth } = useUIStore();
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = trackHeaderWidth;
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const delta = e.clientX - startX.current;
      setTrackHeaderWidth(startWidth.current + delta);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, setTrackHeaderWidth]);

  return <div className={`resize-handle ${dragging ? 'dragging' : ''}`} onMouseDown={onMouseDown} />;
}
