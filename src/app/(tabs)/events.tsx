import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FormModal, { FormField } from "@/components/FormModal";
import { apiFetch } from "@/lib/api";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

type EventRecord = {
  event_id: number;
  user_id: number;
  name: string;
  type: string;
  event_date: string;
  location_id: number | null;
  status: "active" | "inactive" | "completed" | "cancelled" | "hide";
  uploads_enabled: boolean;
  upload_limit: number | null;
  created_at: string;
  last_updated: string;
};

type EventsResponse = { events: EventRecord[] };
type EventResponse = { event: EventRecord };
type QRResponse = {
  qr_image_url: string;
  scan_url: string;
  expires_at?: string;
};
type LocationRecord = {
  venue_name: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};
type LocationResponse = { location: LocationRecord };
type CreateEventResponse = {
  data: { event: EventRecord; location: LocationRecord };
  qr_code: QRResponse | null;
  qr_error?: string | null;
};

const CREATE_EVENT_FIELDS: FormField[] = [
  { key: "name", label: "Event name", placeholder: "Sarah's Wedding", autoCapitalize: "words" },
  { key: "type", label: "Event type", placeholder: "Wedding, birthday, graduation", autoCapitalize: "words" },
  { key: "event_date", label: "Date", placeholder: "MM/DD/YYYY", autoCapitalize: "none" },
  { key: "password", label: "Guest password", placeholder: "Guest password", secure: true },
  { key: "venue_name", label: "Venue", placeholder: "Venue name", autoCapitalize: "words" },
  { key: "street", label: "Street", placeholder: "123 Main St", autoCapitalize: "words" },
  { key: "city", label: "City", placeholder: "City", autoCapitalize: "words" },
  { key: "state", label: "State", placeholder: "MI", autoCapitalize: "characters" },
  { key: "zip", label: "ZIP code", placeholder: "48309", keyboardType: "number-pad" },
];

