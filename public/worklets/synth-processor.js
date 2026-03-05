// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.
// Custom AudioWorkletProcessor for SpeakSynth


const TWO_PI = 2 * Math.PI;

class Voice {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.active = false;
        this.freq = 440;
        this.phase = []; // Array of phases for each unison voice
        this.ampMod = 0;

        // Envelope
        this.envState = 'idle'; // attack, decay, sustain, release, idle
        this.envVal = 0;
        this.envTime = 0;

        // Unison config
        this.unisonCount = 1;
        this.detuneRatios = []; // Freq multipliers
        this.panMatrix = []; // Left/Right gains per unison voice

        // Filter State (SVF)
        this.lp = 0;
        this.hp = 0;
        this.bp = 0;
        this.ic1eq = 0;
        this.ic2eq = 0;
    }

    noteOn(freq, spec) {
        this.freq = freq;
        this.active = true;
        this.envState = 'attack';
        this.envVal = 0;
        this.envTime = 0;

        this.unisonCount = spec.voice.unison;
        this.detuneRatios = [];
        this.panMatrix = [];
        this.phase = new Float64Array(this.unisonCount);

        const spread = spec.voice.stereoSpread;
        const detuneCents = spec.voice.detuneCents;

        for (let i = 0; i < this.unisonCount; i++) {
            // Random start phase
            this.phase[i] = Math.random();

            // Detune calculation
            let cents = 0;
            if (this.unisonCount > 1) {
                // distribute from -detune to +detune
                const norm = i / (this.unisonCount - 1);
                cents = (norm * 2 - 1) * detuneCents;
            }
            this.detuneRatios[i] = Math.pow(2, cents / 1200);

            // Panning calculation
            let pan = 0.5; // Center
            if (this.unisonCount > 1) {
                const norm = i / (this.unisonCount - 1);
                pan = 0.5 + (norm * 2 - 1) * 0.5 * spread;
            }
            this.panMatrix.push([Math.cos(pan * Math.PI / 2), Math.sin(pan * Math.PI / 2)]);
        }
    }

    noteOff() {
        this.envState = 'release';
        this.envTime = 0;
    }

    process(spec, tables, morphAmt, dt) {
        if (!this.active || tables.length === 0) return [0, 0];

        // Envelope
        const { attack, decay, sustain, release } = spec.ampEnv;

        if (this.envState === 'attack') {
            this.envTime += dt;
            this.envVal = attack > 0 ? this.envTime / attack : 1;
            if (this.envVal >= 1) {
                this.envVal = 1;
                this.envState = 'decay';
                this.envTime = 0;
            }
        } else if (this.envState === 'decay') {
            this.envTime += dt;
            if (decay > 0) {
                // Exponetial decay to sustain
                const t = Math.min(1, this.envTime / decay);
                this.envVal = 1.0 - t * (1.0 - sustain);
            } else {
                this.envVal = sustain;
            }
            if (this.envTime >= decay) {
                this.envState = 'sustain';
            }
        } else if (this.envState === 'release') {
            this.envTime += dt;
            const t = release > 0 ? this.envTime / release : 1;
            this.envVal = sustain * (1.0 - t);
            if (this.envVal <= 0) {
                this.envVal = 0;
                this.active = false;
                return [0, 0];
            }
        }

        // Oscillator Wavetable Interpolation
        let outL = 0;
        let outR = 0;

        // Determine which tables to morph between
        const tableIndex = morphAmt * (tables.length - 1);
        const i1 = Math.floor(tableIndex);
        const i2 = Math.min(tables.length - 1, i1 + 1);
        const tMix = tableIndex - i1;

        const tableLen = tables[0].length;

        // Evaluate unison voices
        for (let u = 0; u < this.unisonCount; u++) {
            const f = this.freq * this.detuneRatios[u];
            const phaseInc = f / this.sampleRate;

            this.phase[u] += phaseInc;
            if (this.phase[u] >= 1.0) this.phase[u] -= 1.0;

            const p = this.phase[u] * tableLen;
            const idx1 = Math.floor(p);
            const idx2 = (idx1 + 1) % tableLen;
            const pMix = p - idx1;

            // Interpolate table 1
            const s1 = tables[i1][idx1] * (1 - pMix) + tables[i1][idx2] * pMix;

            // Interpolate table 2
            const s2 = tables[i2][idx1] * (1 - pMix) + tables[i2][idx2] * pMix;

            // Mix tables
            const sample = s1 * (1 - tMix) + s2 * tMix;

            outL += sample * this.panMatrix[u][0];
            outR += sample * this.panMatrix[u][1];
        }

        // Normalize unison gain
        outL /= (Math.sqrt(this.unisonCount));
        outR /= (Math.sqrt(this.unisonCount));

        // Apply Amp Envelope
        outL *= this.envVal;
        outR *= this.envVal;

        // Filter
        // Modulate cutoff by envAmount
        let cut = spec.filter.cutoffHz;
        if (spec.filter.envAmount !== 0) {
            // Scale cutoff exponentially. Max range 5 octaves up/down
            const mod = spec.filter.envAmount * this.envVal * 5;
            cut *= Math.pow(2, mod);
        }

        cut = Math.max(20, Math.min(this.sampleRate / 2.1, cut));

        // Basic SVF Implementation
        const g = Math.tan(Math.PI * cut / this.sampleRate);
        const k = 2.0 - 2.0 * spec.filter.resonance;
        const a1 = 1.0 / (1.0 + g * (g + k));
        const a2 = g * a1;
        const a3 = g * a2;

        // Because we have stereo, we should really have 2 filters, but for simplicity we filter the sum or mono,
        // Or we duplicate state. Let's do a simple mono filter state on L and R for now just keeping it stereo
        // Wait, let's keep it simple: run L and R through the same filter state? No, that causes crossover distortion.
        // I'll run just L through the full SVF here to keep CPU low, then duplicate for R. Wait, let's separate states.

        if (!this.filterStates) {
            this.filterStates = [{ ic1eq: 0, ic2eq: 0 }, { ic1eq: 0, ic2eq: 0 }];
        }

        const applyFilter = (inp, state) => {
            let v3 = inp - state.ic2eq;
            let v1 = a1 * state.ic1eq + a2 * v3;
            let v2 = state.ic2eq + a2 * state.ic1eq + a3 * v3;
            state.ic1eq = 2.0 * v1 - state.ic1eq;
            state.ic2eq = 2.0 * v2 - state.ic2eq;

            if (spec.filter.type === 'svf_bp') return v1; // Bandpass
            if (spec.filter.type === 'svf_hp') return inp - k * v1 - v2;
            return v2; // Lowpass default
        };

        outL = applyFilter(outL, this.filterStates[0]);
        outR = applyFilter(outR, this.filterStates[1]);

        return [outL, outR];
    }
}

