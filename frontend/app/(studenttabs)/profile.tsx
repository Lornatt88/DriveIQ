import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.max(0, Math.min(1, n / d));
}

export default function Profile() {
  // Mock profile data (same vibe as Sessions/Reports)
  const profile = useMemo(
    () => ({
      fullName: "Sarah Mitchell",
      email: "sarah.mitchell@example.com",
      mobile: "+1 (555) 123-4567",
      license: "DL-2847-9320",
      status: "Improving" as const,

      sessionsCompleted: 6,
      sessionsTotal: 10,
      currentDrivingScore: 78,
      badgesEarnedCount: 4,
      earnedBadgesChips: ["Safe Braking", "Lane Master", "Speed Control"],

      badges: [
        { id: "b1", title: "Safe Braking", level: "Bronze", emoji: "🛑" },
        { id: "b2", title: "Lane Master", level: "Silver", emoji: "🛣️" },
        { id: "b3", title: "Speed Control", level: "Gold", emoji: "⚡" },
        { id: "b4", title: "Mirror Check Pro", level: "Silver", emoji: "👀" },
      ] as Badge[],

      instructorHistory: [
        {
          id: "i1",
          name: "John Davis",
          rating: 4.5,
          sessionsCompleted: 4,
          notes: [
            '"Shows great improvement session after session"',
            '"Good focus and listens to instructions well"',
          ],
        },
        {
          id: "i2",
          name: "Aisha Rahman",
          rating: 4.8,
          sessionsCompleted: 2,
          notes: ['"Excellent mirror checks and lane discipline"', '"Very calm and confident driver"'],
        },
      ] as InstructorHistory[],

      milestones: [
        {
          id: "m1",
          emoji: "⭐",
          title: "First 80% Score",
          desc: "Achieved your first session score of 80% or higher",
          status: "Earned",
          date: "Nov 13, 2025",
        },
        {
          id: "m2",
          emoji: "🛡️",
          title: "3 Sessions Without Alerts",
          desc: "Completed 3 consecutive sessions with no safety alerts",
          status: "Earned",
          date: "Nov 11, 2025",
        },
        {
          id: "m3",
          emoji: "✅",
          title: "Perfect Attendance",
          desc: "Attended all scheduled sessions without cancellation",
          status: "Earned",
          date: "Nov 9, 2025",
        },
        {
          id: "m4",
          emoji: "⚡",
          title: "Speed Master",
          desc: "Maintained optimal speed throughout an entire session",
          status: "Earned",
          date: "Nov 6, 2025",
        },
        {
          id: "m5",
          emoji: "🎯",
          title: "Lane Discipline Pro",
          desc: "Complete a session with zero lane drift incidents",
          status: "Locked",
          lockedHint: "Locked",
        },
        {
          id: "m6",
          emoji: "🏆",
          title: "Safe Braking Champion",
          desc: "Achieve smooth braking in all stops for one session",
          status: "Locked",
          lockedHint: "Locked",
        },
      ] as Milestone[],

      motivationTitle: "Keep Up the Great Work!",
      motivationBody: "You're 60% through your training program. 2 more achievements to unlock!",
    }),
    []
  );

  const sessionsProgress = pct(profile.sessionsCompleted, profile.sessionsTotal);
  const scoreProgress = profile.currentDrivingScore / 100;

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

      {/* Personal Information */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.blue} />
          <Text style={styles.sectionTitle}>Personal Information</Text>
        </View>

        <View style={styles.personalRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile.fullName)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.personalGrid}>
              <InfoBlock
                label="Full Name"
                icon="person-outline"
                value={profile.fullName}
              />
              <InfoBlock
                label="Email Address"
                icon="mail-outline"
                value={profile.email}
              />
              <InfoBlock
                label="Mobile Number"
                icon="call-outline"
                value={profile.mobile}
              />
              <InfoBlock
                label="Driving License Number"
                icon="card-outline"
                value={profile.license}
              />
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{profile.status}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Learning Progress */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trending-up-outline" size={18} color={COLORS.green} />
          <Text style={styles.sectionTitle}>Learning Progress</Text>
        </View>

        <View style={styles.progressCardsRow}>
          {/* Sessions Completed */}
          <View style={[styles.progressCard, { borderColor: "#BBD7FF", backgroundColor: "#EEF5FF" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Sessions Completed</Text>
              <Text style={styles.progressRight}>
                {profile.sessionsCompleted}/{profile.sessionsTotal}
              </Text>
            </View>

            <ProgressBar progress={sessionsProgress} />

            <Text style={styles.progressFoot}>{Math.round(sessionsProgress * 100)}% Complete</Text>
          </View>

          {/* Current Driving Score */}
          <View style={[styles.progressCard, { borderColor: "#D6C6FF", backgroundColor: "#F4EFFF" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Current Driving Score</Text>
              <Text style={styles.progressRight}>{profile.currentDrivingScore}%</Text>
            </View>

            <ProgressBar progress={scoreProgress} />

            <View style={styles.smallPill}>
              <Text style={styles.smallPillText}>Improving</Text>
            </View>
          </View>

          {/* Badges Earned */}
          <View style={[styles.progressCard, { borderColor: "#FFD48A", backgroundColor: "#FFF7E6" }]}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Badges Earned</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="trophy-outline" size={16} color={COLORS.yellow} />
                <Text style={styles.progressRight}>{profile.badgesEarnedCount}</Text>
              </View>
            </View>

            <View style={styles.badgeChipsRow}>
              {profile.earnedBadgesChips.map((c) => (
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
          {profile.badges.map((b) => (
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

      {/* Instructor History */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.purple} />
          <Text style={styles.sectionTitle}>Instructor History</Text>
        </View>

        <View style={{ gap: 14 }}>
          {profile.instructorHistory.map((i) => (
            <View key={i.id} style={styles.historyCard}>
              <View style={styles.historyTopRow}>
                <View style={styles.historyAvatar}>
                  <Text style={styles.historyAvatarText}>{initials(i.name)}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.historyNameRow}>
                    <Text style={styles.historyName}>{i.name}</Text>
                    <Ionicons name="star" size={14} color={COLORS.yellow} />
                    <Text style={styles.historyRating}>{i.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.historySub}>{i.sessionsCompleted} sessions completed</Text>
                </View>
              </View>

              <Text style={styles.notesTitle}>Instructor Notes & Endorsements:</Text>

              <View style={{ gap: 10 }}>
                {i.notes.map((n, idx) => (
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

      {/* Milestones & Achievements */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="medal-outline" size={18} color={COLORS.yellow} />
          <Text style={styles.sectionTitle}>Milestones & Achievements</Text>
        </View>

        <View style={styles.milestoneGrid}>
          {profile.milestones.map((m) => {
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
            <Text style={styles.motivationTitle}>{profile.motivationTitle}</Text>
            <Text style={styles.motivationBody}>{profile.motivationBody}</Text>
          </View>
        </View>
      </View>

      {/* little spacing */}
      <View style={{ height: 6 }} />
    </ScrollView>
  );
}

/* ---------- Small UI pieces ---------- */

function InfoBlock({
  label,
  value,
  icon,
}: {
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
      <View style={[styles.progressBarInner, { width: `${Math.round(progress * 100)}%` }]} />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },
  pageContent: { padding: 16, paddingBottom: 28, gap: 14 },

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
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: "#6D67FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },

  personalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoBlock: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 150,
  },
  infoLabel: { color: COLORS.subtext, fontWeight: "800", fontSize: 12 },
  infoValueRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoValue: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  statusPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#E5EDFF",
    borderWidth: 1,
    borderColor: "#BBD7FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: { color: COLORS.blue, fontWeight: "900", fontSize: 11 },

  progressCardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  progressCard: {
    flexGrow: 1,
    flexBasis: "32%",
    minWidth: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  progressRight: { color: COLORS.text, fontWeight: "900", fontSize: 14 },

  progressBarOuter: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    overflow: "hidden",
  },
  progressBarInner: { height: "100%", backgroundColor: COLORS.darkBtn },

  progressFoot: { marginTop: 10, color: COLORS.subtext, fontWeight: "800", fontSize: 12 },

  smallPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallPillText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  badgeChipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  subSectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 10 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    flexGrow: 1,
    flexBasis: "23%",
    minWidth: 160,
    borderWidth: 1,
    borderColor: "#F6C66A",
    backgroundColor: "#FFF8E7",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmoji: { fontSize: 24, marginBottom: 8 },
  badgeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  levelPill: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelPillText: { color: COLORS.text, fontWeight: "900", fontSize: 11 },

  historyCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  historyTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#6D67FF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyAvatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  historyNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyName: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  historyRating: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  historySub: { marginTop: 6, color: COLORS.subtext, fontWeight: "700", fontSize: 12 },

  notesTitle: { marginTop: 14, color: COLORS.text, fontWeight: "900", fontSize: 12, marginBottom: 8 },

  notePill: {
    backgroundColor: "#EDF5FF",
    borderWidth: 1,
    borderColor: "#BBD7FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  noteText: { color: COLORS.blue, fontWeight: "800", fontSize: 12, flex: 1 },

  milestoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  milestoneCard: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  milestoneEmoji: { fontSize: 26, marginBottom: 10 },
  milestoneTitle: { color: COLORS.text, fontWeight: "900", fontSize: 12, textAlign: "center" },
  milestoneDesc: { marginTop: 8, color: COLORS.text, fontWeight: "700", fontSize: 12, textAlign: "center", lineHeight: 18 },

  earnedPill: {
    marginTop: 12,
    backgroundColor: COLORS.darkBtn,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  lockedPill: { backgroundColor: "#E2E8F0" },
  earnedPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  milestoneDate: { marginTop: 10, color: COLORS.subtext, fontWeight: "800", fontSize: 12 },

  motivationBanner: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#B7F2C8",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  motivationEmoji: { fontSize: 22 },
  motivationTitle: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  motivationBody: { marginTop: 6, color: COLORS.subtext, fontWeight: "800", fontSize: 12, lineHeight: 18 },
});
