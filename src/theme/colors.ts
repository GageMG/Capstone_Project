import { StatusBarStyle } from "react-native";

export type ThemeName = "dark" | "light";

export type ThemeColors = {
  bg: string;
  surface: string;
  border: string;
  divider: string;
  textBright: string;
  textPrimary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentStrong: string;
  switchTrackOn: string;
  switchThumbOff: string;
  danger: string;
  decorLarge: string;
  decorSmall: string;
  successBg: string;
  successBorder: string;
  successText: string;
  successTextSoft: string;
  statusBar: StatusBarStyle;
};

export const darkColors: ThemeColors = {
  bg: "#0D1117",
  surface: "#161C27",
  border: "#1E2A40",
  divider: "#1A2235",
  textBright: "#F0F4FF",
  textPrimary: "#E8EDF8",
  textMuted: "#5A6A85",
  textFaint: "#3B4A62",
  accent: "#3B82F6",
  accentStrong: "#2563EB",
  switchTrackOn: "#1D4ED8",
  switchThumbOff: "#3B4A62",
  danger: "#F87171",
  decorLarge: "#1A2F5A",
  decorSmall: "#0E4DA4",
  successBg: "#0A2A1E",
  successBorder: "#10B981",
  successText: "#10B981",
  successTextSoft: "#A7F3D0",
  statusBar: "light-content",
};

export const lightColors: ThemeColors = {
  bg: "#F4F6FB",
  surface: "#FFFFFF",
  border: "#E6EBF3",
  divider: "#EEF1F7",
  textBright: "#0D1117",
  textPrimary: "#1E2A40",
  textMuted: "#64748B",
  textFaint: "#94A3B8",
  accent: "#2563EB",
  accentStrong: "#2563EB",
  switchTrackOn: "#2563EB",
  switchThumbOff: "#FFFFFF",
  danger: "#DC2626",
  decorLarge: "#D6E2F5",
  decorSmall: "#BFD3F0",
  successBg: "#ECFDF5",
  successBorder: "#10B981",
  successText: "#047857",
  successTextSoft: "#065F46",
  statusBar: "dark-content",
};

export const palettes: Record<ThemeName, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};
