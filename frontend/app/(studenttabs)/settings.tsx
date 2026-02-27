import React, { useEffect, useState, useCallback } from "react";
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
  ActivityIndicator,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { apiGet, apiPut, apiPost } from "../../lib/api";
import { clearToken } from "../../lib/token";

// ─── Constants ────────────────────────────────────────────────────────────────

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

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [mobile, setMobile]     = useState("");

  // Change password modal
  const [pwdModalOpen, setPwdModalOpen]       = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmNewPwd, setConfirmNewPwd]     = useState("");
  const [pwdLoading, setPwdLoading]           = useState(false);
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // Notifications
  const [emailNotifs, setEmailNotifs]             = useState(true);
  const [smsNotifs, setSmsNotifs]                 = useState(true);
  const [pushNotifs, setPushNotifs]               = useState(true);
  const [reportReady, setReportReady]             = useState(true);
  const [instructorComments, setInstructorComments] = useState(true);
  const [promos, setPromos]                       = useState(false);

  // Language & accessibility
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [textSize, setTextSize]                   = useState("Medium");
  const [highContrast, setHighContrast]           = useState(false);
  const [voiceFeedback, setVoiceFeedback]         = useState(true);

  // Privacy
  const [dataSharing, setDataSharing]           = useState(true);
  const [sessionRecording, setSessionRecording] = useState(true);

  // ── Load data ───────────────────────────────────────────────────────────────
  async function loadSettings() {
    try {
      setLoading(true);
      const [name, storedEmail, storedMobile] = await Promise.all([
        AsyncStorage.getItem("driveiq_user_name"),
        AsyncStorage.getItem("driveiq_user_email"),
        AsyncStorage.getItem("driveiq_user_mobile"),
      ]);
      if (name)          setFullName(name);
      if (storedEmail)   setEmail(storedEmail);
      if (storedMobile)  setMobile(storedMobile);

      // Also try fetching from API in case profile was updated elsewhere
      try {
        const data = await apiGet("/auth/me");
        if (data?.name)   setFullName(data.name);
        if (data?.email)  setEmail(data.email);
        if (data?.mobile) setMobile(data.mobile);
      } catch {
        // Silently fall back to AsyncStorage values
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);
  useFocusEffect(useCallback(() => { loadSettings(); }, []));

  // ── Save profile ────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Validation", "Full name cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      await apiPut("/auth/profile", {
        name:   fullName.trim(),
        email:  email.trim().toLowerCase(),
        mobile: mobile.trim(),
      });

      // Update AsyncStorage to keep layout name in sync
      await AsyncStorage.setItem("driveiq_user_name",  fullName.trim());
      await AsyncStorage.setItem("driveiq_user_email", email.trim().toLowerCase());
      await AsyncStorage.setItem("driveiq_user_mobile", mobile.trim());

      Alert.alert("Saved ✓", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ─────────────────────────────────────────────────────────
  const onChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert("Required", "Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Too short", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPwd) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert("Same password", "New password must be different from your current one.");
      return;
    }

    try {
      setPwdLoading(true);
      await apiPost("/auth/change-password", {
        current_password: currentPassword,
        new_password:     newPassword,
        confirm_password: confirmNewPwd,
      });

      // Reset fields and close modal
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPwd("");
      setPwdModalOpen(false);
      Alert.alert("Password changed ✓", "Your password has been updated successfully.");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not change password. Check your current password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const closePwdModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPwd("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setPwdModalOpen(false);
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await clearToken();
            await AsyncStorage.multiRemove([
              "driveiq_user_name",
              "driveiq_user_email",
              "driveiq_user_mobile",
            ]);
          } finally {
            router.replace("/");
          }
        },
      },
    ]);
  };

  const onPickerPress = (title: string, current: string, options: string[], setValue: (v: string) => void) => {
    Alert.alert(title, `Current: ${current}`, [
      ...options.map((o) => ({ text: o, onPress: () => setValue(o) })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6D28D9" />
        <Text style={styles.centerText}>Loading settings…</Text>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Ionicons name="settings-outline" size={22} color={COLORS.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>Manage your account and preferences</Text>
          </View>
        </View>

        {/* ── Account Settings ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle icon="person-outline" color={COLORS.blue} title="Account Settings" />

          <View style={styles.accountTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(fullName || "S")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Profile Picture</Text>
              <Pressable style={styles.outlineBtn} onPress={() => Alert.alert("Upload Photo", "Hook this to ImagePicker later.")}>
                <Ionicons name="cloud-upload-outline" size={16} color={COLORS.text} />
                <Text style={styles.outlineBtnText}>Upload New Photo</Text>
              </Pressable>
              <Text style={styles.helperText}>JPG, PNG or GIF. Max size 5MB.</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.formGrid}>
            <Field label="Full Name"      value={fullName} onChangeText={setFullName} icon="person-outline" />
            <Field label="Email Address"  value={email}    onChangeText={setEmail}    icon="mail-outline"   />
            <Field label="Mobile Number"  value={mobile}   onChangeText={setMobile}   icon="call-outline"   />

            {/* Password row */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <View style={[styles.inputRow, { flex: 1 }]}>
                  <TextInput value="••••••••••" editable={false} style={styles.input} placeholderTextColor="#9CA3AF" />
                </View>
                <Pressable style={styles.changePwdBtn} onPress={() => setPwdModalOpen(true)}>
                  <Ionicons name="lock-closed-outline" size={16} color={COLORS.text} />
                  <Text style={styles.changePwdText}>Change Password</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={{ alignItems: "flex-end", marginTop: 10 }}>
            <Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Save Changes</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* ── Notification Preferences ──────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle icon="notifications-outline" color={COLORS.purple} title="Notification Preferences" />

          <Text style={styles.groupTitle}>Session Reminders</Text>
          <ToggleRow icon="mail-outline"          label="Email Notifications"  value={emailNotifs}  onValueChange={setEmailNotifs} />
          <ToggleRow icon="chatbubble-outline"     label="SMS Notifications"    value={smsNotifs}    onValueChange={setSmsNotifs} />
          <ToggleRow icon="notifications-outline"  label="Push Notifications"   value={pushNotifs}   onValueChange={setPushNotifs} />

          <View style={styles.divider} />

          <ToggleRow label="Report Ready Alerts"                  sub="Get notified when session reports are available"        value={reportReady}         onValueChange={setReportReady} />
          <ToggleRow label="Instructor Comments Notifications"    sub="Receive alerts when instructors leave feedback"         value={instructorComments}  onValueChange={setInstructorComments} />
          <ToggleRow label="Promotional or System Updates"        sub="Stay informed about new features and offers"            value={promos}              onValueChange={setPromos} />
        </View>

        {/* ── Language & Accessibility ───────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle icon="globe-outline" color={COLORS.green} title="Language & Accessibility" />

          <View style={styles.twoColRow}>
            <PickerField
              label="Preferred Language"
              value={preferredLanguage}
              onPress={() => onPickerPress("Preferred Language", preferredLanguage, ["English", "Arabic"], setPreferredLanguage)}
            />
            <PickerField
              label="Text Size"
              value={textSize}
              onPress={() => onPickerPress("Text Size", textSize, ["Small", "Medium", "Large"], setTextSize)}
            />
          </View>

          <ToggleRow label="High Contrast Mode" sub="Increase text and UI contrast"    value={highContrast}   onValueChange={setHighContrast} />
          <ToggleRow label="Voice Feedback"     sub="Enable audio announcements"        value={voiceFeedback}  onValueChange={setVoiceFeedback} />
        </View>

        {/* ── Privacy & Permissions ─────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle icon="shield-checkmark-outline" color={COLORS.orange} title="Privacy & Permissions" />

          <ToggleRow label="Data Sharing Consent"         sub="Allow DriveIQ to share anonymized data for improving driving safety"     value={dataSharing}       onValueChange={setDataSharing} />
          <ToggleRow label="Session Recording Opt-In"     sub="Allow video/audio recording during sessions for training purposes"       value={sessionRecording}  onValueChange={setSessionRecording} />

          <View style={styles.divider} />

          <View style={styles.downloadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.downloadTitle}>Download My Data</Text>
              <Text style={styles.downloadSub}>Request a copy of all your personal data and session history</Text>
            </View>
            <Pressable style={styles.outlineBtn} onPress={() => Alert.alert("Download", "Your data download request was sent (mock).")}>
              <Ionicons name="download-outline" size={16} color={COLORS.text} />
              <Text style={styles.outlineBtnText}>Download</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Support & Help ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionTitle icon="help-circle-outline" color={COLORS.blue} title="Support & Help" />

          <View style={styles.supportGrid}>
            <SupportTile icon="chatbox-ellipses-outline" iconColor={COLORS.blue}  title="Contact Support" sub="Get help from our team"    onPress={() => Alert.alert("Support", "Open support chat/email (mock).")} />
            <SupportTile icon="document-text-outline"    iconColor={COLORS.green} title="FAQs"            sub="Find quick answers"         onPress={() => Alert.alert("FAQs", "Open FAQs screen (mock).")} />
            <SupportTile icon="bug-outline"              iconColor="#EF4444"      title="Report a Bug"    sub="Help us improve"            onPress={() => Alert.alert("Bug Report", "Open bug report form (mock).")} />
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* ── Change Password Modal ──────────────────────────────────────── */}
      <Modal visible={pwdModalOpen} transparent animationType="fade" onRequestClose={closePwdModal}>
        <Pressable style={styles.modalOverlay} onPress={closePwdModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>

            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Text style={styles.modalSub}>Enter your current password to continue</Text>
              </View>
              <Pressable onPress={closePwdModal} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.subtext} />
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Current password */}
            <Text style={styles.modalLabel}>Current Password</Text>
            <View style={styles.modalInputRow}>
              <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter your current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showCurrent}
                style={styles.modalInput}
              />
              <Pressable onPress={() => setShowCurrent((v) => !v)}>
                <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={16} color="#94A3B8" />
              </Pressable>
            </View>

            {/* New password */}
            <Text style={[styles.modalLabel, { marginTop: 14 }]}>New Password</Text>
            <View style={styles.modalInputRow}>
              <Ionicons name="key-outline" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 6 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNew}
                style={styles.modalInput}
              />
              <Pressable onPress={() => setShowNew((v) => !v)}>
                <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={16} color="#94A3B8" />
              </Pressable>
            </View>

            {newPassword.length > 0 && newPassword.length < 6 && (
              <Text style={styles.modalError}>Must be at least 6 characters</Text>
            )}

            {/* Confirm new password */}
            <Text style={[styles.modalLabel, { marginTop: 14 }]}>Confirm New Password</Text>
            <View style={styles.modalInputRow}>
              <Ionicons name="key-outline" size={16} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput
                value={confirmNewPwd}
                onChangeText={setConfirmNewPwd}
                placeholder="Repeat new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                style={styles.modalInput}
              />
              <Pressable onPress={() => setShowConfirm((v) => !v)}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={16} color="#94A3B8" />
              </Pressable>
            </View>

            {confirmNewPwd.length > 0 && newPassword !== confirmNewPwd && (
              <Text style={styles.modalError}>Passwords do not match</Text>
            )}

            {/* Password strength hint */}
            {newPassword.length >= 6 && newPassword === confirmNewPwd && (
              <View style={styles.modalSuccessRow}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                <Text style={styles.modalSuccess}>Passwords match and meet requirements</Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={closePwdModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, pwdLoading && { opacity: 0.6 }]}
                onPress={onChangePassword}
                disabled={pwdLoading}
              >
                {pwdLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSaveText}>Update Password</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon, color, title }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, icon }: { label: string; value: string; onChangeText: (t: string) => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <Ionicons name={icon} size={16} color="#94A3B8" style={{ marginRight: 10 }} /> : null}
        <TextInput value={value} onChangeText={onChangeText} style={styles.input} placeholderTextColor="#9CA3AF" />
      </View>
    </View>
  );
}

