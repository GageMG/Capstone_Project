import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import GeneratedVideoPlayer from "@/components/GeneratedVideoPlayer";
import { apiPublicFetch, apiPublicUpload } from "@/lib/api";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

type Guest = { guest_id: number; display_name: string };
type GuestSessionResponse = { guest: Guest };
type UploadResponse = { uploaded: number; results?: Array<{ error?: string; reason?: string }> };
type QRValidationResponse = {
  valid: boolean;
  event_name?: string | null;
  can_upload?: boolean;
  upload_reason?: string | null;
};
type GuestAlbumPhoto = {
  id: number;
  display_url: string;
  nudity_check?: boolean | string | null;
};
type GuestAlbumVideo = {
  id: number;
  display_url: string;
  title?: string | null;
  duration_seconds?: number | null;
  status?: string | null;
};
type GuestAlbumResponse = {
  photos: GuestAlbumPhoto[];
  videos?: GuestAlbumVideo[];
  next_offset: number;
  has_more_photos: boolean;
  has_more_videos?: boolean;
};
type PickedMedia = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  mediaType: "photo" | "video";
  file?: File;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mkv: "video/x-matroska",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mimeFor(mimeType: string | null | undefined, name: string) {
  if (mimeType && Object.values(MIME_BY_EXTENSION).includes(mimeType)) return mimeType;
  const extension = name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
}

