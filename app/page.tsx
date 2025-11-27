"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import MermaidViewer from "@/components/MermaidViewer";
import MeetingInput from "@/components/MeetingInput";
import AudioDeviceInput from "@/components/AudioDeviceInput";
import DecisionsList from "@/components/DecisionsList";
import ChatTranscriptView from "@/components/ChatTranscriptView";
import { TranscriptEntry, DecisionExtractResult } from "@/types";
import type { MeetingInput as MeetingInputType } from "@/lib/services/gemini-decision-extractor";

export default function Home() {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mermaidCode, setMermaidCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("未接続");

  // 画像生成関連
  const [meetingInput, setMeetingInput] = useState<MeetingInputType | null>(null);
  const [decisionsResult, setDecisionsResult] = useState<DecisionExtractResult | null>(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  // オーディオデバイス選択
  const [micDeviceId, setMicDeviceId] = useState<string>("");
  const [systemDeviceId, setSystemDeviceId] = useState<string>("");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>("");

  // マイク用
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const micIsSpeakingRef = useRef<boolean>(false);
  const micNoiseFloorRef = useRef<number>(0.01);

  // タブ音声用
  const tabStreamRef = useRef<MediaStream | null>(null);
  const tabAudioContextRef = useRef<AudioContext | null>(null);
  const tabSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tabIsSpeakingRef = useRef<boolean>(false);
  const tabNoiseFloorRef = useRef<number>(0.01);

  const autoExtractTimerRef = useRef<NodeJS.Timeout | null>(null);

  // オーディオデバイス一覧を取得
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    getAudioDevices();

    // デバイス変更を監視
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, []);

  useEffect(() => {
    // WebSocket接続
    const socket = io("/ws/stt", {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("WebSocket connected");
      setConnectionStatus("接続済み");
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setConnectionStatus("切断");
    });

    socket.on("session_started", (data) => {
      console.log("Session started:", data);
      setConnectionStatus("セッション開始");
    });

    socket.on("final", (data) => {
      console.log("Final transcription:", data);
      if (data.text) {
        const entry: TranscriptEntry = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          text: data.text,
          sessionId: data.sessionId,
          confidence: data.confidence,
          source: data.source || 'microphone', // デフォルトはマイク
        };
        setTranscripts((prev) => [...prev, entry]);
      }
    });

    socket.on("error", (data) => {
      console.error("Server error:", data);
      setError(data.message || "エラーが発生しました");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // リアルタイム画像生成
  useEffect(() => {
    if (!meetingInput || transcripts.length === 0 || !isRecording) {
      return;
    }

    // 既存のタイマーをクリア
    if (autoExtractTimerRef.current) {
      clearTimeout(autoExtractTimerRef.current);
    }

    // 30秒後に自動生成
    autoExtractTimerRef.current = setTimeout(() => {
      if (meetingInput && transcripts.length > 0) {
        setDecisionsLoading(true);
        setError("");

        fetch("/api/extract-decisions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transcripts, meetingInput }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.error) {
              throw new Error(data.error);
            }
            setDecisionsResult(data);
          })
          .catch((err) => {
            console.error("Auto-generate error:", err);
          })
          .finally(() => {
            setDecisionsLoading(false);
          });
      }
    }, 30000);

    return () => {
      if (autoExtractTimerRef.current) {
        clearTimeout(autoExtractTimerRef.current);
      }
    };
  }, [transcripts, meetingInput, isRecording]);

  // 音声処理の共通ロジック
  const setupAudioProcessor = (
    stream: MediaStream,
    audioContext: AudioContext,
    source: 'microphone' | 'tab',
    isSpeakingRef: React.MutableRefObject<boolean>,
    silenceTimerRef: React.MutableRefObject<NodeJS.Timeout | null>,
    noiseFloorRef: React.MutableRefObject<number>
  ) => {
    const mediaSource = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    mediaSource.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // VADアルゴリズム実装
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < inputData.length; i++) {
        const val = Math.abs(inputData[i]);
        sum += inputData[i] * inputData[i];
        peak = Math.max(peak, val);
      }
      const rms = Math.sqrt(sum / inputData.length);
      const energyLevel = rms;

      // 適応的閾値計算
      if (!isSpeakingRef.current) {
        noiseFloorRef.current = noiseFloorRef.current * 0.95 + rms * 0.05;
      }
      const threshold = noiseFloorRef.current * 5.0;

      // 音声レベルを定期的にログ出力（デバッグ用）
      if (Math.random() < 0.01) { // 1%の確率でログ出力（頻度を抑える）
        console.log(`[${source}] RMS: ${rms.toFixed(4)}, Peak: ${peak.toFixed(4)}, Threshold: ${threshold.toFixed(4)}`);
      }

      const SILENCE_DURATION_MS = 1500;

      // PCM16に変換して送信
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      socketRef.current?.emit("audio", {
        buffer: pcm16.buffer,
        source: source,
        sessionId: sessionIdRef.current,
      });

      // VAD状態管理
      const isSpeech = energyLevel > threshold || peak > threshold * 1.5;

      if (isSpeech) {
        if (!isSpeakingRef.current) {
          console.log(`[${source}] Speech started (RMS:`, rms.toFixed(4), "Threshold:", threshold.toFixed(4), ")");
          isSpeakingRef.current = true;
        }

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (isSpeakingRef.current) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log(`[${source}] Speech ended (silence detected after`, SILENCE_DURATION_MS, "ms)");
            isSpeakingRef.current = false;

            socketRef.current?.emit("speech_ended", {
              sessionId: sessionIdRef.current,
              timestamp: Date.now(),
              source: source,
            });

            silenceTimerRef.current = null;
          }, SILENCE_DURATION_MS);
        }
      }
    };
  };

  const startRecording = async () => {
    try {
      setError("");

      // デバイスが選択されていない場合はエラー
      if (!micDeviceId || !systemDeviceId) {
        setError("マイクとシステム音声の両方のデバイスを選択してください");
        return;
      }

      // デバイス情報をログ出力
      const micDevice = audioDevices.find(d => d.deviceId === micDeviceId);
      const systemDevice = audioDevices.find(d => d.deviceId === systemDeviceId);
      console.log('=== 選択されたデバイス ===');
      console.log('マイク:', micDevice?.label || micDeviceId);
      console.log('システム音声:', systemDevice?.label || systemDeviceId);

      // セッションID生成
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // マイク音声をキャプチャ
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: micDeviceId },
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = micStream;
      const micAudioContext = new AudioContext({ sampleRate: 16000 });
      micAudioContextRef.current = micAudioContext;

      // システム音声(仮想オーディオデバイス)をキャプチャ
      console.log('システム音声のキャプチャを開始...');
      const systemStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: systemDeviceId },
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      console.log('システム音声のキャプチャ成功');
      console.log('システム音声トラック数:', systemStream.getAudioTracks().length);

      tabStreamRef.current = systemStream;
      const systemAudioContext = new AudioContext({ sampleRate: 16000 });
      tabAudioContextRef.current = systemAudioContext;

      // セッション開始
      socketRef.current?.emit("start", {
        sessionId: sessionIdRef.current,
        lang: "ja",
        params: {
          threshold: 1.6,
          minSpeechMs: 400,
          hangoverMs: 400,
          maxSilenceMs: 2000,
          minTranscribeDurationSec: 2.0,
          mode: "normal",
          meetingInput,
        },
      });

      // マイク音声処理セットアップ
      setupAudioProcessor(
        micStream,
        micAudioContext,
        'microphone',
        micIsSpeakingRef,
        micSilenceTimerRef,
        micNoiseFloorRef
      );

      // システム音声処理セットアップ
      setupAudioProcessor(
        systemStream,
        systemAudioContext,
        'tab',
        tabIsSpeakingRef,
        tabSilenceTimerRef,
        tabNoiseFloorRef
      );

      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("オーディオデバイスへのアクセスに失敗しました");
    }
  };

  const stopRecording = () => {
    // マイクのクリーンアップ
    if (micSilenceTimerRef.current) {
      clearTimeout(micSilenceTimerRef.current);
      micSilenceTimerRef.current = null;
    }
    micIsSpeakingRef.current = false;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micAudioContextRef.current) {
      micAudioContextRef.current.close();
      micAudioContextRef.current = null;
    }

    // タブ音声のクリーンアップ
    if (tabSilenceTimerRef.current) {
      clearTimeout(tabSilenceTimerRef.current);
      tabSilenceTimerRef.current = null;
    }
    tabIsSpeakingRef.current = false;

    if (tabStreamRef.current) {
      tabStreamRef.current.getTracks().forEach((track) => track.stop());
      tabStreamRef.current = null;
    }

    if (tabAudioContextRef.current) {
      tabAudioContextRef.current.close();
      tabAudioContextRef.current = null;
    }

    if (socketRef.current && sessionIdRef.current) {
      socketRef.current.emit("end", { sessionId: sessionIdRef.current });
    }

    setIsRecording(false);
    setConnectionStatus("接続済み");
  };

  const handleNewSession = () => {
    setTranscripts([]);
    setMermaidCode("");
    setDecisionsResult(null);

    if (socketRef.current && sessionIdRef.current) {
      socketRef.current.emit("reset_session", {
        sessionId: sessionIdRef.current,
      });
    }
  };

  const handleGenerateMermaid = async () => {
    if (transcripts.length === 0) {
      setError("文字起こし履歴がありません");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/mermaid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcripts,
          meetingInput: meetingInput || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "エラーが発生しました");
      }

      setMermaidCode(data.mermaidCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    setDecisionsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/extract-decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcripts,
          meetingInput: meetingInput || { purpose: "一般的な会議", agenda: ["議題1"] }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "エラーが発生しました");
      }

      setDecisionsResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setDecisionsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="h-screen flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white border-b-4 border-indigo-600 shadow-md">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between px-12 py-6">
            <h1 className="text-4xl font-black text-indigo-900 uppercase tracking-tight">
              リアルタイム文字起こし
            </h1>
            {/* 接続状態インジケータ */}
            <div className="flex items-center gap-3 px-6 py-3 bg-gray-100 border-2 border-gray-300">
              <span
                className={`w-3 h-3 ${
                  connectionStatus === "接続済み" || connectionStatus === "セッション開始"
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              ></span>
              <span className="text-sm text-gray-900 font-bold uppercase tracking-wide">{connectionStatus}</span>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-hidden px-16 py-8">
          <div className="h-full max-w-[1800px] mx-auto">
            {/* 上部: 会議情報入力とオーディオデバイス設定 */}
            <div className="mb-8 grid grid-cols-2 gap-8">
              {/* 左: 会議情報 */}
              <MeetingInput
                onSubmit={setMeetingInput}
                disabled={isRecording}
              />

              {/* 右: オーディオデバイス設定 */}
              <AudioDeviceInput
                micDeviceId={micDeviceId}
                systemDeviceId={systemDeviceId}
                audioDevices={audioDevices}
                onMicChange={setMicDeviceId}
                onSystemChange={setSystemDeviceId}
                disabled={isRecording}
              />
            </div>

            {/* メインコンテンツグリッド */}
            <div className="h-[calc(100%-180px)] grid grid-cols-3 gap-8">
              {/* 左: 文字起こしドキュメント */}
              <div className="bg-white shadow-lg border border-gray-300 flex flex-col overflow-hidden">
              <div className="px-8 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 border-b-4 border-blue-700 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">文字起こし</h2>
                <div className="flex gap-3">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-2 px-6 transition-all shadow-lg uppercase tracking-wide text-sm"
                      aria-label="録音を開始"
                    >
                      開始
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-white text-rose-700 hover:bg-rose-50 font-bold py-2 px-6 transition-all shadow-lg uppercase tracking-wide text-sm"
                      aria-label="録音を停止"
                    >
                      停止
                    </button>
                  )}
                  <button
                    onClick={handleNewSession}
                    className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2 px-6 transition-all border-2 border-white uppercase tracking-wide text-sm"
                    aria-label="キャッシュをクリア"
                  >
                    クリア
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <p className="text-center text-lg font-medium text-gray-500">
                      「開始」ボタンを押して話しかけてください
                    </p>
                  </div>
                ) : (
                  <ChatTranscriptView transcripts={transcripts} />
                )}
              </div>
            </div>

              {/* 中央: マーメイド記法 */}
              <div className="bg-white shadow-lg border border-gray-300 flex flex-col overflow-hidden">
                <div className="px-8 py-5 bg-gradient-to-r from-purple-600 to-pink-600 border-b-4 border-purple-700 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white uppercase tracking-tight">マーメイド記法</h2>
                  <button
                    onClick={handleGenerateMermaid}
                    disabled={loading || transcripts.length === 0}
                    className="bg-white text-purple-700 hover:bg-purple-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-bold py-2 px-6 transition-all shadow-lg uppercase tracking-wide text-sm"
                    aria-label="マーメイド記法を生成"
                  >
                    {loading ? "生成中..." : "図を生成"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                  {mermaidCode ? (
                    <div className="space-y-6">
                      <MermaidViewer code={mermaidCode} />
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-purple-700 hover:text-purple-900 font-bold uppercase tracking-wide border-b-2 border-purple-200 pb-2">
                          マーメイド記法を表示
                        </summary>
                        <pre className="mt-4 p-6 bg-gray-50 border-2 border-gray-300 overflow-auto text-xs font-mono">
                          {mermaidCode}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <p className="text-center text-lg font-medium text-gray-500">
                        文字起こし後に右上の「図を生成」ボタンをクリック
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右: AI画像生成 */}
              <DecisionsList
                result={decisionsResult}
                loading={decisionsLoading}
                onExtract={handleGenerateImage}
                disabled={false}
              />
            </div>
          </div>
        </div>

        {/* エラー表示（下部中央） */}
        {error && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-red-100 border-4 border-red-500 text-red-900 px-8 py-4 shadow-2xl font-bold uppercase tracking-wide">
              {error}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
