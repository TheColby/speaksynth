# 🎙️ SpeakSynth

**Speak a sound. Hear it in seconds.**

SpeakSynth is an open-source, browser-based **wavetable synthesizer** powered by speech and AI. Describe any sound in plain English — *"warm analog pad"*, *"gritty whack bass"*, *"glassy FM shimmer"*, *"make an ethereal percussive pitched bongo with reverse reverb gating that morphs calmly within 200 msec into a warbly FM decay with a long tail"* — and receive a fully-realized synthesizer patch playing back in your browser in approximately 2 seconds, with no knobs to turn (unless u want them) and no DAW required.

Seriously. Like, where have you been all my life? 

Nerd Alert:

Under the hood, SpeakSynth combines a Whisper-powered transcription endpoint, a GPT-4o LLM that interprets your description into a structured `SynthSpec` JSON schema, a deterministic DSP wavetable bank generator, and a polyphonic `AudioWorklet` synthesis engine — all running in a Next.js web application.

---

## 🌊 What Is Wavetable Synthesis?

Wavetable synthesis is a digital audio technique in which **a single cycle of a waveform** (called a *wavetable*) is stored in memory and then played back in a loop at varying speeds to produce different pitches. Unlike subtractive synthesis — which starts with a spectrally rich waveform and filters it — wavetable synthesis can produce any timbre by crafting the shape of the wave itself.

A single cycle of a waveform is stored as a lookup table and played back in a loop — the playback speed determines pitch, and the shape of the waveform determines timbre.

A **wavetable bank** extends this: multiple single-cycle waveforms are arranged in a sequence, and the synthesis engine can *morph* between them continuously, creating evolving, animated timbres. This morphing is what gives wavetable synths their characteristic "moving" quality.

### Key DSP Concepts

| Term | Meaning |
|---|---|
| **Single-cycle waveform** | One period of a repeating wave stored as a lookup table |
| **Wavetable bank** | A collection of single-cycle waveforms indexed by a morph parameter |
| **Morphing** | Smooth interpolation between adjacent tables to create spectral evolution |
| **Bandlimiting** | Removing harmonics above Nyquist to prevent aliasing during playback |
| **Harmonic series** | The spectrum of partials at integer multiples of the fundamental frequency |

SpeakSynth implements four wavetable **families** generated algorithmically from your `SynthSpec`:

- **`additive`** — Builds waves from the harmonic series using configurable spectral tilt and inharmonicity. As the morph parameter sweeps, the tilt sharpens, producing evolving brightness.
- **`formant`** — Creates spectral peaks (formants) that sweep across the harmonic series, mimicking the resonant cavities of acoustic instruments and the human voice.
- **`waveshaper`** — Starts with a pure sine, then applies tanh saturation and sine-fold distortion, sweeping from clean to heavily clipped and folded.
- **`pwm`** — Constructs bandlimited pulse waves using additive cosines. The duty cycle sweeps from 50% to near-zero, producing the classic "hollow → nasal" pulse width modulation character.

---

## 📡 History of Wavetable Synthesis

### Origins: The PPG Wave (1981)

