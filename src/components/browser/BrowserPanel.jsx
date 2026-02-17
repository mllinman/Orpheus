import React, { useState, useRef, useEffect } from 'react';
import { EFFECT_TYPES } from '../../audio/EffectsProcessor';
import { audioBufferManager } from '../../audio/AudioBufferManager';
import { pluginManager } from '../../audio/PluginManager';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { audioEngine } from '../../audio/AudioEngine';

const BROWSER_TABS = [
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'plugins', label: 'Plugins', icon: '🔌' },
  { id: 'instruments', label: 'Instruments', icon: '🎹' },
  { id: 'effects', label: 'Effects', icon: '🎛' },
  { id: 'samples', label: 'Samples', icon: '🎵' },
];

// Built-in sample generators for demo content
const BUILT_IN_SAMPLES = {
  'Kick_Deep.wav': { freq: 55, dur: 0.3, type: 'sine', env: 'kick' },
  'Kick_Punch.wav': { freq: 80, dur: 0.2, type: 'sine', env: 'kick' },
  'Snare_Tight.wav': { freq: 200, dur: 0.15, type: 'noise', env: 'snare' },
  'Snare_Fat.wav': { freq: 180, dur: 0.2, type: 'noise', env: 'snare' },
  'HiHat_Closed.wav': { freq: 8000, dur: 0.05, type: 'noise', env: 'hat' },
  'HiHat_Open.wav': { freq: 8000, dur: 0.2, type: 'noise', env: 'hat' },
  'Clap_1.wav': { freq: 1500, dur: 0.12, type: 'noise', env: 'clap' },
  'Sub_Bass_C1.wav': { freq: 32.7, dur: 1.0, type: 'sine', env: 'bass' },
  'Pad_Ambient.wav': { freq: 440, dur: 2.0, type: 'sine', env: 'pad' },
  'Lead_Saw.wav': { freq: 440, dur: 0.5, type: 'sawtooth', env: 'lead' },
};

const INSTRUMENT_ITEMS = [
  { name: 'Orpheus Synth', type: 'synth', icon: '🎹', children: [
    { name: 'Init Patch', preset: 'init' },
    { name: 'Deep Bass', preset: 'deep_bass' },
    { name: 'Warm Pad', preset: 'warm_pad' },
    { name: 'Pluck Lead', preset: 'pluck_lead' },
    { name: 'Super Saw', preset: 'super_saw' },
    { name: 'Acid Squelch', preset: 'acid' },
  ]},
  { name: 'Orpheus Sampler', type: 'sampler', icon: '🥁', children: [
    { name: 'Acoustic Kit', preset: 'acoustic' },
    { name: 'Electronic Kit', preset: 'electronic' },
    { name: 'TR-808 Kit', preset: 'tr808' },
    { name: 'Lo-Fi Kit', preset: 'lofi' },
  ]},
];

const SAMPLE_CATEGORIES = [
  { name: 'Drums', children: [
    'Kick_Deep.wav', 'Kick_Punch.wav', 'Snare_Tight.wav', 'Snare_Fat.wav',
    'HiHat_Closed.wav', 'HiHat_Open.wav', 'Clap_1.wav',
  ]},
  { name: 'Bass', children: ['Sub_Bass_C1.wav'] },
  { name: 'Synth', children: ['Pad_Ambient.wav', 'Lead_Saw.wav'] },
];

