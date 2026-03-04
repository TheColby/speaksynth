// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useState, useEffect, useCallback } from 'react';
import MicInput from '@/components/MicInput';
import TranscriptEntry from '@/components/TranscriptEntry';
import SynthPanel from '@/components/SynthPanel';
import Keyboard from '@/components/Keyboard';
import { SynthSpec } from '@/schemas/synthSpec';
import { engine } from '@/audio/SynthEngine';
import { generateWavetables } from '@/dsp/wavetable_generator';

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSpec, setCurrentSpec] = useState<SynthSpec | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [engineReady, setEngineReady] = useState(false);

  // Initialize the audio engine on first user interaction
  const initEngine = useCallback(async () => {
    if (engineReady) {
      engine.resume();
      return;
    }
    await engine.init();
    setEngineReady(true);
  }, [engineReady]);

  const handleTranscription = useCallback(async (text: string) => {
    setTranscript(text);
    setIsProcessing(false);
    // Auto-generate after transcription
    await generatePatch(text);
  }, []);

  const generatePatch = useCallback(async (text: string) => {
    if (!text.trim()) return;
    await initEngine();

    setIsGenerating(true);
    setStatusMessage('Generating patch…');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('Generation failed');

      const spec: SynthSpec = await res.json();
      const tables = generateWavetables(spec);

      engine.loadSpec(spec, tables);
      engine.playDemo();

      setCurrentSpec(spec);
      setStatusMessage(`🎛 Patch loaded · ${spec.wavetables.family} · ${spec.voice.unison}× unison`);
    } catch (e) {
      console.error(e);
      setStatusMessage('Error generating patch. Check the console.');
    } finally {
      setIsGenerating(false);
    }
  }, [initEngine]);

  const handleGenerate = useCallback(() => {
    generatePatch(transcript);
  }, [transcript, generatePatch]);

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col"
      onClick={initEngine}
    >
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
          <span className={`w-2 h-2 rounded-full ${engineReady ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="text-xs text-zinc-500">{engineReady ? 'Audio ready' : 'Click to enable audio'}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center gap-6 px-6 py-10 max-w-3xl mx-auto w-full">

        {/* Mic + Transcript row */}
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
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Status bar */}
        {statusMessage && (
          <div className="w-full text-sm text-center text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
            {statusMessage}
          </div>
        )}

        {/* Synth macro controls */}
        <SynthPanel hasPatch={!!currentSpec} />

        {/* Keyboard */}
        <Keyboard hasPatch={!!currentSpec} />

        {/* Patch details */}
        {currentSpec && (
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid grid-cols-3 sm:grid-cols-6 gap-4 text-center text-xs text-zinc-500">
            <div>
              <div className="text-zinc-300 font-mono text-sm">{currentSpec.wavetables.family}</div>
              <div>family</div>
            </div>
            <div>
              <div className="text-zinc-300 font-mono text-sm">{currentSpec.wavetables.count}</div>
              <div>tables</div>
            </div>
            <div>
              <div className="text-zinc-300 font-mono text-sm">{currentSpec.voice.unison}×</div>
              <div>unison</div>
            </div>
            <div>
              <div className="text-zinc-300 font-mono text-sm">{currentSpec.ampEnv.attack.toFixed(1)}s</div>
              <div>attack</div>
            </div>
            <div>
              <div className="text-zinc-300 font-mono text-sm">{currentSpec.filter.type.replace('_', ' ')}</div>
              <div>filter</div>
            </div>
            <div>
              <div className="text-zinc-300 font-mono text-sm">{(currentSpec.fx.reverb * 100).toFixed(0)}%</div>
              <div>reverb</div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-3 text-center text-xs text-zinc-600">
        © 2026 Colby Leider and contributors · <a href="https://github.com/TheColby/speaksynth" className="hover:text-zinc-400 transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