The modern concept of wavetable synthesis was **invented by Wolfgang Palm** and commercialized through his company **PPG (Palm Products GmbH)**. The [PPG Wave 2.2](https://en.wikipedia.org/wiki/PPG_Wave) (1982) was the first commercially successful wavetable synthesizer. It used 8-bit wavetables and allowed users to step through discrete waveforms, producing the icy, glassy character that defined early 1980s electronic and pop music.

> *"The PPG Wave had a crystal-clear, brittle quality nobody had heard before. It sounded almost like digital glass."*  
> — Many producers of the era

Notable users of the PPG Wave: **Tangerine Dream**, **Klaus Schulze**, **Duran Duran**, **Kate Bush**, **Howard Jones**.

References:
- Aikin, J. (2001). *Power Tools for Synthesizer Programming*. Backbeat Books.
- Palmer, R. (2012). "Wolfgang Palm Interview." *Sound On Sound*.

---

### Waldorf Microwave (1989) and Blofeld

PPG was succeeded by **Waldorf Music**, founded by former PPG engineers. The [Waldorf Microwave](https://en.wikipedia.org/wiki/Waldorf_Microwave) (1989) modernized the concept with 12-bit wavetables stored in ROM and added powerful modulation. It remains one of the most sought-after hardware synths.

Waldorf went on to produce:
- **Waldorf Wave** (1993) — the apex of hardware wavetable synthesis
- **Waldorf Q** (1999) — brought wavetables to a modern virtual analog platform
- **Waldorf Blofeld** (2007) — affordable desktop module, still sold today
- **Quantum / Iridium** (2018/2020) — modern flagships with user-uploadable wavetables and semi-modular architecture

References:
- Baddeley, R. (2018). *Waldorf Quantum Manual*. Waldorf Music GmbH.
- Vail, M. (2014). *The Synthesizer: A Comprehensive Guide to Understanding, Programming, Playing, and Recording*. Oxford University Press.

---

### Korg Wavestation (1990): Vector Synthesis

Korg's [Wavestation](https://en.wikipedia.org/wiki/Korg_Wavestation) introduced **vector synthesis** — moving between multiple wavetables in 2D space using a joystick. Derived from the Sequential Circuits Prophet-VS (1986), it produced shimmering, evolving pads that no other instrument could replicate.

---

### Ensoniq Transwave (1993) and SQ Series

Ensoniq's **Transwave** technology, used in the SQ-1, SQ-2, and TS-10, allowed real-time wavetable morphing across banks of single-cycle waveforms — a precursor to the modern continuous scanning found in software instruments.

---

### Software: Serum, Vital, and Modern Wavetable VSTs

The software era democratized wavetable synthesis entirely:

| Instrument | Year | Significance |
|---|---|---|
| [Native Instruments Absynth](https://www.native-instruments.com) | 1999 | Introduced morphing wavetable oscillators in software |
| [Native Instruments Massive](https://www.native-instruments.com) | 2007 | Defined "neuro bass" production; massive influence on EDM |
| [Xfer Serum](https://xferrecords.com/products/serum) | 2014 | User-drawable wavetables, visual editor, became industry standard |
| [Vital](https://vital.audio) | 2020 | Free, open-source-inspired; spectral morphing oscillators |
| [Surge XT](https://surge-synthesizer.github.io) | 2005/2018 | Fully open-source; sophisticated wavetable engine |

References:
- Russ, M. (2012). *Sound Synthesis and Sampling* (3rd ed.). Focal Press.
- Chelew, J. (2020). "The History of Wavetable Synthesis." *Reverb.com*.
- Serum product page: https://xferrecords.com/products/serum
- Surge XT source: https://github.com/surge-synthesizer/surge

---

### Academic and Research Context

Wavetable synthesis is formally described in the signal processing and computer music literature:

- **Smith, J.O. & Gossett, P.** (1984). "A flexible sampling-rate conversion method." *ICASSP-84*. IEEE. — foundational work on sample-rate manipulation underpinning read-rate modulation.
- **Bristow-Johnson, R.** (1996). "Wavetable Synthesis 101: A Fundamental Perspective." *AES 101st Convention*. — definitive tutorial on aliasing and bandlimiting in wavetable playback.
- **Moorer, J.A.** (1976). "The Synthesis of Complex Audio Spectra by Means of Discrete Summation Formulas." *Journal of the Audio Engineering Society*, 24(9). — foundational additive synthesis mathematics.
- **Roads, C.** (1996). *The Computer Music Tutorial*. MIT Press. — comprehensive treatment of wavetable and other synthesis techniques (pp. 128–170).
- **Tolonen, T., Välimäki, V., & Karjalainen, M.** (1998). "Evaluation of Modern Sound Synthesis Methods." *Helsinki University of Technology Report*. — comparative analysis including wavetable techniques.

---

## 🤖 What SpeakSynth Does Differently

Traditional wavetable synthesizers require expert knowledge: you must know what "inharmonicity," "spectral tilt," "unison detune," and "SVF resonance" mean, and you must tweak them manually. SpeakSynth eliminates this entirely:

1. **You describe the sound** in natural language
2. **Whisper** transcribes your voice with sub-second latency
3. **GPT-4o** interprets your description and maps it onto a validated `SynthSpec` — a structured JSON object containing wavetable parameters, voice configuration, ADSR envelope, filter settings, and FX amounts
4. **Deterministic DSP** renders a wavetable bank for the chosen family
5. **A polyphonic AudioWorklet** synthesizes audio in real time, directly in your browser — no plugins, no install, no DAW
6. **Play it immediately** — via the on-screen keyboard, your computer keyboard (A–K mapped to a chromatic octave), or any connected **MIDI keyboard** through the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). Plug in a controller and your generated patch responds to real hardware in real time, directly in the browser.

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) + [TypeScript](https://typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Speech-to-Text | [Whisper](https://openai.com/research/whisper) via OpenAI API |
| LLM | [OpenAI GPT-4o](https://platform.openai.com) |
| Schema Validation | [Zod v3](https://zod.dev) |
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

Create `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

> **No API key?** The app falls back to a built-in mock patch (a warm additive pad) so you can still explore the interface and audio engine.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click anywhere to enable audio, then describe a sound.

---

## 🎛️ SynthSpec Schema

The LLM outputs a structured JSON `SynthSpec`, validated with Zod:

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

Filter types: `svf_lp` · `svf_bp` · `ladder_lp`  
Wavetable families: `additive` · `formant` · `waveshaper` · `pwm`

---

## 🧪 Testing

```bash
npm test
```

Unit tests cover the DSP core: wavetable generation, DC removal, normalization, and table sizing across all families.

---

## 📁 Project Structure

```
/app
  /api/generate      → LLM patch generation (POST)
  /api/transcribe    → Whisper transcription (POST)
/audio
  SynthEngine.ts     → WebAudio graph: worklet loader, note scheduling, offline rendering
/components
  MicInput.tsx       → Microphone capture + RMS volume meter
  TranscriptEntry.tsx → Text prompt editor + generate button
  SynthPanel.tsx     → Wavetable morph and filter cutoff macro sliders
  Keyboard.tsx       → On-screen piano keyboard + MIDI input
/dsp
  wavetable_generator.ts  → Bandlimited DSP: additive, formant, waveshaper, PWM families
/public/worklets
  synth-processor.js → AudioWorklet: polyphonic voice allocator, SVF filter, chorus, FDN reverb
/schemas
  synthSpec.ts       → Zod schema for the SynthSpec JSON contract
```

---

## 🤝 Contributing

PRs welcome. Please open an issue for significant feature work before starting.

---

## 📄 License

MIT — see [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) for full dependency and copyright information.

© 2026 Colby Leider and contributors.
