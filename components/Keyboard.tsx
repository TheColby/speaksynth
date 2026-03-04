// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useEffect, useRef, useState } from 'react';
import { engine } from '@/audio/SynthEngine';

function buildOctaveKeys(octave: number, keyMap: Record<string, string>) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes.map(n => ({
        note: `${n}${octave}`,
        key: keyMap[`${n}${octave}`] ?? '',
        isBlack: n.includes('#'),
    }));
}

// Keyboard shortcuts only on the middle octave (C3)
const SHORTCUT_MAP: Record<string, string> = {
    C3: 'a', 'C#3': 'w', D3: 's', 'D#3': 'e', E3: 'd',
    F3: 'f', 'F#3': 't', G3: 'g', 'G#3': 'y',
    A3: 'h', 'A#3': 'u', B3: 'j', C4: 'k',
};

const KEYS = [
    ...buildOctaveKeys(2, SHORTCUT_MAP),
    ...buildOctaveKeys(3, SHORTCUT_MAP),
    ...buildOctaveKeys(4, SHORTCUT_MAP),
    { note: 'C5', key: '', isBlack: false },
];

interface KeyboardProps {
    hasPatch: boolean;
    engineReady: boolean;
}

export default function Keyboard({ hasPatch, engineReady }: KeyboardProps) {
    const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
    // Use a ref so keyboard event handlers never go stale
    const activeNotesRef = useRef<Set<string>>(new Set());

    const noteOn = (note: string) => {
        if (!hasPatch || !engineReady) return;
        if (activeNotesRef.current.has(note)) return;
        activeNotesRef.current = new Set(activeNotesRef.current).add(note);
        setActiveNotes(new Set(activeNotesRef.current));
        engine.noteOn(note);
    };

    const noteOff = (note: string) => {
        if (!hasPatch || !engineReady) return;
        const next = new Set(activeNotesRef.current);
        next.delete(note);
        activeNotesRef.current = next;
        setActiveNotes(new Set(next));
        engine.noteOff(note);
    };

    // Register keyboard shortcuts — only re-registers when hasPatch or engineReady changes,
    // NOT on every activeNotes change (we use the ref instead).
    useEffect(() => {
        if (!hasPatch || !engineReady) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
            const k = KEYS.find(k => k.key === e.key);
            if (k) noteOn(k.note);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            const k = KEYS.find(k => k.key === e.key);
            if (k) noteOff(k.note);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [hasPatch, engineReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const isDisabled = !hasPatch || !engineReady;

    return (
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col items-center gap-3">
            {isDisabled && (
                <p className="text-xs text-zinc-500">
                    {!engineReady ? 'Click anywhere to enable audio, then generate a patch to play' : 'Generate a patch to enable the keyboard'}
                </p>
            )}
            <div className="w-full overflow-x-auto pb-2">
                <div className="relative flex h-32" style={{ minWidth: 'max-content' }}>
                    {KEYS.map(({ note, isBlack, key }) => (
                        <div
                            key={note}
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                noteOn(note);
                            }}
                            onPointerUp={(e) => {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                                noteOff(note);
                            }}
                            onPointerCancel={() => noteOff(note)}
                            className={[
                                'relative flex items-end justify-center pb-1 select-none transition-colors duration-75',
                                isBlack
                                    ? 'w-8 h-20 -mx-4 z-10 rounded-b-md shadow-lg border-x border-b border-zinc-950'
                                    : 'w-12 h-32 rounded-b-md border-x border-b border-zinc-300',
                                isDisabled
                                    ? isBlack ? 'bg-zinc-800 cursor-not-allowed opacity-50' : 'bg-zinc-200 cursor-not-allowed opacity-50'
                                    : isBlack
                                        ? activeNotes.has(note) ? 'bg-emerald-700 cursor-pointer' : 'bg-zinc-800 cursor-pointer hover:bg-zinc-700'
                                        : activeNotes.has(note) ? 'bg-emerald-200 cursor-pointer' : 'bg-zinc-100 cursor-pointer hover:bg-zinc-50',
                            ].join(' ')}
                        >
                            <span className={`text-[9px] font-mono ${isBlack ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                {key.toUpperCase()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
