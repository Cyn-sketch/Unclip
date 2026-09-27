export interface Segment {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptMetadata {
  title?: string;
  author?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  sttProvider: string;
}

export interface Transcript {
  id: string;
  language: string;
  duration: number; // in seconds
  fullText: string;
  segments: Segment[];
  metadata: TranscriptMetadata;
}

export type JobStatus =
  | "queued"
  | "retrieving"
  | "extracting"
  | "transcribing"
  | "processing"
  | "completed"
  | "failed";

export type InstagramErrorCode =
  | "INSTAGRAM_AUTH_REQUIRED"
  | "INSTAGRAM_AUTH_EXPIRED"
  | "INSTAGRAM_CHECKPOINT_REQUIRED"
  | "INSTAGRAM_RATE_LIMITED"
  | "PRIVATE_CONTENT_UNAVAILABLE"
  | "REEL_UNAVAILABLE"
  | "MEDIA_URL_NOT_EXPOSED"
  | "MEDIA_DOWNLOAD_FAILED"
  | "MEDIA_RETRIEVAL_UNAVAILABLE"
  | "INVALID_INSTAGRAM_URL"
  | "INVALID_MEDIA"
  | "FFMPEG_FAILED"
  | "WHISPER_FAILED"
  | "EMPTY_TRANSCRIPT";

export interface TranscriptionJob {
  id: string;
  url?: string;
  isDemo?: boolean;
  demoId?: string;
  status: JobStatus;
  progress: number; // 0 - 100
  message?: string;
  error?: string;
  errorCode?: InstagramErrorCode;
  transcript?: Transcript;
  mediaRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedMetadata {
  url: string;
  canonicalUrl: string;
  mediaId?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  author?: string;
}

export interface RetrievedMedia {
  kind: "video";
  contentType: string;
  size: number;
  localPath: string;
  duration?: number;
}

export interface HighlightItem {
  id: string;
  start: number;
  end: number;
  text: string;
  reason: string;
  score?: number;
}

export interface RepurposedContent {
  summary: {
    executiveSummary: string;
    keyTakeaways: string[];
    sentiment: string;
    wordCount: number;
    speakingCadenceWPM: number;
  };
  socialPosts: {
    instagramCaption: string;
    linkedInPost: string;
    xThread: string[];
    carouselOutline: { slideNumber: number; title: string; body: string }[];
    newsletter: string;
  };
  highlights: HighlightItem[];
  translations: Record<string, { fullText: string; segments: Segment[] }>;
}

export interface SampleReel {
  id: string;
  title: string;
  author: string;
  duration: number;
  category: string;
  url: string;
  thumbnailUrl: string;
  videoUrl?: string;
  hasVideoPlayback: boolean;
  transcript: Transcript;
  repurposed?: RepurposedContent;
}
