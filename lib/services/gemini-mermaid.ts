import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranscriptEntry, MermaidResult } from '@/types';

export interface MeetingInput {
  purpose: string;
  agenda: string[];
}

export class GeminiMermaidService {
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
      console.log('Gemini API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }

  async generateMermaidDiagram(
    transcripts: TranscriptEntry[],
    meetingInput?: MeetingInput,
  ): Promise<MermaidResult> {
    if (!this.model) {
      throw new Error('Gemini API is not configured');
    }

    if (!transcripts || transcripts.length === 0) {
      throw new Error('No transcripts provided');
    }

    // 最新500エントリに制限
    const limitedTranscripts = transcripts.slice(-500);

    // 履歴を整形
    const formattedHistory = limitedTranscripts
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString('ja-JP');
        return `[${time}] ${entry.text}`;
      })
      .join('\n');

    // 会議情報セクション
    let meetingContext = '';
    if (meetingInput) {
      const agendaList = meetingInput.agenda
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n');

      meetingContext = `
# 会議の目的とアジェンダ
会議の目的: ${meetingInput.purpose}

アジェンダ:
${agendaList}

このコンテキストを踏まえて、以下のポイントに注意して図を作成してください：
- 会議の目的に沿った粒度で情報を整理する
- アジェンダ項目を中心に、議論の流れを可視化する
- アジェンダに関連する決定事項や重要なポイントを強調する
`;
    }

    const prompt = `以下の文字起こし履歴を分析し、話の構造を可視化したマーメイド図を生成してください。
${meetingContext}
# 分析手順
1. 会話全体の主題を特定する${meetingInput ? '（会議の目的を参考にする）' : ''}
2. 主題に関連する主要な概念やトピックを抽出する${meetingInput ? '（アジェンダ項目を軸にする）' : '（時系列順ではなく、論理的なまとまりで）'}
3. 概念間の関係性を分析する：
   - 因果関係（AがBの原因となっている）
   - 依存関係（AがBに影響を与える）
   - 包含関係（AがBを含む）
   - 対比関係（AとBは異なるアプローチ）

# 図の作成方針
- 発言の時系列順ではなく、概念の論理的な関係性を優先する
- 重複や冗長な内容は統合し、本質的な要素のみを表現する
${meetingInput ? '- アジェンダ項目を主要なノードとして配置し、関連する議論を紐付ける' : ''}
- 適切な図のタイプを選択する：
  - 因果関係が中心 → flowchart（フローチャート）
  - 階層的な概念 → mindmap（マインドマップ）
  - 複数の要素の関連 → graph（グラフ）
  - 時系列的な流れも重要 → sequenceDiagram

重要:
- マーメイド記法のコードのみを出力してください
- 説明文や余計な文章は含めないでください
- \`\`\`mermaid のようなマークダウンのコードブロックも不要です
- 純粋なマーメイド記法のコードのみを返してください
- ノード名やラベルは日本語で分かりやすく記述してください

文字起こし履歴:
${formattedHistory}

マーメイド記法:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let mermaidCode = response.text();

      // マークダウンのコードブロック記法を除去
      mermaidCode = mermaidCode.replace(/```mermaid\n?/g, '');
      mermaidCode = mermaidCode.replace(/```\n?/g, '');
      mermaidCode = mermaidCode.trim();

      // 図のタイプを推定
      const diagramType = this.detectDiagramType(mermaidCode);

      console.log(
        `Generated mermaid diagram (type: ${diagramType}, length: ${mermaidCode.length})`,
      );

      return {
        mermaidCode,
        diagramType,
      };
    } catch (error) {
      console.error('Failed to generate mermaid diagram:', error);
      throw error;
    }
  }

  private detectDiagramType(code: string): string {
    if (code.includes('sequenceDiagram')) return 'sequence';
    if (code.includes('classDiagram')) return 'class';
    if (code.includes('stateDiagram')) return 'state';
    if (code.includes('gantt')) return 'gantt';
    if (code.includes('erDiagram')) return 'er';
    if (code.includes('mindmap')) return 'mindmap';
    if (code.includes('flowchart') || code.includes('graph')) return 'flowchart';
    return 'unknown';
  }
}

// シングルトンインスタンス
export const geminiMermaidService = new GeminiMermaidService();
