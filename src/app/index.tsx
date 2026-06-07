import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // Handle login logic here
    console.log("Login pressed", { username, password });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background geometric shapes */}
      <View style={styles.bgCircleLarge} />
      <View style={styles.bgCircleSmall} />
      <View style={styles.bgAccentLine} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logoMark}>◆</Text>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>⌂</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#8891A4"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password / Sign In */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>⚿</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#8891A4"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>LOG IN</Text>
            <Text style={styles.loginArrow}>→</Text>
          </TouchableOpacity>

          {/* Bottom Links Row */}
          <View style={styles.linksRow}>
            <TouchableOpacity style={styles.linkButton} activeOpacity={0.7}>
              <Text style={styles.linkText}>Create Account</Text>
              <View style={styles.linkUnderline} />
            </TouchableOpacity>

            <View style={styles.linkDivider} />

            <TouchableOpacity style={styles.linkButton} activeOpacity={0.7}>
              <Text style={styles.linkText}>Create Event</Text>
              <View style={styles.linkUnderline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          By signing in you agree to our{" "}
          <Text style={styles.footerLink}>Terms & Privacy</Text>
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
    overflow: "hidden",
  },

  // Background decorative elements
  bgCircleLarge: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "#1A2F5A",
    top: -160,
    right: -120,
    opacity: 0.6,
  },
  bgCircleSmall: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#0E4DA4",
    bottom: 80,
    left: -80,
    opacity: 0.25,
  },
  bgAccentLine: {
    position: "absolute",
    width: 2,
    height: 260,
    backgroundColor: "#2563EB",
    top: 120,
    left: 28,
    opacity: 0.3,
    borderRadius: 2,
  },

  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
  },

  // Header
  header: {
    marginBottom: 36,
    paddingLeft: 4,
  },
  logoMark: {
    fontSize: 22,
    color: "#2563EB",
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#F0F4FF",
    letterSpacing: -1.2,
    lineHeight: 44,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  subtitle: {
    fontSize: 15,
    color: "#5A6A85",
    marginTop: 6,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },

  // Card
  card: {
    backgroundColor: "#161C27",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "#1E2A40",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16,
  },

  // Fields
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3B82F6",
    letterSpacing: 1.8,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1117",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#1E2A40",
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 16,
    color: "#3B4A62",
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: "#E8EDF8",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },

  // Login Button
  loginButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 28,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    gap: 10,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2.5,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },
  loginArrow: {
    fontSize: 18,
    color: "#93C5FD",
  },

  // Bottom Links
  linksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  linkButton: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 13.5,
    color: "#93C5FD",
    fontWeight: "600",
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },
  linkUnderline: {
    height: 1,
    backgroundColor: "#2563EB",
    marginTop: 3,
    width: "100%",
    opacity: 0.5,
  },
  linkDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#1E2A40",
  },

  // Footer
  footerText: {
    textAlign: "center",
    color: "#3B4A62",
    fontSize: 12,
    marginTop: 32,
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif",
  },
  footerLink: {
    color: "#4B6A9B",
    fontWeight: "600",
  },
});
