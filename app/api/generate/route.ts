// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SynthSpecSchema, SynthSpec } from '@/schemas/synthSpec';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
}) : null;

const schemaJson = zodToJsonSchema(SynthSpecSchema as any, "SynthSpec");

const SYSTEM_PROMPT = `
You are an expert audio DSP engineer and synthesizer patch designer.
Your task is to convert a user's natural language description of a sound into a strict JSON object that conforms to the provided SynthSpec schema.
You must return ONLY the raw JSON object, with no markdown formatting or extra text.

The synthesizer architecture includes:
- Wavetable oscillators with adjustable families (additive, formant, waveshaper, pwm)
- Unison with detuning and stereo spread
- An ADSR amplitude envelope
- A State Variable Filter (LP, BP, or Ladder)
- Global Chorus and Reverb FX
- A demo sequence to showcase the sound

CRITICAL: Make the patch dramatically different based on the description. Do NOT default to pad sounds.
- Basses: attack 0.001–0.01s, decay 0.1–0.3s, sustain 0.3–0.6, release 0.05–0.2s, reverb < 0.2, cutoff 200–600Hz, family 'waveshaper' or 'pwm', unison 1–2
- Leads: attack 0.005–0.05s, decay 0.1s, sustain 0.7–0.9, release 0.1–0.3s, reverb 0.1–0.4, cutoff 1500–4000Hz, family 'additive' or 'formant', unison 1–2
- Pads: attack 1–3s, decay 0.5s, sustain 0.7–0.9, release 2–5s, reverb 0.6–0.9, cutoff 400–900Hz, family 'additive', unison 4–8
- Plucks: attack 0.001s, decay 0.05–0.2s, sustain 0.0–0.1, release 0.3–0.8s, reverb 0.2–0.5, cutoff 2000–8000Hz, family 'pwm' or 'additive', unison 1
- Keys/Piano: attack 0.001s, decay 0.5–1.5s, sustain 0.0–0.3, release 1–2s, reverb 0.2–0.4, cutoff 3000–8000Hz, family 'additive', unison 1
- Strings: attack 0.3–1s, decay 0.3s, sustain 0.8, release 1–2s, reverb 0.4–0.7, family 'formant', unison 3–6
- Brass/Winds: attack 0.05–0.2s, decay 0.1s, sustain 0.8–0.95, release 0.1–0.3s, reverb 0.1–0.3, family 'formant', unison 1–2
- Bells/Mallet: attack 0.001s, decay 1–4s, sustain 0.0, release 2–6s, reverb 0.4–0.7, family 'additive', brightness > 0.7

Here is the JSON schema you must perfectly conform to:
${JSON.stringify(schemaJson, null, 2)}
`;

// ── Keyword-driven mock presets ──────────────────────────────────────────────
// Used when OPENAI_API_KEY is not set, so the app demonstrates real timbral variety.

type PresetDef = { keys: string[]; spec: SynthSpec };