export default function BrowserPanel() {
  const [activeTab, setActiveTab] = useState('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const [importedFiles, setImportedFiles] = useState([]);
  const [pluginList, setPluginList] = useState(pluginManager.getAllPlugins());
  const [pluginExpanded, setPluginExpanded] = useState({});
  const [previewingId, setPreviewingId] = useState(null);
  const fileInputRef = useRef(null);
  const pluginInputRef = useRef(null);

  // Subscribe to buffer manager changes
  useEffect(() => {
    const unsub1 = audioBufferManager.subscribe(() => {
      setImportedFiles(audioBufferManager.getAllBuffers());
    });
    const unsub2 = pluginManager.subscribe(() => {
      setPluginList(pluginManager.getAllPlugins());
    });
    // Load existing buffers
    setImportedFiles(audioBufferManager.getAllBuffers());
    return () => { unsub1(); unsub2(); };
  }, []);

  const toggleExpand = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // ─── File Import ───
  const handleFileImport = async (e) => {
    const files = Array.from(e.target.files);
    await audioEngine.init();
    for (const file of files) {
      try {
        await audioBufferManager.loadFile(file);
      } catch (err) {
        console.error('Failed to import:', file.name, err);
      }
    }
    e.target.value = '';
  };

  // ─── Plugin Import ───
  const handlePluginImport = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        await pluginManager.importPlugin(file);
      } catch (err) {
        console.error('Failed to import plugin:', file.name, err);
      }
    }
    e.target.value = '';
  };

  // ─── Drag Start (for browser items → timeline) ───
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/orpheus-item', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // ─── Add file to timeline ───
  const addToTimeline = (bufferInfo) => {
    const proj = useProjectStore.getState();
    const entry = audioBufferManager.getBuffer(bufferInfo.id);
    if (!entry) return;

    let targetTrack = proj.tracks.find(t => t.type === 'audio');
    if (!targetTrack) {
      proj.addTrack('audio');
      targetTrack = useProjectStore.getState().tracks[useProjectStore.getState().tracks.length - 1];
    }

    const lengthBeats = Math.ceil(audioBufferManager.durationToBeats(entry.duration, proj.bpm));
    let startBeat = 0;
    targetTrack.clips.forEach(c => {
      const end = c.startBeat + c.lengthBeats;
      if (end > startBeat) startBeat = end;
    });

    proj.addClip(targetTrack.id, {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trackId: targetTrack.id,
      type: 'audio',
      name: bufferInfo.fileName.replace(/\.[^.]+$/, ''),
      startBeat,
      lengthBeats,
      offset: 0,
      gain: 1,
      fadeIn: 0,
      fadeOut: 0,
      waveformData: entry.waveformData,
      bufferId: bufferInfo.id,
      color: null,
    });
  };

  // ─── Preview (play) a buffer ───
  const handlePreview = async (id) => {
    setPreviewingId(id);
    audioBufferManager.previewBuffer(id);
    setTimeout(() => setPreviewingId(null), 2000);
  };

  // ─── Generate built-in sample ───
  const generateAndPlaySample = async (sampleName) => {
    await audioEngine.init();
    const spec = BUILT_IN_SAMPLES[sampleName];
    if (!spec) return;
    const buffer = audioEngine.generateTone(spec.freq, spec.dur, spec.type === 'noise' ? 'sawtooth' : spec.type);
    audioEngine.playBuffer(buffer, 0, 0.5);
  };

  // ─── Filter ───
  const filterMatch = (name) =>
    !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());

  // ─── Render Content ───
  const getContent = () => {
    switch (activeTab) {
      case 'files':
        return (
          <div className="browser-section">
            <div className="browser-actions" style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1 }}
              >
                + Import Files
              </button>
            </div>
            {importedFiles.length === 0 ? (
              <div className="browser-empty">
                <p className="text-muted" style={{ fontSize: 'var(--text-xs)', textAlign: 'center', padding: '20px 12px' }}>
                  No files imported yet.<br />
                  Drag & drop audio files here or<br />
                  use the Import button above.
                </p>
              </div>
            ) : (
              importedFiles.filter(f => filterMatch(f.fileName)).map((file) => (
                <div
                  key={file.id}
                  className={`browser-item file-item ${previewingId === file.id ? 'previewing' : ''}`}
                  style={{ paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, { type: 'audio-buffer', bufferId: file.id, fileName: file.fileName })}
                  onDoubleClick={() => addToTimeline(file)}
                >
                  <button
                    className="btn-icon-tiny"
                    onClick={(e) => { e.stopPropagation(); handlePreview(file.id); }}
                    title="Preview"
                  >
                    {previewingId === file.id ? '⏸' : '▶'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="browser-item-name truncate">{file.fileName}</div>
                    <div className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {file.duration.toFixed(1)}s • {file.channels}ch • {(file.fileSize / 1024).toFixed(0)}KB
                    </div>
                  </div>
                  <button
                    className="btn-icon-tiny"
                    onClick={(e) => { e.stopPropagation(); addToTimeline(file); }}
                    title="Add to timeline"
                  >
                    +
                  </button>
                </div>
              ))
            )}
          </div>
        );

      case 'plugins': {
        const categories = pluginManager.getCategories();
        return (
          <div className="browser-section">
            <div className="browser-actions" style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm"
                onClick={() => pluginInputRef.current?.click()}
                style={{ flex: 1 }}
              >
                + Import VST Plugin
              </button>
            </div>
            {categories.filter(cat => filterMatch(cat) ||
              pluginList.some(p => p.category === cat && filterMatch(p.name))
            ).map(category => (
              <div key={category}>
                <div
                  className="browser-item has-children"
                  style={{ paddingLeft: 8, fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 1 }}
                  onClick={() => setPluginExpanded(prev => ({ ...prev, [category]: !prev[category] }))}
                >
                  <span className="browser-expand">{pluginExpanded[category] ? '▾' : '▸'}</span>
                  <span className="browser-item-name">{category}</span>
                  <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}>
                    {pluginList.filter(p => p.category === category).length}
                  </span>
                </div>
                {pluginExpanded[category] && pluginList
                  .filter(p => p.category === category && filterMatch(p.name))
                  .map(plugin => (
                    <div
                      key={plugin.id}
                      className="browser-item"
                      style={{ paddingLeft: 24, display: 'flex', alignItems: 'center', gap: 6 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, { type: 'plugin', pluginId: plugin.id, name: plugin.name })}
                    >
                      <span style={{ fontSize: 10, opacity: 0.5 }}>
                        {plugin.format === 'Built-in' ? '⬣' : '⬡'}
                      </span>
                      <span className="browser-item-name" style={{ flex: 1 }}>{plugin.name}</span>
                      <span className="text-muted" style={{ fontSize: 9 }}>{plugin.format}</span>
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
        );
      }

      case 'instruments':
        return (
          <div className="browser-section">
            {INSTRUMENT_ITEMS.filter(item =>
              filterMatch(item.name) || item.children?.some(c => filterMatch(c.name))
            ).map((item, i) => (
              <div key={i}>
                <div
                  className="browser-item has-children"
                  style={{ paddingLeft: 8 }}
                  onClick={() => toggleExpand(item.name)}
                >
                  <span className="browser-expand">{expanded[item.name] ? '▾' : '▸'}</span>
                  <span style={{ marginRight: 6 }}>{item.icon}</span>
                  <span className="browser-item-name">{item.name}</span>
                </div>
                {expanded[item.name] && item.children.filter(c => filterMatch(c.name)).map((child, ci) => (
                  <div
                    key={ci}
                    className="browser-item"
                    style={{ paddingLeft: 32 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'instrument-preset', instrument: item.type, preset: child.preset, name: child.name })}
                    onClick={() => {
                      // Add an instrument track with this preset
                      const proj = useProjectStore.getState();
                      proj.addTrack('midi');
                      const tracks = useProjectStore.getState().tracks;
                      const newTrack = tracks[tracks.length - 1];
                      useProjectStore.getState().updateTrack(newTrack.id, { name: `${item.name} — ${child.name}` });
                    }}
                  >
                    <span className="browser-item-name">{child.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      case 'effects':
        return (
          <div className="browser-section">
            {EFFECT_TYPES.filter(fx => filterMatch(fx.name)).map(fx => (
              <div
                key={fx.id}
                className="browser-item"
                style={{ paddingLeft: 12 }}
                draggable
                onDragStart={(e) => handleDragStart(e, { type: 'effect', effectId: fx.id, name: fx.name })}
              >
                <span style={{ marginRight: 6, opacity: 0.6 }}>🎛</span>
                <span className="browser-item-name">{fx.name}</span>
              </div>
            ))}
          </div>
        );

      case 'samples':
        return (
          <div className="browser-section">
            {SAMPLE_CATEGORIES.filter(cat =>
              filterMatch(cat.name) || cat.children.some(c => filterMatch(c))
            ).map((cat, ci) => (
              <div key={ci}>
                <div
                  className="browser-item has-children"
                  style={{ paddingLeft: 8 }}
                  onClick={() => toggleExpand(cat.name)}
                >
                  <span className="browser-expand">{expanded[cat.name] ? '▾' : '▸'}</span>
                  <span className="browser-item-name">{cat.name}</span>
                </div>
                {expanded[cat.name] && cat.children.filter(c => filterMatch(c)).map((sample, si) => (
                  <div
                    key={si}
                    className="browser-item"
                    style={{ paddingLeft: 28, display: 'flex', alignItems: 'center', gap: 6 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'sample', name: sample })}
                    onClick={() => generateAndPlaySample(sample)}
                  >
                    <button
                      className="btn-icon-tiny"
                      onClick={(e) => { e.stopPropagation(); generateAndPlaySample(sample); }}
                      title="Preview"
                    >
                      ▶
                    </button>
                    <span className="browser-item-name">{sample}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="browser-panel">
      <div className="browser-header">
        <span>BROWSER</span>
      </div>

      <div className="browser-tabs">
        {BROWSER_TABS.map(tab => (
          <button
            key={tab.id}
            className={`browser-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            data-tooltip={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      <div className="browser-search">
        <input
          type="text"
          className="input input-sm"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div className="browser-list">
        {getContent()}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.flac,.aiff,.aif,.m4a,.webm"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />
      <input
        ref={pluginInputRef}
        type="file"
        accept=".dll,.vst,.vst3,.component,.so"
        multiple
        style={{ display: 'none' }}
        onChange={handlePluginImport}
      />
    </div>
  );
}
