import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

type Role = "student" | "instructor";

export default function ConsentScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role as Role) || "student";

  const [agreed, setAgreed] = useState(false);

  const canContinue = useMemo(() => agreed, [agreed]);

  const onContinue = () => {
    if (!canContinue) return;

    // ✅ Route based on role (keep consistent with your project structure)
    if (role === "student") {
      router.replace("/(studenttabs)/dashboard");
      return;
    }

    router.replace("/(tabs)/dashboard");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        {/* Header */}
        <Text style={styles.h1}>Recording Consent</Text>
        <Text style={styles.h2}>
          DriveIQ records video and audio during real driving lessons for quality
          assurance. Recordings are stored securely and are accessible only by
          managers.
        </Text>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>I understand and agree</Text>
              <Text style={styles.toggleSub}>
                You must agree before continuing.
              </Text>
            </View>

            <Switch
              value={agreed}
              onValueChange={setAgreed}
              trackColor={{ false: "#D0D5DD", true: "#0B1220" }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canContinue && { opacity: 0.45 },
              pressed && canContinue ? { transform: [{ scale: 0.99 }] } : null,
            ]}
          >
            <Text style={styles.primaryBtnText}>Accept & Continue</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/")}
            style={({ pressed }) => [
              styles.linkBtn,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={styles.linkText}>Back to Login</Text>
          </Pressable>
        </View>

        {/* Optional helper */}
        <Pressable
          onPress={() =>
            Alert.alert(
              "Privacy Note",
              "This is a mock consent screen. Hook to backend/legal text later."
            )
          }
          style={styles.helperBtn}
        >
          <Text style={styles.helperText}>View Privacy Details</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 26,
  },

  h1: {
    fontSize: 22,
    fontWeight: "900",
    color: "#101828",
    marginBottom: 10,
  },
  h2: {
    fontSize: 13,
    color: "#667085",
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 18,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    ...Platform.select({
      ios: {
        shadowColor: "#101828",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  toggleTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#101828",
  },
  toggleSub: {
    marginTop: 6,
    fontSize: 12,
    color: "#667085",
    fontWeight: "700",
    lineHeight: 16,
  },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0B1220",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  linkBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
  },
  linkText: {
    color: "#475467",
    fontWeight: "800",
    fontSize: 12,
  },

  helperBtn: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  helperText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },
});
