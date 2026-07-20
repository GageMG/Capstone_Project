import { Stack } from "expo-router";
import { View } from "react-native";
import { AuthProvider } from "@/lib/AuthContext";
import { CurrentEventProvider } from "@/lib/CurrentEventContext";
import { ThemeProvider } from "@/theme/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrentEventProvider>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </CurrentEventProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
