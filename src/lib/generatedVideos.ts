import { apiFetch } from "@/lib/api";

export type GeneratedVideoPlayback = {
  generated_video_id: number;
  event_id: number;
  stream_url: string;
  expires_at: string;
};

export function getGeneratedVideoPlayback(
  generatedVideoId: number
): Promise<GeneratedVideoPlayback> {
  return apiFetch<GeneratedVideoPlayback>(
    `/generated-videos/${generatedVideoId}/playback-url`
  );
}
