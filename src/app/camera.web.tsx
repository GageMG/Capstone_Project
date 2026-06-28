import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

export default function CameraWebFallback() {
  return (
    <View style={styles.container}>
      <View style={styles.iconRing}>
        <Ionicons name="camera-outline" size={36} color="#3B4A62" />
      </View>
      <Text style={styles.title}>Camera Unavailable</Text>
      <Text style={styles.body}>
        The camera feature is only available on iOS and Android devices.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#161C27",
    borderWidth: 1.5,
    borderColor: "#1E2A40",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3B4A62",
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#2A3A55",
    textAlign: "center",
    lineHeight: 21,
  },
});
