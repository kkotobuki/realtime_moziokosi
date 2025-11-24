import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranscriptEntry, DecisionExtractResult, Decision } from '@/types';
import type { MeetingInput } from './gemini-mermaid';

export type { MeetingInput };

export class GeminiDecisionExtractor {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
      });
      console.log('Gemini API initialized successfully for decision extraction');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }

  async extractDecisions(
    transcripts: TranscriptEntry[],
    meetingInput: MeetingInput,
  ): Promise<DecisionExtractResult> {
    if (!this.model) {
      throw new Error('Gemini API is not configured');
    }

    if (!transcripts || transcripts.length === 0) {
      throw new Error('No transcripts provided');
    }

    // 最新1000エントリに制限
    const limitedTranscripts = transcripts.slice(-1000);

    // 履歴を整形
    const formattedHistory = limitedTranscripts
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString('ja-JP');
        return `[${time}] ${entry.text}`;
      })
      .join('\n');

    const agendaList = meetingInput.agenda
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    const prompt = `あなたは会議の文字起こしから決定事項を抽出する専門家です。
以下の会議の目的とアジェンダに基づいて、文字起こしの中から決定事項を抽出してください。

# 会議の目的
${meetingInput.purpose}

# アジェンダ
${agendaList}

# 抽出ルール
- アジェンダに関連のある話で、誰かが次に行動を起こさなければならない内容を抽出する
- 問題として定義されていて、誰かが行動を起こして解決しなければならない内容を抽出する
- 会議の目的を達成するために必要な内容を抽出する

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "decisions": [
    {
      "content": "決定内容の要約",
      "relatedAgendaItems": ["関連するアジェンダの番号（例: "1", "2"）"],
      "confidence": 0.0〜1.0の数値
    }
  ],
  "summary": "会議全体の決定事項の概要を2〜3文で"
}

重要:
- 純粋なJSON形式のみを出力してください
- マークダウンのコードブロック（\`\`\`json）は含めないでください
- 説明文や余計な文章は含めないでください

# 文字起こし履歴
${formattedHistory}

JSON出力:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let jsonText = response.text();

      // マークダウンのコードブロック記法を除去
      jsonText = jsonText.replace(/```json\n?/g, '');
      jsonText = jsonText.replace(/```\n?/g, '');
      jsonText = jsonText.trim();

      // JSONをパース
      const parsedResult = JSON.parse(jsonText);

      // Decisionオブジェクトに変換
      const decisions: Decision[] = parsedResult.decisions.map(
        (d: any, index: number) => ({
          id: `decision-${Date.now()}-${index}`,
          content: d.content,
          timestamp: new Date(),
          relatedAgendaItems: d.relatedAgendaItems || [],
          confidence: d.confidence || 0.5,
        }),
      );

      const extractResult: DecisionExtractResult = {
        decisions,
        summary: parsedResult.summary || '決定事項が抽出されました',
        extractedAt: new Date(),
      };

      console.log(
        `Extracted ${decisions.length} decisions from ${transcripts.length} transcripts`,
      );

      return extractResult;
    } catch (error) {
      console.error('Failed to extract decisions:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
export const geminiDecisionExtractor = new GeminiDecisionExtractor();
