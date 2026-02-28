import React, { useMemo, useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { clearToken } from "../../lib/token";
import { apiGet, apiPatch } from "../../lib/api";

type AccordionKey =
  | "profile"
  | "notifications"
  | "dashboardPrefs"
  | "calendar"
  | "learnerMgmt"
  | "security"
  | "support";

function SectionRow({
  icon,
  title,
  isOpen,
  onToggle,
}: {
  icon: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.sectionRow}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.chev}>{isOpen ? "▴" : "▾"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const twoColumn = width >= 900;

  // ✅ these will be loaded from backend
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [language, setLanguage] = useState<"English" | "Arabic">("English");
  const [timeZone, setTimeZone] = useState<"Eastern Time (ET)" | "Gulf Standard Time (GST)">(
    "Gulf Standard Time (GST)"
  );

  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState<Record<AccordionKey, boolean>>({
    profile: true,
    notifications: false,
    dashboardPrefs: false,
    calendar: false,
    learnerMgmt: false,
    security: false,
    support: false,
  });

  const canSave = useMemo(
    () => fullName.trim().length > 0 && email.trim().length > 0,
    [fullName, email]
  );

  const toggle = (k: AccordionKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const cycleLanguage = () => setLanguage((v) => (v === "English" ? "Arabic" : "English"));

  const cycleTZ = () =>
    setTimeZone((v) => (v === "Eastern Time (ET)" ? "Gulf Standard Time (GST)" : "Eastern Time (ET)"));

  const sections: Array<[string, string, AccordionKey]> = [
    ["🔔", "Notification Preferences", "notifications"],
    ["📊", "Dashboard Preferences", "dashboardPrefs"],
    ["📅", "Calendar & Availability", "calendar"],
    ["👥", "Learner Management Settings", "learnerMgmt"],
    ["🛡️", "Security & Permissions", "security"],
    ["❓", "Support & Help", "support"],
  ];

  // ✅ load from backend
  const loadAll = async () => {
    try {
      setLoading(true);

      // 1) identity
      const me = await apiGet("/auth/me");
      setFullName(me?.name || "");
      setEmail(me?.email || "");

      // 2) settings doc (your backend returns { profile, notifications, preferences })
      const s = await apiGet("/settings/me");
      const profile = s?.profile || {};
      const prefs = s?.preferences || {};

      setMobile(profile?.mobile || profile?.phone || "");

      if (prefs?.language === "Arabic" || prefs?.language === "English") {
        setLanguage(prefs.language);
      }
      if (prefs?.timeZone === "Eastern Time (ET)" || prefs?.timeZone === "Gulf Standard Time (GST)") {
        setTimeZone(prefs.timeZone);
      }
    } catch (e: any) {
      Alert.alert("Settings Error", e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ✅ Save profile + prefs
  const handleSaveProfile = async () => {
    if (!canSave) return;

    try {
      // Your backend currently saves settings, NOT user name/email.
      // So we save "profile" + "preferences" into settings_col.
      await apiPatch("/settings/me", {
        profile: {
          fullName: fullName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
        },
        preferences: {
          language,
          timeZone,
        },
      });

      Alert.alert("✅ Saved", "Profile settings saved.");
      setNewPassword(""); // password not supported by backend right now
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "PATCH /settings/me failed");
    }
  };

  // ✅ LOGOUT — clear token first
  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await clearToken();
          } catch {}
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.h1}>Settings</Text>
          <Text style={styles.h2}>Manage your account preferences and system configuration</Text>
        </View>

        {loading ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#667085", fontWeight: "800" }}>Loading…</Text>
          </View>
        ) : null}

        {/* PROFILE */}
        <View style={styles.card}>
          <SectionRow
            icon="👤"
            title="Profile Settings"
            isOpen={open.profile}
            onToggle={() => toggle("profile")}
          />

          {open.profile && (
            <View style={styles.cardBody}>
              <View style={styles.avatarRow}>
                <View style={styles.bigAvatar}>
                  <Text style={styles.bigAvatarText}>
                    {(fullName || "—")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((x: string) => x[0])
                      .join("")
                      .toUpperCase() || "—"}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Pressable
                    onPress={() => alert("Upload photo (mock) — backend later")}
                    style={({ pressed }) => [styles.uploadBtn, pressed ? { opacity: 0.9 } : null]}
                  >
                    <Text style={styles.uploadBtnText}>⬆️ Upload Photo</Text>
                  </Pressable>
                  <Text style={styles.helper}>JPG, PNG or GIF. Max 2MB</Text>
                </View>
              </View>

              <View style={[styles.formGrid, twoColumn && styles.formTwo]}>
                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
                </View>

                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>

                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Mobile Number</Text>
                  <TextInput value={mobile} onChangeText={setMobile} style={styles.input} />
                </View>

                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Change Password</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#98A2B3"
                    secureTextEntry
                  />
                  <Text style={styles.helper}>
                    Password update is not implemented in backend yet (safe to ignore for demo).
                  </Text>
                </View>

                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Language</Text>
                  <Pressable onPress={cycleLanguage} style={styles.select}>
                    <Text style={styles.selectText}>{language}</Text>
                    <Text style={styles.selectChev}>▾</Text>
                  </Pressable>
                </View>

                <View style={[styles.field, twoColumn && styles.fieldHalf]}>
                  <Text style={styles.label}>Time Zone</Text>
                  <Pressable onPress={cycleTZ} style={styles.select}>
                    <Text style={styles.selectText}>{timeZone}</Text>
                    <Text style={styles.selectChev}>▾</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.saveRow}>
                <Pressable
                  disabled={!canSave}
                  onPress={handleSaveProfile}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    !canSave ? { opacity: 0.5 } : null,
                    pressed && canSave ? { transform: [{ scale: 0.99 }] } : null,
                  ]}
                >
                  <Text style={styles.saveBtnText}>💾 Save Profile</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* OTHER SECTIONS */}
        {sections.map(([icon, title, key]) => (
          <View key={key} style={styles.card}>
            <SectionRow icon={icon} title={title} isOpen={open[key]} onToggle={() => toggle(key)} />
            {open[key] && (
              <View style={styles.simpleBody}>
                <Text style={styles.simpleText}>Mock section for now.</Text>
              </View>
            )}
          </View>
        ))}

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Log Out</Text>
        </Pressable>

        <Text style={styles.footer}>© 2025 DriveIQ. Authorized instructor use only.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  page: { padding: 16, paddingBottom: 28 },

  header: { marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: "900", color: "#101828" },
  h2: { fontSize: 12, color: "#667085", marginTop: 6, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 12,
    overflow: "hidden",
  },

  sectionRow: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLeft: { flexDirection: "row", alignItems: "center" },
  sectionIcon: { fontSize: 16, marginRight: 10 },
  sectionTitle: { fontWeight: "900", fontSize: 13, color: "#101828" },
  chev: { fontSize: 14, color: "#667085", fontWeight: "900" },

  cardBody: { borderTopWidth: 1, borderTopColor: "#EAECF0", padding: 14 },

  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  bigAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bigAvatarText: { fontWeight: "900", fontSize: 18, color: "#111827" },

  uploadBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  uploadBtnText: { fontWeight: "900", fontSize: 12, color: "#101828" },
  helper: { fontSize: 11, marginTop: 6, color: "#667085", fontWeight: "700" },

  formGrid: { marginTop: 6 },
  formTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  field: { marginTop: 10 },
  fieldHalf: { width: "48%" },

  label: { fontSize: 12, fontWeight: "800", marginBottom: 6, color: "#344054" },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#101828",
    fontSize: 13,
  },

  select: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB",
  },
  selectText: { fontWeight: "800", color: "#101828" },
  selectChev: { color: "#667085", fontWeight: "900" },

  saveRow: { marginTop: 14, alignItems: "flex-end" },
  saveBtn: { backgroundColor: "#0B1220", padding: 12, borderRadius: 12 },
  saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  simpleBody: { borderTopWidth: 1, borderTopColor: "#EAECF0", padding: 14 },
  simpleText: { fontSize: 12, color: "#667085", fontWeight: "700" },

  logoutBtn: {
    marginTop: 6,
    backgroundColor: "#0B1220",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },

  footer: { fontSize: 11, color: "#667085", marginTop: 10, fontWeight: "700" },
});
