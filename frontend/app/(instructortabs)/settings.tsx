import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { clearToken } from "../../lib/token";
import { router } from "expo-router";
import { apiGet, apiPatch } from "../../lib/api";
import { colors, card, page } from "../../lib/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = "profile" | "notifications" | "availability" | "security";

// ─── Accordion row ───────────────────────────────────────────────────────────

function AccordionRow({
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
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [ss.accordionRow, pressed && { opacity: 0.85 }]}
    >
      <View style={ss.accordionLeft}>
        <Ionicons name={icon as any} size={18} color={colors.purpleDark} />
        <Text style={ss.accordionTitle}>{title}</Text>
      </View>
      <Ionicons
        name={isOpen ? "chevron-up" : "chevron-down"}
        size={16}
        color={colors.subtext}
      />
    </Pressable>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
  keyboardType,
  helper,
  half,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  helper?: string;
  half?: boolean;
}) {
  return (
    <View style={[ss.field, half && ss.fieldHalf]}>
      <Text style={ss.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        style={ss.input}
        autoCapitalize="none"
      />
      {helper ? <Text style={ss.helper}>{helper}</Text> : null}
    </View>
  );
}

// ─── Toggle row ──────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={ss.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={ss.toggleLabel}>{label}</Text>
        {sub ? <Text style={ss.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.purpleDark }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const twoCol = width >= 900;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [mobile, setMobile]     = useState("");
  const [newPassword, setNewPassword] = useState("");

  // ── Prefs
  const [language, setLanguage] = useState<"English" | "Arabic">("English");
  const [timeZone, setTimeZone] = useState<"Gulf Standard Time (GST)" | "Eastern Time (ET)">(
    "Gulf Standard Time (GST)"
  );

  // ── Notifications
  const [notifyBooking,  setNotifyBooking]  = useState(true);
  const [notifyReminder, setNotifyReminder] = useState(true);
  const [notifyReport,   setNotifyReport]   = useState(true);

  // ── Open sections
  const [open, setOpen] = useState<Record<Section, boolean>>({
    profile:       true,
    notifications: false,
    availability:  false,
    security:      false,
  });

  const toggle = (k: Section) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const canSave = useMemo(
    () => fullName.trim().length > 0 && email.trim().length > 0,
    [fullName, email]
  );

  // ── Load
  async function loadAll() {
    try {
      setLoading(true);
      const [me, s] = await Promise.all([apiGet("/auth/me"), apiGet("/settings/me")]);
      setFullName(me?.name || "");
      setEmail(me?.email || "");
      const profile = s?.profile || {};
      const prefs   = s?.preferences || {};
      const notifs  = s?.notifications || {};
      setMobile(profile?.mobile || profile?.phone || "");
      if (prefs?.language === "Arabic")  setLanguage("Arabic");
      if (prefs?.timeZone) setTimeZone(prefs.timeZone as any);
      setNotifyBooking( notifs?.new_booking  ?? true);
      setNotifyReminder(notifs?.reminder     ?? true);
      setNotifyReport(  notifs?.report_ready ?? true);
    } catch (e: any) {
      Alert.alert("Settings Error", e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  useFocusEffect(useCallback(() => { loadAll(); }, []));

  // ── Save
  async function saveProfile() {
    if (!canSave) return;
    try {
      setSaving(true);
      await apiPatch("/settings/me", {
        profile: { fullName: fullName.trim(), email: email.trim(), mobile: mobile.trim() },
        preferences: { language, timeZone },
        notifications: {
          new_booking:  notifyBooking,
          reminder:     notifyReminder,
          report_ready: notifyReport,
        },
      });
      Alert.alert("Saved", "Your settings have been saved.");
      setNewPassword("");
    } catch (e: any) {
      Alert.alert("Save Failed", e?.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  // ── Logout
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try { await clearToken(); } catch {}
          router.replace("/");
        },
      },
    ]);
  }

  // ── Initials avatar
  const avatarInitials = useMemo(() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase() || "?";
  }, [fullName]);

  // ── Loading
  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading settings…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={page.base}
      contentContainerStyle={[page.content, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View>
        <Text style={ss.h1}>Settings</Text>
        <Text style={ss.h2}>Manage your account and preferences</Text>
      </View>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <View style={[card.base, ss.section]}>
        <AccordionRow
          icon="person-circle-outline"
          title="Profile Settings"
          isOpen={open.profile}
          onToggle={() => toggle("profile")}
        />

        {open.profile && (
          <View style={ss.sectionBody}>
            {/* Avatar */}
            <View style={ss.avatarRow}>
              <View style={ss.avatar}>
                <Text style={ss.avatarText}>{avatarInitials}</Text>
              </View>
              <View>
                <Text style={ss.avatarName}>{fullName || "—"}</Text>
                <Text style={ss.avatarEmail}>{email}</Text>
              </View>
            </View>

            {/* Form */}
            <View style={[ss.formGrid, twoCol && ss.formTwo]}>
              <Field
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                half={twoCol}
              />
              <Field
                label="Email Address"
                value={email}
                onChange={setEmail}
                keyboardType="email-address"
                half={twoCol}
              />
              <Field
                label="Mobile Number"
                value={mobile}
                onChange={setMobile}
                keyboardType="phone-pad"
                placeholder="+971 50 000 0000"
                half={twoCol}
              />
              <Field
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                secure
                placeholder="Leave blank to keep current"
                helper="Password changes are not yet supported by the backend."
                half={twoCol}
              />
            </View>

            {/* Language + timezone */}
            <View style={[ss.formGrid, twoCol && ss.formTwo]}>
              <View style={[ss.field, twoCol && ss.fieldHalf]}>
                <Text style={ss.fieldLabel}>Language</Text>
                <Pressable
                  onPress={() => setLanguage((v) => v === "English" ? "Arabic" : "English")}
                  style={ss.select}
                >
                  <Text style={ss.selectText}>{language}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.subtext} />
                </Pressable>
              </View>

              <View style={[ss.field, twoCol && ss.fieldHalf]}>
                <Text style={ss.fieldLabel}>Time Zone</Text>
                <Pressable
                  onPress={() => setTimeZone((v) =>
                    v === "Gulf Standard Time (GST)" ? "Eastern Time (ET)" : "Gulf Standard Time (GST)"
                  )}
                  style={ss.select}
                >
                  <Text style={ss.selectText} numberOfLines={1}>{timeZone}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.subtext} />
                </Pressable>
              </View>
            </View>

            {/* Save */}
            <View style={ss.saveRow}>
              <Pressable
                onPress={saveProfile}
                disabled={!canSave || saving}
                style={({ pressed }) => [
                  ss.saveBtn,
                  (!canSave || saving) && { opacity: 0.5 },
                  pressed && canSave && { transform: [{ scale: 0.98 }] },
                ]}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={ss.saveBtnText}>Save Settings</Text>
                }
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <View style={[card.base, ss.section]}>
        <AccordionRow
          icon="notifications-outline"
          title="Notification Preferences"
          isOpen={open.notifications}
          onToggle={() => toggle("notifications")}
        />

        {open.notifications && (
          <View style={ss.sectionBody}>
            <ToggleRow
              label="New Booking"
              sub="Alert when a student books one of your time slots"
              value={notifyBooking}
              onChange={setNotifyBooking}
            />
            <View style={ss.rowDivider} />
            <ToggleRow
              label="Session Reminder"
              sub="Reminder 30 minutes before a scheduled session"
              value={notifyReminder}
              onChange={setNotifyReminder}
            />
            <View style={ss.rowDivider} />
            <ToggleRow
              label="Report Ready"
              sub="Alert when a student views their generated report"
              value={notifyReport}
              onChange={setNotifyReport}
            />

            <View style={ss.saveRow}>
              <Pressable
                onPress={saveProfile}
                disabled={saving}
                style={({ pressed }) => [
                  ss.saveBtn,
                  saving && { opacity: 0.5 },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={ss.saveBtnText}>Save Preferences</Text>
                }
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ── Availability ─────────────────────────────────────────────────── */}
      <View style={[card.base, ss.section]}>
        <AccordionRow
          icon="calendar-outline"
          title="Calendar & Availability"
          isOpen={open.availability}
          onToggle={() => toggle("availability")}
        />

        {open.availability && (
          <View style={ss.sectionBody}>
            <View style={ss.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.purpleDark} />
              <Text style={ss.infoText}>
                Manage your available time slots so students can book sessions with you.
                Add new slots from the Sessions page, or contact your administrator
                if you need help adjusting your schedule.
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/(instructortabs)/sessions" as any)}
              style={({ pressed }) => [ss.linkBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.purpleDark} />
              <Text style={ss.linkBtnText}>Manage Availability in Sessions</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.purpleDark} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <View style={[card.base, ss.section]}>
        <AccordionRow
          icon="shield-checkmark-outline"
          title="Security & Account"
          isOpen={open.security}
          onToggle={() => toggle("security")}
        />

        {open.security && (
          <View style={ss.sectionBody}>
            <View style={ss.infoBox}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.subtext} />
              <Text style={ss.infoText}>
                Your account is secured with a hashed password. To change your password, use
                the Profile Settings section above. Two-factor authentication and session
                history will be available in a future update.
              </Text>
            </View>

            <View style={ss.metaRow}>
              <Text style={ss.metaLabel}>Signed in as</Text>
              <Text style={ss.metaValue}>{email || "—"}</Text>
            </View>
            <View style={ss.metaRow}>
              <Text style={ss.metaLabel}>Role</Text>
              <Text style={ss.metaValue}>Instructor</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Logout ───────────────────────────────────────────────────────── */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [ss.logoutBtn, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
        <Text style={ss.logoutText}>Log Out</Text>
      </Pressable>

      <Text style={ss.footer}>© 2025 DriveIQ · Authorized instructor use only</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const ss = StyleSheet.create({
  // ── Header
  h1: { fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 13, fontWeight: "600", color: colors.subtext, marginTop: 4 },

  // ── Accordion
  section: { padding: 0, overflow: "hidden" },
  accordionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  accordionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  accordionTitle: { fontSize: 14, fontWeight: "900", color: colors.text },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 4,
  },

  // ── Avatar
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "900", color: colors.purpleDark },
  avatarName:  { fontSize: 15, fontWeight: "900", color: colors.text },
  avatarEmail: { fontSize: 12, fontWeight: "600", color: colors.subtext, marginTop: 2 },

  // ── Form
  formGrid: { gap: 12 },
  formTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  field: { gap: 6 },
  fieldHalf: { width: "48%" },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: colors.text },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  helper: { fontSize: 11, fontWeight: "600", color: colors.muted },

  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: { fontSize: 13, fontWeight: "600", color: colors.text, flex: 1 },

  // ── Save
  saveRow: { marginTop: 16, alignItems: "flex-end" },
  saveBtn: {
    backgroundColor: colors.darkBtn,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // ── Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  toggleLabel: { fontSize: 13, fontWeight: "800", color: colors.text },
  toggleSub:   { fontSize: 11, fontWeight: "600", color: colors.subtext, marginTop: 2 },
  rowDivider:  { height: 1, backgroundColor: colors.borderLight },

  // ── Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.subtext,
    lineHeight: 19,
  },

  // ── Link button
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.purpleDark,
    backgroundColor: colors.purpleLight,
  },
  linkBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: colors.purpleDark,
  },

  // ── Meta rows (security)
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  metaLabel: { fontSize: 12, fontWeight: "700", color: colors.subtext },
  metaValue: { fontSize: 13, fontWeight: "800", color: colors.text },

  // ── Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },

  footer: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },
});
