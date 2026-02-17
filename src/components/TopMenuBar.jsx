import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';

const MENUS = {
  File: [
    { label: 'New Project', shortcut: 'Ctrl+N', action: 'newProject' },
    { label: 'Open Project...', shortcut: 'Ctrl+O', action: 'openProject' },
    { divider: true },
    { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
    { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
    { divider: true },
    { label: 'Export Audio...', shortcut: 'Ctrl+Shift+E', action: 'export' },
    { label: 'Export MIDI...', action: 'exportMidi' },
    { divider: true },
    { label: 'Project Settings...', action: 'settings' },
  ],
  Edit: [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
    { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: 'redo' },
    { divider: true },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
    { label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
    { label: 'Delete', shortcut: 'Del', action: 'delete' },
    { divider: true },
    { label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' },
    { label: 'Deselect All', shortcut: 'Ctrl+D', action: 'deselectAll' },
  ],
  View: [
    { label: 'Arrangement', shortcut: 'F1', action: 'viewArrangement' },
    { label: 'Mixer', shortcut: 'F2', action: 'viewMixer' },
    { label: 'Piano Roll', shortcut: 'F3', action: 'viewPianoRoll' },
    { label: 'Browser', shortcut: 'F4', action: 'viewBrowser' },
    { divider: true },
    { label: 'Zoom In', shortcut: 'Ctrl++', action: 'zoomIn' },
    { label: 'Zoom Out', shortcut: 'Ctrl+-', action: 'zoomOut' },
    { label: 'Zoom to Fit', shortcut: 'Ctrl+0', action: 'zoomFit' },
  ],
  Track: [
    { label: 'Add Audio Track', shortcut: 'Ctrl+T', action: 'addAudio' },
    { label: 'Add MIDI Track', shortcut: 'Ctrl+Shift+T', action: 'addMidi' },
    { label: 'Add Instrument Track', action: 'addInstrument' },
    { divider: true },
    { label: 'Duplicate Track', shortcut: 'Ctrl+D', action: 'duplicateTrack' },
    { label: 'Remove Track', action: 'removeTrack' },
    { divider: true },
    { label: 'Group Tracks', action: 'groupTracks' },
    { label: 'Freeze Track', action: 'freezeTrack' },
  ],
  Transport: [
    { label: 'Play / Stop', shortcut: 'Space', action: 'playStop' },
    { label: 'Record', shortcut: 'R', action: 'record' },
    { label: 'Loop', shortcut: 'L', action: 'loop' },
    { divider: true },
    { label: 'Metronome', shortcut: 'M', action: 'metronome' },
    { label: 'Tap Tempo', shortcut: 'T', action: 'tapTempo' },
    { divider: true },
    { label: 'Go to Start', shortcut: 'Home', action: 'goToStart' },
    { label: 'Go to End', shortcut: 'End', action: 'goToEnd' },
  ],
  Help: [
    { label: 'Keyboard Shortcuts', action: 'shortcuts' },
    { label: 'Documentation', action: 'docs' },
    { divider: true },
    { label: 'About Orpheus', action: 'about' },
  ],
};

export default function TopMenuBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const projectName = useProjectStore(s => s.projectName);
  const { addTrack, saveProject, exportProject, newProject } = useProjectStore();
  const { setActiveView, toggleMixer, togglePianoRoll, toggleBrowser, zoomIn, zoomOut, setActiveModal } = useUIStore();

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAction = (action) => {
    setOpenMenu(null);
    switch (action) {
      case 'newProject': newProject(); break;
      case 'save': saveProject(); break;
      case 'export': exportProject(); break;
      case 'addAudio': addTrack('audio'); break;
      case 'addMidi': addTrack('midi'); break;
      case 'addInstrument': addTrack('midi'); break;
      case 'viewArrangement': setActiveView('arrangement'); break;
      case 'viewMixer': toggleMixer(); break;
      case 'viewPianoRoll': togglePianoRoll(); break;
      case 'viewBrowser': toggleBrowser(); break;
      case 'zoomIn': zoomIn(); break;
      case 'zoomOut': zoomOut(); break;
      case 'about': setActiveModal('about'); break;
      case 'settings': setActiveModal('settings'); break;
    }
  };

  return (
    <div className="top-menu-bar" ref={menuRef}>
      <div className="menu-logo">
        <span className="logo-icon">♪</span>
        <span className="logo-text">ORPHEUS</span>
      </div>
      <div className="menu-items">
        {Object.entries(MENUS).map(([menuName, items]) => (
          <div
            key={menuName}
            className={`menu-trigger ${openMenu === menuName ? 'open' : ''}`}
            onMouseDown={() => setOpenMenu(openMenu === menuName ? null : menuName)}
            onMouseEnter={() => openMenu && setOpenMenu(menuName)}
          >
            {menuName}
            {openMenu === menuName && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {items.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="dropdown-divider" />
                  ) : (
                    <div
                      key={i}
                      className="dropdown-item"
                      onClick={() => handleAction(item.action)}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="menu-project-name">{projectName}</div>
      <div className="menu-spacer" />
      <div className="menu-indicators">
        <span className="cpu-indicator" data-tooltip="CPU Load">
          <span className="indicator-label">CPU</span>
          <span className="indicator-bar"><span className="indicator-fill" style={{ width: '12%' }} /></span>
        </span>
      </div>
    </div>
  );
}
