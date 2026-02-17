// ============================================
// ORPHEUS DAW — Keyboard Shortcuts
// ============================================

import { audioEngine } from '../audio/AudioEngine';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';

export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        switch (e.code) {
            // Transport
            case 'Space':
                e.preventDefault();
                if (useProjectStore.getState().isPlaying) {
                    audioEngine.stop();
                    useProjectStore.getState().setPlaying(false);
                    useProjectStore.getState().setPlayheadPosition(0);
                } else {
                    audioEngine.play();
                    useProjectStore.getState().setPlaying(true);
                }
                break;

            case 'KeyR':
                if (!ctrl) {
                    e.preventDefault();
                    audioEngine.toggleRecord();
                    useProjectStore.getState().setRecording(audioEngine.isRecording);
                }
                break;

            case 'KeyL':
                e.preventDefault();
                useProjectStore.getState().toggleLoop();
                audioEngine.toggleLoop();
                break;

            case 'KeyM':
                if (!ctrl && !shift) {
                    e.preventDefault();
                    audioEngine.toggleMetronome();
                }
                break;

            // Zoom
            case 'Equal':
            case 'NumpadAdd':
                if (ctrl) {
                    e.preventDefault();
                    useUIStore.getState().zoomIn();
                }
                break;

            case 'Minus':
            case 'NumpadSubtract':
                if (ctrl) {
                    e.preventDefault();
                    useUIStore.getState().zoomOut();
                }
                break;

            // Undo/Redo
            case 'KeyZ':
                if (ctrl && shift) {
                    e.preventDefault();
                    // Redo
                } else if (ctrl) {
                    e.preventDefault();
                    // Undo
                }
                break;

            // Save
            case 'KeyS':
                if (ctrl) {
                    e.preventDefault();
                    useProjectStore.getState().saveProject();
                }
                break;

            // Views
            case 'F1':
                e.preventDefault();
                useUIStore.getState().setActiveView('arrangement');
                break;
            case 'F2':
                e.preventDefault();
                useUIStore.getState().toggleMixer();
                break;
            case 'F3':
                e.preventDefault();
                useUIStore.getState().togglePianoRoll();
                break;
            case 'F4':
                e.preventDefault();
                useUIStore.getState().toggleBrowser();
                break;

            // Tools
            case 'Digit1':
                if (!ctrl) useUIStore.getState().setActiveTool('pointer');
                break;
            case 'Digit2':
                if (!ctrl) useUIStore.getState().setActiveTool('range');
                break;
            case 'Digit3':
                if (!ctrl) useUIStore.getState().setActiveTool('draw');
                break;
            case 'Digit4':
                if (!ctrl) useUIStore.getState().setActiveTool('split');
                break;
            case 'Digit5':
                if (!ctrl) useUIStore.getState().setActiveTool('erase');
                break;
            case 'Digit6':
                if (!ctrl) useUIStore.getState().setActiveTool('automation');
                break;

            // Delete
            case 'Delete':
            case 'Backspace': {
                e.preventDefault();
                const ui = useUIStore.getState();
                const proj = useProjectStore.getState();
                if (ui.selectedClipId && ui.selectedClipTrackId) {
                    proj.removeClip(ui.selectedClipTrackId, ui.selectedClipId);
                    ui.clearSelection();
                }
                break;
            }

            // Add tracks
            case 'KeyT':
                if (ctrl && shift) {
                    e.preventDefault();
                    useProjectStore.getState().addTrack('midi');
                } else if (ctrl) {
                    e.preventDefault();
                    useProjectStore.getState().addTrack('audio');
                }
                break;

            case 'Escape':
                useUIStore.getState().hideContextMenu();
                useUIStore.getState().closeModal();
                useUIStore.getState().clearSelection();
                break;
        }
    });
}
