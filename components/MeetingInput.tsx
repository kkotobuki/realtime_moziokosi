"use client";

import { useState } from "react";
import type { MeetingInput as MeetingInputType } from "@/lib/services/gemini-decision-extractor";

interface MeetingInputProps {
  onSubmit: (input: MeetingInputType) => void;
  disabled?: boolean;
}

export default function MeetingInput({ onSubmit, disabled }: MeetingInputProps) {
  const [purpose, setPurpose] = useState("");
  const [agendaInput, setAgendaInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    if (!purpose.trim() || !agendaInput.trim()) {
      alert("会議の目的とアジェンダを入力してください");
      return;
    }

    const agenda = agendaInput
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (agenda.length === 0) {
      alert("少なくとも1つのアジェンダ項目を入力してください");
      return;
    }

    onSubmit({ purpose, agenda });
    setIsExpanded(false);
  };

  const hasInput = purpose.trim() || agendaInput.trim();

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-4 bg-linear-to-r from-emerald-500 to-teal-500 flex items-center justify-between hover:from-emerald-600 hover:to-teal-600 transition-colors"
      >
        <h2 className="text-lg font-semibold text-white">会議情報</h2>
        <div className="flex items-center gap-2">
          {hasInput && !isExpanded && (
            <span className="text-xs text-white/80 px-3 py-1 bg-white/20 rounded-full">
              入力済み
            </span>
          )}
          <svg
            className={`w-5 h-5 text-white transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 入力フォーム */}
      {isExpanded && (
        <div className="p-8 space-y-6">
          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
              会議の目的 <span className="text-red-500">*</span>
            </label>
            <input
              id="purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例: 新機能の開発方針について決定する"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              disabled={disabled}
            />
          </div>

          <div>
            <label htmlFor="agenda" className="block text-sm font-medium text-gray-700 mb-2">
              アジェンダ（1行1項目） <span className="text-red-500">*</span>
            </label>
            <textarea
              id="agenda"
              value={agendaInput}
              onChange={(e) => setAgendaInput(e.target.value)}
              placeholder={"機能のスコープ確認\n技術スタックの選定\n開発スケジュールの策定"}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono text-sm"
              disabled={disabled}
            />
            <p className="mt-2 text-xs text-gray-500">改行で複数のアジェンダ項目を入力できます</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled || !purpose.trim() || !agendaInput.trim()}
              className="flex-1 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-md"
            >
              設定を保存
            </button>
            <button
              type="button"
              onClick={() => {
                setPurpose("");
                setAgendaInput("");
              }}
              disabled={disabled}
              className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg transition-all font-medium"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
