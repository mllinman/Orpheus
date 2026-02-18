import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { audioExporter } from '../../audio/AudioExporter';
import { audioBufferManager } from '../../audio/AudioBufferManager';

const STEM_TYPES = [
  { id: 'vocals', label: 'Vocals', icon: '🎤', color: '#e91e8a', desc: 'High-pass filtered for vocal isolation' },
  { id: 'drums',  label: 'Drums',  icon: '🥁', color: '#ff7043', desc: 'Low-shelf boost & high-cut for punch' },
  { id: 'bass',   label: 'Bass',   icon: '🎸', color: '#29b6f6', desc: 'Low-pass filtered for bottom end' },
  { id: 'other',  label: 'Other',  icon: '🎹', color: '#66bb6a', desc: 'Mid-band focused for instruments' },
];

export default function StemSeparationPanel() {
  const { processStems, addStemTracks, tracks } = useProjectStore();
  const { selectedClipId, selectedClipTrackId } = useUIStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [useCloud, setUseCloud] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const handleProcess = async () => {
    if (!selectedClipId || !selectedClipTrackId) return;
    setIsProcessing(true);
    
    try {
      if (useCloud) {
        // ─── Cloud Processing ───
        const track = tracks.find(t => t.id === selectedClipTrackId);
        const clip = track?.clips.find(c => c.id === selectedClipId);
        
        if (!clip || !clip.bufferId) throw new Error('No audio clip selected');
        
        const bufferEntry = audioBufferManager.getBuffer(clip.bufferId);
        if (!bufferEntry) throw new Error('Audio buffer not found');

        // 1. Encode to WAV
        const blob = audioExporter.encodeBufferToBlob(bufferEntry.buffer);

        // 2. Upload
        const formData = new FormData();
        formData.append('audio', blob, 'source.wav');

        const res = await fetch('/api/audio/separate', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Processing failed');

        // 3. Load results
        const resultStems = {};
        for (const [type, url] of Object.entries(data.stems)) {
            // Load buffer from URL
            const bufId = await audioBufferManager.loadFromUrl(url);
            // Map stems to friendly names
            const label = STEM_TYPES.find(s => s.id === type)?.label || type;
            resultStems[label] = bufId;
        }

        // 4. Update Project
        addStemTracks(selectedClipTrackId, selectedClipId, resultStems);
        setSuccessMsg('Cloud processing complete!');

      } else {
        // ─── Local Processing ───
        await new Promise(r => setTimeout(r, 800));
        processStems();
        setSuccessMsg('Created 4 stem tracks (EQ Preview)!');
      }
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
    
    setIsProcessing(false);
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

        {/* Cloud Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, background: 'var(--bg-surface)', padding: 10, borderRadius: 6 }}>
           <input 
             type="checkbox" 
             checked={useCloud} 
             onChange={(e) => setUseCloud(e.target.checked)}
             style={{ width: 16, height: 16, cursor: 'pointer' }}
           />
           <div style={{ flex: 1 }}>
             <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>Use Cloud Processing (High Quality)</div>
             <div className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
               {useCloud ? 'Uploads to server for processing (Better quality, slower)' : 'Uses local EQ filters (Instant preview, lower quality)'}
             </div>
           </div>
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