function parseEventDate(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function displayTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function locationLabel(
  location: LocationRecord | null | undefined,
  locationId: number | null
) {
  if (!location) return locationId === null ? "Not assigned" : `Location ${locationId}`;
  return [
    location.venue_name,
    location.street,
    [location.city, location.state].filter(Boolean).join(", "),
    location.zip,
  ]
    .filter(Boolean)
    .join(" · ");
}

function EventDetail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={c.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function EditEventModal({
  event,
  onClose,
  onSaved,
}: {
  event: EventRecord | null;
  onClose: () => void;
  onSaved: (event: EventRecord) => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<EventRecord["status"]>("active");
  const [uploadsEnabled, setUploadsEnabled] = useState(true);
  const [uploadLimit, setUploadLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setName(event.name);
    setType(event.type);
    setDate(event.event_date.slice(0, 10));
    setStatus(event.status);
    setUploadsEnabled(event.uploads_enabled);
    setUploadLimit(event.upload_limit === null ? "" : String(event.upload_limit));
  }, [event]);

  const save = async () => {
    if (!event || !name.trim() || !type.trim() || !date.trim()) {
      Alert.alert("Missing details", "Name, type, and date are required.");
      return;
    }
    const parsedLimit = uploadLimit.trim() === "" ? null : Number(uploadLimit);
    if (parsedLimit !== null && (!Number.isInteger(parsedLimit) || parsedLimit < 0)) {
      Alert.alert("Invalid upload limit", "Enter a whole number of zero or greater.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<EventResponse>(
        `/events/modify/${event.event_id}`,
        {
          name: name.trim(),
          type: type.trim(),
          event_date: `${date.trim()}T00:00:00`,
          status,
          uploads_enabled: uploadsEnabled,
          ...(parsedLimit === null ? {} : { upload_limit: parsedLimit }),
        },
        "PATCH"
      );
      onSaved(result.event);
      onClose();
    } catch (caught) {
      Alert.alert("Could not save event", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={Boolean(event)} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit event</Text>
              <Text style={styles.modalSubtitle}>Changes are saved to this event.</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={21} color={c.textBright} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>EVENT NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={c.textMuted} autoCorrect={false} />
            <Text style={styles.inputLabel}>TYPE</Text>
            <TextInput style={styles.input} value={type} onChangeText={setType} placeholderTextColor={c.textMuted} autoCorrect={false} />
            <Text style={styles.inputLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-07-20" placeholderTextColor={c.textMuted} autoCorrect={false} />
            <Text style={styles.inputLabel}>STATUS</Text>
            <View style={styles.statusWrap}>
              {(["active", "inactive", "completed", "cancelled", "hide"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.statusChip, status === option && styles.statusChipSelected]}
                  onPress={() => setStatus(option)}
                >
                  <Text style={[styles.statusChipText, status === option && styles.statusChipTextSelected]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Allow uploads</Text>
                <Text style={styles.modalSubtitle}>Guests can add media to this event.</Text>
              </View>
              <Switch value={uploadsEnabled} onValueChange={setUploadsEnabled} />
            </View>
            <Text style={styles.inputLabel}>UPLOAD LIMIT</Text>
            <TextInput style={styles.input} value={uploadLimit} onChangeText={setUploadLimit} keyboardType="number-pad" placeholder="No change" placeholderTextColor={c.textMuted} />
          </ScrollView>
          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={() => void save()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>SAVE EVENT</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function QRModal({
  event,
  onClose,
}: {
  event: EventRecord | null;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [qr, setQr] = useState<QRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setImageError(false);
    if (!event) return;

    setLoading(true);
    apiFetch<QRResponse>(`/events/${event.event_id}/qr`)
      .then((response) => {
        if (!cancelled) setQr(response);
      })
      .catch(() => {
        // A missing active code is expected for older events.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event]);

  const generate = async () => {
    if (!event) return;
    setLoading(true);
    try {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + 7);
      const result = await apiFetch<QRResponse>(
        "/qr/generate",
        {
          event_id: event.event_id,
          expires_at: expiration.toISOString(),
          max_uploads:
            event.upload_limit && event.upload_limit > 0
              ? event.upload_limit
              : 50,
          purpose: "guests",
          is_active: true,
        },
        "POST"
      );
      setQr(result);
      setImageError(false);
    } catch (caught) {
      Alert.alert("Could not generate QR code", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={Boolean(event)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.qrCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Guest QR code</Text>
              <Text style={styles.modalSubtitle}>
                {event?.name} · {qr ? "active guest code" : "valid for 7 days"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={21} color={c.textBright} />
            </TouchableOpacity>
          </View>
          {qr ? (
            <>
              {imageError ? (
                <View style={styles.qrEmpty}>
                  <Ionicons name="image-outline" size={54} color={c.danger} />
                  <Text style={styles.qrEmptyText}>
                    The QR image could not be loaded. Generate a new code and try again.
                  </Text>
                </View>
              ) : (
                <View style={styles.qrImageWrap}>
                  <Image
                    source={{ uri: qr.qr_image_url }}
                    style={styles.qrImage}
                    resizeMode="contain"
                    onError={() => setImageError(true)}
                  />
                </View>
              )}
              <Text style={styles.scanUrl} selectable>{qr.scan_url}</Text>
            </>
          ) : (
            <View style={styles.qrEmpty}>
              <Ionicons name="qr-code-outline" size={72} color={c.textFaint} />
              <Text style={styles.qrEmptyText}>Generate a code guests can scan to join and upload.</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} disabled={loading} onPress={() => void generate()}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{qr ? "RECREATE QR CODE" : "GENERATE QR CODE"}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EventsScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [locations, setLocations] = useState<Record<number, LocationRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [qrEvent, setQrEvent] = useState<EventRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setError(null);
      const result = await apiFetch<EventsResponse>("/users/me/events");
      const loadedEvents = result.events ?? [];
      setEvents(loadedEvents);
      const locationEntries = await Promise.all(
        loadedEvents
          .filter((event) => event.location_id !== null)
          .map(async (event) => {
            try {
              const response = await apiFetch<LocationResponse>(
                `/locations/${event.location_id}`
              );
              return [event.location_id as number, response.location] as const;
            } catch {
              return null;
            }
          })
      );
      setLocations(
        Object.fromEntries(
          locationEntries.filter(
            (entry): entry is readonly [number, LocationRecord] => entry !== null
          )
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Events could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const createEvent = async (values: Record<string, string>) => {
    const eventDate = parseEventDate(values.event_date);
    if (!eventDate) {
      Alert.alert("Invalid date", "Enter the event date as MM/DD/YYYY.");
      return;
    }
    setCreating(true);
    try {
      const response = await apiFetch<CreateEventResponse>(
        "/events/create",
        {
          event: {
            user_id: 0,
            name: values.name,
            type: values.type,
            event_date: eventDate,
            password: values.password,
            uploads_enabled: true,
            upload_limit: 50,
          },
          location: {
            venue_name: values.venue_name,
            street: values.street,
            city: values.city,
            state: values.state,
            zip: values.zip,
            searchable: false,
          },
        },
        "POST"
      );
      setCreateOpen(false);
      await loadEvents();
      Alert.alert(
        "Event created",
        response.qr_code
          ? "The event and its guest QR code are ready."
          : `The event was created, but its QR code needs to be recreated.${
              response.qr_error ? ` ${response.qr_error}` : ""
            }`
      );
    } catch (caught) {
      Alert.alert(
        "Could not create event",
        caught instanceof Error ? caught.message : "Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={c.statusBar} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MANAGE</Text>
          <Text style={styles.title}>Events</Text>
        </View>
        <TouchableOpacity style={styles.addEventButton} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={21} color="#fff" />
          <Text style={styles.addEventText}>New event</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 42 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.accent} onRefresh={() => { setRefreshing(true); void loadEvents(); }} />}
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!error && events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color={c.textFaint} />
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.modalSubtitle}>Create an event from the account screen to manage it here.</Text>
            </View>
          ) : null}
          {events.map((event) => (
            <View key={event.event_id} style={styles.eventCard}>
              <View style={styles.eventTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventMeta}>{event.type} · {displayDate(event.event_date)}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{event.status}</Text>
                </View>
              </View>
              <View style={styles.eventInfo}>
                <EventDetail icon="calendar-outline" label="Date" value={displayDate(event.event_date)} />
                <EventDetail icon="pricetag-outline" label="Type" value={event.type} />
                <EventDetail
                  icon="location-outline"
                  label="Location"
                  value={locationLabel(locations[event.location_id ?? -1], event.location_id)}
                />
                <EventDetail
                  icon={event.uploads_enabled ? "cloud-upload-outline" : "cloud-offline-outline"}
                  label="Guest uploads"
                  value={`${event.uploads_enabled ? "Enabled" : "Disabled"} · ${
                    event.upload_limit === null || event.upload_limit === 0
                      ? "No limit"
                      : `Limit ${event.upload_limit}`
                  }`}
                />
                <EventDetail
                  icon="time-outline"
                  label="Last updated"
                  value={displayTimestamp(event.last_updated)}
                />
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.smallButton} onPress={() => setEditing(event)}>
                  <Ionicons name="create-outline" size={17} color={c.textPrimary} />
                  <Text style={styles.smallButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallButton} onPress={() => setQrEvent(event)}>
                  <Ionicons name="qr-code-outline" size={17} color={c.textPrimary} />
                  <Text style={styles.smallButtonText}>QR code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, styles.galleryButton]}
                  onPress={() => router.push({ pathname: "/event/[id]", params: { id: String(event.event_id) } })}
                >
                  <Ionicons name="images-outline" size={17} color="#fff" />
                  <Text style={[styles.smallButtonText, { color: "#fff" }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <EditEventModal
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => setEvents((current) => current.map((item) => item.event_id === saved.event_id ? saved : item))}
      />
      <QRModal event={qrEvent} onClose={() => setQrEvent(null)} />
      <FormModal
        visible={createOpen}
        title="Create event"
        subtitle="A guest QR code will be created automatically."
        fields={CREATE_EVENT_FIELDS}
        submitLabel="CREATE EVENT"
        submitting={creating}
        onClose={() => setCreateOpen(false)}
        onSubmit={createEvent}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 14 },
    eyebrow: { color: c.accent, fontSize: 10, fontWeight: "700", letterSpacing: 2.5, marginBottom: 4 },
    title: { color: c.textBright, fontSize: 32, fontWeight: "800", letterSpacing: -1, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
    addEventButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.accentStrong, borderRadius: 12, paddingHorizontal: 13, height: 42 },
    addEventText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    content: { padding: 20, paddingBottom: 36, gap: 14 },
    eventCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 17, padding: 16 },
    eventTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    eventName: { color: c.textBright, fontSize: 18, fontWeight: "700" },
    eventMeta: { color: c.textMuted, marginTop: 4, fontSize: 12, textTransform: "capitalize" },
    statusBadge: { borderRadius: 20, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 5 },
    statusBadgeText: { color: c.accent, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
    eventInfo: { marginTop: 15, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 5 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    detailLabel: { color: c.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
    detailValue: { color: c.textPrimary, fontSize: 13, marginTop: 2 },
    buttonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    smallButton: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: c.border, borderRadius: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
    galleryButton: { backgroundColor: c.accentStrong, borderColor: c.accentStrong },
    smallButtonText: { color: c.textPrimary, fontWeight: "600", fontSize: 12 },
    emptyCard: { alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 17, padding: 32 },
    emptyTitle: { color: c.textBright, fontWeight: "700", fontSize: 18, marginTop: 10, marginBottom: 4 },
    errorText: { color: c.danger, textAlign: "center", marginVertical: 30 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(5,8,16,0.76)", justifyContent: "center", padding: 22 },
    modalCard: { backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 22, maxHeight: "90%" },
    qrCard: { backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 22 },
    modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 },
    modalTitle: { color: c.textBright, fontSize: 23, fontWeight: "800", fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
    modalSubtitle: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
    closeButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
    inputLabel: { color: c.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.6, marginBottom: 7, marginTop: 10 },
    input: { height: 48, borderWidth: 1, borderColor: c.border, borderRadius: 11, backgroundColor: c.bg, color: c.textPrimary, paddingHorizontal: 13 },
    statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    statusChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
    statusChipSelected: { backgroundColor: c.accentStrong, borderColor: c.accentStrong },
    statusChipText: { color: c.textMuted, fontSize: 11, textTransform: "capitalize" },
    statusChipTextSelected: { color: "#fff", fontWeight: "700" },
    switchRow: { flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 5 },
    switchTitle: { color: c.textPrimary, fontSize: 15, fontWeight: "600" },
    primaryButton: { height: 52, borderRadius: 12, backgroundColor: c.accentStrong, alignItems: "center", justifyContent: "center", marginTop: 20 },
    primaryButtonText: { color: "#fff", fontWeight: "800", letterSpacing: 1.8, fontSize: 12 },
    disabled: { opacity: 0.6 },
    qrImageWrap: { alignSelf: "center", width: 230, height: 230, backgroundColor: "#fff", padding: 10, borderRadius: 14 },
    qrImage: { width: "100%", height: "100%" },
    scanUrl: { color: c.textMuted, fontSize: 11, textAlign: "center", marginTop: 12 },
    qrEmpty: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 20 },
    qrEmptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 12 },
  });
