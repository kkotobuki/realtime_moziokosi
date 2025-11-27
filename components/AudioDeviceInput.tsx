"use client";

import { useState } from "react";

interface AudioDeviceInputProps {
  micDeviceId: string;
  systemDeviceId: string;
  audioDevices: MediaDeviceInfo[];
  onMicChange: (deviceId: string) => void;
  onSystemChange: (deviceId: string) => void;
  disabled?: boolean;
}

export default function AudioDeviceInput({
  micDeviceId,
  systemDeviceId,
  audioDevices,
  onMicChange,
  onSystemChange,
  disabled,
}: AudioDeviceInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSelection = micDeviceId && systemDeviceId;

  return (
    <div className="bg-white shadow-md border-l-8 border-indigo-600">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-6 bg-indigo-50 flex items-center justify-between hover:bg-indigo-100 transition-colors border-b-2 border-indigo-200"
      >
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight">オーディオデバイス設定</h2>
            <p className="text-sm text-indigo-700 font-medium">マイクとシステム音声を選択</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasSelection && !isExpanded && (
            <span className="text-xs text-indigo-800 font-black px-4 py-2 bg-indigo-200 uppercase tracking-wide border-2 border-indigo-600">
              ✓ 設定済み
            </span>
          )}
          <svg
            className={`w-7 h-7 text-indigo-700 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* デバイス選択フォーム */}
      {isExpanded && (
        <div className="p-8 bg-gray-50 space-y-6">
          {/* マイクデバイス選択 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500 p-2">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <label className="block text-base font-black text-gray-900 uppercase tracking-wide">
                  マイク
                </label>
                <p className="text-xs text-gray-600 font-medium">あなたの音声</p>
              </div>
            </div>
            <select
              value={micDeviceId}
              onChange={(e) => onMicChange(e.target.value)}
              disabled={disabled}
              className="w-full px-4 py-4 text-sm border-2 border-gray-300 focus:ring-0 focus:border-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              <option value="">デバイスを選択...</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `デバイス ${device.deviceId.substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          {/* システム音声デバイス選択 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 p-2">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <label className="block text-base font-black text-gray-900 uppercase tracking-wide">
                  システム音声
                </label>
                <p className="text-xs text-gray-600 font-medium">相手の音声 (BlackHole等)</p>
              </div>
            </div>
            <select
              value={systemDeviceId}
              onChange={(e) => onSystemChange(e.target.value)}
              disabled={disabled}
              className="w-full px-4 py-4 text-sm border-2 border-gray-300 focus:ring-0 focus:border-orange-600 disabled:bg-gray-200 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              <option value="">デバイスを選択...</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `デバイス ${device.deviceId.substring(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
