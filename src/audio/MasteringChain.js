// ============================================
// ORPHEUS DAW — Mastering Chain
// ============================================
// Professional mastering signal chain:
//   Input → EQ → Multiband Comp → Stereo Widener → Limiter → Output
// Includes LUFS-style loudness metering and mastering presets.

export class MasteringChain {
    constructor(audioContext, destination) {
        this.ctx = audioContext;
        this.destination = destination;
        this.enabled = false;
        this.abBypass = false;

        // ── Create processing nodes ──
        this.input = this.ctx.createGain();
        this.output = this.ctx.createGain();

        // 1. Input Trim
        this.inputTrim = this.ctx.createGain();
        this.inputTrim.gain.value = 1;

        // 2. Pre-EQ (sculpting)
        this.preEQ = this._createPreEQ();

        // 3. Multiband Compressor (3 bands: low, mid, high)
        this.multibandComp = this._createMultibandCompressor();

        // 4. Stereo Widener (mid-side processing simulation)
        this.stereoWidener = this._createStereoWidener();

        // 5. Post-EQ (air/presence)
        this.postEQ = this._createPostEQ();

        // 6. Limiter (brick-wall)
        this.limiter = this._createLimiter();

        // 7. Output Gain
        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = 1;

        // LUFS Metering
        this.lufsAnalyser = this.ctx.createAnalyser();
        this.lufsAnalyser.fftSize = 4096;
        this.lufsAnalyser.smoothingTimeConstant = 0.95;

        // Pre-master analyser (for A/B)
        this.preAnalyser = this.ctx.createAnalyser();
        this.preAnalyser.fftSize = 2048;

        // Post-master analyser
        this.postAnalyser = this.ctx.createAnalyser();
        this.postAnalyser.fftSize = 2048;

        // Build signal chain
        this._buildChain();

        // Default preset
        this.currentPreset = 'Streaming';
        this.applyPreset('Streaming');
    }

    _createPreEQ() {
        // Low cut + low shelf + high shelf
        const lowCut = this.ctx.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.value = 30;
        lowCut.Q.value = 0.7;

        const lowShelf = this.ctx.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 80;
        lowShelf.gain.value = 0;

        const midPeak = this.ctx.createBiquadFilter();
        midPeak.type = 'peaking';
        midPeak.frequency.value = 1000;
        midPeak.gain.value = 0;
        midPeak.Q.value = 1;

        const highShelf = this.ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 10000;
        highShelf.gain.value = 0;

        lowCut.connect(lowShelf);
        lowShelf.connect(midPeak);
        midPeak.connect(highShelf);

        return {
            input: lowCut,
            output: highShelf,
            lowCut, lowShelf, midPeak, highShelf,
        };
    }

    _createMultibandCompressor() {
        // Split into 3 bands
        const inputGain = this.ctx.createGain();
        const outputGain = this.ctx.createGain();

        // Low band (< 200Hz)
        const lowLP = this.ctx.createBiquadFilter();
        lowLP.type = 'lowpass';
        lowLP.frequency.value = 200;
        lowLP.Q.value = 0.5;
        const lowComp = this.ctx.createDynamicsCompressor();
        lowComp.threshold.value = -18;
        lowComp.ratio.value = 3;
        lowComp.attack.value = 0.01;
        lowComp.release.value = 0.2;
        const lowGain = this.ctx.createGain();
        lowGain.gain.value = 1;

        // Mid band (200Hz - 4kHz)
        const midHP = this.ctx.createBiquadFilter();
        midHP.type = 'highpass';
        midHP.frequency.value = 200;
        midHP.Q.value = 0.5;
        const midLP = this.ctx.createBiquadFilter();
        midLP.type = 'lowpass';
        midLP.frequency.value = 4000;
        midLP.Q.value = 0.5;
        const midComp = this.ctx.createDynamicsCompressor();
        midComp.threshold.value = -20;
        midComp.ratio.value = 2.5;
        midComp.attack.value = 0.005;
        midComp.release.value = 0.15;
        const midGain = this.ctx.createGain();
        midGain.gain.value = 1;

        // High band (> 4kHz)
        const highHP = this.ctx.createBiquadFilter();
        highHP.type = 'highpass';
        highHP.frequency.value = 4000;
        highHP.Q.value = 0.5;
        const highComp = this.ctx.createDynamicsCompressor();
        highComp.threshold.value = -22;
        highComp.ratio.value = 2;
        highComp.attack.value = 0.002;
        highComp.release.value = 0.1;
        const highGain = this.ctx.createGain();
        highGain.gain.value = 1;

        // Connect bands
        inputGain.connect(lowLP);
        lowLP.connect(lowComp);
        lowComp.connect(lowGain);
        lowGain.connect(outputGain);

        inputGain.connect(midHP);
        midHP.connect(midLP);
        midLP.connect(midComp);
        midComp.connect(midGain);
        midGain.connect(outputGain);

        inputGain.connect(highHP);
        highHP.connect(highComp);
        highComp.connect(highGain);
        highGain.connect(outputGain);

        return {
            input: inputGain,
            output: outputGain,
            bands: {
                low: { filter: lowLP, comp: lowComp, gain: lowGain },
                mid: { filterHP: midHP, filterLP: midLP, comp: midComp, gain: midGain },
                high: { filter: highHP, comp: highComp, gain: highGain },
            }
        };
    }

