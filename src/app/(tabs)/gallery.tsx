import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
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
import { apiFetch } from "@/lib/api";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type Photo = { id: string; uri: string };
type UploadedVideo = {
  id: string;
  uri: string;
  title: string;
  durationSeconds: number | null;
};

type Gallery = {
  id: string;
  title: string;
  date: string;
  photoCount: number;
  videoCount: number;
  coverColor: string;
  accentColor: string;
  photos: Photo[];
  videos: UploadedVideo[];
};

type EventRecord = {
  event_id: number;
  name: string;
  type: string;
  event_date: string;
};

type EventsResponse = {
  count: number;
  events: EventRecord[];
};

type MediaRecord = {
  id: number;
  display_url: string | null;
  original_file_name?: string | null;
  title?: string | null;
  duration_seconds?: number | null;
};

type EventMediaResponse = {
  photo_count: number;
  video_count: number;
  photos: MediaRecord[];
  videos: MediaRecord[];
};

const GALLERY_COLORS = [
  { cover: "#1A2F5A", accent: "#3B82F6" },
  { cover: "#312E81", accent: "#8B5CF6" },
  { cover: "#164E63", accent: "#06B6D4" },
  { cover: "#78350F", accent: "#F59E0B" },
];

function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function loadGallery(event: EventRecord, index: number): Promise<Gallery> {
  const media = await apiFetch<EventMediaResponse>(
    `/events/${event.event_id}/media?dataType=both`
  );
  const palette = GALLERY_COLORS[index % GALLERY_COLORS.length];
  const photos = media.photos
    .filter(
      (photo): photo is MediaRecord & { display_url: string } =>
        typeof photo.display_url === "string" && photo.display_url.length > 0
    )
    .map((photo) => ({
      id: String(photo.id),
      uri: photo.display_url,
    }));
  const videos = media.videos
    .filter(
      (video): video is MediaRecord & { display_url: string } =>
        typeof video.display_url === "string" && video.display_url.length > 0
    )
    .map((video) => ({
      id: String(video.id),
      uri: video.display_url,
      title:
        video.title ||
        video.original_file_name ||
        `Uploaded video ${video.id}`,
      durationSeconds: video.duration_seconds ?? null,
    }));

  return {
    id: String(event.event_id),
    title: event.name,
    date: formatEventDate(event.event_date),
    photoCount: photos.length,
    videoCount: videos.length,
    coverColor: palette.cover,
    accentColor: palette.accent,
    photos,
    videos,
  };
}

