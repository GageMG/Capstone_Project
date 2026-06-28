import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

export default function CameraWebFallback() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <Ionicons name="camera-outline" size={36} color={c.textFaint} />
      </View>
      <Text style={styles.title}>Camera Unavailable</Text>
      <Text style={styles.body}>
        The camera feature is only available on iOS and Android devices.
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    iconRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: c.textFaint,
      letterSpacing: -0.5,
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
      marginBottom: 10,
      textAlign: "center",
    },
    body: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 21,
    },
  });
