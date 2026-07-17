import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

type GeneratedVideoPlayerProps = {
  streamUrl: string;
};

export default function GeneratedVideoPlayer({
  streamUrl,
}: GeneratedVideoPlayerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const player = useVideoPlayer(
    {
      uri: streamUrl,
      useCaching: Platform.OS !== "web",
    },
    (videoPlayer) => {
      videoPlayer.loop = false;
    }
  );
  const { error } = useEvent(player, "statusChange", {
    status: player.status,
  });

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        playsInline
        crossOrigin="anonymous"
        fullscreenOptions={{ enable: true }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error.message || "The video could not be played."}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: "100%",
      maxWidth: 1100,
      alignSelf: "center",
      gap: 12,
    },
    video: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: "#000",
      borderRadius: 16,
      overflow: "hidden",
    },
    error: {
      color: colors.danger,
      textAlign: "center",
      paddingHorizontal: 16,
    },
  });
