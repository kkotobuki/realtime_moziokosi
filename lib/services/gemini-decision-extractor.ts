import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { TranscriptEntry, DecisionExtractResult } from '@/types';
import type { MeetingInput } from './gemini-mermaid';

export type { MeetingInput };

export class GeminiDecisionExtractor {
  private imageGenAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set');
      return;
    }

    try {
      // 画像生成用のAIインスタンスを初期化
      this.imageGenAI = new GoogleGenAI({
        apiKey: apiKey,
      });

      console.log('Gemini API initialized successfully for image generation');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }

  private async generateImageFromTranscripts(
    transcripts: TranscriptEntry[],
    meetingInput: MeetingInput,
  ): Promise<string | undefined> {
    if (!this.imageGenAI) {
      console.warn('Image generation API is not configured');
      return undefined;
    }

    try {
      // 文字起こし履歴を整形
      const formattedHistory = transcripts
        .map((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString('ja-JP');
          const source = entry.source === 'microphone' ? 'あなた' : '相手';
          return `[${time}] ${source}: ${entry.text}`;
        })
        .join('\n');

      const agendaList = meetingInput.agenda
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n');

      const prompt = `以下の会議の文字起こし内容をビジュアル化した画像を生成してください。
会議の流れ、主要なトピック、決定事項などを分かりやすく視覚的に魅力的なインフォグラフィックにしてください。文字は日本語です。

# 会議の目的
${meetingInput.purpose}

# アジェンダ
${agendaList}

# 文字起こし内容
${formattedHistory}

この会議内容を、見やすく理解しやすいビジュアル形式で表現してください。`;

      const config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize: '1K',
        },
      };
      const model = 'gemini-3-pro-image-preview';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.imageGenAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const mimeType = inlineData.mimeType || 'image/png';
          const base64Data = inlineData.data || '';

          // Base64データをdata URLとして返す
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          console.log('Transcript image generated successfully');
          return dataUrl;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Failed to generate transcript image:', error);
      return undefined;
    }
  }

  async extractDecisions(
    transcripts: TranscriptEntry[],
    meetingInput: MeetingInput,
  ): Promise<DecisionExtractResult> {
    // 文字起こしがない場合でも画像生成を許可
    const hasTranscripts = transcripts && transcripts.length > 0;

    if (hasTranscripts) {
      // 最新1000エントリに制限
      const limitedTranscripts = transcripts.slice(-1000);

      console.log(`Generating image from ${limitedTranscripts.length} transcript entries`);

      // 文字起こしから直接画像を生成
      const summaryImage = await this.generateImageFromTranscripts(
        limitedTranscripts,
        meetingInput,
      );

      const extractResult: DecisionExtractResult = {
        decisions: [],
        summary: '文字起こし内容から画像を生成しました',
        extractedAt: new Date(),
        summaryImage,
      };

      console.log(`Generated image from ${transcripts.length} transcripts`);

      return extractResult;
    } else {
      // 文字起こしがない場合は会議情報のみから画像生成
      console.log('Generating image from meeting info only (no transcripts)');

      const summaryImage = await this.generateImageFromMeetingInfo(meetingInput);

      const extractResult: DecisionExtractResult = {
        decisions: [],
        summary: '会議情報から画像を生成しました',
        extractedAt: new Date(),
        summaryImage,
      };

      console.log('Generated image from meeting info');

      return extractResult;
    }
  }

  private async generateImageFromMeetingInfo(
    meetingInput: MeetingInput,
  ): Promise<string | undefined> {
    if (!this.imageGenAI) {
      console.warn('Image generation API is not configured');
      return undefined;
    }

    try {
      const agendaList = meetingInput.agenda
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n');

      const prompt = `以下の会議について、視覚的に魅力的なインフォグラフィックを作成してください。
会議の目的とアジェンダをわかりやすく表現してください。

# 会議の目的
${meetingInput.purpose}

# アジェンダ
${agendaList}

この会議の内容を、見やすく理解しやすいビジュアル形式で表現してください。`;

      const config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize: '1K',
        },
      };
      const model = 'gemini-3-pro-image-preview';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.imageGenAI.models.generateContentStream({
        model,
        config,
        contents,
      });

      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const mimeType = inlineData.mimeType || 'image/png';
          const base64Data = inlineData.data || '';

          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          console.log('Meeting info image generated successfully');
          return dataUrl;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Failed to generate meeting info image:', error);
      return undefined;
    }
  }
}

// シングルトンインスタンス
export const geminiDecisionExtractor = new GeminiDecisionExtractor();