const PRESETS: PresetDef[] = [
    {
        keys: ['bass', 'sub', 'low', 'reese', 'growl', 'deep'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'waveshaper', brightness: 0.6, inharmonicity: 0.3 },
            voice: { polyphony: 2, unison: 2, detuneCents: 8, stereoSpread: 0.3 },
            ampEnv: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.1 },
            filter: { type: 'ladder_lp', cutoffHz: 350, resonance: 0.5, envAmount: 0.4 },
            fx: { chorus: 0.1, reverb: 0.05 },
            demo: { type: 'note', notes: ['C2', 'C2', 'G2', 'C2'], lengthSec: 4 },
        },
    },
    {
        keys: ['lead', 'solo', 'melody', 'sharp', 'cutting', 'screech', 'bright'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'additive', brightness: 0.9, inharmonicity: 0.05 },
            voice: { polyphony: 2, unison: 1, detuneCents: 0, stereoSpread: 0.2 },
            ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.85, release: 0.15 },
            filter: { type: 'svf_lp', cutoffHz: 3500, resonance: 0.4, envAmount: 0.1 },
            fx: { chorus: 0.15, reverb: 0.25 },
            demo: { type: 'note', notes: ['C4', 'E4', 'G4', 'B4', 'G4', 'E4', 'C4'], lengthSec: 4 },
        },
    },
    {
        keys: ['pluck', 'pizz', 'harp', 'guitar', 'twang', 'strum'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'pwm', brightness: 0.75, inharmonicity: 0.1 },
            voice: { polyphony: 6, unison: 1, detuneCents: 0, stereoSpread: 0.5 },
            ampEnv: { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.5 },
            filter: { type: 'svf_lp', cutoffHz: 5000, resonance: 0.2, envAmount: -0.3 },
            fx: { chorus: 0.0, reverb: 0.35 },
            demo: { type: 'note', notes: ['C3', 'E3', 'G3', 'C4', 'G3', 'E3'], lengthSec: 3 },
        },
    },
    {
        keys: ['bell', 'chime', 'mallet', 'vibraphone', 'marimba', 'crystal', 'glass', 'xylophone'],
        spec: {
            wavetables: { count: 16, tableSize: 2048, family: 'additive', brightness: 0.85, inharmonicity: 0.25 },
            voice: { polyphony: 8, unison: 1, detuneCents: 0, stereoSpread: 0.6 },
            ampEnv: { attack: 0.001, decay: 2.0, sustain: 0.0, release: 3.0 },
            filter: { type: 'svf_lp', cutoffHz: 8000, resonance: 0.1, envAmount: 0.0 },
            fx: { chorus: 0.0, reverb: 0.55 },
            demo: { type: 'chord', notes: ['C4', 'E4', 'G4', 'C5'], lengthSec: 5 },
        },
    },
    {
        keys: ['string', 'violin', 'cello', 'orchestra', 'cinematic', 'lush'],
        spec: {
            wavetables: { count: 16, tableSize: 2048, family: 'formant', brightness: 0.65, inharmonicity: 0.15 },
            voice: { polyphony: 8, unison: 5, detuneCents: 12, stereoSpread: 0.9 },
            ampEnv: { attack: 0.4, decay: 0.2, sustain: 0.85, release: 1.5 },
            filter: { type: 'svf_lp', cutoffHz: 2000, resonance: 0.15, envAmount: 0.1 },
            fx: { chorus: 0.4, reverb: 0.65 },
            demo: { type: 'chord', notes: ['C3', 'G3', 'E4'], lengthSec: 6 },
        },
    },
    {
        keys: ['brass', 'trumpet', 'horn', 'trombone', 'fanfare', 'wind'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'formant', brightness: 0.8, inharmonicity: 0.05 },
            voice: { polyphony: 4, unison: 2, detuneCents: 5, stereoSpread: 0.4 },
            ampEnv: { attack: 0.08, decay: 0.05, sustain: 0.9, release: 0.2 },
            filter: { type: 'svf_bp', cutoffHz: 1200, resonance: 0.5, envAmount: 0.3 },
            fx: { chorus: 0.1, reverb: 0.2 },
            demo: { type: 'note', notes: ['C3', 'E3', 'G3', 'C4'], lengthSec: 4 },
        },
    },
    {
        keys: ['piano', 'keys', 'electric piano', 'ep', 'rhodes', 'wurlitzer'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'additive', brightness: 0.7, inharmonicity: 0.08 },
            voice: { polyphony: 8, unison: 1, detuneCents: 0, stereoSpread: 0.4 },
            ampEnv: { attack: 0.001, decay: 1.2, sustain: 0.1, release: 1.5 },
            filter: { type: 'svf_lp', cutoffHz: 5000, resonance: 0.1, envAmount: 0.0 },
            fx: { chorus: 0.2, reverb: 0.25 },
            demo: { type: 'chord', notes: ['C3', 'E3', 'G3', 'B3'], lengthSec: 5 },
        },
    },
    {
        keys: ['pad', 'ambient', 'atmosphere', 'drone', 'wash', 'warm', 'soft', 'glassy', 'shimmer'],
        spec: {
            wavetables: { count: 16, tableSize: 2048, family: 'additive', brightness: 0.8, inharmonicity: 0.2 },
            voice: { polyphony: 8, unison: 4, detuneCents: 15, stereoSpread: 0.8 },
            ampEnv: { attack: 2.0, decay: 0.5, sustain: 0.8, release: 4.0 },
            filter: { type: 'svf_lp', cutoffHz: 800, resonance: 0.3, envAmount: 0.2 },
            fx: { chorus: 0.5, reverb: 0.8 },
            demo: { type: 'chord', notes: ['C3', 'G3', 'Bb3', 'D4'], lengthSec: 8 },
        },
    },
    {
        keys: ['pwm', 'pulse', 'hollow', 'nasal', 'c64', 'chiptune', 'retro', '8bit'],
        spec: {
            wavetables: { count: 8, tableSize: 2048, family: 'pwm', brightness: 0.55, inharmonicity: 0.0 },
            voice: { polyphony: 3, unison: 1, detuneCents: 0, stereoSpread: 0.0 },
            ampEnv: { attack: 0.002, decay: 0.05, sustain: 0.9, release: 0.1 },
            filter: { type: 'svf_lp', cutoffHz: 2500, resonance: 0.6, envAmount: 0.0 },
            fx: { chorus: 0.05, reverb: 0.1 },
            demo: { type: 'note', notes: ['C4', 'G4', 'A4', 'F4', 'G4', 'C4'], lengthSec: 3 },
        },
    },
    {
        keys: ['fm', 'metallic', 'electric', 'harsh', 'digital', 'gritty', 'distort', 'aggressive'],
        spec: {
            wavetables: { count: 16, tableSize: 2048, family: 'waveshaper', brightness: 0.85, inharmonicity: 0.5 },
            voice: { polyphony: 4, unison: 3, detuneCents: 20, stereoSpread: 0.7 },
            ampEnv: { attack: 0.002, decay: 0.3, sustain: 0.4, release: 0.2 },
            filter: { type: 'svf_lp', cutoffHz: 4000, resonance: 0.7, envAmount: 0.6 },
            fx: { chorus: 0.2, reverb: 0.15 },
            demo: { type: 'chord', notes: ['C3', 'Eb3', 'Gb3', 'A3'], lengthSec: 4 },
        },
    },
];

