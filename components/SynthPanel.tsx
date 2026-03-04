'use client';

import { useState } from 'react';
import { engine } from '@/audio/SynthEngine';

interface SynthPanelProps {
    hasPatch: boolean;
}

export default function SynthPanel({ hasPatch }: SynthPanelProps) {
    const [motion, setMotion] = useState(0.5);
    const [brightness, setBrightness] = useState(0.5);

    const handleMotionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setMotion(val);
        engine.setMorph(val);
    };

    const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setBrightness(val);
        // Maps brightness roughly to a cutoff envelope from 200Hz to 10000Hz exponentially
        const cutoff = 200 * Math.pow(2, val * 6);
        engine.setCutoff(cutoff);
    };

    if (!hasPatch) {
        return (
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-48 flex items-center justify-center text-zinc-500">
                Generate a patch to unlock controls
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-zinc-100 font-medium tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Active Patch Macros
                </h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
                {/* Motion Macro */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                        <label className="text-zinc-400">Wavetable Morph</label>
                        <span className="text-emerald-400 font-mono">{(motion * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={motion}
                        onChange={handleMotionChange}
                        className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Brightness Macro */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                        <label className="text-zinc-400">Filter Cutoff</label>
                        <span className="text-emerald-400 font-mono">{(brightness * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={brightness}
                        onChange={handleBrightnessChange}
                        className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
}
