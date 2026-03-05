// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useEffect, useRef } from 'react';
import { engine } from '@/audio/SynthEngine';

export default function Visualizer({ engineReady }: { engineReady: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!engineReady || !engine.analyserNode || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = engine.analyserNode;
        // The analyser returns 8-bit values (0-255).
        const bufferLength = analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufferLength);
        const freqData = new Uint8Array(bufferLength);

        let animationId: number;

        const draw = () => {
            animationId = requestAnimationFrame(draw);

            const width = canvas.width;
            const height = canvas.height;

            analyser.getByteTimeDomainData(timeData);
            analyser.getByteFrequencyData(freqData);

            // Clear background
            ctx.fillStyle = '#09090b'; // zinc-950 base
            ctx.fillRect(0, 0, width, height);

            // 1. Draw Spectrogram in background
            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const norm = freqData[i] / 255.0;
                const barHeight = norm * height;

                // Emerald tinted with varying opacity
                ctx.fillStyle = `rgba(16, 185, 129, ${norm * 0.4})`;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }

            // 2. Draw Oscilloscope line
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#34d399'; // emerald-400
            ctx.beginPath();

            const sliceWidth = width * 1.0 / bufferLength;
            x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = timeData[i] / 128.0; // 0..2, 1 is center
                const y = (v * height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [engineReady]);

    return (
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
                <span>Oscilloscope & Spectrum</span>
                {engineReady && (
                    <div className="flex items-center gap-1.5 opacity-80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400">Live</span>
                    </div>
                )}
            </div>
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-zinc-950 shadow-inner bg-zinc-950">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    width={800}
                    height={200}
                />
            </div>
        </div>
    );
}
