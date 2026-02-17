// ============================================
// ORPHEUS DAW — Audio Engine
// ============================================

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

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);

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
        // Actual audio scheduling happens per-track via TrackProcessor
    }

    _stopAllSources() {
        for (const source of this.scheduledSources) {
            try { source.stop(); } catch (e) { /* already stopped */ }
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
