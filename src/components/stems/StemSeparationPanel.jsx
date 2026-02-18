import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

const STEM_TYPES = [
  { id: 'vocals', label: 'Vocals', icon: '🎤', color: '#e91e8a', desc: 'High-pass filtered for vocal isolation' },
  { id: 'drums',  label: 'Drums',  icon: '🥁', color: '#ff7043', desc: 'Low-shelf boost & high-cut for punch' },
  { id: 'bass',   label: 'Bass',   icon: '🎸', color: '#29b6f6', desc: 'Low-pass filtered for bottom end' },
  { id: 'other',  label: 'Other',  icon: '🎹', color: '#66bb6a', desc: 'Mid-band focused for instruments' },
];

export default function StemSeparationPanel() {
  const { processStems } = useProjectStore();
  const { selectedClipId, selectedClipTrackId } = useUIStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleProcess = async () => {
    if (!selectedClipId) return;
    setIsProcessing(true);
    
    // Simulate slight delay for "processing" feel, though logic is instant
    await new Promise(r => setTimeout(r, 800));
    
    processStems();
    
    setIsProcessing(false);
    setSuccessMsg('Created 4 stem tracks in arrangement!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const isValidSelection = !!selectedClipId && !!selectedClipTrackId;

  return (
    <div className="stem-panel">
      <div className="stem-panel-header">
        <div className="stem-title-row">
          <span className="stem-icon">🎚</span>
          <span className="stem-title">STEM SEPARATION</span>
        </div>
      </div>

      <div className="stem-content" style={{ padding: 20 }}>
        <p className="text-muted" style={{ marginBottom: 20 }}>
          Split the selected audio clip into four separate stems using frequency-based separation.
          This will create 4 new tracks in your arrangement.
        </p>

        <div className="stem-types-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {STEM_TYPES.map(stem => (
            <div key={stem.id} className="stem-type-card" style={{ 
              background: 'var(--bg-elevated)', padding: 15, borderRadius: 8,
              borderLeft: `3px solid ${stem.color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span>{stem.icon}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{stem.label}</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{stem.desc}</div>
            </div>
          ))}
        </div>

        <div className="stem-action-area" style={{ textAlign: 'center' }}>
          {!isValidSelection ? (
            <div className="alert-box" style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 4 }}>
              ⚠ Please select an audio clip in the arrangement/mixer to proceed.
            </div>
          ) : (
            <button 
              className={`btn btn-primary ${isProcessing ? 'loading' : ''}`}
              onClick={handleProcess}
              disabled={isProcessing}
              style={{ width: '100%', padding: '12px', fontSize: 16 }}
            >
              {isProcessing ? 'Processing Audio...' : '✨ Separate Stems'}
            </button>
          )}
          
          {successMsg && (
            <div style={{ marginTop: 10, color: 'var(--accent-success)' }} className="fade-in">
              ✔ {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