function ToggleRow({ icon, label, sub, value, onValueChange }: { icon?: keyof typeof Ionicons.glyphMap; label: string; sub?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon ? <Ionicons name={icon} size={16} color="#94A3B8" /> : null}
          <Text style={styles.toggleLabel}>{label}</Text>
        </View>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#D1D5DB", true: "#111827" }} thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined} />
    </View>
  );
}

function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
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

function SupportTile({ icon, iconColor, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable style={styles.supportTile} onPress={onPress}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={styles.supportTitle}>{title}</Text>
      <Text style={styles.supportSub}>{sub}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },
  pageContent: { padding: 16, paddingBottom: 28, gap: 14 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { marginTop: 12, fontSize: 13, fontWeight: "800", color: "#64748B" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  pageSubtitle: { marginTop: 4, color: COLORS.subtext, fontWeight: "600", fontSize: 12 },

  card: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  accountTopRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: { width: 78, height: 78, borderRadius: 999, backgroundColor: "#6D67FF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },

  smallLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 8 },
  helperText: { marginTop: 8, color: COLORS.subtext, fontWeight: "700", fontSize: 11 },

  outlineBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  outlineBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldWrap: { flexGrow: 1, flexBasis: "48%", minWidth: 220 },
  fieldLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 8 },

  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: "#EEF0F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  input: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 12, padding: 0 },

  passwordRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  changePwdBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  changePwdText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  primaryBtn: { backgroundColor: COLORS.darkBtn, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, minWidth: 120, alignItems: "center" },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  groupTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 10 },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  toggleLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  toggleSub: { marginTop: 6, color: COLORS.subtext, fontWeight: "700", fontSize: 11, lineHeight: 16 },

  twoColRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: "#EEF0F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  pickerValue: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  downloadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  downloadTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  downloadSub: { marginTop: 6, color: COLORS.subtext, fontWeight: "700", fontSize: 11, lineHeight: 16 },

  supportGrid: { flexDirection: "column", gap: 12 },
  supportTile: { width: "100%", borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 22, paddingHorizontal: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", gap: 8 },
  supportTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  supportSub: { color: COLORS.subtext, fontWeight: "700", fontSize: 11, textAlign: "center" },

  logoutBtn: { marginTop: 14, backgroundColor: "#0B1020", paddingVertical: 14, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: {
    width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF",
    borderRadius: 16, padding: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
    }),
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  modalIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#EEF5FF", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  modalSub: { fontSize: 12, fontWeight: "700", color: COLORS.subtext, marginTop: 2 },
  modalClose: { padding: 4 },

  modalLabel: { fontSize: 12, fontWeight: "900", color: COLORS.text, marginBottom: 8 },
  modalInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: "#EEF0F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  modalInput: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 13, padding: 0 },

  modalError: { marginTop: 6, color: "#DC2626", fontWeight: "700", fontSize: 11 },
  modalSuccessRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  modalSuccess: { color: COLORS.green, fontWeight: "700", fontSize: 12 },

  modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  modalSaveBtn: { flex: 1, backgroundColor: COLORS.darkBtn, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  modalSaveText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
});
