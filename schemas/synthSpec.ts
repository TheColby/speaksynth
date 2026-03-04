import { z } from 'zod';

export const SynthSpecSchema = z.object({
  wavetables: z.object({
    count: z.number().int().min(1).max(32).describe("Number of wavetables in the bank"),
    tableSize: z.number().int().describe("Size of each wavetable, usually 2048"),
    family: z.enum(['additive', 'formant', 'waveshaper', 'pwm']).describe("The algorithm family to generate the wavetables"),
    brightness: z.number().min(0).max(1).describe("High-frequency content or filter baseline (0.0 to 1.0)"),
    inharmonicity: z.number().min(0).max(1).describe("Amount of inharmonic/noisy content (0.0 to 1.0)")
  }),
  voice: z.object({
    polyphony: z.number().int().min(1).max(16).describe("Maximum simultaneous notes"),
    unison: z.number().int().min(1).max(8).describe("Oscillators per voice"),
    detuneCents: z.number().min(0).max(100).describe("Detuning amount in cents for unison voices"),
    stereoSpread: z.number().min(0).max(1).describe("Stereo panning spread for unison voices (0 to 1)")
  }),
  ampEnv: z.object({
    attack: z.number().min(0).max(10).describe("Attack times in seconds"),
    decay: z.number().min(0).max(10).describe("Decay times in seconds"),
    sustain: z.number().min(0).max(1).describe("Sustain level (0.0 to 1.0)"),
    release: z.number().min(0).max(10).describe("Release times in seconds")
  }),
  filter: z.object({
    type: z.enum(['svf_lp', 'svf_bp', 'ladder_lp']).describe("Filter type"),
    cutoffHz: z.number().min(20).max(20000).describe("Base filter cutoff frequency in Hz"),
    resonance: z.number().min(0).max(1).describe("Filter resonance/Q (0.0 to 1.0)"),
    envAmount: z.number().min(-1).max(1).describe("Amount of envelope applied to cutoff (-1.0 to 1.0)")
  }),
  fx: z.object({
    chorus: z.number().min(0).max(1).describe("Chorus effect mix amount (0.0 to 1.0)"),
    reverb: z.number().min(0).max(1).describe("Reverb effect mix amount (0.0 to 1.0)")
  }),
  demo: z.object({
    type: z.enum(['chord', 'note']).describe("Whether the demo plays a chord progression or a single note"),
    notes: z.array(z.string()).describe("Array of notes to play, e.g. ['C3', 'G3', 'Bb3', 'D4']"),
    lengthSec: z.number().min(1).max(30).describe("Length of the demo sequence in seconds")
  })
});

export type SynthSpec = z.infer<typeof SynthSpecSchema>;
