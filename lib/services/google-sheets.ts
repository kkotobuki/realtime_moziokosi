import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private sessionRowMap: Map<string, number> = new Map();

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';

    if (!this.spreadsheetId) {
      console.warn('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
      return;
    }

    try {
      const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(
        /\\n/g,
        '\n',
      );

      if (!privateKey || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
        console.warn('Google Sheets credentials are not fully configured');
        return;
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      console.log('Google Sheets API initialized successfully');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to initialize Google Sheets API:', {
          message: error.message,
          code: (error as any).code,
          stack: error.stack,
        });
      } else {
        console.error('Failed to initialize Google Sheets API:', error);
      }
    }
  }

  async updateOrAppendTranscript(
    sessionId: string,
    text: string,
    isNewSession: boolean = false,
  ): Promise<void> {
    if (!this.sheets || !this.spreadsheetId) {
      console.warn('Google Sheets is not configured');
      return;
    }

    try {
      let rowNumber = this.sessionRowMap.get(sessionId);

      if (isNewSession || rowNumber === undefined) {
        // 新しいセッション: 新しい行に追加
        await this.appendNewRow(text);
        const newRowNumber = await this.getLastRowNumber();
        this.sessionRowMap.set(sessionId, newRowNumber);
        console.log(`New session ${sessionId} created at row ${newRowNumber}`);
      } else {
        // 既存セッション: 同じ行を更新
        await this.updateExistingRow(rowNumber, text);
        console.log(`Session ${sessionId} updated at row ${rowNumber}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to update/append transcript:', {
          message: error.message,
          code: (error as any).code,
          opensslErrorStack: (error as any).opensslErrorStack,
          library: (error as any).library,
          reason: (error as any).reason,
        });
      } else {
        console.error('Failed to update/append transcript:', error);
      }
      // エラーでもSTT処理は継続する(非同期)
    }
  }

  async resetSession(sessionId: string): Promise<void> {
    this.sessionRowMap.delete(sessionId);
    console.log(`Session ${sessionId} reset`);
  }

  private async appendNewRow(text: string): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'A:A',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[text]],
      },
    });
  }

  private async updateExistingRow(
    rowNumber: number,
    newText: string,
  ): Promise<void> {
    // 既存のテキストを取得
    const getResponse = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `A${rowNumber}`,
    });

    const existingText = getResponse.data.values?.[0]?.[0] || '';
    const updatedText = existingText
      ? `${existingText} ${newText}`
      : newText;

    // テキストを連結して更新
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `A${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[updatedText]],
      },
    });
  }

  private async getLastRowNumber(): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'A:A',
    });

    const rows = response.data.values || [];
    return rows.length;
  }

  async clearAllSessions(): Promise<void> {
    this.sessionRowMap.clear();
    console.log('All sessions cleared from memory');
  }
}

// シングルトンインスタンス
export const googleSheetsService = new GoogleSheetsService();