const DEFAULT_PRESET = PRESETS.find(p => p.keys.includes('pad'))!.spec;

function pickMockPreset(text: string): SynthSpec {
    const lower = text.toLowerCase();
    for (const preset of PRESETS) {
        if (preset.keys.some(k => lower.includes(k))) {
            return preset.spec;
        }
    }
    return DEFAULT_PRESET;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { text, contextSpec } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid "text" in request body' }, { status: 400 });
        }

        if (!openai) {
            console.log("No OPENAI_API_KEY — using keyword-matched preset for:", text);
            await new Promise(resolve => setTimeout(resolve, 800));
            return NextResponse.json(pickMockPreset(text));
        }

        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        if (contextSpec) {
            messages.push({
                role: "system",
                content: `The user currently has this patch loaded:\n${JSON.stringify(contextSpec, null, 2)}\n\nApply their requested changes as a modification to this existing patch instead of starting from scratch. Keep parameters they don't mention relatively similar.`
            });
        }

        messages.push({ role: "user", content: `Generate a synth patch for this description: "${text}"` });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            response_format: { type: "json_object" }
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) throw new Error("No content returned from LLM");

        const parsedJson = JSON.parse(responseContent);
        const validSpec = SynthSpecSchema.parse(parsedJson);
        return NextResponse.json(validSpec);
    } catch (error) {
        console.error('Error generating SynthSpec:', error);
        return NextResponse.json({ error: 'Failed to generate synthesizer specification' }, { status: 500 });
    }
}
