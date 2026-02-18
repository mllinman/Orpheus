// ============================================
// ORPHEUS DAW — Audio Engine
// ============================================

import { audioBufferManager } from './AudioBufferManager';

export class AudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.analyser = null;
        this.isPlaying = false;
        this.isRecording = false;
        this.isLooping = false;
        this.bpm = 120;
        this.timeSignature = [4, 4];
        this.startTime = 0;
        this.pauseTime = 0;
        this.loopStart = 0;
        this.loopEnd = 16;
        this.trackProcessors = new Map();
        this.scheduledSources = [];
        this.metronomeEnabled = false;
        this.listeners = new Set();
        this._storeRef = null; // Set externally to avoid circular deps

        // Mastering Chain Nodes
        this.mastering = {
            in: null,
            preEQ: { low: null, mid: null, high: null, lowCut: null },
            compressor: null,
            limiter: null,
            out: null,
            gainReduction: 0 // Simulated for now as WebAudio doesn't expose it easily
        };

        // Autotune / Pitch Detection
        this.pitchDetector = {
            buffer: new Float32Array(2048),
            detectedPitch: 0,
            clarity: 0,
            enabled: false
        };
    }

    // Called from App.jsx or main to inject the store reference
    setStoreRef(storeRef) {
        this._storeRef = storeRef;
    }

    async init() {
        if (this.context) return;
        this.context = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100,
            latencyHint: 'interactive'
        });

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.8;

        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        // Initialize Mastering Chain
        this._initMasteringChain();

        // Connect Master Gain -> Mastering Chain -> Analyser -> Destination
        this.masterGain.connect(this.mastering.in);
        this.mastering.out.connect(this.analyser);
        this.analyser.connect(this.context.destination);

        this._startPitchDetection();

        // Create metronome buffer
        this.clickBuffer = this._createClickBuffer();
        this.accentBuffer = this._createAccentBuffer();
    }

    _createClickBuffer() {
        const length = this.context.sampleRate * 0.02;
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / this.context.sampleRate;
            data[i] = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 200) * 0.3;
        }
        return buffer;
    }

    _createAccentBuffer() {
        const length = this.context.sampleRate * 0.03;
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / this.context.sampleRate;
            data[i] = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 150) * 0.5;
        }
        return buffer;
    }

    get currentTime() {
        if (!this.context) return 0;
        if (this.isPlaying) {
            return this.context.currentTime - this.startTime;
        }
        return this.pauseTime;
    }

    get currentBeat() {
        return (this.currentTime / 60) * this.bpm;
    }

    get currentBar() {
        return Math.floor(this.currentBeat / this.timeSignature[0]) + 1;
    }

    beatToTime(beat) {
        return (beat / this.bpm) * 60;
    }

    timeToBeats(time) {
        return (time / 60) * this.bpm;
    }

    setBPM(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
        this._notify();
    }

    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(value, this.context.currentTime);
        }
    }

    async play() {
        if (!this.context) await this.init();
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        this.isPlaying = true;
        this.startTime = this.context.currentTime - this.pauseTime;
        this._schedulePlayback();
        this._notify();
    }

    pause() {
        this.pauseTime = this.currentTime;
        this.isPlaying = false;
        this._stopAllSources();
        this._notify();
    }

    stop() {
        this.isPlaying = false;
        this.isRecording = false;
        this.pauseTime = 0;
        this._stopAllSources();
        this._notify();
    }

    toggleRecord() {
        this.isRecording = !this.isRecording;
        if (this.isRecording && !this.isPlaying) {
            this.play();
        }
        this._notify();
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        this._notify();
    }

    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;
        this._notify();
    }

    seekTo(time) {
        this.pauseTime = Math.max(0, time);
        if (this.isPlaying) {
            this._stopAllSources();
            this.startTime = this.context.currentTime - this.pauseTime;
            this._schedulePlayback();
        }
        this._notify();
    }

    _schedulePlayback() {
        this._stopAllSources();
        this._scheduleClipsFromStore();
    }

    _scheduleClipsFromStore() {
        try {
            // Use the injected store reference
            const store = this._storeRef ? this._storeRef() : null;
            if (!store || !store.tracks) return;

            const now = this.context.currentTime;
            const offset = this.pauseTime; // current playback offset in seconds

            for (const track of store.tracks) {
                // Skip muted tracks or handle solo
                const hasSolo = store.tracks.some(t => t.solo);
                if (hasSolo && !track.solo) continue;
                if (track.mute) continue;

                const trackGain = this.context.createGain();
                trackGain.gain.value = track.volume;

                // Panning
                let panNode = null;
                if (this.context.createStereoPanner) {
                    panNode = this.context.createStereoPanner();
                    panNode.pan.value = track.pan;
                    trackGain.connect(panNode);
                    panNode.connect(this.masterGain);
                } else {
                    trackGain.connect(this.masterGain);
                }

                // Track Effects Chain
                let inputNode = null; // Will be the entry point for sources
                let lastNode = null;

                // Create Effect Nodes
                if (track.effects && track.effects.length > 0) {
                    track.effects.forEach(effect => {
                        if (effect.type === 'eq' && effect.active) {
                            // Simple 3-band EQ
                            const low = this.context.createBiquadFilter();
                            low.type = 'lowshelf';
                            low.frequency.value = effect.params.lowFreq || 100;
                            low.gain.value = effect.params.low || 0;

                            const mid = this.context.createBiquadFilter();
                            mid.type = 'peaking';
                            mid.frequency.value = effect.params.midFreq || 1000;
                            mid.gain.value = effect.params.mid || 0;

                            const high = this.context.createBiquadFilter();
                            high.type = 'highshelf';
                            high.frequency.value = effect.params.highFreq || 10000;
                            high.gain.value = effect.params.high || 0;

                            // Connect: low -> mid -> high
                            low.connect(mid);
                            mid.connect(high);

                            if (!inputNode) inputNode = low;
                            if (lastNode) lastNode.connect(low);
                            lastNode = high;
                        }
                    });
                }

                // If effects exist, connect chain to trackGain
                if (lastNode) {
                    lastNode.connect(destination);
                    // destination is Pan or Master
                    // Wait, sources connect to trackGain, trackGain connects to Panner, Panner connects to Master.
                    // Correct chain: Source -> [Effects] -> TrackGain -> Panner -> Master
                    // But trackGain controls volume. Panner controls pan.
                    // Let's do: Source -> [Effects] -> TrackGain -> Panner -> Master
                }

                // Actually, let's simplify: 
                // Sources connect to 'entryNode'.
                // entryNode -> Effects -> TrackGain

                let entryNode = this.context.createGain();

                let current = entryNode;
                if (track.effects && track.effects.length > 0) {
                    track.effects.forEach(effect => {
                        if (effect.type === 'eq' && effect.active) {
                            const low = this.context.createBiquadFilter();
                            low.type = 'lowshelf';
                            low.frequency.value = effect.params.lowFreq || 100;
                            low.gain.value = effect.params.low || 0;

                            const mid = this.context.createBiquadFilter();
                            mid.type = 'peaking';
                            mid.frequency.value = effect.params.midFreq || 1000;
                            mid.gain.value = effect.params.mid || 0;

                            const high = this.context.createBiquadFilter();
                            high.type = 'highshelf';
                            high.frequency.value = effect.params.highFreq || 10000;
                            high.gain.value = effect.params.high || 0;

                            current.connect(low);
                            low.connect(mid);
                            mid.connect(high);
                            current = high;
                        }
                    });
                }

                // Connect end of effects to trackGain
                current.connect(trackGain);

                for (const clip of track.clips) {
                    const clipStartTime = this.beatToTime(clip.startBeat);
                    const clipEndTime = this.beatToTime(clip.startBeat + clip.lengthBeats);

                    // Skip clips that have already passed
                    if (clipEndTime <= offset) continue;

                    if (clip.type === 'audio' && clip.bufferId) {
                        const entry = audioBufferManager.getBuffer(clip.bufferId);
                        if (!entry || !entry.buffer) continue;

                        const audioOffset = Math.max(0, offset - clipStartTime) + (clip.offset || 0);
                        const when = now + Math.max(0, clipStartTime - offset);
                        const duration = Math.min(
                            entry.buffer.duration - audioOffset,
                            clipEndTime - Math.max(offset, clipStartTime)
                        );

                        const source = this.context.createBufferSource();
                        source.buffer = entry.buffer;
                        const clipGain = this.context.createGain();
                        // Initialize gain at 0 if fading in, else clip.gain
                        const baseGain = clip.gain || 1;
                        const fadeInDur = clip.fadeIn || 0;
                        const fadeOutDur = clip.fadeOut || 0;

                        // Start value
                        if (fadeInDur > 0) {
                            clipGain.gain.setValueAtTime(0, when);
                            clipGain.gain.linearRampToValueAtTime(baseGain, when + Math.min(fadeInDur, duration));
                        } else {
                            clipGain.gain.setValueAtTime(baseGain, when);
                        }

                        // Fade out
                        if (fadeOutDur > 0) {
                            // Ensure we don't start fade out before fade in finishes? 
                            // Or just ramp from whatever current is.
                            // Fade out starts at end - fadeOutDur.
                            const fadeOutStart = when + duration - fadeOutDur;
                            if (fadeOutStart > when) {
                                clipGain.gain.setValueAtTime(baseGain, fadeOutStart);
                                clipGain.gain.linearRampToValueAtTime(0.001, when + duration);
                            } else {
                                // Short clip, overlap? Just ramp down from start?
                                // Simplified: if overlap, intersection logic is hard. 
                                // Let's just assume fades valid.
                                clipGain.gain.linearRampToValueAtTime(0.001, when + duration);
                            }
                        }

                        source.connect(clipGain);
                        // Connect to entry of track chain (Effects -> TrackGain)
                        clipGain.connect(entryNode);

                        if (duration > 0) {
                            // Apply Autotune (Simple Detune for now)
                            if (track.autotune && track.autotune.enabled) {
                                source.detune.value = track.autotune.retune || 0;
                            }

                            if (clip.isReversed) {
                                try {
                                    source.playbackRate.value = -1;
                                    const startPoint = audioOffset + duration;
                                    if (startPoint <= entry.buffer.duration + 0.001) {
                                        source.start(when, startPoint, duration);
                                        this.scheduledSources.push({ source, trackId: track.id });
                                    }
                                } catch (e) {
                                    // Fallback if issues
                                    console.warn('Reverse playback fail', e);
                                }
                            } else {
                                source.start(when, audioOffset, duration);
                                this.scheduledSources.push({ source, trackId: track.id });
                            }
                        }
                    } else if (clip.type === 'audio' && !clip.bufferId) {
                        // Demo audio clips without real buffers — generate noise burst
                        const when = now + Math.max(0, clipStartTime - offset);
                        const dur = clipEndTime - Math.max(offset, clipStartTime);
                        if (dur > 0) {
                            const bufLen = Math.min(dur, 30) * this.context.sampleRate;
                            const noiseBuffer = this.context.createBuffer(1, bufLen, this.context.sampleRate);
                            const data = noiseBuffer.getChannelData(0);
                            for (let s = 0; s < bufLen; s++) {
                                const t = s / this.context.sampleRate;
                                const env = Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.01);
                                data[s] = (Math.sin(t * 220 * Math.PI) * 0.15 + (Math.random() - 0.5) * 0.08) * env;
                            }
                            const src = this.context.createBufferSource();
                            src.buffer = noiseBuffer;
                            const cGain = this.context.createGain();
                            cGain.gain.value = (clip.gain || 1) * 0.3;
                            src.connect(cGain);
                            cGain.connect(entryNode);
                            const audioOff = Math.max(0, offset - clipStartTime);
                            src.start(when, audioOff);
                            this.scheduledSources.push({ source: src, trackId: track.id });
                        }
                    } else if (clip.type === 'midi' && clip.notes) {
                        // Play MIDI notes as simple tones
                        for (const note of clip.notes) {
                            const noteAbsStart = this.beatToTime(clip.startBeat + note.startBeat);
                            const noteDuration = this.beatToTime(note.lengthBeats);
                            const noteEnd = noteAbsStart + noteDuration;

                            if (noteEnd <= offset) continue;

                            const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
                            const when = now + Math.max(0, noteAbsStart - offset);
                            const dur = Math.min(noteDuration, noteEnd - Math.max(offset, noteAbsStart));

                            if (dur > 0.01) {
                                const osc = this.context.createOscillator();
                                const noteGain = this.context.createGain();
                                osc.type = 'triangle';
                                osc.frequency.value = freq;
                                const vel = (note.velocity || 100) / 127;
                                noteGain.gain.setValueAtTime(0.001, when);
                                noteGain.gain.linearRampToValueAtTime(vel * 0.25, when + 0.005);
                                noteGain.gain.setValueAtTime(vel * 0.25, when + dur - 0.01);
                                noteGain.gain.linearRampToValueAtTime(0.001, when + dur);
                                osc.connect(noteGain);
                                noteGain.connect(entryNode);
                                osc.start(when);
                                osc.stop(when + dur);
                                this.scheduledSources.push(osc);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Store not yet available during init
        }
    }

    _stopAllSources() {
        for (const item of this.scheduledSources) {
            try {
                if (item.source) item.source.stop();
                else item.stop(); // Fallback if it was just a node
            } catch (e) { /* already stopped */ }
        }
        this.scheduledSources = [];
    }

    playBuffer(buffer, time = 0, gain = 1, destination = null) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        const gainNode = this.context.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode);
        gainNode.connect(destination || this.masterGain);
        source.start(time || this.context.currentTime);
        this.scheduledSources.push(source);
        return source;
    }

    playClick(accent = false) {
        if (!this.metronomeEnabled || !this.context) return;
        const buffer = accent ? this.accentBuffer : this.clickBuffer;
        this.playBuffer(buffer);
    }

    getMasterLevel() {
        if (!this.analyser) return { left: 0, right: 0, peak: 0 };
        const data = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(data);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            sum += abs * abs;
            if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sum / data.length);
        return { rms, peak, db: 20 * Math.log10(rms + 0.0001) };
    }

    // Generate waveform data from an oscillator type
    generateTone(frequency, duration, type = 'sine') {
        const length = Math.floor(this.context.sampleRate * duration);
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            const t = i / this.context.sampleRate;
            switch (type) {
                case 'sine':
                    data[i] = Math.sin(2 * Math.PI * frequency * t);
                    break;
                case 'square':
                    data[i] = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
                    break;
                case 'sawtooth':
                    data[i] = 2 * ((frequency * t) % 1) - 1;
                    break;
                case 'triangle':
                    data[i] = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1;
                    break;
            }
            // Apply simple envelope
            const env = Math.min(1, i / (this.context.sampleRate * 0.01)) *
                Math.min(1, (length - i) / (this.context.sampleRate * 0.05));
            data[i] *= env * 0.5;
        }
        return buffer;
    }

    // Subscribe to engine state changes
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    _notify() {
        for (const fn of this.listeners) fn(this.getState());
    }

    getState() {
        return {
            isPlaying: this.isPlaying,
            isRecording: this.isRecording,
            isLooping: this.isLooping,
            bpm: this.bpm,
            currentTime: this.currentTime,
            currentBeat: this.currentBeat,
            metronomeEnabled: this.metronomeEnabled
        };
    }

    // ─── Mastering Chain ───
    _initMasteringChain() {
        const ctx = this.context;
        this.mastering.in = ctx.createGain();
        this.mastering.out = ctx.createGain();

        // 1. Pre-EQ
        this.mastering.preEQ.lowCut = ctx.createBiquadFilter();
        this.mastering.preEQ.lowCut.type = 'highpass';
        this.mastering.preEQ.lowCut.frequency.value = 30;

        this.mastering.preEQ.low = ctx.createBiquadFilter();
        this.mastering.preEQ.low.type = 'lowshelf';
        this.mastering.preEQ.low.frequency.value = 100;

        this.mastering.preEQ.mid = ctx.createBiquadFilter();
        this.mastering.preEQ.mid.type = 'peaking';
        this.mastering.preEQ.mid.frequency.value = 1000;

        this.mastering.preEQ.high = ctx.createBiquadFilter();
        this.mastering.preEQ.high.type = 'highshelf';
        this.mastering.preEQ.high.frequency.value = 10000;

        // 2. Multiband Compressor (Simplified to Single band for Web Audio performance)
        this.mastering.compressor = ctx.createDynamicsCompressor();
        this.mastering.compressor.threshold.value = -20;
        this.mastering.compressor.knee.value = 30;
        this.mastering.compressor.ratio.value = 12;
        this.mastering.compressor.attack.value = 0.003;
        this.mastering.compressor.release.value = 0.25;

        // 3. Limiter (High ratio compressor)
        this.mastering.limiter = ctx.createDynamicsCompressor();
        this.mastering.limiter.threshold.value = -1.0;
        this.mastering.limiter.knee.value = 0;
        this.mastering.limiter.ratio.value = 20;
        this.mastering.limiter.attack.value = 0.001;
        this.mastering.limiter.release.value = 0.1;

        // Connect Chain
        this.mastering.in.connect(this.mastering.preEQ.lowCut);
        this.mastering.preEQ.lowCut.connect(this.mastering.preEQ.low);
        this.mastering.preEQ.low.connect(this.mastering.preEQ.mid);
        this.mastering.preEQ.mid.connect(this.mastering.preEQ.high);
        this.mastering.preEQ.high.connect(this.mastering.compressor);
        this.mastering.compressor.connect(this.mastering.limiter);
        this.mastering.limiter.connect(this.mastering.out);
    }

    setMasteringParam(module, param, value) {
        if (!this.context) return;
        const now = this.context.currentTime;
        try {
            if (module === 'preEQ') {
                if (param === 'lowShelf') this.mastering.preEQ.low.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'midGain') this.mastering.preEQ.mid.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'highShelf') this.mastering.preEQ.high.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'lowCut') this.mastering.preEQ.lowCut.frequency.setTargetAtTime(value, now, 0.1);
            } else if (module === 'comp') {
                // Simplified generic compressor control
                if (param === 'threshold') {
                    this.mastering.compressor.threshold.setTargetAtTime(value, now, 0.1);
                    // Approximate gain reduction for visualization
                    this.mastering.gainReduction = Math.min(0, value - 0);
                }
            } else if (module === 'limiter') {
                if (param === 'threshold') this.mastering.limiter.threshold.setTargetAtTime(value, now, 0.1);
            }
        } catch (e) { console.warn('Mastering param error', e); }
    }

    getMasteringMeters() {
        if (!this.analyser) return { lufs: -100, gainReduction: 0 };

        // Calculate LUFS relative to RMS
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const sample = (data[i] - 128) / 128;
            sum += sample * sample;
        }
        const rms = Math.sqrt(sum / data.length);
        const db = 20 * Math.log10(rms || 0.00001);

        // Simulating GR since Web Audio Compressor node doesn't expose reduction property
        // We use the input signal level vs threshold to guess
        let gr = 0;
        if (this.mastering.compressor) {
            const thresh = this.mastering.compressor.threshold.value;
            if (db > thresh) gr = (thresh - db) * 0.5; // Rough approximation
        }

        return { lufs: Math.max(-100, db), gainReduction: gr };
    }

    // ─── Pitch Detection ───
    _startPitchDetection() {
        const detect = () => {
            if (!this.context || !this.analyser) return;

            this.analyser.getFloatTimeDomainData(this.pitchDetector.buffer);
            const buffer = this.pitchDetector.buffer;

            // Autocorrelation
            let bestOffset = -1;
            let bestCorrelation = 0;
            let rms = 0;
            let foundGoodCorrelation = false;

            for (let i = 0; i < buffer.length; i++) {
                rms += buffer[i] * buffer[i];
            }
            rms = Math.sqrt(rms / buffer.length);

            if (rms < 0.01) { // Silence threshold
                this.pitchDetector.detectedPitch = 0;
                this.pitchDetector.clarity = 0;
            } else {
                for (let offset = 48; offset < 1000; offset++) { // ~45Hz to ~1000Hz
                    let correlation = 0;
                    for (let i = 0; i < buffer.length - offset; i++) {
                        correlation += Math.abs(buffer[i] - buffer[i + offset]);
                    }
                    correlation = 1 - (correlation / buffer.length); // Normalize

                    if (correlation > 0.9 && correlation > bestCorrelation) {
                        bestCorrelation = correlation;
                        bestOffset = offset;
                        foundGoodCorrelation = true;

                        // Break early if very good match
                        if (correlation > 0.98) break;
                    }
                }

                if (foundGoodCorrelation) {
                    const frequency = this.context.sampleRate / bestOffset;
                    this.pitchDetector.detectedPitch = frequency;
                    this.pitchDetector.clarity = bestCorrelation;
                }
            }

            requestAnimationFrame(detect);
        };
        requestAnimationFrame(detect);
    }

    getDetectedPitch() {
        return this.pitchDetector;
    }

    setAutotuneParam(trackId, param, value) {
        // Update currently playing sources for this track
        const now = this.context.currentTime;

        if (param === 'retune') {
            for (const item of this.scheduledSources) {
                if (item.trackId === trackId && item.source && item.source.detune) {
                    item.source.detune.setTargetAtTime(value, now, 0.1);
                }
            }
        }
        // logical params like 'scale', 'key' are used during pitch detection/correction algorithm
        // which would be in a AudioWorklet. For now, we only support retune (detune) in real-time.
    }

    dispose() {
        this._stopAllSources();
        if (this.context) {
            this.context.close();
            this.context = null;
        }
    }
}

// Singleton
export const audioEngine = new AudioEngine();
