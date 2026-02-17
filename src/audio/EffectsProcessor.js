// ============================================
// ORPHEUS DAW — Effects Processor
// ============================================

export function createEQ(ctx) {
    const bands = [
        { type: 'lowshelf', frequency: 100, gain: 0 },
        { type: 'peaking', frequency: 500, gain: 0, Q: 1.4 },
        { type: 'peaking', frequency: 2000, gain: 0, Q: 1.4 },
        { type: 'highshelf', frequency: 8000, gain: 0 }
    ];

    const filters = bands.map(b => {
        const f = ctx.createBiquadFilter();
        f.type = b.type;
        f.frequency.value = b.frequency;
        f.gain.value = b.gain;
        if (b.Q) f.Q.value = b.Q;
        return f;
    });

    // Chain
    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }

    return {
        type: 'eq',
        name: 'Parametric EQ',
        input: filters[0],
        output: filters[filters.length - 1],
        filters,
        bands,
        bypass: false,
        setBand(index, freq, gain, q) {
            if (freq !== undefined) filters[index].frequency.value = freq;
            if (gain !== undefined) filters[index].gain.value = gain;
            if (q !== undefined && filters[index].type === 'peaking') filters[index].Q.value = q;
            bands[index] = { ...bands[index], frequency: filters[index].frequency.value, gain: filters[index].gain.value };
        }
    };
}

export function createCompressor(ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    const makeupGain = ctx.createGain();
    makeupGain.gain.value = 1;
    comp.connect(makeupGain);

    return {
        type: 'compressor',
        name: 'Compressor',
        input: comp,
        output: makeupGain,
        node: comp,
        makeupGain,
        bypass: false,
        setThreshold(v) { comp.threshold.value = v; },
        setRatio(v) { comp.ratio.value = v; },
        setAttack(v) { comp.attack.value = v; },
        setRelease(v) { comp.release.value = v; },
        setKnee(v) { comp.knee.value = v; },
        setMakeupGain(v) { makeupGain.gain.value = v; },
        getReduction() { return comp.reduction; }
    };
}

export function createReverb(ctx) {
    const convolver = ctx.createConvolver();
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();
    const input = ctx.createGain();
    const output = ctx.createGain();

    wetGain.gain.value = 0.3;
    dryGain.gain.value = 0.7;

    input.connect(convolver);
    input.connect(dryGain);
    convolver.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);

    // Generate impulse response
    const duration = 2.5;
    const length = ctx.sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
        }
    }
    convolver.buffer = impulse;

    return {
        type: 'reverb',
        name: 'Reverb',
        input,
        output,
        bypass: false,
        setMix(wet) {
            wetGain.gain.value = wet;
            dryGain.gain.value = 1 - wet;
        },
        setDecay(seconds) {
            const len = ctx.sampleRate * seconds;
            const imp = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = imp.getChannelData(ch);
                for (let i = 0; i < len; i++) {
                    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (seconds * 0.3)));
                }
            }
            convolver.buffer = imp;
        }
    };
}

export function createDelay(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const delay = ctx.createDelay(5.0);
    const feedback = ctx.createGain();
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    delay.delayTime.value = 0.375;
    feedback.gain.value = 0.4;
    wetGain.gain.value = 0.3;
    dryGain.gain.value = 0.7;

    input.connect(delay);
    input.connect(dryGain);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);

    return {
        type: 'delay',
        name: 'Delay',
        input,
        output,
        bypass: false,
        setTime(t) { delay.delayTime.value = t; },
        setFeedback(f) { feedback.gain.value = Math.min(0.95, f); },
        setMix(wet) {
            wetGain.gain.value = wet;
            dryGain.gain.value = 1 - wet;
        }
    };
}

export function createChorus(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const delay = ctx.createDelay(0.1);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();

    delay.delayTime.value = 0.015;
    lfo.frequency.value = 1.5;
    lfoGain.gain.value = 0.003;
    wetGain.gain.value = 0.5;
    dryGain.gain.value = 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    input.connect(delay);
    input.connect(dryGain);
    delay.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);

    return {
        type: 'chorus',
        name: 'Chorus',
        input,
        output,
        bypass: false,
        setRate(r) { lfo.frequency.value = r; },
        setDepth(d) { lfoGain.gain.value = d * 0.01; },
        setMix(wet) {
            wetGain.gain.value = wet;
            dryGain.gain.value = 1 - wet;
        }
    };
}

export const EFFECT_TYPES = [
    { id: 'eq', name: 'Parametric EQ', create: createEQ },
    { id: 'compressor', name: 'Compressor', create: createCompressor },
    { id: 'reverb', name: 'Reverb', create: createReverb },
    { id: 'delay', name: 'Delay', create: createDelay },
    { id: 'chorus', name: 'Chorus', create: createChorus }
];
