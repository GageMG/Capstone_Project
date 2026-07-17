import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import GeneratedVideoPlayer from "@/components/GeneratedVideoPlayer";
import { useAuth } from "@/lib/AuthContext";
import { downloadVideo } from "@/lib/downloadVideo";
import {
  GeneratedVideoPlayback,
  getGeneratedVideoPlayback,
} from "@/lib/generatedVideos";
import { useTheme } from "@/theme/ThemeContext";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function GeneratedVideoScreen() {
  const params = useLocalSearchParams<{
    eventid?: string | string[];
    generatedVideoId?: string | string[];
  }>();
  const { ready, loggedIn } = useAuth();
  const { colors } = useTheme();
  const generatedVideoId = Number(firstParam(params.generatedVideoId));
  const eventId = firstParam(params.eventid);
  const validVideoId =
    Number.isInteger(generatedVideoId) && generatedVideoId > 0;

  const [playback, setPlayback] =
    useState<GeneratedVideoPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function loadPlaybackUrl() {
    if (!validVideoId) {
      setError("This video link is invalid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setPlayback(await getGeneratedVideoPlayback(generatedVideoId));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load the video."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (!loggedIn) {
      setError("Please log in to watch this video.");
      setLoading(false);
      return;
    }
    loadPlaybackUrl();
  }, [generatedVideoId, loggedIn, ready]);

  async function handleDownload() {
    if (!playback || downloading) return;

    setDownloading(true);
    setDownloadError(null);

    try {
      let downloadSource = playback;
      const expiresIn = new Date(playback.expires_at).getTime() - Date.now();

      if (expiresIn < 60_000) {
        downloadSource = await getGeneratedVideoPlayback(generatedVideoId);
        setPlayback(downloadSource);
      }

      await downloadVideo(
        downloadSource.stream_url,
        `event-${downloadSource.event_id}-video-${downloadSource.generated_video_id}.mp4`
      );
    } catch (caught) {
      setDownloadError(
        caught instanceof Error
          ? caught.message
          : "The video could not be downloaded."
      );
    } finally {
      setDownloading(false);
    }
  }

  const expiresAt = playback
    ? new Date(playback.expires_at).toLocaleString()
    : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.textBright}
            />
          </TouchableOpacity>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              EVENT {eventId ?? ""}
            </Text>
            <Text style={[styles.title, { color: colors.textBright }]}>
              Generated video
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ color: colors.textMuted }}>Loading video...</Text>
            </View>
          ) : error || !playback ? (
            <View style={styles.center}>
              <Ionicons
                name="alert-circle-outline"
                size={42}
                color={colors.danger}
              />
              <Text style={[styles.error, { color: colors.danger }]}>
                {error ?? "Video unavailable."}
              </Text>
              {loggedIn && validVideoId ? (
                <TouchableOpacity
                  onPress={loadPlaybackUrl}
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.accentStrong },
                  ]}
                >
                  <Text style={styles.actionButtonText}>Try again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <GeneratedVideoPlayer
                key={playback.stream_url}
                streamUrl={playback.stream_url}
              />
              <View style={styles.playbackFooter}>
                <Text style={[styles.expiry, { color: colors.textMuted }]}>
                  Secure playback link expires {expiresAt}
                </Text>
                <View style={styles.playbackActions}>
                  <TouchableOpacity
                    accessibilityLabel="Download generated video"
                    disabled={downloading}
                    onPress={handleDownload}
                    style={[
                      styles.downloadButton,
                      { backgroundColor: colors.accentStrong },
                      downloading && styles.disabledButton,
                    ]}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="download-outline" size={18} color="#fff" />
                    )}
                    <Text style={styles.downloadText}>
                      {downloading ? "Downloading..." : "Download"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Refresh secure video link"
                    onPress={loadPlaybackUrl}
                    style={[
                      styles.refreshButton,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name="refresh"
                      size={18}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.refreshText, { color: colors.accent }]}
                    >
                      Refresh link
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {downloadError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.downloadError, { color: colors.danger }]}
                >
                  {downloadError}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.7,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  content: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    flex: 1,
  },
  center: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  error: {
    textAlign: "center",
    paddingHorizontal: 24,
  },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  playbackFooter: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  expiry: {
    fontSize: 12,
  },
  playbackActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  downloadButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  disabledButton: {
    opacity: 0.65,
  },
  downloadText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  refreshButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: "700",
  },
  downloadError: {
    marginTop: 10,
    textAlign: "right",
    fontSize: 13,
  },
});
