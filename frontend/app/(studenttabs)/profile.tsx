import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../../lib/api";
import { colors, type_, radius, space, card, page, divider } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Badge = { id: string; title: string; level: "Bronze" | "Silver" | "Gold"; emoji: string };
type InstructorHistory = { id: string; name: string; rating: number; sessionsCompleted: number; notes: string[] };
type Milestone = { id: string; title: string; desc: string; date?: string; status: "Earned" | "Locked"; emoji: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}
function pct(n: number, d: number) {
  return d <= 0 ? 0 : Math.max(0, Math.min(1, n / d));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const [loading, setLoading]           = useState(true);
  const [dash, setDash]                 = useState<any>(null);
  const [storedName, setStoredName]     = useState("");
  const [storedEmail, setStoredEmail]   = useState("");
  const [storedMobile, setStoredMobile] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      const [name, email, mobile] = await Promise.all([
        AsyncStorage.getItem("driveiq_user_name"),
        AsyncStorage.getItem("driveiq_user_email"),
        AsyncStorage.getItem("driveiq_user_mobile"),
      ]);
      setStoredName(name || "");
      setStoredEmail(email || "");
      setStoredMobile(mobile || "");
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

  // ── Derived values — no hardcoded fallback data ─────────────────────────────
  const fullName            = dash?.welcome?.name || storedName || "—";
  const email               = storedEmail || "—";
  const mobile              = storedMobile || "—";
  const license             = dash?.profile?.license || "—";
  const status              = dash?.welcome?.badge || "—";
  const sessionsCompleted   = dash?.progress?.sessions_completed ?? 0;
  const sessionsTotal       = dash?.progress?.target_sessions ?? 0;
  const currentDrivingScore = dash?.progress?.current_score ?? 0;
  const instructorName      = dash?.link?.instructor?.name || dash?.link?.instructor?.instructor_name || "—";

  // Only show real data from API — no hardcoded fallbacks
  const badges: Badge[] = Array.isArray(dash?.achievements)
    ? dash.achievements.filter((a: any) => a.earned).map((a: any, i: number) => ({
        id: a.id || `b-${i}`, title: a.title || "Badge", level: a.level || "Bronze", emoji: a.icon || "🏅",
      }))
    : [];

  const earnedBadgesChips = badges.slice(0, 3).map((b) => b.title);

  const instructorHistory: InstructorHistory[] = Array.isArray(dash?.instructor_history)
    ? dash.instructor_history : [];

  const milestones: Milestone[] = Array.isArray(dash?.milestones)
    ? dash.milestones : [];

  const sessionsProgress = pct(sessionsCompleted, sessionsTotal);
  const scoreProgress    = currentDrivingScore / 100;
  const earnedCount      = milestones.filter((m) => m.status === "Earned").length;
  const motivationBody   = sessionsTotal > 0
    ? `You're ${Math.round(sessionsProgress * 100)}% through your training program. ${Math.max(0, milestones.length - earnedCount)} more achievements to unlock!`
    : "Complete your first session to start tracking your progress.";

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.headerRow}>
        <Ionicons name="person-outline" size={22} color={colors.blue} />
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>My Profile</Text>
          <Text style={s.pageSubtitle}>View your learning journey and achievements</Text>
        </View>
      </View>

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={18} color={colors.blue} />
          <Text style={s.sectionTitle}>Personal Information</Text>
        </View>

        <View style={s.personalRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{fullName !== "—" ? initials(fullName) : "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.personalGrid}>
              <InfoBlock label="Full Name"              icon="person-outline"  value={fullName} />
              <InfoBlock label="Email Address"          icon="mail-outline"    value={email} />
              <InfoBlock label="Mobile Number"          icon="call-outline"    value={mobile} />
              <InfoBlock label="Driving License Number" icon="card-outline"    value={license} />
            </View>
            {status !== "—" && (
              <View style={s.statusPill}>
                <Text style={s.statusPillText}>{status}</Text>
              </View>
            )}
            {instructorName !== "—" && (
              <View style={[s.statusPill, { marginTop: 8, backgroundColor: colors.greenLight, borderColor: colors.greenBorderAlt }]}>
                <Text style={[s.statusPillText, { color: colors.greenDark }]}>Instructor: {instructorName}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Learning Progress ────────────────────────────────────────────── */}
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="trending-up-outline" size={18} color={colors.green} />
          <Text style={s.sectionTitle}>Learning Progress</Text>
        </View>

        <View style={s.progressCardsRow}>
          <View style={[s.progressCard, { borderColor: colors.blueChip, backgroundColor: "#EEF5FF" }]}>
            <View style={s.progressTop}>
              <Text style={s.progressLabel}>Sessions Completed</Text>
              <Text style={s.progressRight}>
                {sessionsTotal > 0 ? `${sessionsCompleted}/${sessionsTotal}` : `${sessionsCompleted}`}
              </Text>
            </View>
            <ProgressBar progress={sessionsProgress} />
            <Text style={s.progressFoot}>{Math.round(sessionsProgress * 100)}% Complete</Text>
          </View>

          <View style={[s.progressCard, { borderColor: colors.purpleBorderAlt, backgroundColor: colors.purpleLighter }]}>
            <View style={s.progressTop}>
              <Text style={s.progressLabel}>Current Driving Score</Text>
              <Text style={s.progressRight}>{currentDrivingScore > 0 ? `${currentDrivingScore}%` : "—"}</Text>
            </View>
            <ProgressBar progress={scoreProgress} />
            {status !== "—" && (
              <View style={s.smallPill}><Text style={s.smallPillText}>{status}</Text></View>
            )}
          </View>

          <View style={[s.progressCard, { borderColor: colors.yellowBorderAlt, backgroundColor: colors.yellowLighter }]}>
            <View style={s.progressTop}>
              <Text style={s.progressLabel}>Badges Earned</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="trophy-outline" size={16} color={colors.yellow} />
                <Text style={s.progressRight}>{badges.length}</Text>
              </View>
            </View>
            {earnedBadgesChips.length > 0 && (
              <View style={s.badgeChipsRow}>
                {earnedBadgesChips.map((c) => (
                  <View key={c} style={s.chip}><Text style={s.chipText}>{c}</Text></View>
                ))}
              </View>
            )}
            {badges.length === 0 && (
              <Text style={s.progressFoot}>Complete sessions to earn badges</Text>
            )}
          </View>
        </View>

        <View style={divider.base} />

        <Text style={s.subSectionTitle}>Your Badges</Text>
        {badges.length === 0 ? (
          <EmptyState text="No badges earned yet. Keep driving!" />
        ) : (
          <View style={s.badgeGrid}>
            {badges.map((b) => (
              <View key={b.id} style={s.badgeCard}>
                <Text style={s.badgeEmoji}>{b.emoji}</Text>
                <Text style={s.badgeTitle}>{b.title}</Text>
                <View style={s.levelPill}><Text style={s.levelPillText}>{b.level}</Text></View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Instructor History ───────────────────────────────────────────── */}
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="sparkles-outline" size={18} color={colors.purple} />
          <Text style={s.sectionTitle}>Instructor History</Text>
        </View>

        {instructorHistory.length === 0 ? (
          <EmptyState text="No instructor history yet." />
        ) : (
          <View style={{ gap: 14 }}>
            {instructorHistory.map((inst) => (
              <View key={inst.id} style={s.historyCard}>
                <View style={s.historyTopRow}>
                  <View style={s.historyAvatar}>
                    <Text style={s.historyAvatarText}>{initials(inst.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.historyNameRow}>
                      <Text style={s.historyName}>{inst.name}</Text>
                      <Ionicons name="star" size={14} color={colors.yellow} />
                      <Text style={s.historyRating}>{inst.rating.toFixed(1)}</Text>
                    </View>
                    <Text style={s.historySub}>{inst.sessionsCompleted} sessions completed</Text>
                  </View>
                </View>
                {inst.notes.length > 0 && (
                  <>
                    <Text style={s.notesTitle}>Instructor Notes & Endorsements:</Text>
                    <View style={{ gap: 10 }}>
                      {inst.notes.map((n, idx) => (
                        <View key={idx} style={s.notePill}>
                          <Ionicons name="checkmark-circle-outline" size={16} color={colors.blue} style={{ marginRight: 10 }} />
                          <Text style={s.noteText}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Milestones & Achievements ────────────────────────────────────── */}
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="medal-outline" size={18} color={colors.yellow} />
          <Text style={s.sectionTitle}>Milestones & Achievements</Text>
        </View>

        {milestones.length === 0 ? (
          <EmptyState text="Complete sessions to start unlocking milestones." />
        ) : (
          <View style={s.milestoneGrid}>
            {milestones.map((m) => {
              const earned = m.status === "Earned";
              return (
                <View key={m.id} style={[
                  s.milestoneCard,
                  earned ? { backgroundColor: colors.yellowLight, borderColor: "#F6C66A" }
                          : { backgroundColor: colors.pageBg, borderColor: colors.borderMid },
                ]}>
                  <Text style={s.milestoneEmoji}>{m.emoji}</Text>
                  <Text style={s.milestoneTitle}>{m.title}</Text>
                  <Text style={[s.milestoneDesc, !earned && { color: "#94A3B8" }]}>{m.desc}</Text>
                  <View style={[s.earnedPill, earned ? null : s.lockedPill]}>
                    <Ionicons
                      name={earned ? "checkmark" : "lock-closed"} size={14} color="#FFFFFF" style={{ marginRight: 8 }}
                    />
                    <Text style={s.earnedPillText}>{earned ? "Earned" : "Locked"}</Text>
                  </View>
                  {earned && m.date && (
                    <Text style={s.milestoneDate}>{m.date}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={divider.base} />

        <View style={s.motivationBanner}>
          <Text style={s.motivationEmoji}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.motivationTitle}>Keep Up the Great Work!</Text>
            <Text style={s.motivationBody}>{motivationBody}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 6 }} />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBlock({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.infoBlock}>
      <Text style={s.infoLabel}>{label}</Text>
      <View style={s.infoValueRow}>
        <Ionicons name={icon} size={14} color={colors.subtext} style={{ marginRight: 8 }} />
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={s.progressBarOuter}>
      <View style={[s.progressBarInner, { width: `${Math.round(progress * 100)}%` as any }]} />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ paddingVertical: 12, alignItems: "center" }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.subtext, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { flex: 1, backgroundColor: colors.pageBgAlt },
  pageContent: { padding: space.page, paddingBottom: 28, gap: 14 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  headerRow:   { flexDirection: "row", alignItems: "center", gap: space.md },
  pageTitle:   { ...type_.pageTitle },
  pageSubtitle:{ ...type_.pageSubtitle },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  sectionTitle:    { ...type_.sectionTitle },

  personalRow:  { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar:       { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  avatarText:   { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
  personalGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  infoBlock:    { flexBasis: "48%", flexGrow: 1, minWidth: 150 },
  infoLabel:    { ...type_.labelSm },
  infoValueRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoValue:    { ...type_.body, fontWeight: "900" },

  statusPill:     { marginTop: 12, alignSelf: "flex-start", backgroundColor: colors.purpleChip, borderWidth: 1, borderColor: colors.blueChip, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { color: colors.blue, fontWeight: "900", fontSize: 11 },

  progressCardsRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  progressCard:     { flexGrow: 1, flexBasis: "32%", minWidth: 220, borderWidth: 1, borderRadius: radius.input, padding: space.md },
  progressTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel:    { ...type_.body, fontWeight: "900", color: colors.text },
  progressRight:    { ...type_.body, fontWeight: "900", fontSize: 14, color: colors.text },
  progressBarOuter: { marginTop: 10, height: 10, borderRadius: radius.pill, backgroundColor: "#CBD5E1", overflow: "hidden" },
  progressBarInner: { height: "100%", backgroundColor: colors.darkBtn },
  progressFoot:     { marginTop: 10, ...type_.labelSm },

  smallPill:     { marginTop: 10, alignSelf: "flex-start", backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  smallPillText: { ...type_.chip },

  badgeChipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip:          { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText:      { ...type_.chip },

  subSectionTitle: { ...type_.sectionTitle, marginBottom: 10 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  badgeCard: { flexGrow: 1, flexBasis: "23%", minWidth: 160, borderWidth: 1, borderColor: "#F6C66A", backgroundColor: colors.yellowLight, borderRadius: radius.input, padding: 14, alignItems: "center", justifyContent: "center" },
  badgeEmoji:{ fontSize: 24, marginBottom: 8 },
  badgeTitle:{ ...type_.body, fontWeight: "900", textAlign: "center" },
  levelPill: { marginTop: 10, borderWidth: 1, borderColor: colors.borderMid, backgroundColor: colors.cardBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  levelPillText: { ...type_.chip },

  historyCard:      { borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radius.input, padding: 14, backgroundColor: colors.cardBg },
  historyTopRow:    { flexDirection: "row", alignItems: "center", gap: space.md },
  historyAvatar:    { width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  historyAvatarText:{ color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  historyNameRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  historyName:      { ...type_.sectionTitle },
  historyRating:    { ...type_.body, fontWeight: "900", color: colors.text },
  historySub:       { marginTop: 6, ...type_.labelSm },
  notesTitle:       { marginTop: 14, ...type_.body, fontWeight: "900", marginBottom: 8 },
  notePill:         { backgroundColor: colors.blueNote, borderWidth: 1, borderColor: colors.blueNoteBorder, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  noteText:         { color: colors.blue, fontWeight: "800", fontSize: 12, flex: 1 },

  milestoneGrid:  { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  milestoneCard:  { flexGrow: 1, flexBasis: "31%", minWidth: 220, borderWidth: 1, borderRadius: radius.input, padding: 14, alignItems: "center" },
  milestoneEmoji: { fontSize: 26, marginBottom: 10 },
  milestoneTitle: { ...type_.body, fontWeight: "900", textAlign: "center" },
  milestoneDesc:  { marginTop: 8, ...type_.body, textAlign: "center", lineHeight: 18 },
  earnedPill:     { marginTop: 12, backgroundColor: colors.darkBtn, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  lockedPill:     { backgroundColor: colors.borderMid },
  earnedPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  milestoneDate:  { marginTop: 10, ...type_.labelSm },

  motivationBanner: { backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radius.input, padding: 14, flexDirection: "row", alignItems: "center", gap: space.md },
  motivationEmoji:  { fontSize: 22 },
  motivationTitle:  { ...type_.sectionTitle },
  motivationBody:   { marginTop: 6, ...type_.labelSm, lineHeight: 18 },
});
