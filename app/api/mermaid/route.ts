import { NextRequest, NextResponse } from 'next/server';
import { geminiMermaidService, type MeetingInput } from '@/lib/services/gemini-mermaid';
import { TranscriptEntry } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcripts, meetingInput } = body as {
      transcripts: TranscriptEntry[];
      meetingInput?: MeetingInput;
    };

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json(
        { error: '文字起こし履歴がありません' },
        { status: 400 }
      );
    }

    console.log(
      `Generating mermaid diagram from ${transcripts.length} transcripts${meetingInput ? ' with meeting context' : ''}`
    );

    const result = await geminiMermaidService.generateMermaidDiagram(
      transcripts,
      meetingInput
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating mermaid diagram:', error);
    return NextResponse.json(
      { error: 'マーメイド記法の生成に失敗しました' },
      { status: 500 }
    );
  }
}
