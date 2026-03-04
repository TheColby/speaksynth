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

Here is the JSON schema you must perfectly conform to:
${JSON.stringify(schemaJson, null, 2)}

Make creative choices to best approximate the prompt. For a "glassy ambient pad", you might choose 'additive', slow attack/release, low cutoff with env amount, polyphony 8, unison 4, and high reverb. For a "gritty bass", use 'waveshaper' or 'pwm', fast attack, fast decay, no sustain, 0 reverb.
`;

const MOCK_RESPONSE: SynthSpec = {
    wavetables: {
        count: 16,
        tableSize: 2048,
        family: "additive",
        brightness: 0.8,
        inharmonicity: 0.2
    },
    voice: {
        polyphony: 8,
        unison: 4,
        detuneCents: 15,
        stereoSpread: 0.8
    },
    ampEnv: {
        attack: 2.0,
        decay: 0.5,
        sustain: 0.8,
        release: 4.0
    },
    filter: {
        type: "svf_lp",
        cutoffHz: 800,
        resonance: 0.3,
        envAmount: 0.2
    },
    fx: {
        chorus: 0.5,
        reverb: 0.8
    },
    demo: {
        type: "chord",
        notes: ["C3", "G3", "Bb3", "D4"],
        lengthSec: 8
    }
};

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid "text" in request body' }, { status: 400 });
        }

        if (!openai) {
            console.log("No OPENAI_API_KEY found. Returning mock SynthSpec.");
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            return NextResponse.json(MOCK_RESPONSE);
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Generate a synth patch for this description: "${text}"` }
            ],
            response_format: { type: "json_object" }
        });

        const responseContent = completion.choices[0]?.message?.content;

        if (!responseContent) {
            throw new Error("No content returned from LLM");
        }

        const parsedJson = JSON.parse(responseContent);
        const validSpec = SynthSpecSchema.parse(parsedJson);

        return NextResponse.json(validSpec);
    } catch (error) {
        console.error('Error generating SynthSpec:', error);
        return NextResponse.json({ error: 'Failed to generate synthesizer specification' }, { status: 500 });
    }
}
