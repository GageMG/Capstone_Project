import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/theme/ThemeContext";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function dateFromValue(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (display) {
    return new Date(Number(display[3]), Number(display[1]) - 1, Number(display[2]));
  }

  return new Date();
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function CalendarDateField({
  value,
  onChange,
  placeholder = "Select a date",
}: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === "web") {
    const WebDateInput = "input" as any;
    return (
      <View style={styles.wrapper}>
        <Ionicons name="calendar-outline" size={19} color={c.textMuted} />
        <WebDateInput
          type="date"
          value={value}
          onChange={(event: any) => onChange(event.target.value)}
          aria-label={placeholder}
          style={{
            flex: 1,
            height: 48,
            border: "none",
            outline: "none",
            background: "transparent",
            color: c.textPrimary,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      </View>
    );
  }

  const selectedDate = dateFromValue(value);
  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "set" && selected) onChange(dateValue(selected));
  };

  return (
    <>
      <TouchableOpacity style={styles.wrapper} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar-outline" size={19} color={c.textMuted} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={c.textMuted} />
      </TouchableOpacity>
      {showPicker ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={handleChange}
          />
          {Platform.OS === "ios" ? (
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowPicker(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    wrapper: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.bg,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    value: { flex: 1, color: c.textPrimary, fontSize: 15 },
    placeholder: { color: c.textMuted },
    pickerWrap: { backgroundColor: c.bg, borderRadius: 12, marginTop: 8, overflow: "hidden" },
    doneButton: { alignSelf: "flex-end", paddingHorizontal: 18, paddingVertical: 10 },
    doneText: { color: c.accent, fontWeight: "700" },
  });
