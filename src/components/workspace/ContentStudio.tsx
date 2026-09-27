import React, { useState } from "react";
import { Transcript, RepurposedContent, HighlightItem } from "@/types";
import { formatTimestamp } from "@/lib/utils";
import { Sparkles, FileText, Flame, Languages, Copy, Check, Loader2 } from "lucide-react";

interface ContentStudioProps {
  transcript: Transcript;
  onSeek: (seconds: number) => void;
}

type TabType = "summary" | "highlights" | "translate";

export const ContentStudio: React.FC<ContentStudioProps> = ({ transcript, onSeek }) => {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Local state for modular AI content outputs
  const [summaryData, setSummaryData] = useState<RepurposedContent["summary"] | null>(null);
  const [highlightsData, setHighlightsData] = useState<HighlightItem[] | null>(null);
  const [translationsData, setTranslationsData] = useState<Record<string, { fullText: string }> | null>(null);
  const [selectedLang, setSelectedLang] = useState("es");

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchSummary = async () => {
    if (summaryData) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (data.summary) setSummaryData(data.summary);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const fetchHighlights = async () => {
    if (highlightsData) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (data.highlights) setHighlightsData(data.highlights);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const fetchTranslate = async () => {
    if (translationsData) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, languages: ["es", "fr", "de"] }),
      });
      const data = await res.json();
      if (data.translations) setTranslationsData(data.translations);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "summary") fetchSummary();
    if (tab === "highlights") fetchHighlights();
    if (tab === "translate") fetchTranslate();
  };

  // Auto trigger initial summary fetch
  React.useEffect(() => {
    fetchSummary();
  }, [transcript]);

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#0d1017] border border-[#00c4cc]/20 overflow-hidden shadow-2xl mt-6 font-body">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-[#00c4cc]/15 bg-[#141824]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#ffec00]" />
          <h3 className="font-heading text-lg tracking-wide text-white">Content Intelligence Studio</h3>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#08090c] p-1.5 rounded-xl border border-[#00c4cc]/20 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => handleTabChange("summary")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-body font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "summary"
                ? "bg-[#00c4cc] text-black shadow-md shadow-[#00c4cc]/20"
                : "text-neutral-400 hover:text-white hover:bg-[#00c4cc]/10"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("highlights")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-body font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "highlights"
                ? "bg-[#00c4cc] text-black shadow-md shadow-[#00c4cc]/20"
                : "text-neutral-400 hover:text-white hover:bg-[#00c4cc]/10"
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${activeTab === "highlights" ? "text-black" : "text-[#ffec00]"}`} />
            <span>Potential Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("translate")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-body font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "translate"
                ? "bg-[#00c4cc] text-black shadow-md shadow-[#00c4cc]/20"
                : "text-neutral-400 hover:text-white hover:bg-[#00c4cc]/10"
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Translate</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 font-body">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[#00c4cc] animate-spin mb-3" />
            <p className="text-xs text-neutral-400 font-mono">Generating AI content intelligence...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: SUMMARY */}
            {activeTab === "summary" && (
              <div className="flex flex-col gap-4">
                {summaryData ? (
                  <>
                    <div className="p-4 rounded-xl bg-[#141824]/70 border border-[#00c4cc]/15">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-[#00c4cc] uppercase tracking-wider font-body">
                          Executive Summary
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyText(summaryData.executiveSummary, "sum")}
                          className="p-1 text-neutral-400 hover:text-[#00c4cc]"
                        >
                          {copiedKey === "sum" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-sm text-neutral-200 leading-relaxed font-body">
                        {summaryData.executiveSummary}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#141824]/70 border border-[#00c4cc]/15">
                      <h4 className="text-xs font-bold text-[#ffec00] uppercase tracking-wider mb-2 font-body">
                        Key Takeaways
                      </h4>
                      <ul className="flex flex-col gap-2">
                        {summaryData.keyTakeaways.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-300 font-body">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00c4cc] mt-2 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-neutral-500 font-body">Click to generate executive summary.</p>
                )}
              </div>
            )}

            {/* TAB 2: POTENTIAL HIGHLIGHTS */}
            {activeTab === "highlights" && (
              <div className="flex flex-col gap-3">
                {highlightsData ? (
                  highlightsData.map((hl) => (
                    <div
                      key={hl.id}
                      className="p-4 rounded-xl bg-[#141824]/70 border border-[#00c4cc]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-[#00c4cc]/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onSeek(hl.start)}
                          className="px-2.5 py-1 rounded-lg bg-[#00c4cc] text-black font-mono text-xs font-bold shrink-0 hover:bg-[#00b2b8] transition-colors"
                        >
                          {formatTimestamp(hl.start)}
                        </button>
                        <div>
                          <p className="text-xs text-white font-body font-medium">"{hl.text}"</p>
                          <span className="text-[11px] text-[#ffec00] mt-1 block font-body">
                            {hl.reason}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-500 font-body">Click to identify potential highlight moments.</p>
                )}
              </div>
            )}

            {/* TAB 3: TRANSLATE */}
            {activeTab === "translate" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  {["es", "fr", "de"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLang(lang)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                        selectedLang === lang
                          ? "bg-[#00c4cc] text-black"
                          : "bg-[#08090c] text-neutral-400 hover:text-white"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                {translationsData && translationsData[selectedLang] ? (
                  <div className="p-4 rounded-xl bg-[#141824]/70 border border-[#00c4cc]/15">
                    <p className="text-xs text-neutral-200 leading-relaxed font-body">
                      {translationsData[selectedLang].fullText}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 font-body">Click to generate multi-language translations.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

