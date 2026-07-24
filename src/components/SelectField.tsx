import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

type Props = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SelectField({ value, options, onChange, placeholder = "Select an option" }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity style={styles.control} onPress={() => setOpen((current) => !current)}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={c.textMuted} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.options}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.option, value === option && styles.selectedOption]}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <Text style={[styles.optionText, value === option && styles.selectedText]}>{option}</Text>
              {value === option ? <Ionicons name="checkmark" size={18} color={c.accent} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    control: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bg,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    value: { flex: 1, color: c.textPrimary, fontSize: 15 },
    placeholder: { color: c.textMuted },
    options: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: c.surface,
    },
    option: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    selectedOption: { backgroundColor: c.bg },
    optionText: { flex: 1, color: c.textPrimary, fontSize: 14 },
    selectedText: { color: c.accent, fontWeight: "700" },
  });