    _createStereoWidener() {
        // Simulate stereo widening using subtle delay and phase
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();
        const dry = this.ctx.createGain();
        dry.gain.value = 1;
        const wet = this.ctx.createGain();
        wet.gain.value = 0;

        const delay = this.ctx.createDelay(0.05);
        delay.delayTime.value = 0.012; // Haas effect

        const widthFilter = this.ctx.createBiquadFilter();
        widthFilter.type = 'highpass';
        widthFilter.frequency.value = 300; // Only widen above 300Hz

        input.connect(dry);
        input.connect(widthFilter);
        widthFilter.connect(delay);
        delay.connect(wet);
        dry.connect(output);
        wet.connect(output);

        return {
            input,
            output,
            dry,
            wet,
            delay,
            _width: 0,
            setWidth(value) {
                // 0 = mono, 0.5 = normal, 1 = wide
                this._width = value;
                this.wet.gain.setTargetAtTime(value * 0.4, input.context.currentTime, 0.02);
            }
        };
    }

    _createPostEQ() {
        // Air band + presence
        const airBand = this.ctx.createBiquadFilter();
        airBand.type = 'highshelf';
        airBand.frequency.value = 12000;
        airBand.gain.value = 0;

        const presence = this.ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 3500;
        presence.gain.value = 0;
        presence.Q.value = 1.5;

        airBand.connect(presence);

        return {
            input: airBand,
            output: presence,
            airBand,
            presence,
        };
    }

    _createLimiter() {
        // Brick-wall limiter using DynamicsCompressor with extreme settings
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -1;
        comp.ratio.value = 20;
        comp.attack.value = 0.001;
        comp.release.value = 0.05;
        comp.knee.value = 0;

        const ceiling = this.ctx.createGain();
        ceiling.gain.value = 0.98; // True peak ceiling

        comp.connect(ceiling);

        return {
            input: comp,
            output: ceiling,
            comp,
            ceiling,
            setCeiling(db) {
                const linear = Math.pow(10, db / 20);
                ceiling.gain.setTargetAtTime(linear, comp.context.currentTime, 0.01);
            },
            setThreshold(db) {
                comp.threshold.setTargetAtTime(db, comp.context.currentTime, 0.01);
            },
            getReduction() {
                return comp.reduction;
            }
        };
    }

