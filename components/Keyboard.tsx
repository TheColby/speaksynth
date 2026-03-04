// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useEffect, useState } from 'react';
import { engine } from '@/audio/SynthEngine';

const KEYS = [
    { note: 'C3', key: 'a', isBlack: false },
    { note: 'C#3', key: 'w', isBlack: true },
    { note: 'D3', key: 's', isBlack: false },
    { note: 'D#3', key: 'e', isBlack: true },
    { note: 'E3', key: 'd', isBlack: false },
    { note: 'F3', key: 'f', isBlack: false },
    { note: 'F#3', key: 't', isBlack: true },
    { note: 'G3', key: 'g', isBlack: false },
    { note: 'G#3', key: 'y', isBlack: true },
    { note: 'A3', key: 'h', isBlack: false },
    { note: 'A#3', key: 'u', isBlack: true },
    { note: 'B3', key: 'j', isBlack: false },
    { note: 'C4', key: 'k', isBlack: false },
];

export default function Keyboard({ hasPatch }: { hasPatch: boolean }) {
    const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!hasPatch) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const keyMap = KEYS.find(k => k.key === e.key);
            if (keyMap && !activeNotes.has(keyMap.note)) {
                engine.noteOn(keyMap.note);
                setActiveNotes(prev => new Set(prev).add(keyMap.note));
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const keyMap = KEYS.find(k => k.key === e.key);
            if (keyMap) {
                engine.noteOff(keyMap.note);
                setActiveNotes(prev => {
                    const next = new Set(prev);
                    next.delete(keyMap.note);
                    return next;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // MIDI Support
        let midiAccess: WebMidi.MIDIAccess | null = null;
        let midiInputs: WebMidi.MIDIInput[] = [];

        const onMidiMessage = (message: WebMidi.MIDIMessageEvent) => {
            const data = message.data;
            if (!data) return;
            const cmd = data[0] >> 4;
            const noteNum = data[1];
            const velocity = data.length > 2 ? data[2] : 0;

            // Calculate octave (MIDI note 60 is C4)
            const octave = Math.floor(noteNum / 12) - 1;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = noteNames[noteNum % 12];
            const noteStr = `${noteName}${octave}`;

            if (cmd === 9 && velocity > 0) {
                // Note On
                if (!activeNotes.has(noteStr)) {
                    engine.noteOn(noteStr);
                    setActiveNotes(prev => new Set(prev).add(noteStr));
                }
            } else if (cmd === 8 || (cmd === 9 && velocity === 0)) {
                // Note Off
                engine.noteOff(noteStr);
                setActiveNotes(prev => {
                    const next = new Set(prev);
                    next.delete(noteStr);
                    return next;
                });
            }
        };

        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(access => {
                midiAccess = access;
                for (const input of access.inputs.values()) {
                    input.onmidimessage = onMidiMessage;
                    midiInputs.push(input);
                }

                access.onstatechange = (e) => {
                    const port = e.port;
                    if (port.type === 'input') {
                        const input = port as WebMidi.MIDIInput;
                        if (port.state === 'connected') {
                            input.onmidimessage = onMidiMessage;
                        }
                    }
                };
            }).catch(err => console.error("MIDI access denied", err));
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (midiAccess) {
                for (const input of midiInputs) {
                    input.onmidimessage = null;
                }
            }
        };
    }, [hasPatch, activeNotes]);

    const handlePointerDown = (note: string) => {
        if (!hasPatch) return;
        engine.noteOn(note);
        setActiveNotes(prev => new Set(prev).add(note));
    };

    const handlePointerUp = (note: string) => {
        if (!hasPatch) return;
        engine.noteOff(note);
        setActiveNotes(prev => {
            const next = new Set(prev);
            next.delete(note);
            return next;
        });
    };

    return (
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex justify-center overflow-x-auto">
            <div className={`relative flex h-32 ${!hasPatch ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                {KEYS.map(({ note, isBlack, key }) => (
                    <div
                        key={note}
                        onPointerDown={() => handlePointerDown(note)}
                        onPointerUp={() => handlePointerUp(note)}
                        onPointerLeave={() => {
                            if (activeNotes.has(note)) handlePointerUp(note);
                        }}
                        className={`
              relative flex items-end justify-center pb-2 select-none cursor-pointer transition-colors
              ${isBlack
                                ? 'w-8 h-20 -mx-4 z-10 bg-zinc-800 border-x border-b border-zinc-950 rounded-b-md shadow-md'
                                : 'w-12 h-32 bg-zinc-100 border-x border-b border-zinc-300 rounded-b-md'
                            }
              ${activeNotes.has(note) ? (isBlack ? 'bg-emerald-800' : 'bg-emerald-200') : ''}
            `}
                    >
                        <span className={`text-[10px] font-mono ${isBlack ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            {key.toUpperCase()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
