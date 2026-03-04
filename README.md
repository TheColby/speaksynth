# 🎙️ SpeakSynth

> **Speak a sound. Hear it in seconds.**

SpeakSynth is an open-source, browser-based synthesizer powered by speech and AI. Describe any sound in plain English — a "warm analog pad", a "gritty reese bass", a "glassy shimmer" — and receive a fully-realized wavetable synthesizer patch playing back in ~2 seconds. No knob-turning required.

---

## ✨ How It Works

```
🎤 Speak  →  📝 Transcribe (Whisper)  →  🤖 LLM Patch Generation  →  🔊 WebAudio Playback
```

1. **Speak** your sound description into the microphone
2. **Transcribe** — audio is sent to Whisper for fast, accurate transcription
3. **Generate** — an LLM converts the text into a structured `SynthSpec` (validated with Zod)
4. **Synthesize** — the spec is rendered into a wavetable bank via deterministic DSP algorithms
5. **Play** — an AudioWorklet-powered engine plays back your sound instantly in the browser

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) + [TypeScript](https://typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Speech-to-Text | [Whisper / faster-whisper](https://github.com/openai/whisper) or OpenAI API |
| LLM | [OpenAI GPT-4o](https://platform.openai.com) |
| Schema Validation | [Zod](https://zod.dev) |
| Audio Engine | [WebAudio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) + [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) |
| Testing | [Vitest](https://vitest.dev) |

---

## 🚀 Quick Start

### 1. Clone and install

```bash
git clone https://github.com/TheColby/speaksynth.git
cd speaksynth
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Add your API key:

```env
OPENAI_API_KEY=sk-...
```

> **No API key?** The app falls back to a built-in mock patch so you can still explore the UI and DSP engine.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing

```bash
npm test
```

Unit tests cover the core DSP algorithms (wavetable generation, normalization, DC removal) using Vitest.

---

## 📁 Project Structure

```
/app
  /api/generate      → LLM patch generation endpoint (POST)
  /api/transcribe    → Whisper transcription endpoint (POST)
/audio
  SynthEngine.ts     → WebAudio graph: oscillator, filter, FX, ADSR
/components
  MicInput.tsx       → Microphone capture and waveform display
  SynthPanel.tsx     → Patch parameter visualization
  Keyboard.tsx       → On-screen MIDI keyboard
/dsp
  wavetable_generator.ts  → Deterministic DSP: additive, formant, waveshaper, PWM families
/public/worklets
  synth-processor.js → AudioWorklet DSP thread
/schemas
  synthSpec.ts       → Zod schema for the SynthSpec JSON contract
```

---

## 🎛️ SynthSpec Schema

The LLM outputs a structured JSON `SynthSpec` validated against a Zod schema:

```ts
{
  wavetables: { count, tableSize, family, brightness, inharmonicity },
  voice:      { polyphony, unison, detuneCents, stereoSpread },
  ampEnv:     { attack, decay, sustain, release },
  filter:     { type, cutoffHz, resonance, envAmount },
  fx:         { chorus, reverb },
  demo:       { type, notes, lengthSec }
}
```

Wavetable families: `additive` · `formant` · `waveshaper` · `pwm`

---

## 🤝 Contributing

PRs welcome. Open an issue first for major changes.

---

## 📄 License

MIT
