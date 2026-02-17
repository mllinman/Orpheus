import React, { useState, useEffect, useRef } from 'react';

const STEMS = [
  { id: 'vocals', label: 'Vocals', icon: '🎤', color: '#e91e8a' },
  { id: 'drums',  label: 'Drums',  icon: '🥁', color: '#ff7043' },
  { id: 'bass',   label: 'Bass',   icon: '🎸', color: '#29b6f6' },
  { id: 'other',  label: 'Other',  icon: '🎹', color: '#66bb6a' },
];

export default function StemSeparationPanel() {
  const [enabled, setEnabled] = useState(false);
  const [stems, setStems] = useState(
    Object.fromEntries(STEMS.map(s => [s.id, { volume: 1, mute: false, solo: false, level: 0 }]))
  );
  const [processing, setProcessing] = useState(false);
  const animRef = useRef(null);

  // Simulate level animation
  useEffect(() => {
    const animate = () => {
      if (enabled) {
        setStems(prev => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            const base = next[key].mute ? 0 : next[key].volume;
            next[key] = {
              ...next[key],
              level: base * (0.3 + Math.random() * 0.5),
            };
          }
          return next;
        });
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [enabled]);

  const toggleMute = (id) => {
    setStems(prev => ({ ...prev, [id]: { ...prev[id], mute: !prev[id].mute } }));
  };

  const toggleSolo = (id) => {
    setStems(prev => ({ ...prev, [id]: { ...prev[id], solo: !prev[id].solo } }));
  };

  const setVolume = (id, vol) => {
    setStems(prev => ({ ...prev, [id]: { ...prev[id], volume: vol } }));
  };

  const handleSeparate = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setEnabled(true);
    }, 2000);
  };

  return (
    <div className="stem-panel">
      <div className="stem-panel-header">
        <div className="stem-title-row">
          <span className="stem-icon">🎚</span>
          <span className="stem-title">STEM SEPARATION</span>
          <button
            className={`btn btn-sm ${enabled ? 'active' : ''}`}
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {!enabled && !processing && (
          <button className="btn stem-separate-btn" onClick={handleSeparate}>
            ✨ Separate Stems
          </button>
        )}
        {processing && (
          <div className="stem-processing">
            <div className="stem-progress-bar">
              <div className="stem-progress-fill animate-pulse" />
            </div>
            <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>Analyzing audio...</span>
          </div>
        )}
      </div>

      {enabled && (
        <div className="stem-channels">
          {STEMS.map(stem => {
            const state = stems[stem.id];
            const hasSolo = Object.values(stems).some(s => s.solo);
            const isActive = hasSolo ? state.solo && !state.mute : !state.mute;
            const segments = 16;
            const litSegments = Math.floor((isActive ? state.level : 0) * segments);

            return (
              <div key={stem.id} className={`stem-channel ${!isActive ? 'inactive' : ''}`}>
                <div className="stem-channel-header">
                  <span className="stem-emoji">{stem.icon}</span>
                  <span className="stem-label">{stem.label}</span>
                </div>

                <div className="stem-meter">
                  {Array.from({ length: segments }).map((_, i) => {
                    const idx = segments - 1 - i;
                    const lit = idx < litSegments;
                    return (
                      <div
                        key={i}
                        className="stem-meter-seg"
                        style={{
                          background: lit ? stem.color : 'rgba(255,255,255,0.05)',
                          boxShadow: lit ? `0 0 4px ${stem.color}40` : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.volume}
                  onChange={(e) => setVolume(stem.id, parseFloat(e.target.value))}
                  className="stem-fader"
                  style={{ accentColor: stem.color }}
                />

                <div className="stem-channel-btns">
                  <button
                    className={`track-btn ${state.mute ? 'mute-active' : ''}`}
                    onClick={() => toggleMute(stem.id)}
                  >
                    M
                  </button>
                  <button
                    className={`track-btn ${state.solo ? 'solo-active' : ''}`}
                    onClick={() => toggleSolo(stem.id)}
                  >
                    S
                  </button>
                </div>

                <div className="stem-vol-label mono">
                  {state.volume > 0 ? `${(20 * Math.log10(state.volume)).toFixed(1)} dB` : '-∞'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {enabled && (
        <div className="stem-export-row">
          <button className="btn btn-sm btn-ghost">Export All Stems</button>
        </div>
      )}
    </div>
  );
}
