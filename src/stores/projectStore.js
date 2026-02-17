// ============================================
// ORPHEUS DAW — Project Store (Zustand)
// ============================================

import { create } from 'zustand';
import { uid, getTrackColor, generateWaveformData } from '../utils/helpers';
import { useUIStore } from './uiStore';

const createDefaultTrack = (index, type = 'audio', name) => ({
    id: uid(),
    name: name || `${type === 'audio' ? 'Audio' : type === 'midi' ? 'MIDI' : 'Inst'} ${index + 1}`,
    type,
    color: getTrackColor(index),
    volume: 0.75,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    clips: [],
    effects: [],
    automationLanes: [],
    height: 80,
    visible: true,
});

const createAudioClip = (trackId, startBeat, lengthBeats, name) => ({
    id: uid(),
    trackId,
    type: 'audio',
    name: name || 'Audio Clip',
    startBeat,
    lengthBeats,
    offset: 0,
    gain: 1,
    fadeIn: 0,
    fadeOut: 0,
    waveformData: generateWaveformData(500, 'random'),
    color: null,
});

const createMidiClip = (trackId, startBeat, lengthBeats, name, notes = []) => ({
    id: uid(),
    trackId,
    type: 'midi',
    name: name || 'MIDI Clip',
    startBeat,
    lengthBeats,
    notes,
    color: null,
});

const createMidiNote = (pitch, startBeat, lengthBeats, velocity = 100) => ({
    id: uid(),
    pitch,
    startBeat,
    lengthBeats,
    velocity,
});

// Demo project
function createDemoProject() {
    const tracks = [];

    // Track 1: Drums (Audio)
    const drums = createDefaultTrack(0, 'audio', 'Drums');
    drums.clips = [
        { ...createAudioClip(drums.id, 0, 8, 'Drum Loop 1'), waveformData: generateWaveformData(500, 'drum') },
        { ...createAudioClip(drums.id, 8, 8, 'Drum Loop 2'), waveformData: generateWaveformData(500, 'drum') },
        { ...createAudioClip(drums.id, 16, 16, 'Drum Fill'), waveformData: generateWaveformData(500, 'drum') },
    ];
    tracks.push(drums);

    // Track 2: Bass (MIDI)
    const bass = createDefaultTrack(1, 'midi', 'Bass Synth');
    const bassNotes = [];
    const bassPattern = [36, 36, 38, 36, 40, 36, 38, 41];
    for (let bar = 0; bar < 4; bar++) {
        for (let i = 0; i < bassPattern.length; i++) {
            bassNotes.push(createMidiNote(bassPattern[i], bar * 8 + i, 0.9, 80 + Math.random() * 40));
        }
    }
    bass.clips = [createMidiClip(bass.id, 0, 32, 'Bass Line', bassNotes)];
    tracks.push(bass);

    // Track 3: Lead Synth (MIDI)
    const lead = createDefaultTrack(2, 'midi', 'Lead Melody');
    const leadNotes = [];
    const melody = [60, 64, 67, 72, 71, 67, 64, 60, 62, 64, 67, 69, 67, 64, 62, 60];
    for (let i = 0; i < melody.length; i++) {
        leadNotes.push(createMidiNote(melody[i], i * 2, 1.8, 70 + Math.random() * 50));
    }
    lead.clips = [createMidiClip(lead.id, 0, 32, 'Lead Melody', leadNotes)];
    lead.volume = 0.6;
    tracks.push(lead);

    // Track 4: Pad (Audio)
    const pad = createDefaultTrack(3, 'audio', 'Ambient Pad');
    pad.clips = [
        { ...createAudioClip(pad.id, 0, 32, 'Pad Texture'), waveformData: generateWaveformData(500, 'vocal') },
    ];
    pad.volume = 0.45;
    pad.pan = -0.2;
    tracks.push(pad);

    // Track 5: Vocals (Audio)
    const vox = createDefaultTrack(4, 'audio', 'Vocals');
    vox.clips = [
        { ...createAudioClip(vox.id, 8, 16, 'Verse'), waveformData: generateWaveformData(500, 'vocal') },
        { ...createAudioClip(vox.id, 28, 4, 'Ad-lib'), waveformData: generateWaveformData(500, 'vocal') },
    ];
    vox.volume = 0.7;
    tracks.push(vox);

    // Track 6: FX (Audio)
    const fx = createDefaultTrack(5, 'audio', 'FX / Risers');
    fx.clips = [
        { ...createAudioClip(fx.id, 14, 2, 'Riser'), waveformData: generateWaveformData(500, 'sine') },
        { ...createAudioClip(fx.id, 30, 2, 'Impact'), waveformData: generateWaveformData(500, 'drum') },
    ];
    fx.volume = 0.5;
    tracks.push(fx);

    return tracks;
}

