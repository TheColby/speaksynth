import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('audio') as Blob | null;

        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // Mock response if no OpenAI key
        if (!openai) {
            console.log("No OPENAI_API_KEY found. Mocking transcription.");
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            return NextResponse.json({
                text: "Make a warm glassy ambient pad with a slow attack and subtle chorus."
            });
        }

        // OpenAI Whisper implementation
        // Depending on the file type from the frontend (webm/ogg), we need to send it as a File object compatible with OpenAI
        const audioFile = new File([file], 'recording.webm', { type: file.type || 'audio/webm' });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
        });

        return NextResponse.json({ text: transcription.text });
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    }
}
