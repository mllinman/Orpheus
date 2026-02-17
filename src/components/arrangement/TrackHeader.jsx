import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

export default function TrackHeader({ track, height }) {
  const { toggleMute, toggleSolo, toggleArmed, setTrackVolume, setTrackPan, updateTrack, removeTrack, duplicateTrack } = useProjectStore();
  const { selectedTrackId, setSelectedTrack } = useUIStore();
  const isSelected = selectedTrackId === track.id;

  const typeIcon = track.type === 'midi' ? '🎹' : '🎵';

  const handleContextMenu = (e) => {
    e.preventDefault();
    const { showContextMenu } = useUIStore.getState();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Duplicate Track', action: () => duplicateTrack(track.id) },
      { label: 'Remove Track', action: () => removeTrack(track.id), danger: true },
      { divider: true },
      { label: 'Rename...', action: () => {} },
      { label: 'Change Color', action: () => {} },
    ]);
  };

  return (
    <div
      className={`track-header ${isSelected ? 'selected' : ''}`}
      style={{
        height,
        borderLeft: `3px solid ${track.color}`,
      }}
      onClick={() => setSelectedTrack(track.id)}
      onContextMenu={handleContextMenu}
    >
      <div className="track-header-top">
        <span className="track-type-icon">{typeIcon}</span>
        <span className="track-name truncate">{track.name}</span>
      </div>

      <div className="track-header-controls">
        <button
          className={`track-btn ${track.mute ? 'mute-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
          data-tooltip="Mute"
        >
          M
        </button>
        <button
          className={`track-btn ${track.solo ? 'solo-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
          data-tooltip="Solo"
        >
          S
        </button>
        <button
          className={`track-btn ${track.armed ? 'arm-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleArmed(track.id); }}
          data-tooltip="Record Arm"
        >
          R
        </button>
      </div>

      <div className="track-header-faders">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
          className="track-volume-slider"
          data-tooltip={`Vol: ${Math.round(track.volume * 100)}%`}
          onClick={(e) => e.stopPropagation()}
        />
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan}
          onChange={(e) => setTrackPan(track.id, parseFloat(e.target.value))}
          className="track-pan-slider"
          data-tooltip={`Pan: ${track.pan > 0 ? `R${Math.round(track.pan * 100)}` : track.pan < 0 ? `L${Math.round(-track.pan * 100)}` : 'C'}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
