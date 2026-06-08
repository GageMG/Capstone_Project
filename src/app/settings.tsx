import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Types 
type SettingToggleItem = {
  type: "toggle";
  id: string;
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

type SettingActionItem = {
  type: "action";
  id: string;
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value?: string;
  destructive?: boolean;
};

type SettingItem = SettingToggleItem | SettingActionItem;

type SettingSection = {
  title: string;
  items: SettingItem[];
};

// ─── Toggle Row
function ToggleRow({
  item,
  value,
  onChange,
}: {
  item: SettingToggleItem;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={row.container}>
      <View style={[row.iconBox, { backgroundColor: item.iconColor + "22" }]}>
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <View style={row.text}>
        <Text style={row.label}>{item.label}</Text>
        {item.description && (
          <Text style={row.description}>{item.description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#1E2A40", true: "#1D4ED8" }}
        thumbColor={value ? "#3B82F6" : "#3B4A62"}
        ios_backgroundColor="#1E2A40"
      />
    </View>
  );
}

// ─── Action Row
function ActionRow({
  item,
  onPress,
}: {
  item: SettingActionItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={row.container} onPress={onPress} activeOpacity={0.75}>
      <View style={[row.iconBox, { backgroundColor: item.iconColor + "22" }]}>
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <View style={row.text}>
        <Text style={[row.label, item.destructive && row.destructiveText]}>
          {item.label}
        </Text>
        {item.description && (
          <Text style={row.description}>{item.description}</Text>
        )}
      </View>
      <View style={row.right}>
        {item.value && <Text style={row.value}>{item.value}</Text>}
        {!item.destructive && (
          <Ionicons name="chevron-forward" size={16} color="#3B4A62" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: { flex: 1 },
  label: {
    fontSize: 15,
    color: "#E8EDF8",
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  destructiveText: {
    color: "#F87171",
  },
  description: {
    fontSize: 12,
    color: "#5A6A85",
    marginTop: 2,
    lineHeight: 16,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  value: {
    fontSize: 14,
    color: "#5A6A85",
  },
});

// ─── Section
function Section({
  section,
  toggleState,
  onToggle,
  onAction,
}: {
  section: SettingSection;
  toggleState: Record<string, boolean>;
  onToggle: (id: string, val: boolean) => void;
  onAction: (id: string) => void;
}) {
  return (
    <View style={sec.wrapper}>
      <Text style={sec.title}>{section.title}</Text>
      <View style={sec.card}>
        {section.items.map((item, idx) => (
          <View key={item.id}>
            {item.type === "toggle" ? (
              <ToggleRow
                item={item}
                value={toggleState[item.id] ?? false}
                onChange={(v) => onToggle(item.id, v)}
              />
            ) : (
              <ActionRow item={item} onPress={() => onAction(item.id)} />
            )}
            {idx < section.items.length - 1 && (
              <View style={sec.divider} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const sec = StyleSheet.create({
  wrapper: { marginBottom: 28 },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3B82F6",
    letterSpacing: 2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "#161C27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E2A40",
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "#1A2235",
    marginLeft: 62,
  },
});

// ─── Settings Data
const SECTIONS: SettingSection[] = [
  {
    title: "ACCOUNT",
    items: [
      {
        type: "action",
        id: "profile",
        label: "Edit Profile",
        description: "Update your name, photo, and bio",
        icon: "person-circle-outline",
        iconColor: "#3B82F6",
      },
      {
        type: "action",
        id: "password",
        label: "Change Password",
        description: "Update your login credentials",
        icon: "lock-closed-outline",
        iconColor: "#10B981",
      },
      {
        type: "action",
        id: "email",
        label: "Email Address",
        description: "Manage your email",
        icon: "mail-outline",
        iconColor: "#F59E0B",
        value: "user@email.com",
      },
    ],
  },
  {
    title: "NOTIFICATIONS",
    items: [
      {
        type: "toggle",
        id: "push",
        label: "Push Notifications",
        description: "Receive alerts for new events",
        icon: "notifications-outline",
        iconColor: "#3B82F6",
      },
      {
        type: "toggle",
        id: "email_notif",
        label: "Email Notifications",
        description: "Weekly digest of activity",
        icon: "mail-outline",
        iconColor: "#A855F7",
      },
      {
        type: "toggle",
        id: "new_photos",
        label: "New Photo Alerts",
        description: "When photos are added to your events",
        icon: "image-outline",
        iconColor: "#10B981",
      },
    ],
  },
  {
    title: "GALLERY",
    items: [
      {
        type: "toggle",
        id: "auto_download",
        label: "Auto-Download Photos",
        description: "Save photos to camera roll automatically",
        icon: "cloud-download-outline",
        iconColor: "#F59E0B",
      },
      {
        type: "toggle",
        id: "hq",
        label: "High Quality Uploads",
        description: "Uses more data",
        icon: "sparkles-outline",
        iconColor: "#3B82F6",
      },
      {
        type: "action",
        id: "storage",
        label: "Storage Used",
        icon: "server-outline",
        iconColor: "#5A6A85",
        value: "1.2 GB",
      },
    ],
  },
  {
    title: "APPEARANCE",
    items: [
      {
        type: "toggle",
        id: "dark_mode",
        label: "Dark Mode",
        icon: "moon-outline",
        iconColor: "#A855F7",
      },
      {
        type: "action",
        id: "language",
        label: "Language",
        icon: "language-outline",
        iconColor: "#10B981",
        value: "English",
      },
    ],
  },
  {
    title: "PRIVACY & SECURITY",
    items: [
      {
        type: "toggle",
        id: "two_factor",
        label: "Two-Factor Authentication",
        description: "Add an extra layer of security",
        icon: "shield-checkmark-outline",
        iconColor: "#10B981",
      },
      {
        type: "toggle",
        id: "private_profile",
        label: "Private Profile",
        description: "Only invited guests can view your events",
        icon: "eye-off-outline",
        iconColor: "#F59E0B",
      },
      {
        type: "action",
        id: "privacy_policy",
        label: "Privacy Policy",
        icon: "document-text-outline",
        iconColor: "#5A6A85",
      },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      {
        type: "action",
        id: "help",
        label: "Help Center",
        icon: "help-circle-outline",
        iconColor: "#3B82F6",
      },
      {
        type: "action",
        id: "feedback",
        label: "Send Feedback",
        icon: "chatbubble-outline",
        iconColor: "#F59E0B",
      },
      {
        type: "action",
        id: "version",
        label: "App Version",
        icon: "information-circle-outline",
        iconColor: "#5A6A85",
        value: "1.0.0",
      },
    ],
  },
  {
    title: "ACCOUNT ACTIONS",
    items: [
      {
        type: "action",
        id: "logout",
        label: "Log Out",
        icon: "log-out-outline",
        iconColor: "#F87171",
        destructive: true,
      },
      {
        type: "action",
        id: "delete",
        label: "Delete Account",
        icon: "trash-outline",
        iconColor: "#F87171",
        destructive: true,
      },
    ],
  },
];

const DEFAULT_TOGGLES: Record<string, boolean> = {
  push: true,
  email_notif: false,
  new_photos: true,
  auto_download: false,
  hq: true,
  dark_mode: true,
  two_factor: false,
  private_profile: false,
};

// ─── Settings Screen
export default function SettingsScreen() {
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES);

  const handleToggle = (id: string, val: boolean) => {
    setToggles((prev) => ({ ...prev, [id]: val }));
  };

  const handleAction = (id: string) => {
    if (id === "logout") {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: () => {} },
      ]);
    } else if (id === "delete") {
      Alert.alert(
        "Delete Account",
        "This action is permanent and cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => {} },
        ]
      );
    } else {
      // Navigate or handle per item
      console.log("Action pressed:", id);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <Section
            key={section.title}
            section={section}
            toggleState={toggles}
            onToggle={handleToggle}
            onAction={handleAction}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
});
