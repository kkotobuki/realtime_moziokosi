"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import MermaidViewer from "@/components/MermaidViewer";
import MeetingInput from "@/components/MeetingInput";
import DecisionsList from "@/components/DecisionsList";
import { TranscriptEntry, DecisionExtractResult } from "@/types";
import type { MeetingInput as MeetingInputType } from "@/lib/services/gemini-decision-extractor";

export default function Home() {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mermaidCode, setMermaidCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("未接続");

  // 決定事項抽出関連
  const [meetingInput, setMeetingInput] = useState<MeetingInputType | null>(null);
  const [decisionsResult, setDecisionsResult] = useState<DecisionExtractResult | null>(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const noiseFloorRef = useRef<number>(0.01);
  const autoExtractTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // リアルタイム決定事項抽出
  useEffect(() => {
    if (!meetingInput || transcripts.length === 0 || !isRecording) {
      return;
    }

    // 既存のタイマーをクリア
    if (autoExtractTimerRef.current) {
      clearTimeout(autoExtractTimerRef.current);
    }

    // 30秒後に自動抽出
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
            console.error("Auto-extract error:", err);
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

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // セッションID生成
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
        },
      });

      // AudioWorkletとVADの実装
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
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

        const SILENCE_DURATION_MS = 1500;

        // PCM16に変換して送信
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        socketRef.current?.emit("audio", pcm16.buffer);

        // VAD状態管理
        const isSpeech = energyLevel > threshold || peak > threshold * 1.5;

        if (isSpeech) {
          if (!isSpeakingRef.current) {
            console.log("Speech started (RMS:", rms.toFixed(4), "Threshold:", threshold.toFixed(4), ")");
            isSpeakingRef.current = true;
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (isSpeakingRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log("Speech ended (silence detected after", SILENCE_DURATION_MS, "ms)");
              isSpeakingRef.current = false;

              socketRef.current?.emit("speech_ended", {
                sessionId: sessionIdRef.current,
                timestamp: Date.now(),
              });

              silenceTimerRef.current = null;
            }, SILENCE_DURATION_MS);
          }
        }
      };

      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("マイクへのアクセスに失敗しました");
    }
  };

  const stopRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isSpeakingRef.current = false;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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

  const handleExtractDecisions = async () => {
    if (transcripts.length === 0) {
      setError("文字起こし履歴がありません");
      return;
    }

    if (!meetingInput) {
      setError("会議情報を設定してください");
      return;
    }

    setDecisionsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/extract-decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcripts, meetingInput }),
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
    <main className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="h-screen flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white/80 backdrop-blur-sm px-16 py-8 border-b border-indigo-100 shadow-sm">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-12 px-8">
            <h1 className="text-3xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              リアルタイム文字起こし
            </h1>
            {/* 接続状態インジケータ */}
            <div className="flex items-center gap-4 px-8 py-4 bg-white rounded-full shadow-sm border border-indigo-100">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "接続済み" || connectionStatus === "セッション開始"
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              ></span>
              <span className="text-xs text-indigo-700 font-medium">{connectionStatus}</span>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-hidden p-8">
          <div className="h-full max-w-[1920px] mx-auto px-4">
            {/* 上部: 会議情報入力 */}
            <div className="mb-6">
              <MeetingInput
                onSubmit={setMeetingInput}
                disabled={isRecording}
              />
            </div>

            {/* メインコンテンツグリッド */}
            <div className="h-[calc(100%-120px)] grid grid-cols-3 gap-6">
              {/* 左: 文字起こしドキュメント */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-indigo-100 flex flex-col overflow-hidden">
              <div className="px-8 py-4 bg-linear-to-r from-blue-500 to-indigo-500 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">文字起こし</h2>
                <div className="flex gap-2">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold py-2 px-6 rounded-lg transition-all shadow-md"
                      aria-label="録音を開始"
                    >
                      開始
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-white text-rose-600 hover:bg-rose-50 font-semibold py-2 px-6 rounded-lg transition-all shadow-md"
                      aria-label="録音を停止"
                    >
                      停止
                    </button>
                  )}
                  <button
                    onClick={handleNewSession}
                    className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-6 rounded-lg transition-all backdrop-blur-sm"
                    aria-label="キャッシュをクリア"
                  >
                    クリア
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-12">
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-indigo-300 px-8">
                    <p className="text-center max-w-2xl">
                      「開始」ボタンを押して話しかけてください
                    </p>
                  </div>
                ) : (
                  <div className="prose prose-indigo max-w-none">
                    {transcripts.map((entry) => (
                      <p key={entry.id} className="mb-4 text-gray-800 leading-relaxed">
                        {entry.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

              {/* 中央: マーメイド図 */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 flex flex-col overflow-hidden">
                <div className="px-8 py-4 bg-linear-to-r from-purple-500 to-pink-500 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">マーメイド図</h2>
                  <button
                    onClick={handleGenerateMermaid}
                    disabled={loading || transcripts.length === 0}
                    className="bg-white text-purple-600 hover:bg-purple-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed font-semibold py-2 px-6 rounded-lg transition-all shadow-md"
                    aria-label="マーメイド図を生成"
                  >
                    {loading ? "生成中..." : "図を生成"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                  {mermaidCode ? (
                    <div className="space-y-4">
                      <MermaidViewer code={mermaidCode} />
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm text-purple-600 hover:text-purple-700 font-medium">
                          マーメイド記法を表示
                        </summary>
                        <pre className="mt-3 p-4 bg-purple-50 rounded-lg overflow-auto text-xs font-mono border border-purple-100">
                          {mermaidCode}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-purple-300">
                      <p className="text-center">
                        文字起こし後に「図を生成」ボタンをクリック
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右: 決定事項 */}
              <DecisionsList
                result={decisionsResult}
                loading={decisionsLoading}
                onExtract={handleExtractDecisions}
                disabled={!meetingInput || transcripts.length === 0}
              />
            </div>
          </div>
        </div>

        {/* エラー表示（下部中央） */}
        {error && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-6 py-3 shadow-lg">
              {error}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
