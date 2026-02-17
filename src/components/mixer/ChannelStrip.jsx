import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { EFFECT_TYPES } from '../../audio/EffectsProcessor';

export default function ChannelStrip({ track }) {
  const { toggleMute, toggleSolo, toggleArmed, setTrackVolume, setTrackPan } = useProjectStore();
  const { selectedTrackId, setSelectedTrack } = useUIStore();
  const isSelected = selectedTrackId === track.id;
  const [showEffectMenu, setShowEffectMenu] = useState(false);

  const dbValue = track.volume > 0 ? (20 * Math.log10(track.volume)).toFixed(1) : '-∞';
  const panLabel = track.pan > 0.01 ? `R${Math.round(track.pan * 100)}`
    : track.pan < -0.01 ? `L${Math.round(-track.pan * 100)}`
    : 'C';

  // Simulated VU level
  const level = track.mute ? 0 : track.volume * (0.5 + Math.random() * 0.3);
  const segments = 20;
  const litSegments = Math.floor(level * segments);

  return (
    <div
      className={`channel-strip ${isSelected ? 'selected' : ''}`}
      onClick={() => setSelectedTrack(track.id)}
      style={{ borderTop: `2px solid ${track.color}` }}
    >
      <div className="channel-label">
        <span className="channel-name truncate">{track.name}</span>
      </div>

      {/* Insert slots */}
      <div className="channel-inserts">
        {track.effects.length > 0 ? (
          track.effects.map((fx, i) => (
            <div key={i} className="insert-slot filled">{fx.name}</div>
          ))
        ) : null}
        <div className="insert-slot empty" onClick={(e) => { e.stopPropagation(); setShowEffectMenu(!showEffectMenu); }}>
          + Insert
          {showEffectMenu && (
            <div className="dropdown-menu" style={{ left: 0, minWidth: 150 }}>
              {EFFECT_TYPES.map(fx => (
                <div key={fx.id} className="dropdown-item" onClick={() => setShowEffectMenu(false)}>
                  {fx.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pan Knob */}
      <div className="channel-pan">
        <div className="pan-label mono">{panLabel}</div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan}
          onChange={(e) => setTrackPan(track.id, parseFloat(e.target.value))}
          className="pan-slider"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setTrackPan(track.id, 0)}
        />
      </div>

      {/* Fader + VU */}
      <div className="channel-fader-area">
        <div className="vu-meter">
          <div className="vu-channel">
            {Array.from({ length: segments }).map((_, i) => {
              const idx = segments - 1 - i;
              const isLit = idx < litSegments;
              let color = '#00b894';
              if (idx >= segments * 0.85) color = '#ff6b6b';
              else if (idx >= segments * 0.7) color = '#fdcb6e';
              return (
                <div
                  key={i}
                  className="vu-segment"
                  style={{
                    background: isLit ? color : 'rgba(255,255,255,0.05)',
                    boxShadow: isLit ? `0 0 3px ${color}40` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="fader-container">
          <input
            type="range"
            className="channel-fader"
            min="0"
            max="1"
            step="0.005"
            value={track.volume}
            onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            orient="vertical"
          />
          <div className="fader-db mono">{dbValue}</div>
        </div>
      </div>

      {/* M / S / R */}
      <div className="channel-buttons">
        <button
          className={`track-btn ${track.mute ? 'mute-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
        >
          M
        </button>
        <button
          className={`track-btn ${track.solo ? 'solo-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
        >
          S
        </button>
        <button
          className={`track-btn ${track.armed ? 'arm-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleArmed(track.id); }}
        >
          R
        </button>
      </div>
    </div>
  );
}
