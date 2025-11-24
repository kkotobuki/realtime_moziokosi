"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidViewerProps {
  code: string;
}

export default function MermaidViewer({ code }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });
  }, []);

  useEffect(() => {
    if (!code || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        renderIdRef.current += 1;
        const id = `mermaid-${renderIdRef.current}`;

        if (containerRef.current) {
          containerRef.current.innerHTML = "";

          const { svg } = await mermaid.render(id, code);

          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        }
      } catch (error) {
        console.error("マーメイド図のレンダリングエラー:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="text-red-600 p-4 border border-red-300 rounded bg-red-50">
              <p class="font-bold">マーメイド図のレンダリングに失敗しました</p>
              <p class="text-sm mt-2">コードに構文エラーがある可能性があります。</p>
              <pre class="mt-2 text-xs overflow-auto">${String(error)}</pre>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[200px] flex items-center justify-center p-6 bg-white border border-gray-200 rounded"
    />
  );
}
