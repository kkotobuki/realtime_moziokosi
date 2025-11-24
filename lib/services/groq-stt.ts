import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import FormData from 'form-data';
import { TranscriptionResult } from '@/types';

export class GroqSTTService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
  private readonly model = 'whisper-large-v3-turbo';

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      console.warn('GROQ_API_KEY is not set');
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    language: string = 'ja',
  ): Promise<TranscriptionResult> {
    try {
      const wavBuffer = this.pcmToWav(audioBuffer, 16000, 1);

      const formData = new FormData();
      formData.append('file', wavBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });
      formData.append('model', this.model);
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0');

      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 15000,
      });

      const text = response.data.text?.trim() || '';
      const duration = response.data.duration || 0;

      // 雑音フィルタリング
      if (this.isNoise(text, duration)) {
        return { text: '', confidence: 0, duration };
      }

      return {
        text,
        confidence: this.calculateConfidence(response.data),
        duration,
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  private isNoise(text: string, duration: number): boolean {
    // 空文字
    if (!text) return true;

    // 一般的な挨拶フレーズ
    const noisePatterns = [
      /^ありがとうございました\.?$/,
      /^ありがとうございます\.?$/,
      /^お願いします\.?$/,
      /^すみません\.?$/,
    ];
    if (noisePatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    // 3文字以下の短文
    if (text.length <= 3) return true;

    // 2秒未満で10文字以下
    if (duration < 2 && text.length <= 10) return true;

    return false;
  }

  private calculateConfidence(data: any): number {
    // Groq APIがconfidenceを返さない場合のフォールバック
    if (data.confidence !== undefined) {
      return data.confidence;
    }
    // テキストの長さや継続時間から信頼度を推定
    const textLength = (data.text || '').length;
    const duration = data.duration || 0;
    if (textLength > 20 && duration > 1) {
      return 0.9;
    } else if (textLength > 10) {
      return 0.8;
    } else {
      return 0.6;
    }
  }

  private pcmToWav(pcmBuffer: Buffer, sampleRate: number, channels: number): Buffer {
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
    header.writeUInt16LE(channels * 2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }
}

// シングルトンインスタンス
export const groqSTTService = new GroqSTTService();
