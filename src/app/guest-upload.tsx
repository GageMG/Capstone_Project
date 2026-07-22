import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { apiFetch, apiUpload } from "@/lib/api";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

type Guest = { guest_id: number; display_name: string };
type GuestSessionResponse = { guest: Guest };
type UploadResponse = { uploaded: number; results?: Array<{ error?: string }> };
type QRValidationResponse = { valid: boolean; event_name?: string | null };
type PickedPhoto = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
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
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mimeFor(mimeType: string | null | undefined, name: string) {
  if (mimeType?.startsWith("image/")) return mimeType;
  const extension = name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
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
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(eventId) || eventId <= 0 || !qrToken) {
      setValidationError("This QR link is missing its event information.");
      setValidating(false);
      return;
    }
    apiFetch<QRValidationResponse>(
      "/qr/validate",
      { event_id: eventId, token: qrToken },
      "POST"
    )
      .then((response) => setEventName(response.event_name ?? null))
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
      const response = await apiFetch<GuestSessionResponse>(
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

  const choosePhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo-library access to choose images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.85,
    });
    if (result.canceled) return;
    const picked = result.assets.flatMap((asset, index) => {
      const name = asset.fileName ?? `guest_photo_${Date.now()}_${index}.jpg`;
      const mimeType = mimeFor(asset.mimeType, name);
      return mimeType
        ? [
            {
              id: `${Date.now()}-${index}`,
              uri: asset.uri,
              name,
              mimeType,
              file: asset.file ?? undefined,
            },
          ]
        : [];
    });
    setPhotos(picked);
  };

  const upload = async () => {
    if (!guest || photos.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("eventID", String(eventId));
      form.append("qrToken", qrToken);
      form.append("guestID", String(guest.guest_id));
      for (const photo of photos) {
        if (Platform.OS === "web") {
          let file: Blob;
          if (photo.file) {
            file = photo.file;
          } else {
            const response = await fetch(photo.uri);
            if (!response.ok) throw new Error(`Could not read ${photo.name}.`);
            const blob = await response.blob();
            if (!blob) throw new Error(`Could not read ${photo.name}.`);
            file = blob;
          }
          form.append("files", file, photo.name);
        } else {
          form.append("files", {
            uri: photo.uri,
            name: photo.name,
            type: photo.mimeType,
          } as any);
        }
      }
      const result = await apiUpload<UploadResponse>("/upload/guest", form);
      if (result.uploaded < 1) {
        throw new Error(
          result.results?.find((item) => item.error)?.error ??
            "The server did not accept any photos."
        );
      }
      setPhotos([]);
      Alert.alert(
        "Upload complete",
        `${result.uploaded} photo${result.uploaded === 1 ? "" : "s"} added to the event.`
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
          <Text style={styles.title}>Share your photos</Text>
          <Text style={styles.subtitle}>
            Join {eventName ?? "this event"} and add photos to its gallery.
          </Text>

          {validating ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
          ) : validationError ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : !guest ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Join this event</Text>
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
              <Text style={styles.cardCopy}>Choose up to 20 photos from your device.</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => void choosePhotos()}>
                <Ionicons name="images-outline" size={22} color={c.accent} />
                <Text style={styles.pickerText}>
                  {photos.length ? `${photos.length} selected` : "Choose photos"}
                </Text>
              </TouchableOpacity>
              {photos.length > 0 ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                    {photos.map((photo) => (
                      <Image key={photo.id} source={{ uri: photo.uri }} style={styles.preview} />
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
                      <Text style={styles.primaryText}>UPLOAD PHOTOS</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    card: { width: "100%", maxWidth: 540, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, padding: 20 },
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
  });
