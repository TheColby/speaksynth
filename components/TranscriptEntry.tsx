// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface TranscriptEntryProps {
    transcript: string;
    setTranscript: (val: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
}

export default function TranscriptEntry({ transcript, setTranscript, onGenerate, isGenerating }: TranscriptEntryProps) {
    return (
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-zinc-100 font-medium">Prompt</h2>

            <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="e.g. Make a warm glassy ambient pad with a slow attack and subtle chorus..."
                className="w-full h-24 bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all placeholder:text-zinc-600"
            />

            <div className="flex justify-end">
                <button
                    onClick={onGenerate}
                    disabled={!transcript.trim() || isGenerating}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-2.5 rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating Patch...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Generate Synth
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
