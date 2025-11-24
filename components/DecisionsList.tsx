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
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-100 flex flex-col overflow-hidden h-full">
      {/* ヘッダー */}
      <div className="px-8 py-4 bg-linear-to-r from-amber-500 to-orange-500 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">決定事項</h2>
        <button
          type="button"
          onClick={onExtract}
          disabled={loading || disabled}
          className="bg-white text-amber-600 hover:bg-amber-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed font-semibold py-2 px-6 rounded-lg transition-all shadow-md"
        >
          {loading ? "抽出中..." : "決定事項を抽出"}
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-8">
        {!result ? (
          <div className="h-full flex flex-col items-center justify-center text-amber-300">
            <svg
              className="w-16 h-16 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-center">会議情報を設定し、文字起こし後に抽出ボタンをクリック</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 概要 */}
            {result.summary && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">概要</h3>
                <p className="text-sm text-amber-800">{result.summary}</p>
              </div>
            )}

            {/* 決定事項リスト */}
            {result.decisions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>決定事項が見つかりませんでした</p>
                <p className="text-xs mt-2">
                  明確な決定を示す表現が含まれていない可能性があります
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  決定事項 ({result.decisions.length}件)
                </h3>
                {result.decisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-gray-800 flex-1">{decision.content}</p>
                      {/* 信頼度バッジ */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          decision.confidence >= 0.8
                            ? "bg-emerald-100 text-emerald-700"
                            : decision.confidence >= 0.5
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {Math.round(decision.confidence * 100)}%
                      </span>
                    </div>

                    {/* 関連アジェンダ */}
                    {decision.relatedAgendaItems.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {decision.relatedAgendaItems.map((item) => (
                          <span
                            key={item}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200"
                          >
                            アジェンダ {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 抽出時刻 */}
            <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100">
              抽出日時: {new Date(result.extractedAt).toLocaleString("ja-JP")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
