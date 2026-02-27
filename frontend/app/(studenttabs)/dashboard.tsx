import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiGet } from "../../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportStatus = "Passed" | "Needs Improvement";

type RecentReport = {
  id: string;
  date: string;
  instructor: string;
  score: number;
  status: ReportStatus;
};

type FeedbackArea = {
  id: string;
  title: string;
  score: number;
  hint: string;
  icon: string;
};

type CommentItem = {
  id: string;
  date: string;
  text: string;
  rating: number;
};

type Achievement = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  earned: boolean;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await apiGet("/dashboard/trainee");
      setDash(data);
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  useFocusEffect(
    useCallback(() => { loadDashboard(); }, [])
  );

  // ── Data derivations ──────────────────────────────────────────────────────
  const studentName = dash?.welcome?.name ?? "Zaid Osama";
  const sessionsCompleted = dash?.progress?.sessions_completed ?? 6;
  const sessionsTotal = dash?.progress?.target_sessions ?? 10;
  const completedPct = Math.round((sessionsCompleted / Math.max(1, sessionsTotal)) * 100);
  const currentDrivingScore = dash?.progress?.current_score ?? 78;
  const scoreLabel = dash?.welcome?.badge ?? "Improving";
  const goalText = dash?.progress?.goal_text ?? "Reach 80% to unlock your Safe Driver badge";
  const instructorName = dash?.link?.instructor?.name ?? dash?.link?.instructor?.instructor_name ?? "—";

  const upcoming = useMemo(() => {
    const u = dash?.upcoming_session;
    const dateISO = u?.dateISO || u?.date_iso || u?.date || "2026-11-16";
    const dateLabel = u?.dateLabel || u?.date_label || (dateISO ? new Date(dateISO).toLocaleDateString() : "—");
    const timeLabel = u?.timeLabel || u?.time_label || u?.time || "2:00 PM";
    const instructor = u?.instructor || u?.instructor_name || instructorName || "—";
    const vehicle = u?.vehicle || u?.vehicle_id || "VEH-2847";
    return { dateISO, dateLabel, timeLabel, instructor, vehicle };
  }, [dash, instructorName]);

  const countdownLabel = useMemo(() => {
    const now = new Date();
    const d = new Date(upcoming.dateISO + "T00:00:00");
    const ms = d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    if (Number.isNaN(days)) return "—";
    if (days > 1) return `${days} days away`;
    if (days === 1) return "Tomorrow";
    if (days === 0) return "Today";
    return "Session passed";
  }, [upcoming.dateISO]);

  const reports: RecentReport[] = useMemo(() => {
    const list = Array.isArray(dash?.recent_reports) ? dash.recent_reports : null;
    if (!list) {
      return [
        { id: "rep1", date: "Nov 13, 2025", instructor: "John Davis", score: 82, status: "Passed" },
        { id: "rep2", date: "Nov 11, 2025", instructor: "John Davis", score: 76, status: "Passed" },
        { id: "rep3", date: "Nov 9, 2025", instructor: "Sarah Johnson", score: 65, status: "Needs Improvement" },
      ];
    }
    return list.map((r: any, idx: number) => {
      const score = r?.score?.overall ?? r?.score ?? 0;
      const status: ReportStatus = score >= 70 ? "Passed" : "Needs Improvement";
      const date = r?.date_label || r?.date || (r?.created_at ? new Date(r.created_at).toLocaleDateString() : "—");
      const instructor = r?.instructor_name || r?.instructor || instructorName || "—";
      return { id: r?.id || r?._id || r?.trip_id || `rep-${idx}`, date, instructor, score, status };
    });
  }, [dash, instructorName]);

  const feedback: FeedbackArea[] = useMemo(() => {
    const list = Array.isArray(dash?.ai_feedback) ? dash.ai_feedback : null;
    if (!list) {
      return [
        { id: "f1", title: "Braking", score: 65, hint: "Work on smoother braking", icon: "📈" },
        { id: "f2", title: "Lane Discipline", score: 70, hint: "Practice lane discipline", icon: "🎯" },
        { id: "f3", title: "Speed Control", score: 82, hint: "Maintain consistent speed", icon: "📊" },
      ];
    }
    return list.map((f: any, idx: number) => ({
      id: f?.id || `f-${idx}`,
      title: f?.title || f?.area || "Tip",
      score: typeof f?.score === "number" ? f.score : 0,
      hint: f?.message || f?.hint || "",
      icon: f?.icon || "💡",
    }));
  }, [dash]);

  const comments: CommentItem[] = useMemo(() => {
    const list = Array.isArray(dash?.instructor_comments) ? dash.instructor_comments : null;
    if (!list) {
      return [
        { id: "c1", date: "Nov 13, 2025", text: "Great improvement in turning accuracy. Keep up the good work!", rating: 4.5 },
        { id: "c2", date: "Nov 11, 2025", text: "Focus more on mirror checks before lane changes.", rating: 4.0 },
      ];
    }
    return list.map((c: any, idx: number) => ({
      id: c?.id || `c-${idx}`,
      date: c?.date ? c.date : c?.created_at ? new Date(c.created_at).toLocaleDateString() : "—",
      text: c?.text || c?.comment || "",
      rating: c?.rating ?? 4.0,
    }));
  }, [dash]);

  const achievements: Achievement[] = useMemo(() => {
    const list = Array.isArray(dash?.achievements) ? dash.achievements : null;
    if (!list) {
      return [
        { id: "a1", title: "First Drive", subtitle: "Completed your first session", icon: "🚗", earned: true },
        { id: "a2", title: "Safe Driver", subtitle: "Completed 5 safe driving sessions", icon: "🛡️", earned: true },
        { id: "a3", title: "Speed Master", subtitle: "Improved speed control by 20%", icon: "⚡", earned: true },
        { id: "a4", title: "Perfect Score", subtitle: "Score 90% or higher in a session", icon: "⭐", earned: false },
      ];
    }
    return list.map((a: any, idx: number) => ({
      id: a?.id || `a-${idx}`,
      title: a?.title || "Achievement",
      subtitle: a?.subtitle || a?.desc || "",
      icon: a?.icon || "🏅",
      earned: !!a?.earned,
    }));
  }, [dash]);

  const onReschedule = () => router.push("/(studenttabs)/sessions");
  const onViewReport = (_reportId: string) => router.push("/(studenttabs)/reports");

  // ── Score badge color ─────────────────────────────────────────────────────
  const scoreBadgeColor =
    currentDrivingScore >= 85 ? "#16A34A" :
    currentDrivingScore >= 70 ? "#2563EB" : "#DC2626";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6D28D9" />
        <Text style={s.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>

      {/* ── 1. Hero ───────────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroHello}>Hello, {studentName} 👋</Text>
          <Text style={s.heroSub}>
            Great to see you back! Let's keep improving your driving skills.
          </Text>
          <Text style={[s.heroSub, { marginTop: 4 }]}>
            Instructor: {instructorName}
          </Text>
        </View>
        <View style={s.heroIconBubble}>
          <Text style={s.heroIconText}>🚗</Text>
        </View>
      </View>

      {/* ── 2. Progress ──────────────────────────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="🏆" iconBg="#FEF3C7" label="Your Progress" />

        <View style={[s.progressGrid, isWide && { flexDirection: "row" }]}>

          {/* Sessions */}
          <View style={[s.progressItem, isWide && { flex: 1 }]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Sessions Completed</Text>
              <Text style={s.progressMeta}>{sessionsCompleted}/{sessionsTotal}</Text>
            </View>
            <ProgressBar pct={completedPct} color="#6D28D9" />
            <Text style={s.progressHint}>
              {Math.max(0, sessionsTotal - sessionsCompleted)} sessions remaining
            </Text>
          </View>

          {/* Score */}
          <View style={[s.progressItem, isWide && { flex: 1 }]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Current Driving Score</Text>
              <View style={s.scoreBadgeRow}>
                <Text style={s.scoreBig}>{currentDrivingScore}%</Text>
                <View style={[s.scoreBadge, { backgroundColor: scoreBadgeColor }]}>
                  <Text style={s.scoreBadgeText}>{scoreLabel}</Text>
                </View>
              </View>
            </View>
            <ProgressBar pct={Math.min(100, Math.max(0, currentDrivingScore))} color={scoreBadgeColor} />
          </View>

          {/* Goal */}
          <View style={[s.goalBox, isWide && { flex: 1 }]}>
            <View style={s.goalIconWrap}>
              <Text style={{ fontSize: 18 }}>🎯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.goalTitle}>Next Goal</Text>
              <Text style={s.goalText}>{goalText}</Text>
            </View>
          </View>
        </View>

        {/* ── Upcoming session (inside progress card, matching Figma) */}
        <View style={s.divider} />
        <SectionHeader icon="🗓️" iconBg="#DCFCE7" label="Upcoming Session" />

        <View style={[s.upcomingRow, isWide && { flexDirection: "row" }]}>
          <InfoPill label="Date"       value={upcoming.dateLabel}  icon="🗓️" bg="#EEF2FF" border="#C7D2FE" />
          <InfoPill label="Time"       value={upcoming.timeLabel}  icon="🕑" bg="#F3E8FF" border="#DDD6FE" />
          <InfoPill label="Instructor" value={upcoming.instructor} icon="👤" bg="#DCFCE7" border="#BBF7D0" />
          <InfoPill label="Vehicle"    value={upcoming.vehicle}    icon="🚘" bg="#FEF3C7" border="#FDE68A" />
        </View>

        <View style={s.countdownRow}>
          <Text style={s.countdownText}>🕒 {countdownLabel}</Text>
          <Pressable
            onPress={onReschedule}
            style={({ pressed }) => [s.outlineBtn, { marginTop: 0 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.outlineBtnText}>Reschedule</Text>
          </Pressable>
        </View>
      </View>

      {/* ── 3. Reports + AI Feedback ─────────────────────────────────────── */}
      <View style={[s.twoCol, isWide && { flexDirection: "row" }]}>

        {/* Recent Reports */}
        <View style={[s.card, isWide && { flex: 1 }]}>
          <SectionHeader icon="📄" iconBg="#DBEAFE" label="Recent Reports" />

          <View style={{ marginTop: 12, gap: 10 }}>
            {reports.map((r) => (
              <View key={r.id} style={s.reportCard}>
                <View style={s.reportTop}>
                  <View>
                    <Text style={s.reportDate}>{r.date}</Text>
                    <Text style={s.reportSub}>Instructor: {r.instructor}</Text>
                  </View>
                  <View style={[
                    s.statusPill,
                    r.status === "Passed" ? s.statusPassed : s.statusNeeds,
                  ]}>
                    <Text style={[
                      s.statusText,
                      r.status === "Passed" ? s.statusPassedText : s.statusNeedsText,
                    ]}>
                      {r.status === "Passed" ? "✓ Passed" : "Needs Work"}
                    </Text>
                  </View>
                </View>

                <View style={s.reportBottom}>
                  <Text style={s.reportScoreLabel}>
                    Score: <Text style={[s.reportScoreValue, { color: r.score >= 70 ? "#16A34A" : "#DC2626" }]}>{r.score}%</Text>
                  </Text>
                  <Pressable
                    onPress={() => onViewReport(r.id)}
                    style={({ pressed }) => [s.outlineBtn, { marginTop: 0, paddingHorizontal: 12, paddingVertical: 8 }, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={s.outlineBtnText}>View Report →</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* AI Feedback */}
        <View style={[s.card, isWide && { flex: 1 }]}>
          <SectionHeader icon="💡" iconBg="#FEF9C3" label="AI Feedback" />

          <View style={{ marginTop: 12, gap: 16 }}>
            {feedback.map((f) => (
              <View key={f.id}>
                <View style={s.fbRow}>
                  <View style={s.fbLeft}>
                    <Text style={{ fontSize: 14 }}>{f.icon}</Text>
                    <Text style={s.fbTitle}>{f.title}</Text>
                  </View>
                  <Text style={s.fbPct}>{f.score}%</Text>
                </View>
                <ProgressBar pct={Math.min(100, Math.max(0, f.score))} color="#6D28D9" />
                <Text style={s.fbHint}>"{f.hint}"</Text>
              </View>
            ))}
          </View>

          <View style={s.tipBox}>
            <Text style={s.tipText}>
              💡 Focus on your lowest-scoring areas to see the biggest improvements!
            </Text>
          </View>
        </View>
      </View>

      {/* ── 4. Instructor Comments ────────────────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="💬" iconBg="#F3E8FF" label="Instructor Comments" />

        <View style={[s.commentsGrid, isWide && { flexDirection: "row" }]}>
          {comments.map((c) => (
            <View key={c.id} style={[s.commentCard, isWide && { flex: 1 }]}>
              <View style={s.commentTop}>
                <Text style={s.commentDate}>{c.date}</Text>
                <View style={s.ratingRow}>
                  <Text style={{ fontSize: 13 }}>⭐</Text>
                  <Text style={s.ratingText}>{c.rating}</Text>
                </View>
              </View>
              <Text style={s.commentText}>{c.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 5. Achievements ──────────────────────────────────────────────── */}
      <View style={s.card}>
        <SectionHeader icon="🏅" iconBg="#FEF3C7" label="Achievements & Milestones" />

        <View style={[s.achGrid, isWide && { flexDirection: "row" }]}>
          {achievements.map((a) => (
            <View
              key={a.id}
              style={[
                s.achCard,
                isWide && { flex: 1 },
                a.earned ? s.achEarned : s.achLocked,
              ]}
            >
              <Text style={s.achIcon}>{a.icon}</Text>
              <Text style={s.achTitle}>{a.title}</Text>
              <Text style={s.achSub}>{a.subtitle}</Text>
              <View style={[s.earnedPill, a.earned ? s.earnedOn : s.earnedOff]}>
                <Text style={[s.earnedText, a.earned ? s.earnedTextOn : s.earnedTextOff]}>
                  {a.earned ? "✓ Earned" : "Locked"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Motivation banner */}
        <View style={s.motivationBanner}>
          <Text style={s.motivationEmoji}>🎉</Text>
          <Text style={s.motivationText}>You're on track to pass — keep practicing!</Text>
          <Text style={s.motivationSub}>You've improved your overall score by 12% this month.</Text>
        </View>

        <Pressable
          onPress={loadDashboard}
          style={({ pressed }) => [s.outlineBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.outlineBtnText}>↻ Refresh</Text>
        </Pressable>
      </View>

      <Text style={s.footer}>© 2025 DriveIQ · Student Portal</Text>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, iconBg, label }: { icon: string; iconBg: string; label: string }) {
  return (
    <View style={sh.row}>
      <View style={[sh.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={sh.iconText}>{icon}</Text>
      </View>
      <Text style={sh.label}>{label}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: "900", color: "#101828" },
});

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 8, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginVertical: 6 },
  fill: { height: "100%", borderRadius: 999 },
});

function InfoPill({ label, value, icon, bg, border }: {
  label: string; value: string; icon: string; bg: string; border: string;
}) {
  return (
    <View style={ip.wrap}>
      <View style={[ip.iconWrap, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ip.label}>{label}</Text>
        <Text style={ip.value}>{value}</Text>
      </View>
    </View>
  );
}

const ip = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 160 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, fontWeight: "800", color: "#667085" },
  value: { fontSize: 12, fontWeight: "900", color: "#101828", marginTop: 2 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 32, gap: 14 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { marginTop: 12, fontSize: 13, fontWeight: "800", color: "#64748B" },

  // Hero
  hero: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#6D28D9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Subtle gradient-like effect using a slightly lighter bottom border
    borderBottomColor: "#5B21B6",
    borderBottomWidth: 2,
  },
  heroHello: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  heroSub: { color: "rgba(255,255,255,0.82)", fontWeight: "700", fontSize: 12, marginTop: 6, maxWidth: 280 },
  heroIconBubble: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroIconText: { fontSize: 26 },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    padding: 16,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: "900", color: "#101828" },

  // Progress section
  progressGrid: { flexDirection: "column", gap: 16, marginTop: 12 },
  progressItem: { gap: 2 },
  progressLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontWeight: "800", color: "#344054" },
  progressMeta: { fontSize: 12, fontWeight: "900", color: "#101828" },
  progressHint: { fontSize: 11, fontWeight: "700", color: "#667085" },

  scoreBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBig: { fontSize: 15, fontWeight: "900", color: "#101828" },
  scoreBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  goalBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, borderWidth: 1, borderColor: "#BBD3FF",
    backgroundColor: "#EEF6FF", padding: 12, marginTop: 4,
  },
  goalIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
    backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center",
  },
  goalTitle: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  goalText: { fontSize: 11, fontWeight: "700", color: "#1E40AF", marginTop: 3 },

  divider: { height: 1, backgroundColor: "#F2F4F7", marginVertical: 16 },

  upcomingRow: { flexDirection: "column", gap: 12, marginTop: 12 },
  countdownRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 14,
  },
  countdownText: { fontSize: 12, fontWeight: "900", color: "#2563EB" },

  twoCol: { flexDirection: "column", gap: 14 },

  // Reports
  reportCard: {
    borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB", padding: 12,
  },
  reportTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  reportDate: { fontSize: 12, fontWeight: "900", color: "#101828" },
  reportSub: { fontSize: 11, fontWeight: "700", color: "#667085", marginTop: 4 },
  reportBottom: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 10,
  },
  reportScoreLabel: { fontSize: 12, fontWeight: "800", color: "#344054" },
  reportScoreValue: { fontWeight: "900", fontSize: 13 },

  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPassed: { backgroundColor: "#DCFCE7" },
  statusNeeds: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 11, fontWeight: "900" },
  statusPassedText: { color: "#16A34A" },
  statusNeedsText: { color: "#DC2626" },

  // AI Feedback
  fbRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fbLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  fbTitle: { fontSize: 12, fontWeight: "900", color: "#101828" },
  fbPct: { fontSize: 12, fontWeight: "900", color: "#6D28D9" },
  fbHint: { fontSize: 11, fontWeight: "700", color: "#667085", fontStyle: "italic" },
  tipBox: {
    borderRadius: 12, borderWidth: 1, borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF", padding: 12, marginTop: 8,
  },
  tipText: { fontSize: 12, fontWeight: "800", color: "#1D4ED8" },

  // Comments
  commentsGrid: { flexDirection: "column", gap: 12, marginTop: 12 },
  commentCard: {
    borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB", padding: 12,
  },
  commentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentDate: { fontSize: 12, fontWeight: "900", color: "#6D28D9" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 12, fontWeight: "900", color: "#101828" },
  commentText: { fontSize: 12, fontWeight: "700", color: "#344054", marginTop: 10, lineHeight: 18 },

  // Achievements
  achGrid: { flexDirection: "column", gap: 10, marginTop: 12 },
  achCard: {
    borderRadius: 14, borderWidth: 1, padding: 14,
    alignItems: "center",
  },
  achEarned: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" },
  achLocked: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  achIcon: { fontSize: 28 },
  achTitle: { fontSize: 12, fontWeight: "900", color: "#101828", marginTop: 10 },
  achSub: { fontSize: 11, fontWeight: "700", color: "#667085", textAlign: "center", marginTop: 6 },
  earnedPill: { marginTop: 10, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  earnedOn: { backgroundColor: "#6D28D9" },
  earnedOff: { backgroundColor: "#E5E7EB" },
  earnedText: { fontSize: 11, fontWeight: "900" },
  earnedTextOn: { color: "#FFFFFF" },
  earnedTextOff: { color: "#667085" },

  motivationBanner: {
    marginTop: 16, borderRadius: 14, borderWidth: 1,
    borderColor: "#BBF7D0", backgroundColor: "#F0FDF4",
    padding: 16, alignItems: "center", gap: 6,
  },
  motivationEmoji: { fontSize: 24 },
  motivationText: { fontSize: 13, fontWeight: "900", color: "#166534", textAlign: "center" },
  motivationSub: { fontSize: 12, fontWeight: "700", color: "#15803D", textAlign: "center" },

  // Buttons
  outlineBtn: {
    marginTop: 10, borderRadius: 12, borderWidth: 1,
    borderColor: "#D0D5DD", backgroundColor: "#FFFFFF",
    paddingVertical: 10, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center",
  },
  outlineBtnText: { color: "#344054", fontWeight: "900", fontSize: 12 },

  sectionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionIconEmoji: { fontSize: 16 },

  footer: {
    marginTop: 8, textAlign: "center",
    color: "#98A2B3", fontSize: 11, fontWeight: "700",
  },
});