export const useProjectStore = create((set, get) => ({
    // Project metadata
    projectName: 'Untitled Project',
    bpm: 128,
    timeSignature: [4, 4],
    sampleRate: 44100,

    // Tracks
    tracks: createDemoProject(),

    // Transport
    isPlaying: false,
    isRecording: false,
    isLooping: true,
    loopStart: 0,
    loopEnd: 32,
    playheadPosition: 0,
    masterVolume: 0.8,

    // Undo/redo
    undoStack: [],
    redoStack: [],
    _maxHistory: 50,

    // Push current state to undo stack before making changes
    _pushUndo: () => {
        const state = get();
        const snapshot = {
            tracks: JSON.parse(JSON.stringify(state.tracks)),
            projectName: state.projectName,
            bpm: state.bpm,
            timeSignature: state.timeSignature,
        };
        set(prev => ({
            undoStack: [...prev.undoStack.slice(-prev._maxHistory), snapshot],
            redoStack: [],
        }));
    },

    undo: () => {
        const { undoStack, tracks, projectName, bpm, timeSignature } = get();
        if (undoStack.length === 0) return;
        const current = { tracks: JSON.parse(JSON.stringify(tracks)), projectName, bpm, timeSignature };
        const prev = undoStack[undoStack.length - 1];
        set({
            ...prev,
            undoStack: undoStack.slice(0, -1),
            redoStack: [...get().redoStack, current],
        });
    },

    redo: () => {
        const { redoStack, tracks, projectName, bpm, timeSignature } = get();
        if (redoStack.length === 0) return;
        const current = { tracks: JSON.parse(JSON.stringify(tracks)), projectName, bpm, timeSignature };
        const next = redoStack[redoStack.length - 1];
        set({
            ...next,
            redoStack: redoStack.slice(0, -1),
            undoStack: [...get().undoStack, current],
        });
    },
    // Actions
    setProjectName: (name) => set({ projectName: name }),
    setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, bpm)) }),
    setTimeSignature: (ts) => set({ timeSignature: ts }),
    setMasterVolume: (v) => set({ masterVolume: v }),

    setPlaying: (v) => set({ isPlaying: v }),
    setRecording: (v) => set({ isRecording: v }),
    toggleLoop: () => set((s) => ({ isLooping: !s.isLooping })),
    setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
    setLoopRange: (start, end) => set({ loopStart: start, loopEnd: end }),

    addTrack: (type = 'audio') => set((state) => {
        get()._pushUndo();
        const track = createDefaultTrack(state.tracks.length, type);
        return { tracks: [...state.tracks, track] };
    }),

    removeTrack: (id) => {
        get()._pushUndo();
        set((state) => ({ tracks: state.tracks.filter(t => t.id !== id) }));
    },

    duplicateTrack: (id) => set((state) => {
        const source = state.tracks.find(t => t.id === id);
        if (!source) return state;
        const copy = {
            ...source,
            id: uid(),
            name: `${source.name} (Copy)`,
            clips: source.clips.map(c => ({ ...c, id: uid() }))
        };
        const idx = state.tracks.findIndex(t => t.id === id);
        const tracks = [...state.tracks];
        tracks.splice(idx + 1, 0, copy);
        return { tracks };
    }),

    updateTrack: (id, updates) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),

    toggleMute: (id) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, mute: !t.mute } : t)
    })),

    toggleSolo: (id) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, solo: !t.solo } : t)
    })),

    toggleArmed: (id) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, armed: !t.armed } : t)
    })),

    setTrackVolume: (id, volume) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, volume } : t)
    })),

    setTrackPan: (id, pan) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, pan } : t)
    })),

    addTrackEffect: (trackId, effect) => {
        get()._pushUndo();
        set((state) => ({
            tracks: state.tracks.map(t =>
                t.id === trackId ? { ...t, effects: [...t.effects, { ...effect, id: uid() }] } : t
            )
        }));
    },

    removeTrackEffect: (trackId, effectId) => {
        get()._pushUndo();
        set((state) => ({
            tracks: state.tracks.map(t =>
                t.id === trackId ? { ...t, effects: t.effects.filter(e => e.id !== effectId) } : t
            )
        }));
    },

    renameTrack: (trackId, name) => set((state) => ({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, name } : t)
    })),

    setTrackColor: (trackId, color) => set((state) => ({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, color } : t)
    })),

    quantizeSelection: (grid = 0.25) => {
        const state = get();
        const { selectedClipId, selectedClipTrackId } = useUIStore.getState();

        if (!selectedClipId || !selectedClipTrackId) return;

        const trackIndex = state.tracks.findIndex(t => t.id === selectedClipTrackId);
        if (trackIndex === -1) return;

        const track = state.tracks[trackIndex];
        const clipIndex = track.clips.findIndex(c => c.id === selectedClipId);
        if (clipIndex === -1) return;

        state._pushUndo();

        const clip = { ...track.clips[clipIndex] };

        // Quantize Clip Start
        clip.startBeat = Math.round(clip.startBeat / grid) * grid;

        // If MIDI, quantize notes
        if (clip.type === 'midi' && clip.notes) {
            clip.notes = clip.notes.map(note => ({
                ...note,
                startBeat: Math.round(note.startBeat / grid) * grid,
                lengthBeats: Math.max(grid, Math.round(note.lengthBeats / grid) * grid)
            }));
        }

        const newTracks = [...state.tracks];
        newTracks[trackIndex] = {
            ...track,
            clips: [
                ...track.clips.slice(0, clipIndex),
                clip,
                ...track.clips.slice(clipIndex + 1)
            ]
        };

        set({ tracks: newTracks });
    },

    addClip: (trackId, clip) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        )
    })),

    removeClip: (trackId, clipId) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t
        )
    })),

    updateClip: (trackId, clipId, updates) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? {
                ...t,
                clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
            } : t
        )
    })),

    // MIDI note editing
    addNote: (trackId, clipId, note) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? {
                ...t,
                clips: t.clips.map(c =>
                    c.id === clipId ? { ...c, notes: [...(c.notes || []), note] } : c
                )
            } : t
        )
    })),

    removeNote: (trackId, clipId, noteId) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? {
                ...t,
                clips: t.clips.map(c =>
                    c.id === clipId ? { ...c, notes: (c.notes || []).filter(n => n.id !== noteId) } : c
                )
            } : t
        )
    })),

    updateNote: (trackId, clipId, noteId, updates) => set((state) => ({
        tracks: state.tracks.map(t =>
            t.id === trackId ? {
                ...t,
                clips: t.clips.map(c =>
                    c.id === clipId ? {
                        ...c,
                        notes: (c.notes || []).map(n => n.id === noteId ? { ...n, ...updates } : n)
                    } : c
                )
            } : t
        )
    })),

    // Automation
    updateTrackAutomation: (trackId, laneIndex, param, points) => set((state) => ({
        tracks: state.tracks.map(t => {
            if (t.id !== trackId) return t;
            const lanes = [...(t.automationLanes || [])];
            while (lanes.length <= laneIndex) lanes.push({ param: 'volume', points: [] });
            lanes[laneIndex] = { param, points };
            return { ...t, automationLanes: lanes };
        })
    })),

    addAutomationLane: (trackId) => {
        get()._pushUndo();
        set((state) => ({
            tracks: state.tracks.map(t =>
                t.id === trackId
                    ? { ...t, automationLanes: [...(t.automationLanes || []), { param: 'volume', points: [{ beat: 0, value: 0.75 }, { beat: 32, value: 0.75 }] }] }
                    : t
            )
        }));
    },

    removeAutomationLane: (trackId, laneIndex) => {
        get()._pushUndo();
        set((state) => ({
            tracks: state.tracks.map(t =>
                t.id === trackId
                    ? { ...t, automationLanes: (t.automationLanes || []).filter((_, i) => i !== laneIndex) }
                    : t
            )
        }));
    },

    // Serialization
    saveProject: () => {
        const state = get();
        const data = {
            projectName: state.projectName,
            bpm: state.bpm,
            timeSignature: state.timeSignature,
            tracks: state.tracks,
            loopStart: state.loopStart,
            loopEnd: state.loopEnd,
        };
        const json = JSON.stringify(data);
        localStorage.setItem('orpheus_project', json);
        return json;
    },

    loadProject: () => {
        const json = localStorage.getItem('orpheus_project');
        if (!json) return false;
        try {
            const data = JSON.parse(json);
            set(data);
            return true;
        } catch {
            return false;
        }
    },

    exportProject: () => {
        const state = get();
        const data = {
            projectName: state.projectName,
            bpm: state.bpm,
            timeSignature: state.timeSignature,
            tracks: state.tracks.map(t => ({
                ...t,
                clips: t.clips.map(c => ({
                    ...c,
                    waveformData: undefined // Don't export waveform data
                }))
            })),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.projectName}.orpheus`;
        a.click();
        URL.revokeObjectURL(url);
    },

    newProject: () => set({
        projectName: 'Untitled Project',
        bpm: 120,
        timeSignature: [4, 4],
        tracks: [createDefaultTrack(0, 'audio')],
        playheadPosition: 0,
        isPlaying: false,
        isRecording: false,
        undoStack: [],
        redoStack: [],
    }),

    // Import project from file
    importProject: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    set({
                        ...data,
                        isPlaying: false,
                        isRecording: false,
                        playheadPosition: 0,
                        undoStack: [],
                        redoStack: [],
                    });
                    resolve(true);
                } catch {
                    reject(new Error('Invalid project file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },
}));
