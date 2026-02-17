import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { SNAP_VALUES } from '../utils/helpers';

const TOOLS = [
  { id: 'pointer',    icon: '⬆', label: 'Pointer (1)', key: '1' },
  { id: 'range',      icon: '⬌', label: 'Range (2)', key: '2' },
  { id: 'draw',       icon: '✏', label: 'Draw (3)', key: '3' },
  { id: 'split',      icon: '✂', label: 'Split (4)', key: '4' },
  { id: 'erase',      icon: '✕', label: 'Erase (5)', key: '5' },
  { id: 'automation', icon: '⌇', label: 'Automation (6)', key: '6' },
  { id: 'mute',       icon: '🔇', label: 'Mute (7)', key: '7' },
];

export default function Toolbar() {
  const { activeTool, setActiveTool, snapEnabled, snapValue, setSnapEnabled, setSnapValue,
    showStemSeparation, showMastering, showAutotune,
    toggleStemSeparation, toggleMastering, toggleAutotune } = useUIStore();

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`btn btn-icon ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
            data-tooltip={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="separator" />

      <div className="toolbar-group">
        <button
          className={`btn btn-sm ${snapEnabled ? 'active' : ''}`}
          onClick={() => setSnapEnabled(!snapEnabled)}
          data-tooltip="Snap to Grid"
        >
          🧲 Snap
        </button>
        <select
          className="select input-sm"
          value={snapValue}
          onChange={(e) => setSnapValue(parseFloat(e.target.value))}
          style={{ width: 72 }}
        >
          {SNAP_VALUES.map(sv => (
            <option key={sv.label} value={sv.value}>{sv.label}</option>
          ))}
        </select>
      </div>

      <div className="separator" />

      <div className="toolbar-group">
        <button className="btn btn-sm btn-ghost" data-tooltip="Quantize Selection">
          Quantize
        </button>
      </div>

      <div className="toolbar-spacer" />

      {/* Advanced Feature Toggles */}
      <div className="toolbar-group toolbar-features">
        <button
          className={`btn btn-sm btn-feature ${showStemSeparation ? 'active' : ''}`}
          onClick={toggleStemSeparation}
          data-tooltip="STEM Separation (F5)"
        >
          🎚 STEM
        </button>
        <button
          className={`btn btn-sm btn-feature ${showMastering ? 'active' : ''}`}
          onClick={toggleMastering}
          data-tooltip="Mastering (F6)"
        >
          🎛 Master
        </button>
        <button
          className={`btn btn-sm btn-feature ${showAutotune ? 'active' : ''}`}
          onClick={toggleAutotune}
          data-tooltip="Autotune (F7)"
        >
          🎤 Tune
        </button>
      </div>
    </div>
  );
}
