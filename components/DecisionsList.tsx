"use client";

import type { DecisionExtractResult } from "@/types";

interface DecisionsListProps {
  result: DecisionExtractResult | null;
  loading: boolean;
  onExtract: () => void;
  disabled?: boolean;
}

export default function DecisionsList({
  result,
  loading,
  onExtract,
  disabled,
}: DecisionsListProps) {
  return (
    <div className="bg-white shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
      {/* ヘッダー */}
      <div className="px-12 py-6 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 border-b-4 border-purple-700">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">AI画像生成</h2>
          <button
            type="button"
            onClick={onExtract}
            disabled={loading}
            className="bg-white text-purple-700 hover:bg-purple-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-bold py-3 px-8 transition-all shadow-lg hover:shadow-xl uppercase tracking-wide text-sm"
          >
            {loading ? "生成中..." : "画像を生成"}
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {!result ? (
          <div className="h-full flex flex-col items-center justify-center px-16 py-24">
            <svg
              className="w-32 h-32 mb-6 text-purple-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-center text-xl font-bold text-gray-700 mb-4">
              会議内容をビジュアル化
            </p>
            <p className="text-center text-base text-gray-600 mb-2">
              右上の「画像を生成」ボタンをクリック
            </p>
            <p className="text-center text-sm text-gray-500 mb-6">
              文字起こしや会議情報がある場合はその内容から画像を生成します
            </p>
            <p className="text-center text-sm text-purple-600 font-bold mt-6">
              Powered by Gemini Nano Banana
            </p>
          </div>
        ) : (
          <div className="p-12">
            {/* 生成された画像 */}
            {result.summaryImage ? (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 p-8 border-l-8 border-purple-600">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-purple-600 p-3">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
                      生成結果
                    </h3>
                  </div>
                  <div className="bg-white border-4 border-gray-300 shadow-xl">
                    <img
                      src={result.summaryImage}
                      alt="会議内容をビジュアル化したAI生成画像"
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="mt-6 p-4 bg-white border-l-4 border-purple-600">
                    <p className="text-base text-gray-800 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                </div>

                {/* 生成時刻 */}
                <div className="text-sm text-gray-500 text-right border-t-2 border-gray-200 pt-4">
                  生成日時: {new Date(result.extractedAt).toLocaleString("ja-JP")}
                </div>
              </div>
            ) : (
              <div className="text-center py-24">
                <svg
                  className="w-20 h-20 mx-auto mb-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xl font-bold text-gray-700 mb-3">画像生成エラー</p>
                <p className="text-base text-gray-600">もう一度お試しください</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
