// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { generateWavetables } from './wavetable_generator';
import { SynthSpec } from '@/schemas/synthSpec';

describe('wavetable_generator', () => {
    it('generates the correct number of tables with correct size', () => {
        const spec: SynthSpec = {
            wavetables: {
                count: 4,
                tableSize: 256,
                family: 'additive',
                brightness: 0.5,
                inharmonicity: 0.1,
            },
            voice: { polyphony: 1, unison: 1, detuneCents: 0, stereoSpread: 0 },
            ampEnv: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.1 },
            filter: { type: 'svf_lp', cutoffHz: 1000, resonance: 0, envAmount: 0 },
            fx: { chorus: 0, reverb: 0 },
            demo: { type: 'chord', notes: ['C4'], lengthSec: 1 }
        };

        const tables = generateWavetables(spec);
        expect(tables.length).toBe(4);
        expect(tables[0].length).toBe(256);
        expect(tables[3].length).toBe(256);
    });

    it('removes DC offset and normalizes (additive)', () => {
        const spec: SynthSpec = {
            wavetables: {
                count: 1,
                tableSize: 256,
                family: 'additive',
                brightness: 0.8,
                inharmonicity: 0.0,
            },
            voice: { polyphony: 1, unison: 1, detuneCents: 0, stereoSpread: 0 },
            ampEnv: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.1 },
            filter: { type: 'svf_lp', cutoffHz: 1000, resonance: 0, envAmount: 0 },
            fx: { chorus: 0, reverb: 0 },
            demo: { type: 'chord', notes: ['C4'], lengthSec: 1 }
        };

        const tables = generateWavetables(spec);
        const table = tables[0];

        // Calculate DC offset
        const sum = table.reduce((a, b) => a + b, 0);
        const dc = sum / table.length;

        // Float precision error tolerance
        expect(Math.abs(dc)).toBeLessThan(0.001);

        // Check normalization
        const maxAmp = Math.max(...Array.from(table).map(Math.abs));
        expect(maxAmp).toBeCloseTo(1.0, 3);
    });
});
