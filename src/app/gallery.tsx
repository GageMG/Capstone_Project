import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// ─── Sample Data
const GALLERIES = [
  {
    id: "1",
    title: "Summer Gala 2024",
    date: "Aug 14, 2024",
    photoCount: 48,
    coverColor: "#1A3A6B",
    accentColor: "#3B82F6",
    photos: [
      { id: "p1", uri: "https://picsum.photos/seed/gala1/400/400" },
      { id: "p2", uri: "https://picsum.photos/seed/gala2/400/400" },
      { id: "p3", uri: "https://picsum.photos/seed/gala3/400/400" },
      { id: "p4", uri: "https://picsum.photos/seed/gala4/400/400" },
      { id: "p5", uri: "https://picsum.photos/seed/gala5/400/400" },
      { id: "p6", uri: "https://picsum.photos/seed/gala6/400/400" },
    ],
  },
  {
    id: "2",
    title: "Product Launch",
    date: "Oct 3, 2024",
    photoCount: 31,
    coverColor: "#1A4A3A",
    accentColor: "#10B981",
    photos: [
      { id: "p1", uri: "https://picsum.photos/seed/launch1/400/400" },
      { id: "p2", uri: "https://picsum.photos/seed/launch2/400/400" },
      { id: "p3", uri: "https://picsum.photos/seed/launch3/400/400" },
      { id: "p4", uri: "https://picsum.photos/seed/launch4/400/400" },
    ],
  },
  {
    id: "3",
    title: "Annual Conference",
    date: "Nov 18, 2024",
    photoCount: 76,
    coverColor: "#3A1A4A",
    accentColor: "#A855F7",
    photos: [
      { id: "p1", uri: "https://picsum.photos/seed/conf1/400/400" },
      { id: "p2", uri: "https://picsum.photos/seed/conf2/400/400" },
      { id: "p3", uri: "https://picsum.photos/seed/conf3/400/400" },
      { id: "p4", uri: "https://picsum.photos/seed/conf4/400/400" },
      { id: "p5", uri: "https://picsum.photos/seed/conf5/400/400" },
    ],
  },
  {
    id: "4",
    title: "Team Retreat",
    date: "Dec 5, 2024",
    photoCount: 22,
    coverColor: "#4A2A1A",
    accentColor: "#F59E0B",
    photos: [
      { id: "p1", uri: "https://picsum.photos/seed/retreat1/400/400" },
      { id: "p2", uri: "https://picsum.photos/seed/retreat2/400/400" },
      { id: "p3", uri: "https://picsum.photos/seed/retreat3/400/400" },
    ],
  },
];

type Gallery = (typeof GALLERIES)[0];
type Photo = { id: string; uri: string };

// ─── Photo Lightbox
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

        {/* Close */}
        <TouchableOpacity style={lb.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={26} color="#F0F4FF" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={lb.counter}>
          <Text style={lb.counterText}>
            {current + 1} / {photos.length}
          </Text>
        </View>

        {/* Photo */}
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

        {/* Dot indicators */}
        <View style={lb.dots}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[lb.dot, i === current && lb.dotActive]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050810",
    justifyContent: "center",
  },
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
  counterText: {
    color: "#F0F4FF",
    fontSize: 13,
    fontWeight: "600",
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
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
  dotActive: {
    backgroundColor: "#3B82F6",
    width: 18,
  },
});

// ─── Gallery Detail Modal
function GalleryDetail({
  gallery,
  onClose,
}: {
  gallery: Gallery;
  onClose: () => void;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const numCols = 3;
  const cellSize = (SCREEN_WIDTH - 4) / numCols;

  return (
    <Modal visible animationType="slide">
      <View style={gd.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <SafeAreaView>
          <View style={gd.header}>
            <TouchableOpacity onPress={onClose} style={gd.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#F0F4FF" />
            </TouchableOpacity>
            <View style={gd.headerText}>
              <Text style={gd.title}>{gallery.title}</Text>
              <Text style={gd.meta}>
                {gallery.date} · {gallery.photoCount} photos
              </Text>
            </View>
            <View
              style={[gd.accentDot, { backgroundColor: gallery.accentColor }]}
            />
          </View>
        </SafeAreaView>

        {/* Divider */}
        <View style={[gd.divider, { backgroundColor: gallery.accentColor }]} />

        {/* Grid */}
        <FlatList
          data={gallery.photos}
          numColumns={numCols}
          keyExtractor={(item) => item.id}
          contentContainerStyle={gd.grid}
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

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <Lightbox
            photos={gallery.photos}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </View>
    </Modal>
  );
}

const gd = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1117" },
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
    backgroundColor: "#161C27",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F0F4FF",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 12,
    color: "#5A6A85",
    marginTop: 2,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  divider: {
    height: 2,
    marginHorizontal: 16,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 2,
  },
  grid: { gap: 2 },
  cell: { overflow: "hidden" },
  cellImage: { width: "100%", height: "100%" },
  cellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,17,23,0.1)",
  },
});

// ─── Gallery Card ────────────────────────────────────────────────────────────
function GalleryCard({
  gallery,
  onPress,
}: {
  gallery: Gallery;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[gc.card, { width: CARD_WIDTH }]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      {/* Cover */}
      <View style={[gc.cover, { backgroundColor: gallery.coverColor }]}>
        <Image
          source={{ uri: gallery.photos[0]?.uri }}
          style={gc.coverImage}
          resizeMode="cover"
        />
        {/* Photo count badge */}
        <View style={[gc.badge, { backgroundColor: gallery.accentColor }]}>
          <Ionicons name="images" size={10} color="#fff" />
          <Text style={gc.badgeText}>{gallery.photoCount}</Text>
        </View>
        {/* Accent bar */}
        <View style={[gc.accentBar, { backgroundColor: gallery.accentColor }]} />
      </View>

      {/* Info */}
      <View style={gc.info}>
        <Text style={gc.cardTitle} numberOfLines={1}>
          {gallery.title}
        </Text>
        <Text style={gc.cardDate}>{gallery.date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const gc = StyleSheet.create({
  card: {
    backgroundColor: "#161C27",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E2A40",
  },
  cover: {
    height: CARD_WIDTH * 0.75,
    width: "100%",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  accentBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.7,
  },
  info: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E8EDF8",
    letterSpacing: -0.2,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  cardDate: {
    fontSize: 11,
    color: "#5A6A85",
    marginTop: 2,
  },
});

// ─── Gallery Screen ──────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR EVENTS</Text>
            <Text style={styles.title}>Galleries</Text>
          </View>
          <TouchableOpacity style={styles.searchBtn}>
            <Ionicons name="search" size={20} color="#5A6A85" />
          </TouchableOpacity>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {GALLERIES.length} saved events
        </Text>

        {/* Grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          <View style={styles.row}>
            {GALLERIES.map((gallery) => (
              <GalleryCard
                key={gallery.id}
                gallery={gallery}
                onPress={() => setSelectedGallery(gallery)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Detail modal */}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
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
    color: "#3B82F6",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F0F4FF",
    letterSpacing: -1,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#161C27",
    borderWidth: 1,
    borderColor: "#1E2A40",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#3B4A62",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  grid: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
