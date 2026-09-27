import { Transcript, TranscriptionJob } from "@/types";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function saveTranscriptToHistory(transcript: Transcript): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // In-memory / client-side storage fallback
    saveToLocalStorageFallback(transcript);
    return false;
  }

  try {
    // Supabase REST client call when env vars exist
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/transcripts`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(transcript),
    });
    return true;
  } catch (err) {
    console.warn("Supabase persistence failed, falling back to local storage:", err);
    saveToLocalStorageFallback(transcript);
    return false;
  }
}

function saveToLocalStorageFallback(transcript: Transcript) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(localStorage.getItem("unclip_history") || "[]");
    const updated = [transcript, ...existing.filter((t: Transcript) => t.id !== transcript.id)].slice(0, 30);
    localStorage.getItem("unclip_history") || localStorage.setItem("unclip_history", JSON.stringify(updated));
  } catch {
    // Silent fallback
  }
}
