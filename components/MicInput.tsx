// Copyright (c) 2026 Colby Leider and contributors. All rights reserved.
// Licensed under the MIT License. See LICENSE for details.

'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

interface MicInputProps {
    onTranscription: (text: string) => void;
    isProcessing: boolean;
    setIsProcessing: (b: boolean) => void;
}

// Pick the best supported MIME type for the current browser
function getSupportedMimeType(): string {
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
    ];
    for (const type of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return ''; // Let the browser choose
}

export default function MicInput({ onTranscription, isProcessing, setIsProcessing }: MicInputProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(0);
    const [micError, setMicError] = useState<string | null>(null);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            if (audioCtxRef.current?.state !== 'closed') {
                audioCtxRef.current?.close();
            }
        };
    }, []);

    const updateVolume = () => {
        if (!analyzerRef.current) return;
        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        analyzerRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVolume(Math.min(1, rms * 5));
        rafRef.current = requestAnimationFrame(updateVolume);
    };

    const startRecording = async () => {
        setMicError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtxRef.current.createMediaStreamSource(stream);
            analyzerRef.current = audioCtxRef.current.createAnalyser();
            source.connect(analyzerRef.current);
            updateVolume();

            const mimeType = getSupportedMimeType();
            const recorderOptions = mimeType ? { mimeType } : {};
            const recorder = new MediaRecorder(stream, recorderOptions);
            mediaRecorder.current = recorder;
            audioChunks.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            recorder.onstop = async () => {
                cancelAnimationFrame(rafRef.current);
                setVolume(0);
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunks.current, { type: mimeType || 'audio/webm' });
                await uploadAudio(audioBlob, mimeType || 'audio/webm');
            };

            recorder.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error('Microphone error:', err);
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                setMicError('Microphone permission denied. Allow access in your browser settings and reload.');
            } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                setMicError('No microphone found. Connect one or type your prompt below instead.');
            } else if (err?.name === 'NotReadableError') {
                setMicError('Microphone is in use by another app. Close it and try again.');
            } else {
                setMicError('Could not start recording. Type your prompt below instead.');
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
            setIsRecording(false);
        }
    };

    const uploadAudio = async (blob: Blob, mimeType: string) => {
        setIsProcessing(true);
        const formData = new FormData();
        // Determine file extension from mime type
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm';
        formData.append('audio', blob, `recording.${ext}`);

        try {
            const res = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.noKey) {
                setMicError('Voice input requires OPENAI_API_KEY. Type your description below and hit Generate.');
                setIsProcessing(false);
            } else if (data.text) {
                onTranscription(data.text);
            } else {
                setMicError('Transcription failed: ' + (data.error ?? 'unknown error'));
                setIsProcessing(false);
            }
        } catch (error) {
            console.error('Upload error', error);
            setMicError('Network error during transcription.');
            setIsProcessing(false);
        }
    };

    const barCount = 20;
    const activeBars = Math.floor(volume * barCount);

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="text-sm font-medium text-zinc-400">
                {isProcessing ? 'Transcribing…' : isRecording ? 'Recording…' : 'Describe a sound'}
            </div>

            <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`
                    relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300
                    ${isProcessing
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : isRecording
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 shadow-[0_0_30px_rgba(52,211,153,0.1)]'
                    }
                `}
            >
                {isProcessing ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                ) : isRecording ? (
                    <Square className="w-10 h-10 fill-current" />
                ) : (
                    <Mic className="w-10 h-10" />
                )}
                {isRecording && (
                    <div className="absolute inset-0 rounded-full animate-ping border border-red-500 opacity-20" />
                )}
            </button>

            {/* Volume Meter */}
            <div className="flex gap-1 h-8 mt-2 opacity-80">
                {Array.from({ length: barCount }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-1.5 rounded-full transition-all duration-75 ${i < activeBars ? 'bg-emerald-400' : 'bg-zinc-800'}`}
                        style={{ height: i < activeBars ? '100%' : '20%', opacity: i < activeBars ? 1 : 0.5 }}
                    />
                ))}
            </div>

            {/* Error state */}
            {micError && (
                <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 w-full">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{micError}</span>
                </div>
            )}
        </div>
    );
}
