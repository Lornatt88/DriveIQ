import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const COLORS = {
  pageBg: "#F6F7FB",
  cardBg: "#FFFFFF",
  border: "#E8EAF2",
  text: "#0F172A",
  subtext: "#64748B",
  blue: "#2563EB",
  purple: "#7C3AED",
  green: "#16A34A",
  orange: "#F59E0B",
  darkBtn: "#0B1020",
  inputBg: "#F3F4F6",
};

// ✅ make sure this matches what you used in login
// If your login stores a different key, change it here too.
const TOKEN_KEY = "token";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export default function Settings() {
  const user = useMemo(
    () => ({
      fullName: "Sarah Mitchell",
      email: "sarah.mitchell@example.com",
      mobile: "+1 (555) 123-4567",
    }),
    []
  );

  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile);

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  const [reportReady, setReportReady] = useState(true);
  const [instructorComments, setInstructorComments] = useState(true);
  const [promos, setPromos] = useState(false);

  // Language & accessibility
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [textSize, setTextSize] = useState("Medium");
  const [highContrast, setHighContrast] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(true);

  // Privacy
  const [dataSharing, setDataSharing] = useState(true);
  const [sessionRecording, setSessionRecording] = useState(true);

  const onUploadPhoto = () => {
    Alert.alert("Upload Photo", "Hook this to ImagePicker later. UI is ready.", [
      { text: "OK" },
    ]);
  };

  const onChangePassword = () => {
    Alert.alert(
      "Change Password",
      "You can open a change-password modal here (same style as booking modal).",
      [{ text: "OK" }]
    );
  };

  const onSave = () => {
    Alert.alert("Saved", "Your settings were saved (mock).", [{ text: "OK" }]);
  };

  const onDownloadData = () => {
    Alert.alert("Download", "Your data download request was sent (mock).", [
      { text: "OK" },
    ]);
  };

  const onPickerPress = (
    title: string,
    current: string,
    options: string[],
    setValue: (v: string) => void
  ) => {
    Alert.alert(title, `Current: ${current}`, [
      ...options.map((o) => ({
        text: o,
        onPress: () => setValue(o),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ✅ LOGOUT (fixed: clears token)
  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(TOKEN_KEY);
            // if you store role/user too, remove them here:
            await AsyncStorage.multiRemove(["role", "user"]);
          } catch (e) {
            // even if removal fails, continue logout navigation
          } finally {
            // ✅ send user to login/root
            router.replace("/");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Ionicons name="settings-outline" size={22} color={COLORS.blue} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSubtitle}>
            Manage your account and preferences
          </Text>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.card}>
        <SectionTitle
          icon="person-outline"
          color={COLORS.blue}
          title="Account Settings"
        />

        <View style={styles.accountTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Profile Picture</Text>

            <Pressable style={styles.outlineBtn} onPress={onUploadPhoto}>
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={COLORS.text}
              />
              <Text style={styles.outlineBtnText}>Upload New Photo</Text>
            </Pressable>

            <Text style={styles.helperText}>JPG, PNG or GIF. Max size 5MB.</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.formGrid}>
          <Field
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />
          <Field
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
          />
          <Field
            label="Mobile Number"
            value={mobile}
            onChangeText={setMobile}
            icon="call-outline"
          />

          {/* Password row with button */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <TextInput
                  value={"••••••••••"}
                  editable={false}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <Pressable style={styles.changePwdBtn} onPress={onChangePassword}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={COLORS.text}
                />
                <Text style={styles.changePwdText}>Change Password</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{ alignItems: "flex-end", marginTop: 10 }}>
          <Pressable style={styles.primaryBtn} onPress={onSave}>
            <Text style={styles.primaryBtnText}>Save Changes</Text>
          </Pressable>
        </View>
      </View>

      {/* Notification Preferences */}
      <View style={styles.card}>
        <SectionTitle
          icon="notifications-outline"
          color={COLORS.purple}
          title="Notification Preferences"
        />

        <Text style={styles.groupTitle}>Session Reminders</Text>

        <ToggleRow
          icon="mail-outline"
          label="Email Notifications"
          value={emailNotifs}
          onValueChange={setEmailNotifs}
        />
        <ToggleRow
          icon="chatbubble-outline"
          label="SMS Notifications"
          value={smsNotifs}
          onValueChange={setSmsNotifs}
        />
        <ToggleRow
          icon="notifications-outline"
          label="Push Notifications"
          value={pushNotifs}
          onValueChange={setPushNotifs}
        />

        <View style={styles.divider} />

        <ToggleRow
          label="Report Ready Alerts"
          sub="Get notified when session reports are available"
          value={reportReady}
          onValueChange={setReportReady}
        />
        <ToggleRow
          label="Instructor Comments Notifications"
          sub="Receive alerts when instructors leave feedback"
          value={instructorComments}
          onValueChange={setInstructorComments}
        />
        <ToggleRow
          label="Promotional or System Updates"
          sub="Stay informed about new features and offers"
          value={promos}
          onValueChange={setPromos}
        />
      </View>

      {/* Language & Accessibility */}
      <View style={styles.card}>
        <SectionTitle
          icon="globe-outline"
          color={COLORS.green}
          title="Language & Accessibility"
        />

        <View style={styles.twoColRow}>
          <PickerField
            label="Preferred Language"
            value={preferredLanguage}
            onPress={() =>
              onPickerPress(
                "Preferred Language",
                preferredLanguage,
                ["English", "Arabic"],
                setPreferredLanguage
              )
            }
          />
          <PickerField
            label="Text Size"
            value={textSize}
            onPress={() =>
              onPickerPress(
                "Text Size",
                textSize,
                ["Small", "Medium", "Large"],
                setTextSize
              )
            }
          />
        </View>

        <ToggleRow
          label="High Contrast Mode"
          sub="Increase text and UI contrast"
          value={highContrast}
          onValueChange={setHighContrast}
        />
        <ToggleRow
          label="Voice Feedback"
          sub="Enable audio announcements"
          value={voiceFeedback}
          onValueChange={setVoiceFeedback}
        />
      </View>

      {/* Privacy & Permissions */}
      <View style={styles.card}>
        <SectionTitle
          icon="shield-checkmark-outline"
          color={COLORS.orange}
          title="Privacy & Permissions"
        />

        <ToggleRow
          label="Data Sharing Consent"
          sub="Allow DriveIQ to share anonymized data for improving driving safety"
          value={dataSharing}
          onValueChange={setDataSharing}
        />
        <ToggleRow
          label="Session Recording Opt-In"
          sub="Allow video/audio recording during sessions for training purposes"
          value={sessionRecording}
          onValueChange={setSessionRecording}
        />

        <View style={styles.divider} />

        <View style={styles.downloadRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.downloadTitle}>Download My Data</Text>
            <Text style={styles.downloadSub}>
              Request a copy of all your personal data and session history
            </Text>
          </View>

          <Pressable style={styles.outlineBtn} onPress={onDownloadData}>
            <Ionicons name="download-outline" size={16} color={COLORS.text} />
            <Text style={styles.outlineBtnText}>Download</Text>
          </Pressable>
        </View>
      </View>

      {/* Support & Help */}
      <View style={styles.card}>
        <SectionTitle
          icon="help-circle-outline"
          color={COLORS.blue}
          title="Support & Help"
        />

        <View style={styles.supportGrid}>
          <SupportTile
            icon="chatbox-ellipses-outline"
            iconColor={COLORS.blue}
            title="Contact Support"
            sub="Get help from our team"
            onPress={() => Alert.alert("Support", "Open support chat/email (mock).")}
          />
          <SupportTile
            icon="document-text-outline"
            iconColor={COLORS.green}
            title="FAQs"
            sub="Find quick answers"
            onPress={() => Alert.alert("FAQs", "Open FAQs screen (mock).")}
          />
          <SupportTile
            icon="bug-outline"
            iconColor="#EF4444"
            title="Report a Bug"
            sub="Help us improve"
            onPress={() => Alert.alert("Bug Report", "Open bug report form (mock).")}
          />
        </View>

        {/* ✅ Logout button */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      <View style={{ height: 10 }} />
    </ScrollView>
  );
}

/* ---------------- Components ---------------- */

function SectionTitle({
  icon,
  color,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color="#94A3B8"
            style={{ marginRight: 10 }}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          placeholderTextColor="#9CA3AF"
        />
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon ? <Ionicons name={icon} size={16} color="#94A3B8" /> : null}
          <Text style={styles.toggleLabel}>{label}</Text>
        </View>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D1D5DB", true: "#111827" }}
        thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
      />
    </View>
  );
}

function PickerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.pickerRow} onPress={onPress}>
        <Text style={styles.pickerValue}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
      </Pressable>
    </View>
  );
}