// Simple Delay Line for Chorus/Reverb
class DelayLine {
    constructor(size) {
        this.buffer = new Float32Array(size);
        this.writeIdx = 0;
        this.size = size;
    }

    read(delaySamples) {
        let readIdx = this.writeIdx - delaySamples;
        while (readIdx < 0) readIdx += this.size;
        const i1 = Math.floor(readIdx);
        const i2 = (i1 + 1) % this.size;
        const frac = readIdx - i1;
        return this.buffer[i1] * (1 - frac) + this.buffer[i2] * frac;
    }

    write(sample) {
        this.buffer[this.writeIdx] = sample;
        this.writeIdx = (this.writeIdx + 1) % this.size;
    }
}

class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        for (let i = 0; i < 16; i++) {
            this.voices.push(new Voice(sampleRate));
        }

        this.spec = null;
        this.tables = [];
        this.morphAmt = 0.5; // Controlled via parameter or spec

        // FX State
        this.chorusDelayL = new DelayLine(sampleRate * 0.1);
        this.chorusDelayR = new DelayLine(sampleRate * 0.1);
        this.chorusLFO = 0;

        // Simple FDN Reverb state
        this.rvbDelays = [
            new DelayLine(sampleRate * 0.0297),
            new DelayLine(sampleRate * 0.0371),
            new DelayLine(sampleRate * 0.0411),
            new DelayLine(sampleRate * 0.0437)
        ];
        this.rvbFeedbacks = [0, 0, 0, 0];

        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'SET_SPEC') {
                this.spec = msg.spec;
                this.tables = msg.tables;
            } else if (msg.type === 'NOTE_ON') {
                // Find free voice
                let voice = this.voices.find(v => !v.active);
                if (!voice) {
                    // Steal oldest voice (simplistic stealing)
                    voice = this.voices[0];
                }
                voice.noteOn(msg.freq, this.spec);
            } else if (msg.type === 'NOTE_OFF') {
                for (let v of this.voices) {
                    if (v.active && Math.abs(v.freq - msg.freq) < 0.1) {
                        v.noteOff();
                    }
                }
            } else if (msg.type === 'SET_MORPH') {
                this.morphAmt = msg.value;
            } else if (msg.type === 'SET_CUTOFF') {
                if (this.spec) this.spec.filter.cutoffHz = msg.value;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0];
        const outR = output[output.length > 1 ? 1 : 0]; // handle mono output systems

        if (!this.spec || this.tables.length === 0) {
            for (let i = 0; i < outL.length; i++) { outL[i] = 0; outR[i] = 0; }
            return true;
        }

        const dt = 1.0 / sampleRate;

        for (let i = 0; i < outL.length; i++) {
            let mixL = 0;
            let mixR = 0;

            // Sum active voices
            for (let v of this.voices) {
                if (v.active) {
                    const [l, r] = v.process(this.spec, this.tables, this.morphAmt, dt);
                    mixL += l;
                    mixR += r;
                }
            }

            // FX - Chorus
            if (this.spec.fx.chorus > 0) {
                this.chorusLFO += dt * 0.5; // 0.5Hz LFO
                const mod1 = Math.sin(this.chorusLFO * TWO_PI) * 0.005; // 5ms modulation
                const mod2 = Math.cos(this.chorusLFO * TWO_PI) * 0.005;

                const baseDelay = 0.01; // 10ms
                const dL = this.chorusDelayL.read((baseDelay + mod1) * sampleRate);
                const dR = this.chorusDelayR.read((baseDelay + mod2) * sampleRate);

                this.chorusDelayL.write(mixL);
                this.chorusDelayR.write(mixR);

                const amt = this.spec.fx.chorus;
                mixL = mixL * (1 - amt) + dL * amt;
                mixR = mixR * (1 - amt) + dR * amt;
            }

            // FX - Simple Reverb (4 parallel delays with cross feedback + lowpass)
            if (this.spec.fx.reverb > 0) {
                const amt = this.spec.fx.reverb;
                const decay = 0.8; // arbitrary reverb lengths

                const rvbOut0 = this.rvbDelays[0].read(this.rvbDelays[0].size - 1);
                const rvbOut1 = this.rvbDelays[1].read(this.rvbDelays[1].size - 1);
                const rvbOut2 = this.rvbDelays[2].read(this.rvbDelays[2].size - 1);
                const rvbOut3 = this.rvbDelays[3].read(this.rvbDelays[3].size - 1);

                // Hadamard matrix feedback mixing
                const rIn0 = (rvbOut0 + rvbOut1 + rvbOut2 + rvbOut3) * 0.5;
                const rIn1 = (rvbOut0 - rvbOut1 + rvbOut2 - rvbOut3) * 0.5;
                const rIn2 = (rvbOut0 + rvbOut1 - rvbOut2 - rvbOut3) * 0.5;
                const rIn3 = (rvbOut0 - rvbOut1 - rvbOut2 + rvbOut3) * 0.5;

                const monoSum = (mixL + mixR) * 0.5;

                this.rvbDelays[0].write(monoSum + rIn0 * decay);
                this.rvbDelays[1].write(monoSum + rIn1 * decay);
                this.rvbDelays[2].write(monoSum + rIn2 * decay);
                this.rvbDelays[3].write(monoSum + rIn3 * decay);

                const rvbMixL = rvbOut0 - rvbOut2;
                const rvbMixR = rvbOut1 + rvbOut3;

                mixL = mixL * (1 - amt * 0.5) + rvbMixL * amt;
                mixR = mixR * (1 - amt * 0.5) + rvbMixR * amt;
            }

            // Master limiter scale
            outL[i] = Math.max(-1, Math.min(1, mixL));
            outR[i] = Math.max(-1, Math.min(1, mixR));
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);
