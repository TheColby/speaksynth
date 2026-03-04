import { SynthSpec } from '@/schemas/synthSpec';

export class SynthEngine {
    context: AudioContext | OfflineAudioContext | null = null;
    workletNode: AudioWorkletNode | null = null;
    initialized = false;
    spec: SynthSpec | null = null;

    async init(offlineLengthSec = 0) {
        if (this.initialized) return;

        if (offlineLengthSec > 0) {
            this.context = new OfflineAudioContext(2, 44100 * offlineLengthSec, 44100);
        } else {
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        try {
            await this.context.audioWorklet.addModule('/worklets/synth-processor.js');
            this.workletNode = new AudioWorkletNode(this.context, 'synth-processor', {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            });

            this.workletNode.connect(this.context.destination);
            this.initialized = true;
        } catch (e) {
            console.error("Failed to load AudioWorklet", e);
        }
    }

    resume() {
        if (this.context && this.context.state === 'suspended' && !(this.context instanceof OfflineAudioContext)) {
            this.context.resume();
        }
    }

    loadSpec(spec: SynthSpec, tables: Float32Array[]) {
        this.spec = spec;
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'SET_SPEC',
                spec: spec,
                tables: tables
            });
        }
    }

    noteOn(noteOrFreq: string | number) {
        if (!this.workletNode) return;
        const freq = typeof noteOrFreq === 'string' ? this.noteToFreq(noteOrFreq) : noteOrFreq;
        this.workletNode.port.postMessage({ type: 'NOTE_ON', freq });
    }

    noteOff(noteOrFreq: string | number) {
        if (!this.workletNode) return;
        const freq = typeof noteOrFreq === 'string' ? this.noteToFreq(noteOrFreq) : noteOrFreq;
        this.workletNode.port.postMessage({ type: 'NOTE_OFF', freq });
    }

    setMorph(val: number) {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'SET_MORPH', value: val });
        }
    }

    setCutoff(val: number) {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'SET_CUTOFF', value: val });
        }
    }

    playDemo() {
        if (!this.spec || !this.workletNode) return;
        const { type, notes, lengthSec } = this.spec.demo;

        // Play notes immediately
        if (type === 'chord') {
            notes.forEach(note => this.noteOn(note));
            setTimeout(() => {
                notes.forEach(note => this.noteOff(note));
            }, lengthSec * 1000);
        } else {
            // Arpeggiate or play sequence (simple version: just play first note, or sweep)
            let time = 0;
            notes.forEach((note, i) => {
                setTimeout(() => this.noteOn(note), time * 1000);
                setTimeout(() => this.noteOff(note), (time + (lengthSec / notes.length)) * 1000);
                time += lengthSec / notes.length;
            });
        }
    }

    // Utility to convert MIDI note string (e.g. C3) to frequency
    noteToFreq(note: string): number {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const regex = /^([A-G]#?)(-?\d+)$/;
        const match = note.match(regex);
        if (!match) return 440;
        const n = notes.indexOf(match[1]);
        const octave = parseInt(match[2], 10);
        const midi = n + (octave + 1) * 12;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    async renderDemoWav(spec: SynthSpec, tables: Float32Array[]): Promise<Blob | null> {
        const offlineEngine = new SynthEngine();
        await offlineEngine.init(spec.demo.lengthSec + spec.ampEnv.release + 1); // add trailing tail
        if (!offlineEngine.initialized || !(offlineEngine.context instanceof OfflineAudioContext)) return null;

        offlineEngine.loadSpec(spec, tables);

        // Play sequence in offline context timeline
        // Note: setTimeout won't work in offline context. We need to schedule it. 
        // Since AudioWorklet expects messages, we send them immediately, but AudioWorklet message port is async.
        // OfflineAudioContext needs a trick or we just suspend/resume. 
        // Wait, simpler for MVP: just export demo by recording context output in realtime using MediaRecorder if needed.
        // But rendering offline with worklet requires context.suspend(time) -> postMessage -> context.resume()
        // Let's implement that.

        const ctx = offlineEngine.context;

        // Helper to send message at specific offline time
        const scheduleMessage = async (time: number, msg: any) => {
            // If time is 0, we can post immediately before starting rendering
            if (time === 0) {
                offlineEngine.workletNode!.port.postMessage(msg);
            } else {
                await ctx.suspend(time);
                offlineEngine.workletNode!.port.postMessage(msg);
                ctx.resume();
            }
        };

        const notes = spec.demo.notes;

        if (spec.demo.type === 'chord') {
            notes.forEach(note => scheduleMessage(0, { type: 'NOTE_ON', freq: this.noteToFreq(note) }));
            scheduleMessage(spec.demo.lengthSec, { type: 'ALL_NOTES_OFF' }); // or loop and turn off
            for (const note of notes) {
                scheduleMessage(spec.demo.lengthSec, { type: 'NOTE_OFF', freq: this.noteToFreq(note) });
            }
        } else {
            let time = 0;
            const step = spec.demo.lengthSec / Math.max(1, notes.length);
            notes.forEach(note => {
                scheduleMessage(time, { type: 'NOTE_ON', freq: this.noteToFreq(note) });
                scheduleMessage(time + step, { type: 'NOTE_OFF', freq: this.noteToFreq(note) });
                time += step;
            });
        }

        const buffer = await ctx.startRendering();
        return this.audioBufferToWav(buffer);
    }

    audioBufferToWav(buffer: AudioBuffer): Blob {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        let result = new Float32Array(buffer.length * numChannels);
        // Interleave
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                result[i * numChannels + channel] = channelData[i];
            }
        }

        const dataSize = result.length * (bitDepth / 8);
        const bufferArray = new ArrayBuffer(44 + dataSize);
        const view = new DataView(bufferArray);

        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let i = 0; i < result.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, result[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}

export const engine = new SynthEngine();