function SupportTile({
  icon,
  iconColor,
  title,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.supportTile} onPress={onPress}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={styles.supportTitle}>{title}</Text>
      <Text style={styles.supportSub}>{sub}</Text>
    </Pressable>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },
  pageContent: { padding: 16, paddingBottom: 28, gap: 14 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  pageSubtitle: {
    marginTop: 4,
    color: COLORS.subtext,
    fontWeight: "600",
    fontSize: 12,
  },

  card: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  accountTopRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: "#6D67FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },

  smallLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    color: COLORS.subtext,
    fontWeight: "700",
    fontSize: 11,
  },

  outlineBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  outlineBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldWrap: { flexGrow: 1, flexBasis: "48%", minWidth: 220 },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: "#EEF0F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
    padding: 0,
  },

  passwordRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  changePwdBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  changePwdText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  primaryBtn: {
    backgroundColor: COLORS.darkBtn,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  groupTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 10,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  toggleLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  toggleSub: {
    marginTop: 6,
    color: COLORS.subtext,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },

  twoColRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: "#EEF0F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerValue: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  downloadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  downloadTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  downloadSub: {
    marginTop: 6,
    color: COLORS.subtext,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },

  supportGrid: { flexDirection: "column", gap: 12 },

  supportTile: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  supportTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
  },
  supportSub: {
    color: COLORS.subtext,
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },

  logoutBtn: {
    marginTop: 14,
    backgroundColor: "#0B1020",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
});