    _buildChain() {
        this.input.connect(this.preAnalyser);
        this.input.connect(this.inputTrim);
        this.inputTrim.connect(this.preEQ.input);
        this.preEQ.output.connect(this.multibandComp.input);
        this.multibandComp.output.connect(this.stereoWidener.input);
        this.stereoWidener.output.connect(this.postEQ.input);
        this.postEQ.output.connect(this.limiter.input);
        this.limiter.output.connect(this.outputGain);
        this.outputGain.connect(this.postAnalyser);
        this.outputGain.connect(this.lufsAnalyser);
        this.outputGain.connect(this.output);
        this.output.connect(this.destination);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    setInputTrim(db) {
        const linear = Math.pow(10, db / 20);
        this.inputTrim.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
    }

    setOutputGain(db) {
        const linear = Math.pow(10, db / 20);
        this.outputGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
    }

    // ── Presets ──
    applyPreset(presetName) {
        this.currentPreset = presetName;
        const preset = MASTERING_PRESETS[presetName];
        if (!preset) return;

        // Pre-EQ
        this.preEQ.lowShelf.gain.value = preset.preEQ.lowShelf;
        this.preEQ.midPeak.gain.value = preset.preEQ.mid;
        this.preEQ.highShelf.gain.value = preset.preEQ.highShelf;
        this.preEQ.lowCut.frequency.value = preset.preEQ.lowCut;

        // Multiband comp thresholds
        this.multibandComp.bands.low.comp.threshold.value = preset.comp.lowThresh;
        this.multibandComp.bands.mid.comp.threshold.value = preset.comp.midThresh;
        this.multibandComp.bands.high.comp.threshold.value = preset.comp.highThresh;

        // Stereo width
        this.stereoWidener.setWidth(preset.stereoWidth);

        // Post-EQ
        this.postEQ.airBand.gain.value = preset.postEQ.air;
        this.postEQ.presence.gain.value = preset.postEQ.presence;

        // Limiter
        this.limiter.setThreshold(preset.limiter.threshold);
        this.limiter.setCeiling(preset.limiter.ceiling);
    }

    // ── Metering ──
    getLUFS() {
        const data = new Float32Array(this.lufsAnalyser.fftSize);
        this.lufsAnalyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        // Approximate LUFS (simplified K-weighting)
        const lufs = 20 * Math.log10(rms + 0.0001) - 0.691;
        return Math.max(-70, lufs);
    }

    getPreLevel() {
        return this._getLevel(this.preAnalyser);
    }

    getPostLevel() {
        return this._getLevel(this.postAnalyser);
    }

    _getLevel(analyser) {
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            sum += abs * abs;
            if (abs > peak) peak = abs;
        }
        return {
            rms: Math.sqrt(sum / data.length),
            peak,
            db: 20 * Math.log10(Math.sqrt(sum / data.length) + 0.0001),
        };
    }

    getGainReduction() {
        return {
            low: this.multibandComp.bands.low.comp.reduction,
            mid: this.multibandComp.bands.mid.comp.reduction,
            high: this.multibandComp.bands.high.comp.reduction,
            limiter: this.limiter.comp.reduction,
        };
    }

    getState() {
        return {
            enabled: this.enabled,
            preset: this.currentPreset,
            lufs: this.getLUFS(),
            preLevel: this.getPreLevel(),
            postLevel: this.getPostLevel(),
            gainReduction: this.getGainReduction(),
        };
    }

    dispose() {
        this.input.disconnect();
        this.output.disconnect();
    }
}

// ── Mastering Presets ──
export const MASTERING_PRESETS = {
    Streaming: {
        name: 'Streaming (Spotify/Apple)',
        target: '-14 LUFS',
        preEQ: { lowCut: 30, lowShelf: 1, mid: 0, highShelf: 0.5 },
        comp: { lowThresh: -18, midThresh: -20, highThresh: -22 },
        stereoWidth: 0.4,
        postEQ: { air: 1.5, presence: 0.5 },
        limiter: { threshold: -1, ceiling: -1 },
    },
    CD: {
        name: 'CD / Loud Master',
        target: '-9 LUFS',
        preEQ: { lowCut: 25, lowShelf: 2, mid: 0.5, highShelf: 1 },
        comp: { lowThresh: -15, midThresh: -16, highThresh: -18 },
        stereoWidth: 0.5,
        postEQ: { air: 2, presence: 1 },
        limiter: { threshold: -0.3, ceiling: -0.3 },
    },
    Vinyl: {
        name: 'Vinyl / Analog',
        target: '-12 LUFS',
        preEQ: { lowCut: 40, lowShelf: 0, mid: -0.5, highShelf: -1 },
        comp: { lowThresh: -20, midThresh: -22, highThresh: -24 },
        stereoWidth: 0.3,
        postEQ: { air: 0, presence: 0 },
        limiter: { threshold: -2, ceiling: -1 },
    },
    Broadcast: {
        name: 'Broadcast / Radio',
        target: '-16 LUFS',
        preEQ: { lowCut: 50, lowShelf: -1, mid: 1, highShelf: 0 },
        comp: { lowThresh: -16, midThresh: -18, highThresh: -20 },
        stereoWidth: 0.3,
        postEQ: { air: 1, presence: 1.5 },
        limiter: { threshold: -1.5, ceiling: -1 },
    },
    Podcast: {
        name: 'Podcast / Voice',
        target: '-16 LUFS',
        preEQ: { lowCut: 80, lowShelf: -2, mid: 2, highShelf: 1 },
        comp: { lowThresh: -14, midThresh: -16, highThresh: -20 },
        stereoWidth: 0,
        postEQ: { air: 1, presence: 2 },
        limiter: { threshold: -1, ceiling: -1 },
    },
};
