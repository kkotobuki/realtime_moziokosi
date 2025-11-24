import { NextRequest, NextResponse } from 'next/server';
import {
  geminiDecisionExtractor,
  type MeetingInput,
} from '@/lib/services/gemini-decision-extractor';
import { TranscriptEntry } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcripts, meetingInput } = body as {
      transcripts: TranscriptEntry[];
      meetingInput: MeetingInput;
    };

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json(
        { error: '文字起こし履歴がありません' },
        { status: 400 },
      );
    }

    if (!meetingInput || !meetingInput.purpose || !meetingInput.agenda) {
      return NextResponse.json(
        { error: '会議の目的とアジェンダが必要です' },
        { status: 400 },
      );
    }

    console.log(
      `Extracting decisions from ${transcripts.length} transcripts with purpose: ${meetingInput.purpose}`,
    );

    const result =
      await geminiDecisionExtractor.extractDecisions(
        transcripts,
        meetingInput,
      );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error extracting decisions:', error);
    return NextResponse.json(
      {
        error: '決定事項の抽出に失敗しました',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
