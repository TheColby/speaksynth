// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

import { SynthSpec } from '@/schemas/synthSpec';

const TWO_PI = 2 * Math.PI;

/**
 * Normalizes a wavetable to lay between -1 and 1, and removes DC offset.
 */
function normalizeAndRemoveDC(table: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < table.length; i++) {
        sum += table[i];
    }
    const dc = sum / table.length;

    let maxAmp = 0;
    for (let i = 0; i < table.length; i++) {
        table[i] -= dc;
        const abs = Math.abs(table[i]);
        if (abs > maxAmp) maxAmp = abs;
    }

    if (maxAmp > 0) {
        const scale = 1.0 / maxAmp;
        for (let i = 0; i < table.length; i++) {
            table[i] *= scale;
        }
    }
}

/**
 * Generate a deterministic morphing wavetable bank based on SynthSpec parameters.
 */
export function generateWavetables(spec: SynthSpec): Float32Array[] {
    const { count, tableSize, family, brightness, inharmonicity } = spec.wavetables;

    const tables: Float32Array[] = [];

    // Base configuration
    const nyquistHarmonics = Math.floor(tableSize / 2) - 1; // Bandlimited to avoid aliasing up to Nyquist
    const numHarmonics = Math.max(1, Math.floor(nyquistHarmonics * brightness));

    for (let t = 0; t < count; t++) {
        const morphAmt = count > 1 ? t / (count - 1) : 0; // 0.0 to 1.0 across tables
        const table = new Float32Array(tableSize);

        // Additive Family: Harmonic series with spectral tilt that changes across tables
        if (family === 'additive') {
            const tilt = 1.0 - (brightness * 0.8) + (morphAmt * 0.5); // Tilt sharpens with morph

            for (let h = 1; h <= numHarmonics; h++) {
                // Inharmonicity detunes partials slightly
                const freqRatio = h + (Math.sin(h * 13.37) * inharmonicity * 0.5 * morphAmt);

                let amplitude = 1.0 / Math.pow(h, tilt);

                // Randomize phase slightly
                const phaseOffset = inharmonicity * Math.random() * TWO_PI;

                for (let i = 0; i < tableSize; i++) {
                    const phase = (i / tableSize) * TWO_PI * freqRatio + phaseOffset;
                    table[i] += Math.sin(phase) * amplitude;
                }
            }
        }

        // Formant Family: Spectral peaks sweeping across the table
        else if (family === 'formant') {
            // Formant center sweeps up across the tables, driven by brightness and morphAmt
            const centerHarmonic = 2 + Math.floor(morphAmt * 10 * brightness);
            const width = 1.5 + inharmonicity * 3.0;

            for (let h = 1; h <= numHarmonics; h++) {
                const dist = Math.abs(h - centerHarmonic);
                const amplitude = Math.max(0, 1.0 - (dist / width));

                if (amplitude > 0) {
                    for (let i = 0; i < tableSize; i++) {
                        const phase = (i / tableSize) * TWO_PI * h;
                        table[i] += Math.sin(phase) * amplitude;
                    }
                }
            }
        }

        // Waveshaper Family: Sine -> Tanh Fold -> Clip morph
        else if (family === 'waveshaper') {
            const drive = 1.0 + (morphAmt * 10.0 * brightness);
            const foldAmount = inharmonicity * Math.PI * 2.0 * morphAmt;

            for (let i = 0; i < tableSize; i++) {
                const phase = (i / tableSize) * TWO_PI;
                let s = Math.sin(phase);

                // Tanh drive
                s = Math.tanh(s * drive);

                // Sine fold
                if (foldAmount > 0) {
                    s = Math.sin(s * Math.PI * 0.5 + foldAmount * s);
                }

                table[i] = s;
            }
        }

        // PWM Family: Band-limited pulse width sweep
        else if (family === 'pwm') {
            const pulseWidth = 0.5 - (morphAmt * 0.45 * brightness); // sweeps from 50% to almost 5%

            for (let h = 1; h <= numHarmonics; h++) {
                // Bandlimited pulse wave constructed from sine waves
                // Amplitude = sin(pi * h * d) / h, where d is duty cycle
                let amplitude = Math.sin(Math.PI * h * pulseWidth) / h;

                // Add noise/inharmonicity jitter
                if (inharmonicity > 0) {
                    amplitude *= 1.0 + (Math.random() - 0.5) * inharmonicity;
                }

                for (let i = 0; i < tableSize; i++) {
                    const phase = (i / tableSize) * TWO_PI * h;
                    table[i] += Math.cos(phase) * amplitude; // Cosine to align phases better for sharp edges
                }
            }
        }

        normalizeAndRemoveDC(table);
        tables.push(table);
    }

    return tables;
}
