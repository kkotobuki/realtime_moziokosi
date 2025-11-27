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
    <div className="bg-white shadow-md border-l-8 border-emerald-600">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-6 bg-emerald-50 flex items-center justify-between hover:bg-emerald-100 transition-colors border-b-2 border-emerald-200"
      >
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600 p-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-emerald-900 uppercase tracking-tight">会議情報を設定</h2>
            <p className="text-sm text-emerald-700 font-medium">会議の目的とアジェンダを入力してください</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasInput && !isExpanded && (
            <span className="text-xs text-emerald-800 font-black px-4 py-2 bg-emerald-200 uppercase tracking-wide border-2 border-emerald-600">
              ✓ 入力済み
            </span>
          )}
          <svg
            className={`w-7 h-7 text-emerald-700 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 入力フォーム */}
      {isExpanded && (
        <div className="p-8 space-y-6 bg-gray-50">
          <div>
            <label htmlFor="purpose" className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              会議の目的 <span className="text-red-600">*</span>
            </label>
            <input
              id="purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例: 新機能の開発方針について決定する"
              className="w-full px-4 py-3 border-2 border-gray-300 focus:ring-0 focus:border-emerald-600 transition-all"
              disabled={disabled}
            />
          </div>

          <div>
            <label htmlFor="agenda" className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              アジェンダ（1行1項目） <span className="text-red-600">*</span>
            </label>
            <textarea
              id="agenda"
              value={agendaInput}
              onChange={(e) => setAgendaInput(e.target.value)}
              placeholder={"機能のスコープ確認\n技術スタックの選定\n開発スケジュールの策定"}
              rows={5}
              className="w-full px-4 py-3 border-2 border-gray-300 focus:ring-0 focus:border-emerald-600 transition-all font-mono text-sm"
              disabled={disabled}
            />
            <p className="mt-2 text-xs text-gray-600">改行で複数のアジェンダ項目を入力できます</p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled || !purpose.trim() || !agendaInput.trim()}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 transition-all shadow-lg uppercase tracking-wide text-sm"
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
              className="px-8 py-3 border-2 border-gray-400 text-gray-700 hover:bg-gray-200 disabled:bg-gray-200 disabled:cursor-not-allowed transition-all font-bold uppercase tracking-wide text-sm"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
