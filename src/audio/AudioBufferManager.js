// ============================================
// ORPHEUS DAW — Audio Buffer Manager
// ============================================
// Central registry for all loaded audio buffers with real WAV decoding

import { audioEngine } from './AudioEngine';

class AudioBufferManager {
    constructor() {
        this.buffers = new Map();     // bufferId → { buffer, waveformData, fileName, duration, sampleRate, channels }
        this.listeners = new Set();
    }

    /**
     * Load an audio file (WAV, MP3, OGG, FLAC, AIFF) and decode it
     * @param {File} file - The file to load
     * @returns {Promise<string>} bufferId
     */
    async loadFile(file) {
        await audioEngine.init();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioEngine.context.decodeAudioData(arrayBuffer);
        const id = `buf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const waveformData = this.extractWaveformPeaks(audioBuffer, 800);

        this.buffers.set(id, {
            buffer: audioBuffer,
            waveformData,
            fileName: file.name,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels,
            fileSize: file.size,
        });

        this._notify();
        return id;
    }

    /**
     * Extract waveform peak data for visual display
     * @param {AudioBuffer} audioBuffer 
     * @param {number} numPoints - Number of peak points to extract
     * @returns {number[]} normalized peak values 0-1
     */
    extractWaveformPeaks(audioBuffer, numPoints = 800) {
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const blockSize = Math.floor(channelData.length / numPoints);
        const peaks = [];

        for (let i = 0; i < numPoints; i++) {
            const start = i * blockSize;
            let max = 0;
            for (let j = 0; j < blockSize && start + j < channelData.length; j++) {
                const abs = Math.abs(channelData[start + j]);
                if (abs > max) max = abs;
            }
            peaks.push(max);
        }

        // Normalize peaks
        const peakMax = Math.max(...peaks, 0.001);
        return peaks.map(p => p / peakMax);
    }

    /**
     * Get a buffer by ID
     */
    getBuffer(id) {
        return this.buffers.get(id) || null;
    }

    /**
     * Get all loaded buffers
     */
    getAllBuffers() {
        return Array.from(this.buffers.entries()).map(([id, data]) => ({
            id,
            ...data,
            buffer: undefined, // Don't expose raw buffer in lists
        }));
    }

    /**
     * Play a buffer directly for preview
     */
    previewBuffer(id) {
        const entry = this.buffers.get(id);
        if (!entry) return;
        audioEngine.playBuffer(entry.buffer, 0, 0.8);
    }

    /**
     * Play a buffer at a specific time with offset and duration for clip playback
     */
    playClip(id, when, offset = 0, duration = null, gain = 1) {
        const entry = this.buffers.get(id);
        if (!entry || !audioEngine.context) return null;

        const source = audioEngine.context.createBufferSource();
        source.buffer = entry.buffer;
        const gainNode = audioEngine.context.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode);
        gainNode.connect(audioEngine.masterGain);

        if (duration) {
            source.start(when, offset, duration);
        } else {
            source.start(when, offset);
        }

        audioEngine.scheduledSources.push(source);
        return source;
    }

    /**
     * Remove a buffer from the registry
     */
    removeBuffer(id) {
        this.buffers.delete(id);
        this._notify();
    }

    /**
     * Calculate beats from duration
     */
    durationToBeats(durationSeconds, bpm) {
        return (durationSeconds / 60) * bpm;
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    _notify() {
        for (const fn of this.listeners) fn(this.getAllBuffers());
    }
}

export const audioBufferManager = new AudioBufferManager();
