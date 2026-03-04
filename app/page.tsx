// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useState, useEffect, useRef } from 'react';
import MicInput from '@/components/MicInput';
import TranscriptEntry from '@/components/TranscriptEntry';
import SynthPanel from '@/components/SynthPanel';
import Keyboard from '@/components/Keyboard';
import { SynthSpec } from '@/schemas/synthSpec';
import { engine } from '@/audio/SynthEngine';
import { generateWavetables } from '@/dsp/wavetable_generator';

// Ensure audio context is running (browsers auto-suspend it)
async function ensureAudio() {
  await engine.init();
  engine.resume();
}

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSpec, setCurrentSpec] = useState<SynthSpec | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [engineReady, setEngineReady] = useState(false);

  // Use a ref for generatePatch so handleTranscription never goes stale
  const generatePatchRef = useRef<((text: string) => Promise<void>) | undefined>(undefined);

  // Initialize audio engine on mount — avoids race between pointerdown and click
  useEffect(() => {
    // We can't call init() until a user gesture, but we can warm up everything else.
    // The first user interaction (any click/tap) will resume the context.
    const handleFirstInteraction = async () => {
      await ensureAudio();
      setEngineReady(true);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  async function generatePatch(text: string) {
    if (!text.trim()) return;

    // Ensure audio is ready before generating
    await ensureAudio();
    if (!engineReady) setEngineReady(true);

    setIsGenerating(true);
    setStatusMessage('Generating patch…');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`Generation failed: ${res.status}`);

      const spec: SynthSpec = await res.json();
      const tables = generateWavetables(spec);
      engine.loadSpec(spec, tables);
      engine.playDemo();

      setCurrentSpec(spec);
      setStatusMessage(`🎛 Patch loaded · ${spec.wavetables.family} · ${spec.voice.unison}× unison`);
    } catch (e) {
      console.error(e);
      setStatusMessage('Error generating patch. Is OPENAI_API_KEY set?');
    } finally {
      setIsGenerating(false);
    }
  }

  // Keep the ref current so MicInput's callback is never stale
  generatePatchRef.current = generatePatch;

  async function handleTranscription(text: string) {
    setTranscript(text);
    setIsProcessing(false);
    await generatePatchRef.current!(text);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50">SpeakSynth</h1>
            <p className="text-xs text-zinc-500">Speak a sound. Hear it in seconds.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full transition-colors ${engineReady ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="text-xs text-zinc-500">{engineReady ? 'Audio ready' : 'Click anywhere to enable audio'}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-6 py-10 max-w-3xl mx-auto w-full">
        {/* Mic + Transcript */}
        <div className="flex flex-col sm:flex-row gap-4 w-full items-start justify-center">
          <MicInput
            onTranscription={handleTranscription}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
          <div className="flex-1 w-full">
            <TranscriptEntry
              transcript={transcript}
              setTranscript={setTranscript}
              onGenerate={() => generatePatch(transcript)}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Status */}
        {statusMessage && (
          <div className="w-full text-sm text-center text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
            {statusMessage}
          </div>
        )}

        {/* Synth macros */}
        <SynthPanel hasPatch={!!currentSpec} />

        {/* Keyboard — always visible; enabled once audio is ready */}
        <Keyboard hasPatch={!!currentSpec} engineReady={engineReady} />

        {/* Patch info */}
        {currentSpec && (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-xs text-zinc-500">
            {[
              { label: 'family', value: currentSpec.wavetables.family },
              { label: 'tables', value: currentSpec.wavetables.count },
              { label: 'unison', value: `${currentSpec.voice.unison}×` },
              { label: 'attack', value: `${currentSpec.ampEnv.attack.toFixed(1)}s` },
              { label: 'filter', value: currentSpec.filter.type.replace('_', ' ') },
              { label: 'reverb', value: `${(currentSpec.fx.reverb * 100).toFixed(0)}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-zinc-300 font-mono text-sm">{value}</div>
                <div>{label}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-center text-xs text-zinc-600">
        © 2026 Colby Leider and contributors ·{' '}
        <a href="https://github.com/TheColby/speaksynth" className="hover:text-zinc-400 transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
