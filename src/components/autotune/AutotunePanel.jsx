import React, { useState, useEffect, useRef } from 'react';
import { PitchCorrector } from '../../audio/PitchCorrector';

const SCALES = Object.keys(PitchCorrector.SCALES);
const KEYS = PitchCorrector.KEYS;

const SCALE_LABELS = {
  chromatic: 'Chromatic',
  major: 'Major (Ionian)',
  minor: 'Natural Minor',
  harmonicMinor: 'Harmonic Minor',
  melodicMinor: 'Melodic Minor',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  pentatonicMajor: 'Pentatonic Major',
  pentatonicMinor: 'Pentatonic Minor',
  blues: 'Blues',
  wholeHalfDim: 'Whole-Half Dim.',
};

export default function AutotunePanel() {
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState('C');
  const [scale, setScale] = useState('chromatic');
  const [speed, setSpeed] = useState(0.5);
  const [amount, setAmount] = useState(1.0);
  const [formantPreserve, setFormantPreserve] = useState(true);
  const [humanize, setHumanize] = useState(0.1);
  const [retune, setRetune] = useState(0);

  // Simulated detection display
  const [detectedPitch, setDetectedPitch] = useState(0);
  const [detectedNote, setDetectedNote] = useState('--');
  const [targetNote, setTargetNote] = useState('--');
  const [centsOff, setCentsOff] = useState(0);
  const [confidence, setConfidence] = useState(0);

  const animRef = useRef(null);

  // Simulate pitch detection for visual demo
  useEffect(() => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const freqs = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3];
    let noteIdx = 0;
    let phase = 0;

    const animate = () => {
      if (enabled) {
        phase += 0.02;
        if (phase > 1) {
          phase = 0;
          noteIdx = (noteIdx + 1) % notes.length;
        }

        const jitter = (Math.random() - 0.5) * 15;
        setDetectedPitch(freqs[noteIdx] + jitter);
        setDetectedNote(notes[noteIdx]);
        setTargetNote(notes[noteIdx]);
        setCentsOff(jitter / freqs[noteIdx] * 100 * 30);
        setConfidence(0.7 + Math.random() * 0.25);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [enabled]);

  // Get active scale notes for the keyboard display
  const keyIndex = KEYS.indexOf(key);
  const scaleIntervals = PitchCorrector.SCALES[scale] || PitchCorrector.SCALES.chromatic;
  const activeNotes = scaleIntervals.map(i => (i + keyIndex) % 12);

  const speedLabel = speed < 0.2 ? 'Natural' : speed < 0.5 ? 'Moderate' : speed < 0.8 ? 'Fast' : 'Hard Tune';
  const speedColor = speed < 0.5 ? 'var(--accent-success)' : speed < 0.8 ? 'var(--accent-warning)' : 'var(--accent-danger)';

  return (
    <div className="autotune-panel">
      <div className="autotune-header">
        <div className="autotune-title-row">
          <span style={{ fontSize: 16 }}>🎤</span>
          <span className="autotune-title">AUTOTUNE</span>
          <button
            className={`btn btn-sm ${enabled ? 'active' : ''}`}
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="autotune-content">
        {/* Pitch Display */}
        <div className="autotune-pitch-display">
          <div className="pitch-detected">
            <div className="pitch-note-large mono" style={{
              color: enabled ? (Math.abs(centsOff) < 10 ? 'var(--accent-success)' : 'var(--accent-warning)') : 'var(--text-muted)'
            }}>
              {enabled ? detectedNote : '--'}
            </div>
            <div className="pitch-freq mono">
              {enabled ? `${detectedPitch.toFixed(1)} Hz` : '--- Hz'}
            </div>
          </div>

          {/* Cents meter */}
          <div className="cents-meter">
            <div className="cents-label">CENTS</div>
            <div className="cents-bar">
              <div className="cents-center" />
              <div
                className="cents-indicator"
                style={{
                  left: `${50 + (enabled ? centsOff : 0) * 0.5}%`,
                  background: Math.abs(centsOff) < 10 ? 'var(--accent-success)' : 'var(--accent-warning)',
                }}
              />
            </div>
            <div className="cents-labels-row">
              <span>-50</span>
              <span>0</span>
              <span>+50</span>
            </div>
          </div>

          {/* Target note */}
          <div className="pitch-target">
            <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>TARGET</span>
            <span className="pitch-target-note mono">{enabled ? targetNote : '--'}</span>
          </div>

          {/* Confidence bar */}
          <div className="confidence-row">
            <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>CONFIDENCE</span>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${(enabled ? confidence : 0) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key & Scale */}
        <div className="autotune-section">
          <div className="autotune-section-label">KEY & SCALE</div>
          <div className="key-scale-row">
            <select className="select" value={key} onChange={(e) => setKey(e.target.value)} style={{ width: 70 }}>
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="select" value={scale} onChange={(e) => setScale(e.target.value)} style={{ flex: 1 }}>
              {SCALES.map(s => <option key={s} value={s}>{SCALE_LABELS[s] || s}</option>)}
            </select>
          </div>

          {/* Piano keyboard showing active notes */}
          <div className="mini-keyboard">
            {KEYS.map((noteName, i) => {
              const isBlack = noteName.includes('#');
              const isActive = activeNotes.includes(i);
              const isDetected = enabled && detectedNote.startsWith(noteName);
              return (
                <div
                  key={noteName}
                  className={`mini-key ${isBlack ? 'black' : 'white'} ${isActive ? 'in-scale' : 'out-scale'} ${isDetected ? 'detected' : ''}`}
                  data-tooltip={noteName}
                >
                  {!isBlack && <span className="mini-key-label">{noteName}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Correction Speed */}
        <div className="autotune-section">
          <div className="autotune-section-label">CORRECTION SPEED</div>
          <div className="speed-control">
            <div className="speed-bar">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: speedColor }}
              />
            </div>
            <div className="speed-labels">
              <span className="text-muted">Natural</span>
              <span className="mono" style={{ color: speedColor, fontWeight: 600, fontSize: 'var(--text-sm)' }}>{speedLabel}</span>
              <span className="text-muted">Hard</span>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="autotune-section">
          <div className="autotune-section-label">AMOUNT</div>
          <div className="autotune-slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
            />
            <span className="mono" style={{ fontSize: 'var(--text-xs)', minWidth: 36, textAlign: 'right' }}>
              {Math.round(amount * 100)}%
            </span>
          </div>
        </div>

        {/* Humanize */}
        <div className="autotune-section">
          <div className="autotune-section-label">HUMANIZE</div>
          <div className="autotune-slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={humanize}
              onChange={(e) => setHumanize(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-secondary)' }}
            />
            <span className="mono" style={{ fontSize: 'var(--text-xs)', minWidth: 36, textAlign: 'right' }}>
              {Math.round(humanize * 100)}%
            </span>
          </div>
        </div>

        {/* Retune */}
        <div className="autotune-section">
          <div className="autotune-section-label">RETUNE / DETUNE</div>
          <div className="autotune-slider-row">
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={retune}
              onChange={(e) => setRetune(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-tertiary)' }}
            />
            <span className="mono" style={{ fontSize: 'var(--text-xs)', minWidth: 46, textAlign: 'right' }}>
              {retune > 0 ? '+' : ''}{retune} ct
            </span>
          </div>
        </div>

        {/* Toggles */}
        <div className="autotune-section">
          <div className="autotune-toggles">
            <label className="autotune-toggle">
              <input
                type="checkbox"
                checked={formantPreserve}
                onChange={(e) => setFormantPreserve(e.target.checked)}
              />
              <span>Formant Preservation</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
