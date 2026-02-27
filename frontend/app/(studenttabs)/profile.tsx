import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Badge = {
  id: string;
  title: string;
  level: "Bronze" | "Silver" | "Gold";
  emoji: string;
};

type InstructorHistory = {
  id: string;
  name: string;
  rating: number;
  sessionsCompleted: number;
  notes: string[];
};

type Milestone = {
  id: string;
  title: string;
  desc: string;
  date?: string;
  status: "Earned" | "Locked";
  emoji: string;
  lockedHint?: string;
};

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
  yellow: "#F59E0B",
  darkBtn: "#0B1020",
};

const FALLBACK_BADGES: Badge[] = [
  { id: "b1", title: "Safe Braking",    level: "Bronze", emoji: "🛑" },
  { id: "b2", title: "Lane Master",     level: "Silver", emoji: "🛣️" },
  { id: "b3", title: "Speed Control",   level: "Gold",   emoji: "⚡" },
  { id: "b4", title: "Mirror Check Pro",level: "Silver", emoji: "👀" },
];

const FALLBACK_INSTRUCTORS: InstructorHistory[] = [
  {
    id: "i1", name: "John Davis", rating: 4.5, sessionsCompleted: 4,
    notes: ['"Shows great improvement session after session"', '"Good focus and listens well"'],
  },
  {
    id: "i2", name: "Aisha Rahman", rating: 4.8, sessionsCompleted: 2,
    notes: ['"Excellent mirror checks and lane discipline"', '"Very calm and confident driver"'],
  },
];

