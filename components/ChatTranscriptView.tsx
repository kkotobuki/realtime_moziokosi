"use client";

import { TranscriptEntry } from "@/types";

interface ChatTranscriptViewProps {
  transcripts: TranscriptEntry[];
}

export default function ChatTranscriptView({ transcripts }: ChatTranscriptViewProps) {
  return (
    <div className="flex flex-col gap-4 px-12 py-4">
      {transcripts.map((entry) => {
        const isMicrophone = entry.source === 'microphone';

        return (
          <div
            key={entry.id}
            className={`flex ${isMicrophone ? 'justify-end' : 'justify-start'} px-6`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-6 py-5 shadow-sm ${
                isMicrophone
                  ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
              }`}
            >
              {/* メッセージ本文 */}
              <div className={`leading-relaxed whitespace-pre-wrap break-words ${
                isMicrophone ? 'text-white' : 'text-gray-800'
              }`}>
                {entry.text}
              </div>

              {/* タイムスタンプ */}
              <div className={`text-xs mt-4 ${
                isMicrophone ? 'text-indigo-100' : 'text-gray-400'
              }`}>
                {new Date(entry.timestamp).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