function isSensitivePhoto(value: boolean | string | null | undefined) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function formatDuration(value: number | null | undefined) {
  if (!value || value < 1) return null;
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function GuestUploadScreen() {
  const params = useLocalSearchParams<{
    eventID?: string | string[];
    qrToken?: string | string[];
  }>();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const eventId = Number(firstParam(params.eventID));
  const qrToken = firstParam(params.qrToken) ?? "";
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [joining, setJoining] = useState(false);
  const [mediaItems, setMediaItems] = useState<PickedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [canUpload, setCanUpload] = useState(true);
  const [uploadUnavailableReason, setUploadUnavailableReason] = useState<string | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<GuestAlbumPhoto[]>([]);
  const [albumVideos, setAlbumVideos] = useState<GuestAlbumVideo[]>([]);
  const [albumOffset, setAlbumOffset] = useState(0);
  const [albumHasMore, setAlbumHasMore] = useState(false);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [selectedAlbumPhoto, setSelectedAlbumPhoto] = useState<GuestAlbumPhoto | null>(null);
  const [selectedAlbumVideo, setSelectedAlbumVideo] = useState<GuestAlbumVideo | null>(null);

  async function loadAlbum(startOffset: number) {
    setAlbumLoading(true);
    setAlbumError(null);
    try {
      const response = await apiPublicFetch<GuestAlbumResponse>(
        `/events/${eventId}/guest-media?qrToken=${encodeURIComponent(qrToken)}&limit=60&offset=${startOffset}`
      );
      setAlbumPhotos((current) => {
        const combined = startOffset === 0 ? response.photos : [...current, ...response.photos];
        const unique = new Map(combined.map((photo) => [photo.id, photo]));
        return [...unique.values()];
      });
      setAlbumVideos((current) => {
        const videos = response.videos ?? [];
        const combined = startOffset === 0 ? videos : [...current, ...videos];
        const unique = new Map(combined.map((video) => [video.id, video]));
        return [...unique.values()];
      });
      setAlbumOffset(response.next_offset);
      setAlbumHasMore(response.has_more_photos || Boolean(response.has_more_videos));
    } catch (caught) {
      setAlbumError(
        caught instanceof Error ? caught.message : "The event album could not be loaded."
      );
    } finally {
      setAlbumLoading(false);
    }
  }

  const openAlbumPhoto = (photo: GuestAlbumPhoto) => {
    if (!isSensitivePhoto(photo.nudity_check)) {
      setSelectedAlbumPhoto(photo);
      return;
    }

    Alert.alert(
      "Sensitive photo",
      "This photo may contain nudity. Do you want to view it?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "View Photo", onPress: () => setSelectedAlbumPhoto(photo) },
      ]
    );
  };

  useEffect(() => {
    if (!Number.isInteger(eventId) || eventId <= 0 || !qrToken) {
      setValidationError("This QR link is missing its event information.");
      setValidating(false);
      return;
    }
    apiPublicFetch<QRValidationResponse>(
      "/qr/validate",
      { event_id: eventId, token: qrToken },
      "POST"
    )
      .then((response) => {
        setEventName(response.event_name ?? null);
        setCanUpload(response.can_upload !== false);
        setUploadUnavailableReason(response.upload_reason ?? null);
        void loadAlbum(0);
      })
      .catch((caught) => {
        setValidationError(
          caught instanceof Error ? caught.message : "This QR code is not valid."
        );
      })
      .finally(() => setValidating(false));
  }, [eventId, qrToken]);

  const join = async () => {
    if (!displayName.trim()) {
      Alert.alert("Name required", "Enter your name before continuing.");
      return;
    }
    setJoining(true);
    try {
      const response = await apiPublicFetch<GuestSessionResponse>(
        "/guests/session",
        {
          event_id: eventId,
          qr_token: qrToken,
          display_name: displayName.trim(),
          email: email.trim() || null,
          phone_number: phone.trim() || null,
        },
        "POST"
      );
      setGuest(response.guest);
    } catch (caught) {
      Alert.alert(
        "Could not join event",
        caught instanceof Error ? caught.message : "Please try again."
      );
    } finally {
      setJoining(false);
    }
  };

  const chooseMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow media-library access to choose photos and videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.85,
    });
    if (result.canceled) return;
    const picked: PickedMedia[] = result.assets.flatMap((asset, index) => {
      const initialName = asset.fileName ?? asset.uri;
      const mimeType = mimeFor(asset.mimeType, initialName);
      const extension = mimeType
        ? Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mimeType)?.[0]
        : null;
      const name = asset.fileName ?? `guest_media_${Date.now()}_${index}.${extension ?? "jpg"}`;
      return mimeType
        ? [
            {
              id: `${Date.now()}-${index}`,
              uri: asset.uri,
              name,
              mimeType,
              mediaType: mimeType.startsWith("video/") ? "video" : "photo",
              file: asset.file ?? undefined,
            },
          ]
        : [];
    });
    if (picked.length !== result.assets.length) {
      Alert.alert(
        "Unsupported files",
        "Allowed formats: JPG, JPEG, PNG, GIF, WebP, HEIC, HEIF, MP4, MOV, WebM, AVI, WMV, and MKV."
      );
    }
    setMediaItems(picked);
  };

  const upload = async () => {
    if (!guest || mediaItems.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("eventID", String(eventId));
      form.append("qrToken", qrToken);
      form.append("guestID", String(guest.guest_id));
      for (const item of mediaItems) {
        if (Platform.OS === "web") {
          let file: Blob;
          if (item.file) {
            file = item.file.type === item.mimeType
              ? item.file
              : item.file.slice(0, item.file.size, item.mimeType);
          } else {
            const response = await fetch(item.uri);
            if (!response.ok) throw new Error(`Could not read ${item.name}.`);
            const blob = await response.blob();
            file = blob.type === item.mimeType
              ? blob
              : blob.slice(0, blob.size, item.mimeType);
          }
          form.append("files", file, item.name);
        } else {
          form.append("files", {
            uri: item.uri,
            name: item.name,
            type: item.mimeType,
          } as any);
        }
      }
      const result = await apiPublicUpload<UploadResponse>("/upload/guest", form);
      if (result.uploaded < 1) {
        throw new Error(
          result.results?.find((item) => item.error || item.reason)?.error ??
            result.results?.find((item) => item.reason)?.reason ??
            "The server did not accept any files."
        );
      }
      setMediaItems([]);
      Alert.alert(
        "Upload complete",
        `${result.uploaded} file${result.uploaded === 1 ? "" : "s"} added to the event.`
      );
    } catch (caught) {
      Alert.alert(
        "Upload failed",
        caught instanceof Error ? caught.message : "Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={c.statusBar} />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}>
            <Ionicons name="images-outline" size={32} color="#fff" />
          </View>
          <Text style={styles.eyebrow}>EVENT GUEST</Text>
          <Text style={styles.title}>Event album</Text>
          <Text style={styles.subtitle}>
            View photos and videos from {eventName ?? "this event"} or contribute your own.
          </Text>

          {validating ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
          ) : validationError ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.albumHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Shared photos</Text>
                    <Text style={styles.cardCopy}>
                      {albumPhotos.length} photo{albumPhotos.length === 1 ? "" : "s"} loaded
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Refresh event album"
                    style={styles.refreshButton}
                    disabled={albumLoading}
                    onPress={() => void loadAlbum(0)}
                  >
                    <Ionicons name="refresh" size={19} color={c.accent} />
                  </TouchableOpacity>
                </View>

                {albumPhotos.length > 0 ? (
                  <View style={styles.albumGrid}>
                    {albumPhotos.map((photo) => {
                      const sensitive = isSensitivePhoto(photo.nudity_check);
                      return (
                        <TouchableOpacity
                          key={photo.id}
                          style={styles.albumTile}
                          activeOpacity={0.85}
                          onPress={() => openAlbumPhoto(photo)}
                        >
                          <Image
                            source={{ uri: photo.display_url }}
                            style={styles.albumImage}
                            resizeMode="cover"
                            blurRadius={sensitive ? 22 : 0}
                          />
                          {sensitive ? (
                            <View style={styles.sensitiveOverlay}>
                              <Ionicons name="eye-off-outline" size={18} color="#fff" />
                              <Text style={styles.sensitiveText}>Sensitive</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : albumLoading ? (
                  <ActivityIndicator color={c.accent} style={styles.albumStatus} />
                ) : albumError ? (
                  <View style={styles.albumStatus}>
                    <Text style={styles.errorText}>{albumError}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => void loadAlbum(0)}>
                      <Text style={styles.retryText}>TRY AGAIN</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.emptyAlbumText}>No approved photos are available yet.</Text>
                )}

                {albumHasMore ? (
                  <TouchableOpacity
                    style={[styles.loadMoreButton, albumLoading && styles.disabled]}
                    disabled={albumLoading}
                    onPress={() => void loadAlbum(albumOffset)}
                  >
                    {albumLoading ? (
                      <ActivityIndicator color={c.accent} />
                    ) : (
                      <Text style={styles.loadMoreText}>LOAD MORE MEDIA</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.albumHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Shared videos</Text>
                    <Text style={styles.cardCopy}>
                      {albumVideos.length} video{albumVideos.length === 1 ? "" : "s"} loaded
                    </Text>
                  </View>
                  <Ionicons name="videocam-outline" size={24} color={c.accent} />
                </View>

                {albumVideos.length > 0 ? (
                  <View style={styles.albumVideoList}>
                    {albumVideos.map((video) => {
                      const duration = formatDuration(video.duration_seconds);
                      return (
                        <TouchableOpacity
                          key={video.id}
                          style={styles.albumVideo}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Play ${video.title ?? "event video"}`}
                          onPress={() => setSelectedAlbumVideo(video)}
                        >
                          <View style={styles.albumVideoIcon}>
                            <Ionicons name="play" size={22} color="#fff" />
                          </View>
                          <View style={styles.albumVideoText}>
                            <Text style={styles.albumVideoTitle} numberOfLines={2}>
                              {video.title ?? "Event video"}
                            </Text>
                            <Text style={styles.albumVideoMeta}>
                              {[duration, video.status].filter(Boolean).join(" · ") || "Ready to play"}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : albumLoading ? (
                  <ActivityIndicator color={c.accent} style={styles.albumStatus} />
                ) : albumError ? (
                  <Text style={styles.errorText}>{albumError}</Text>
                ) : (
                  <Text style={styles.emptyAlbumText}>No uploaded videos are available yet.</Text>
                )}
              </View>

              {canUpload ? (
                !guest ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Add photos or videos</Text>
                    <Text style={styles.cardCopy}>No account required. Enter a display name to continue.</Text>
                    <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                    <TextInput
                      style={styles.input}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Your name"
                      placeholderTextColor={c.textMuted}
                      autoCapitalize="words"
                    />
                    <Text style={styles.inputLabel}>EMAIL (OPTIONAL)</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Text style={styles.inputLabel}>PHONE (OPTIONAL)</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Phone number"
                      placeholderTextColor={c.textMuted}
                      keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                      style={[styles.primaryButton, joining && styles.disabled]}
                      disabled={joining}
                      onPress={() => void join()}
                    >
                      {joining ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryText}>CONTINUE</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome, {guest.display_name}</Text>
                    <Text style={styles.cardCopy}>Choose up to 20 photos or videos from your device.</Text>
                    <TouchableOpacity style={styles.pickerButton} onPress={() => void chooseMedia()}>
                      <Ionicons name="images-outline" size={22} color={c.accent} />
                      <Text style={styles.pickerText}>
                        {mediaItems.length ? `${mediaItems.length} selected` : "Choose photos or videos"}
                      </Text>
                    </TouchableOpacity>
                    {mediaItems.length > 0 ? (
                      <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                          {mediaItems.map((item) => (
                            item.mediaType === "video" ? (
                              <View key={item.id} style={styles.videoPreview}>
                                <Ionicons name="videocam" size={28} color={c.accent} />
                                <Text style={styles.videoPreviewName} numberOfLines={2}>{item.name}</Text>
                              </View>
                            ) : (
                              <Image key={item.id} source={{ uri: item.uri }} style={styles.preview} />
                            )
                          ))}
                        </ScrollView>
                        <TouchableOpacity
                          style={[styles.primaryButton, uploading && styles.disabled]}
                          disabled={uploading}
                          onPress={() => void upload()}
                        >
                          {uploading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryText}>UPLOAD MEDIA</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                )
              ) : (
                <View style={styles.uploadClosedCard}>
                  <Ionicons name="cloud-offline-outline" size={26} color={c.textMuted} />
                  <View style={styles.uploadClosedText}>
                    <Text style={styles.cardTitle}>Uploads are closed</Text>
                    <Text style={styles.cardCopy}>
                      {uploadUnavailableReason ?? "This event is no longer accepting guest uploads."}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={selectedAlbumPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAlbumPhoto(null)}
      >
        <View style={styles.lightbox}>
          <TouchableOpacity
            style={styles.lightboxClose}
            accessibilityLabel="Close photo"
            onPress={() => setSelectedAlbumPhoto(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedAlbumPhoto ? (
            <Image
              source={{ uri: selectedAlbumPhoto.display_url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={selectedAlbumVideo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAlbumVideo(null)}
      >
        <View style={styles.videoLightbox}>
          <TouchableOpacity
            style={styles.lightboxClose}
            accessibilityLabel="Close video"
            onPress={() => setSelectedAlbumVideo(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedAlbumVideo ? (
            <View style={styles.videoPlayerWrap}>
              <Text style={styles.videoLightboxTitle} numberOfLines={2}>
                {selectedAlbumVideo.title ?? "Event video"}
              </Text>
              <GeneratedVideoPlayer
                key={selectedAlbumVideo.display_url}
                streamUrl={selectedAlbumVideo.display_url}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 22, paddingTop: 42, paddingBottom: 40 },
    heroIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: c.accentStrong, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    eyebrow: { color: c.accent, fontSize: 10, fontWeight: "800", letterSpacing: 2.5 },
    title: { color: c.textBright, fontSize: 30, fontWeight: "800", marginTop: 5, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
    subtitle: { color: c.textMuted, textAlign: "center", lineHeight: 20, marginTop: 8, marginBottom: 25 },
    card: { width: "100%", maxWidth: 540, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 20, marginBottom: 18 },
    cardTitle: { color: c.textBright, fontSize: 20, fontWeight: "700", marginBottom: 4 },
    cardCopy: { color: c.textMuted, marginBottom: 16 },
    inputLabel: { color: c.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginTop: 14, marginBottom: 7 },
    input: { height: 50, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.textPrimary, paddingHorizontal: 14 },
    primaryButton: { height: 52, borderRadius: 12, backgroundColor: c.accentStrong, alignItems: "center", justifyContent: "center", marginTop: 20 },
    primaryText: { color: "#fff", fontWeight: "800", letterSpacing: 1.7, fontSize: 12 },
    disabled: { opacity: 0.6 },
    errorCard: { width: "100%", maxWidth: 540, alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.danger, borderRadius: 16, padding: 22, backgroundColor: c.surface },
    errorText: { color: c.danger, textAlign: "center", lineHeight: 20 },
    pickerButton: { height: 62, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
    pickerText: { color: c.textPrimary, fontWeight: "700" },
    previewRow: { marginTop: 16 },
    preview: { width: 82, height: 82, borderRadius: 10, marginRight: 9, backgroundColor: c.bg },
    videoPreview: { width: 82, height: 82, borderRadius: 10, marginRight: 9, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 6, gap: 4 },
    videoPreviewName: { color: c.textMuted, fontSize: 9, textAlign: "center" },
    albumHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    refreshButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    albumTile: { width: "31.5%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: c.bg },
    albumImage: { width: "100%", height: "100%" },
    albumVideoList: { gap: 10 },
    albumVideo: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg },
    albumVideoIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.accentStrong },
    albumVideoText: { flex: 1 },
    albumVideoTitle: { color: c.textPrimary, fontWeight: "700", fontSize: 14 },
    albumVideoMeta: { color: c.textMuted, fontSize: 11, marginTop: 4, textTransform: "capitalize" },
    sensitiveOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.28)", gap: 4 },
    sensitiveText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    albumStatus: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 12 },
    emptyAlbumText: { color: c.textMuted, textAlign: "center", paddingVertical: 28 },
    retryButton: { borderRadius: 10, borderWidth: 1, borderColor: c.accent, paddingHorizontal: 18, paddingVertical: 10 },
    retryText: { color: c.accent, fontWeight: "800", fontSize: 11, letterSpacing: 1.2 },
    loadMoreButton: { height: 46, marginTop: 16, borderRadius: 11, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    loadMoreText: { color: c.accent, fontWeight: "800", fontSize: 11, letterSpacing: 1.2 },
    uploadClosedCard: { width: "100%", maxWidth: 540, flexDirection: "row", gap: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 20 },
    uploadClosedText: { flex: 1 },
    lightbox: { flex: 1, backgroundColor: "rgba(2,6,12,0.96)", alignItems: "center", justifyContent: "center" },
    lightboxClose: { position: "absolute", zIndex: 2, top: 24, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    lightboxImage: { width: "100%", height: "100%" },
    videoLightbox: { flex: 1, backgroundColor: "rgba(2,6,12,0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    videoPlayerWrap: { width: "100%", maxWidth: 1100, gap: 14 },
    videoLightboxTitle: { color: "#fff", fontSize: 18, fontWeight: "700", paddingRight: 56 },
  });