// Photo Lightbox
function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={lb.container}>
        <StatusBar hidden />
        <TouchableOpacity style={lb.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#F0F4FF" />
        </TouchableOpacity>
        <View style={lb.counter}>
          <Text style={lb.counterText}>
            {current + 1} / {photos.length}
          </Text>
        </View>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setCurrent(idx);
          }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, justifyContent: "center" }}>
              <Image
                source={{ uri: item.uri }}
                style={lb.photo}
                resizeMode="contain"
              />
            </View>
          )}
        />
        <View style={lb.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[lb.dot, i === current && lb.dotActive]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050810", justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: { color: "#F0F4FF", fontSize: 13, fontWeight: "600" },
  photo: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  dots: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dotActive: { backgroundColor: "#3B82F6", width: 18 },
});

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "Video";
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function UploadedVideoModal({
  eventId,
  video,
  onClose,
}: {
  eventId: number;
  video: UploadedVideo;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const [freshVideo, setFreshVideo] = useState<UploadedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const media = await apiFetch<EventMediaResponse>(
          `/events/${eventId}/media?dataType=videos`
        );
        const current = media.videos.find(
          (item) => String(item.id) === video.id
        );

        if (!current?.display_url) {
          throw new Error("This uploaded video is no longer available.");
        }

        if (!cancelled) {
          setFreshVideo({
            ...video,
            uri: current.display_url,
            title:
              current.title ||
              current.original_file_name ||
              video.title,
            durationSeconds:
              current.duration_seconds ?? video.durationSeconds,
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The uploaded video could not be loaded."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, video]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <SafeAreaView style={[videoModal.container, { backgroundColor: c.bg }]}>
        <StatusBar barStyle={c.statusBar} />
        <View style={videoModal.header}>
          <View style={videoModal.headerText}>
            <Text
              numberOfLines={1}
              style={[videoModal.title, { color: c.textBright }]}
            >
              {video.title}
            </Text>
            <Text style={[videoModal.meta, { color: c.textMuted }]}>
              Uploaded video
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Close video"
            onPress={onClose}
            style={[
              videoModal.closeButton,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Ionicons name="close" size={24} color={c.textBright} />
          </TouchableOpacity>
        </View>
        <View style={videoModal.playerArea}>
          {error ? (
            <View style={videoModal.center}>
              <Ionicons
                name="alert-circle-outline"
                size={42}
                color={c.danger}
              />
              <Text style={[videoModal.error, { color: c.danger }]}>
                {error}
              </Text>
            </View>
          ) : freshVideo ? (
            <GeneratedVideoPlayer
              key={freshVideo.uri}
              streamUrl={freshVideo.uri}
            />
          ) : (
            <View style={videoModal.center}>
              <ActivityIndicator size="large" color={c.accent} />
              <Text style={{ color: c.textMuted }}>Loading video...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const videoModal = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playerArea: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  center: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  error: {
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

//Gallery Detail Modal
function GalleryDetail({
  gallery,
  onClose,
}: {
  gallery: Gallery;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const gd = useMemo(() => makeDetailStyles(c), [c]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<UploadedVideo | null>(
    null
  );
  const [mediaTab, setMediaTab] = useState<"photos" | "videos">(
    gallery.photos.length > 0 ? "photos" : "videos"
  );
  const numCols = 3;
  const cellSize = (SCREEN_WIDTH - 4) / numCols;

  return (
    <Modal visible animationType="slide">
      <View style={gd.container}>
        <StatusBar barStyle={c.statusBar} />
        <SafeAreaView>
          <View style={gd.header}>
            <TouchableOpacity onPress={onClose} style={gd.backBtn}>
              <Ionicons name="chevron-back" size={24} color={c.textBright} />
            </TouchableOpacity>
            <View style={gd.headerText}>
              <Text style={gd.title}>{gallery.title}</Text>
              <Text style={gd.meta}>
                {gallery.date} · {gallery.photoCount} photos ·{" "}
                {gallery.videoCount} videos
              </Text>
            </View>
            <View
              style={[gd.accentDot, { backgroundColor: gallery.accentColor }]}
            />
          </View>
        </SafeAreaView>
        <View style={[gd.divider, { backgroundColor: gallery.accentColor }]} />
        <View style={gd.tabs}>
          <TouchableOpacity
            onPress={() => setMediaTab("photos")}
            style={[
              gd.tab,
              mediaTab === "photos" && {
                backgroundColor: gallery.accentColor,
              },
            ]}
          >
            <Ionicons
              name="images-outline"
              size={17}
              color={mediaTab === "photos" ? "#fff" : c.textMuted}
            />
            <Text
              style={[
                gd.tabText,
                { color: mediaTab === "photos" ? "#fff" : c.textMuted },
              ]}
            >
              Photos ({gallery.photoCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMediaTab("videos")}
            style={[
              gd.tab,
              mediaTab === "videos" && {
                backgroundColor: gallery.accentColor,
              },
            ]}
          >
            <Ionicons
              name="videocam-outline"
              size={18}
              color={mediaTab === "videos" ? "#fff" : c.textMuted}
            />
            <Text
              style={[
                gd.tabText,
                { color: mediaTab === "videos" ? "#fff" : c.textMuted },
              ]}
            >
              Videos ({gallery.videoCount})
            </Text>
          </TouchableOpacity>
        </View>
        {mediaTab === "photos" ? (
          <FlatList
            key="photos"
            data={gallery.photos}
            numColumns={numCols}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              gd.grid,
              gallery.photos.length === 0 && gd.emptyList,
            ]}
            ListEmptyComponent={
              <View style={gd.empty}>
                <Ionicons
                  name="images-outline"
                  size={38}
                  color={c.textFaint}
                />
                <Text style={[gd.emptyText, { color: c.textMuted }]}>
                  No uploaded photos yet.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setLightboxIndex(index)}
                style={[gd.cell, { width: cellSize, height: cellSize }]}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={gd.cellImage}
                  resizeMode="cover"
                />
                <View style={gd.cellOverlay} />
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            key="videos"
            data={gallery.videos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              gd.videoList,
              gallery.videos.length === 0 && gd.emptyList,
            ]}
            ListEmptyComponent={
              <View style={gd.empty}>
                <Ionicons
                  name="videocam-outline"
                  size={42}
                  color={c.textFaint}
                />
                <Text style={[gd.emptyText, { color: c.textMuted }]}>
                  No uploaded videos yet.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedVideo(item)}
                style={[
                  gd.videoRow,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View
                  style={[
                    gd.videoIcon,
                    { backgroundColor: gallery.coverColor },
                  ]}
                >
                  <Ionicons name="play" size={24} color="#fff" />
                </View>
                <View style={gd.videoInfo}>
                  <Text
                    numberOfLines={1}
                    style={[gd.videoTitle, { color: c.textPrimary }]}
                  >
                    {item.title}
                  </Text>
                  <Text style={[gd.videoMeta, { color: c.textMuted }]}>
                    {formatDuration(item.durationSeconds)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={c.textFaint}
                />
              </TouchableOpacity>
            )}
          />
        )}
        {lightboxIndex !== null && (
          <Lightbox
            photos={gallery.photos}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
        {selectedVideo && (
          <UploadedVideoModal
            eventId={Number(gallery.id)}
            video={selectedVideo}
            onClose={() => setSelectedVideo(null)}
          />
        )}
      </View>
    </Modal>
  );
}

const makeDetailStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: { flex: 1 },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textBright,
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
      letterSpacing: -0.4,
    },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    accentDot: { width: 10, height: 10, borderRadius: 5 },
    divider: {
      height: 2,
      marginHorizontal: 16,
      borderRadius: 2,
      opacity: 0.5,
      marginBottom: 2,
    },
    tabs: {
      flexDirection: "row",
      alignSelf: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    tab: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "700",
    },
    grid: { gap: 2 },
    emptyList: {
      flexGrow: 1,
      justifyContent: "center",
    },
    empty: {
      minHeight: 240,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: 14,
    },
    cell: { overflow: "hidden" },
    cellImage: { width: "100%", height: "100%" },
    cellOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(13,17,23,0.1)",
    },
    videoList: {
      width: "100%",
      maxWidth: 900,
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 10,
    },
    videoRow: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
    },
    videoIcon: {
      width: 58,
      height: 58,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    videoInfo: {
      flex: 1,
    },
    videoTitle: {
      fontSize: 15,
      fontWeight: "700",
    },
    videoMeta: {
      fontSize: 12,
      marginTop: 4,
    },
  });

// Gallery Card
function GalleryCard({
  gallery,
  onPress,
}: {
  gallery: Gallery;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const gc = useMemo(() => makeCardStyles(c), [c]);
  return (
    <TouchableOpacity
      style={[gc.card, { width: CARD_WIDTH }]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={[gc.cover, { backgroundColor: gallery.coverColor }]}>
        {gallery.photos[0] ? (
          <Image
            source={{ uri: gallery.photos[0].uri }}
            style={gc.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={gc.emptyCover}>
            <Ionicons name="videocam" size={34} color="#fff" />
          </View>
        )}
        <View style={gc.badges}>
          <View style={[gc.badge, { backgroundColor: gallery.accentColor }]}>
            <Ionicons name="images" size={10} color="#fff" />
            <Text style={gc.badgeText}>{gallery.photoCount}</Text>
          </View>
          {gallery.videoCount > 0 ? (
            <View style={[gc.badge, { backgroundColor: "#111827" }]}>
              <Ionicons name="videocam" size={11} color="#fff" />
              <Text style={gc.badgeText}>{gallery.videoCount}</Text>
            </View>
          ) : null}
        </View>
        <View style={[gc.accentBar, { backgroundColor: gallery.accentColor }]} />
      </View>
      <View style={gc.info}>
        <Text style={gc.cardTitle} numberOfLines={1}>
          {gallery.title}
        </Text>
        <Text style={gc.cardDate}>{gallery.date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeCardStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    cover: { height: CARD_WIDTH * 0.75, width: "100%", overflow: "hidden" },
    coverImage: { width: "100%", height: "100%", opacity: 0.85 },
    emptyCover: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.8,
    },
    badges: {
      position: "absolute",
      top: 8,
      right: 8,
      flexDirection: "row",
      gap: 6,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    accentBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      opacity: 0.7,
    },
    info: { padding: 10 },
    cardTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textPrimary,
      letterSpacing: -0.2,
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    },
    cardDate: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  });

// Gallery Screen
export default function GalleryScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await apiFetch<EventsResponse>("/users/me/events");
        const loaded = await Promise.all(
          response.events.map((event, index) => loadGallery(event, index))
        );
        if (!cancelled) {
          setGalleries(loaded);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load galleries."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={c.statusBar} />
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR EVENTS</Text>
            <Text style={styles.title}>Galleries</Text>
          </View>
          <TouchableOpacity style={styles.searchBtn}>
            <Ionicons name="search" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>{galleries.length} saved events</Text>

        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            <View style={styles.row}>
              {galleries.map((gallery) => (
                <GalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  onPress={() => setSelectedGallery(gallery)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {selectedGallery && (
          <GalleryDetail
            gallery={selectedGallery}
            onClose={() => setSelectedGallery(null)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 4,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "700",
      color: c.accent,
      letterSpacing: 2.5,
      marginBottom: 4,
    },
    title: {
      fontSize: 32,
      fontWeight: "800",
      color: c.textBright,
      letterSpacing: -1,
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    },
    searchBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: c.textFaint,
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    errorText: {
      color: c.danger,
      textAlign: "center",
      marginTop: 40,
      paddingHorizontal: 24,
    },
    grid: { paddingHorizontal: 20, paddingBottom: 24 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  });