const FALLBACK_MILESTONES: Milestone[] = [
  { id: "m1", emoji: "⭐", title: "First 80% Score",           desc: "Achieved your first session score of 80% or higher",          status: "Earned", date: "Nov 13, 2025" },
  { id: "m2", emoji: "🛡️", title: "3 Sessions Without Alerts", desc: "Completed 3 consecutive sessions with no safety alerts",       status: "Earned", date: "Nov 11, 2025" },
  { id: "m3", emoji: "✅", title: "Perfect Attendance",         desc: "Attended all scheduled sessions without cancellation",         status: "Earned", date: "Nov 9, 2025" },
  { id: "m4", emoji: "⚡", title: "Speed Master",               desc: "Maintained optimal speed throughout an entire session",        status: "Earned", date: "Nov 6, 2025" },
  { id: "m5", emoji: "🎯", title: "Lane Discipline Pro",        desc: "Complete a session with zero lane drift incidents",            status: "Locked" },
  { id: "m6", emoji: "🏆", title: "Safe Braking Champion",      desc: "Achieve smooth braking in all stops for one session",          status: "Locked" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.max(0, Math.min(1, n / d));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);
  const [storedName, setStoredName] = useState("");
  const [storedEmail, setStoredEmail] = useState("");
  const [storedMobile, setStoredMobile] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);

      // Load stored identity fields from AsyncStorage
      const [name, email, mobile] = await Promise.all([
        AsyncStorage.getItem("driveiq_user_name"),
        AsyncStorage.getItem("driveiq_user_email"),
        AsyncStorage.getItem("driveiq_user_mobile"),
      ]);
      setStoredName(name || "");
      setStoredEmail(email || "");
      setStoredMobile(mobile || "");

      // Load dashboard data for scores/progress
      const data = await apiGet("/dashboard/trainee");
      setDash(data);
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);
  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  // ── Derived values ──────────────────────────────────────────────────────────
  const fullName           = dash?.welcome?.name || storedName || "Student";
  const email              = storedEmail || "—";
  const mobile             = storedMobile || "—";
  const license            = dash?.profile?.license || "—";
  const status             = dash?.welcome?.badge || "Improving";

  const sessionsCompleted  = dash?.progress?.sessions_completed ?? 6;
  const sessionsTotal      = dash?.progress?.target_sessions ?? 10;
  const currentDrivingScore = dash?.progress?.current_score ?? 78;

  const instructorName     = dash?.link?.instructor?.name || dash?.link?.instructor?.instructor_name || "—";

  const badges: Badge[]    = Array.isArray(dash?.achievements)
    ? dash.achievements.filter((a: any) => a.earned).map((a: any, i: number) => ({
        id: a.id || `b-${i}`,
        title: a.title || "Badge",
        level: a.level || "Bronze",
        emoji: a.icon || "🏅",
      }))
    : FALLBACK_BADGES;

  const earnedBadgesChips  = badges.slice(0, 3).map((b) => b.title);

  const instructorHistory: InstructorHistory[] = Array.isArray(dash?.instructor_history)
    ? dash.instructor_history
    : FALLBACK_INSTRUCTORS;

  const milestones: Milestone[] = Array.isArray(dash?.milestones)
    ? dash.milestones
    : FALLBACK_MILESTONES;

  const sessionsProgress   = pct(sessionsCompleted, sessionsTotal);
  const scoreProgress      = currentDrivingScore / 100;

  const earnedCount        = milestones.filter((m) => m.status === "Earned").length;
  const motivationBody     = `You're ${Math.round(sessionsProgress * 100)}% through your training program. ${Math.max(0, milestones.length - earnedCount)} more achievements to unlock!`;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6D28D9" />
        <Text style={styles.centerText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>

      {/* Page header */}
      <View style={styles.headerRow}>
        <Ionicons name="person-outline" size={22} color={COLORS.blue} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>My Profile</Text>
          <Text style={styles.pageSubtitle}>View your learning journey and achievements</Text>
        </View>
      </View>

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.blue} />
          <Text style={styles.sectionTitle}>Personal Information</Text>
        </View>

        <View style={styles.personalRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.personalGrid}>
              <InfoBlock label="Full Name"             icon="person-outline"  value={fullName} />
              <InfoBlock label="Email Address"         icon="mail-outline"    value={email} />
              <InfoBlock label="Mobile Number"         icon="call-outline"    value={mobile} />
              <InfoBlock label="Driving License Number" icon="card-outline"   value={license} />
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{status}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Learning Progress ────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trending-up-outline" size={18} color={COLORS.green} />
          <Text style={styles.sectionTitle}>Learning Progress</Text>
        </View>

        <View style={styles.progressCardsRow}>
          {/* Sessions */}
          <View style={[styles.progressCard, { borderColor: "#BBD7FF", backgroundColor: "#EEF5FF" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Sessions Completed</Text>
              <Text style={styles.progressRight}>{sessionsCompleted}/{sessionsTotal}</Text>
            </View>
            <ProgressBar progress={sessionsProgress} />
            <Text style={styles.progressFoot}>{Math.round(sessionsProgress * 100)}% Complete</Text>
          </View>

          {/* Score */}
          <View style={[styles.progressCard, { borderColor: "#D6C6FF", backgroundColor: "#F4EFFF" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Current Driving Score</Text>
              <Text style={styles.progressRight}>{currentDrivingScore}%</Text>
            </View>
            <ProgressBar progress={scoreProgress} />
            <View style={styles.smallPill}>
              <Text style={styles.smallPillText}>{status}</Text>
            </View>
          </View>

          {/* Badges */}
          <View style={[styles.progressCard, { borderColor: "#FFD48A", backgroundColor: "#FFF7E6" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Badges Earned</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="trophy-outline" size={16} color={COLORS.yellow} />
                <Text style={styles.progressRight}>{badges.length}</Text>
              </View>
            </View>
            <View style={styles.badgeChipsRow}>
              {earnedBadgesChips.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.subSectionTitle}>Your Badges</Text>
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>{b.emoji}</Text>
              <Text style={styles.badgeTitle}>{b.title}</Text>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>{b.level}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Instructor History ───────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.purple} />
          <Text style={styles.sectionTitle}>Instructor History</Text>
        </View>

        <View style={{ gap: 14 }}>
          {instructorHistory.map((inst) => (
            <View key={inst.id} style={styles.historyCard}>
              <View style={styles.historyTopRow}>
                <View style={styles.historyAvatar}>
                  <Text style={styles.historyAvatarText}>{initials(inst.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.historyNameRow}>
                    <Text style={styles.historyName}>{inst.name}</Text>
                    <Ionicons name="star" size={14} color={COLORS.yellow} />
                    <Text style={styles.historyRating}>{inst.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.historySub}>{inst.sessionsCompleted} sessions completed</Text>
                </View>
              </View>

              <Text style={styles.notesTitle}>Instructor Notes & Endorsements:</Text>
              <View style={{ gap: 10 }}>
                {inst.notes.map((n, idx) => (
                  <View key={idx} style={styles.notePill}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.blue} style={{ marginRight: 10 }} />
                    <Text style={styles.noteText}>{n}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Milestones & Achievements ────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="medal-outline" size={18} color={COLORS.yellow} />
          <Text style={styles.sectionTitle}>Milestones & Achievements</Text>
        </View>

        <View style={styles.milestoneGrid}>
          {milestones.map((m) => {
            const earned = m.status === "Earned";
            return (
              <View
                key={m.id}
                style={[
                  styles.milestoneCard,
                  earned
                    ? { backgroundColor: "#FFF8E7", borderColor: "#F6C66A" }
                    : { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
                ]}
              >
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <Text style={styles.milestoneTitle}>{m.title}</Text>
                <Text style={[styles.milestoneDesc, !earned && { color: "#94A3B8" }]}>{m.desc}</Text>

                <View style={[styles.earnedPill, earned ? null : styles.lockedPill]}>
                  <Ionicons
                    name={earned ? "checkmark" : "lock-closed"}
                    size={14}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.earnedPillText}>{earned ? "Earned" : "Locked"}</Text>
                </View>

                <Text style={[styles.milestoneDate, !earned && { color: "#CBD5E1" }]}>
                  {earned ? m.date : ""}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.motivationBanner}>
          <Text style={styles.motivationEmoji}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.motivationTitle}>Keep Up the Great Work!</Text>
            <Text style={styles.motivationBody}>{motivationBody}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 6 }} />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBlock({ label, value, icon }: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Ionicons name={icon} size={14} color={COLORS.subtext} style={{ marginRight: 8 }} />
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressBarOuter}>
      <View style={[styles.progressBarInner, { width: `${Math.round(progress * 100)}%` as any }]} />
    </View>
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

  card: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  personalRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 88, height: 88, borderRadius: 999,
    backgroundColor: "#6D67FF",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },

  personalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoBlock: { flexBasis: "48%", flexGrow: 1, minWidth: 150 },
  infoLabel: { color: COLORS.subtext, fontWeight: "800", fontSize: 12 },
  infoValueRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoValue: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  statusPill: {
    marginTop: 12, alignSelf: "flex-start",
    backgroundColor: "#E5EDFF", borderWidth: 1, borderColor: "#BBD7FF",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  statusPillText: { color: COLORS.blue, fontWeight: "900", fontSize: 11 },

  progressCardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  progressCard: { flexGrow: 1, flexBasis: "32%", minWidth: 220, borderWidth: 1, borderRadius: 12, padding: 12 },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  progressRight: { color: COLORS.text, fontWeight: "900", fontSize: 14 },

  progressBarOuter: { marginTop: 10, height: 10, borderRadius: 999, backgroundColor: "#CBD5E1", overflow: "hidden" },
  progressBarInner: { height: "100%", backgroundColor: COLORS.darkBtn },
  progressFoot: { marginTop: 10, color: COLORS.subtext, fontWeight: "800", fontSize: 12 },

  smallPill: {
    marginTop: 10, alignSelf: "flex-start",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  smallPillText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  badgeChipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  subSectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 10 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    flexGrow: 1, flexBasis: "23%", minWidth: 160,
    borderWidth: 1, borderColor: "#F6C66A", backgroundColor: "#FFF8E7",
    borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center",
  },
  badgeEmoji: { fontSize: 24, marginBottom: 8 },
  badgeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  levelPill: {
    marginTop: 10, borderWidth: 1, borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  levelPillText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  historyCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, backgroundColor: "#FFFFFF" },
  historyTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyAvatar: { width: 54, height: 54, borderRadius: 999, backgroundColor: "#6D67FF", alignItems: "center", justifyContent: "center" },
  historyAvatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  historyNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyName: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  historyRating: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  historySub: { marginTop: 6, color: COLORS.subtext, fontWeight: "700", fontSize: 12 },
  notesTitle: { marginTop: 14, color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 8 },
  notePill: {
    backgroundColor: "#EDF5FF", borderWidth: 1, borderColor: "#BBD7FF",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", alignItems: "center",
  },
  noteText: { color: COLORS.blue, fontWeight: "800", fontSize: 12, flex: 1 },

  milestoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  milestoneCard: { flexGrow: 1, flexBasis: "31%", minWidth: 220, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  milestoneEmoji: { fontSize: 26, marginBottom: 10 },
  milestoneTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  milestoneDesc: { marginTop: 8, color: COLORS.text, fontWeight: "700", fontSize: 12, textAlign: "center", lineHeight: 18 },
  earnedPill: {
    marginTop: 12, backgroundColor: COLORS.darkBtn, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center",
  },
  lockedPill: { backgroundColor: "#E2E8F0" },
  earnedPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  milestoneDate: { marginTop: 10, color: COLORS.subtext, fontWeight: "800", fontSize: 12 },

  motivationBanner: {
    backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#B7F2C8",
    borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
  },
  motivationEmoji: { fontSize: 22 },
  motivationTitle: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  motivationBody: { marginTop: 6, color: COLORS.subtext, fontWeight: "800", fontSize: 12, lineHeight: 18 },
});
