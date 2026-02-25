import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiGet, apiPost } from "../../lib/api";

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

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await apiGet("/dashboard/trainee");
      setDash(data);
    } catch {
      // If request fails, we show join UI (or mock)
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // ✅ Refresh when user returns to this tab
  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function onJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("Join Code", "Please enter your join code.");
      return;
    }

    try {
      setJoining(true);
      await apiPost("/trainee/join", { join_code: code });
      Alert.alert("Success", "You’re linked to your instructor ✅");
      setJoinCode("");
      await loadDashboard();
    } catch (e: any) {
      Alert.alert("Join Failed", e?.message || "Invalid join code");
    } finally {
      setJoining(false);
    }
  }

  // ✅ Correct linked logic based on YOUR backend response:
  // return includes: link: { is_linked: bool, instructor: {...}|null }
  const isLinked = !!dash?.link?.is_linked;

  const studentName = dash?.welcome?.name ?? "Zaid Osama";

  const sessionsCompleted = dash?.progress?.sessions_completed ?? 6;
  const sessionsTotal = dash?.progress?.target_sessions ?? 10;
  const completedPct = Math.round((sessionsCompleted / Math.max(1, sessionsTotal)) * 100);

  const currentDrivingScore = dash?.progress?.current_score ?? 78;
  const scoreLabel = dash?.welcome?.badge ?? "Improving";
  const goalText =
    dash?.progress?.goal_text ?? "Reach 80% to unlock your Safe Driver badge";

  const instructorName =
    dash?.link?.instructor?.name ?? dash?.link?.instructor?.instructor_name ?? "—";

  // Upcoming session: backend currently doesn't send upcoming_session,
  // so we keep your existing fallback behavior.
  const upcoming = useMemo(() => {
    const u = dash?.upcoming_session;
    const dateISO =
      u?.dateISO ||
      u?.date_iso ||
      u?.date ||
      "2026-11-16";

    const dateLabel =
      u?.dateLabel ||
      u?.date_label ||
      (dateISO ? new Date(dateISO).toLocaleDateString() : "—");

    const timeLabel = u?.timeLabel || u?.time_label || u?.time || "2:00 PM";
    const instructor = u?.instructor || u?.instructor_name || instructorName || "—";
    const vehicle = u?.vehicle || u?.vehicle_id || "VEH-2847";

    return { dateISO, dateLabel, timeLabel, instructor, vehicle };
  }, [dash, instructorName]);

  const countdownLabel = useMemo(() => {
    const now = new Date();
    const d = new Date(upcoming.dateISO + "T00:00:00");
    const ms =
      d.getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));

    if (Number.isNaN(days)) return "—";
    if (days > 1) return `${days} days until your next session`;
    if (days === 1) return `1 day until your next session`;
    if (days === 0) return `Today`;
    return `Session date passed`;
  }, [upcoming.dateISO]);

  // Reports from backend: /dashboard/trainee returns recent_reports (results docs)
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

      const date =
        r?.date_label ||
        r?.date ||
        (r?.created_at ? new Date(r.created_at).toLocaleDateString() : "—");

      // results docs usually have instructor_id, not instructor name,
      // so we fallback to linked instructor name.
      const instructor =
        r?.instructor_name ||
        r?.instructor ||
        instructorName ||
        "—";

      return {
        id: r?.id || r?._id || r?.trip_id || `rep-${idx}`,
        date,
        instructor,
        score,
        status,
      };
    });
  }, [dash, instructorName]);

  // AI feedback from backend returns list of tips: [{priority,title,message}]
  const feedback: FeedbackArea[] = useMemo(() => {
    const list = Array.isArray(dash?.ai_feedback) ? dash.ai_feedback : null;
    if (!list) {
      return [
        { id: "f1", title: "Braking", score: 65, hint: "Work on smoother braking", icon: "↗️" },
        { id: "f2", title: "Lane Discipline", score: 70, hint: "Practice lane discipline", icon: "🧿" },
        { id: "f3", title: "Speed Control", score: 82, hint: "Maintain consistent speed", icon: "📊" },
      ];
    }

    // Your backend tips have no numeric score per tip (they are messages),
    // so we show "score" as 0 and still display the hint text.
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
      date: c?.date
        ? c.date
        : c?.created_at
        ? new Date(c.created_at).toLocaleDateString()
        : "—",
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

  const onReschedule = () => {
    router.push("/(studenttabs)/sessions");
  };

  const onViewReport = (_reportId: string) => {
    router.push("/(studenttabs)/reports");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (!isLinked) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroHello}>Welcome 👋</Text>
            <Text style={styles.heroSub}>
              Enter your instructor join code to unlock your dashboard.
            </Text>
          </View>
          <View style={styles.heroIconBubble}>
            <Text style={styles.heroIcon}>🔗</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔗 Join Instructor</Text>

          <Text style={styles.joinLabel}>Join Code</Text>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="e.g. J4F9A2C"
            autoCapitalize="characters"
            style={styles.joinInput}
          />

          <Pressable
            onPress={onJoin}
            disabled={joining}
            style={({ pressed }) => [
              styles.joinBtn,
              joining ? { opacity: 0.6 } : null,
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={styles.joinBtnText}>
              {joining ? "Joining..." : "Join"}
            </Text>
          </Pressable>

          <Pressable
            onPress={loadDashboard}
            style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}
          >
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroHello}>Hello, {studentName} 👋</Text>
          <Text style={styles.heroSub}>
            Great to see you back! Let&apos;s keep improving your driving skills.
          </Text>
          {/* ✅ show linked instructor (small demo win) */}
          <Text style={styles.heroSub}>Instructor: {instructorName}</Text>
        </View>
        <View style={styles.heroIconBubble}>
          <Text style={styles.heroIcon}>🚗</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>🏆  Your Progress</Text>
        </View>

        <View style={[styles.progressRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          <View style={[styles.progressCol, { flex: 1.2 }]}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressLabel}>Sessions Completed</Text>
              <Text style={styles.progressMeta}>
                {sessionsCompleted}/{sessionsTotal}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fillDark, { width: `${completedPct}%` }]} />
            </View>
            <Text style={styles.progressHint}>{Math.max(0, sessionsTotal - sessionsCompleted)} sessions remaining</Text>
          </View>

          <View style={[styles.progressCol, { flex: 1.2 }]}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressLabel}>Current Driving Score</Text>
              <View style={styles.scoreRight}>
                <Text style={styles.scoreBig}>{currentDrivingScore}%</Text>
                <View style={styles.scoreChip}>
                  <Text style={styles.scoreChipText}>{scoreLabel}</Text>
                </View>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fillDark, { width: `${Math.max(0, Math.min(100, currentDrivingScore))}%` }]} />
            </View>
          </View>

          <View style={[styles.goalBox, { flex: 1.1 }]}>
            <View style={styles.goalIconWrap}>
              <Text style={styles.goalIcon}>🧿</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>Next Goal</Text>
              <Text style={styles.goalText}>{goalText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.upcomingCard}>
          <View style={styles.upcomingHeader}>
            <Text style={styles.upcomingTitle}>🗓️  Upcoming Session</Text>

            <View style={styles.countdownWrap}>
              <Text style={styles.countdownIcon}>🕒</Text>
              <Text style={styles.countdownText}>{countdownLabel}</Text>
            </View>
          </View>

          <View style={[styles.upcomingRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
            <InfoPill label="Date" value={upcoming.dateLabel} icon="🗓️" bg="#EEF2FF" border="#E0E7FF" />
            <InfoPill label="Time" value={upcoming.timeLabel} icon="🕑" bg="#F3E8FF" border="#E9D5FF" />
            <InfoPill label="Instructor" value={upcoming.instructor} icon="👤" bg="#DCFCE7" border="#BBF7D0" />
            <InfoPill label="Vehicle" value={upcoming.vehicle} icon="🚘" bg="#FEF3C7" border="#FDE68A" />

            <Pressable onPress={onReschedule} style={({ pressed }) => [styles.rescheduleBtn, pressed ? { opacity: 0.9 } : null]}>
              <Text style={styles.rescheduleText}>Reschedule</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.grid, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
        <View style={[styles.card, isWide ? { flex: 1 } : null]}>
          <Text style={styles.cardTitle}>📄  Recent Reports</Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {reports.map((r) => (
              <View key={r.id} style={styles.reportCard}>
                <View style={styles.reportTop}>
                  <View>
                    <Text style={styles.reportDate}>{r.date}</Text>
                    <Text style={styles.reportSub}>Instructor: {r.instructor}</Text>
                  </View>

                  <View style={[styles.statusPill, r.status === "Passed" ? styles.statusPassed : styles.statusNeeds]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        r.status === "Passed" ? styles.statusPassedText : styles.statusNeedsText,
                      ]}
                    >
                      {r.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportBottom}>
                  <Text style={styles.reportScoreLabel}>
                    Driving Score: <Text style={styles.reportScoreValue}>{r.score}%</Text>
                  </Text>

                  <Pressable onPress={() => onViewReport(r.id)} style={({ pressed }) => [styles.viewReportBtn, pressed ? { opacity: 0.9 } : null]}>
                    <Text style={styles.viewReportText}>📄  View Full Report</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, isWide ? { flex: 1 } : null]}>
          <Text style={styles.cardTitle}>💡  AI Feedback & Improvement Areas</Text>

          <View style={{ marginTop: 12, gap: 14 }}>
            {feedback.map((f) => (
              <View key={f.id}>
                <View style={styles.fbHeader}>
                  <View style={styles.fbLeft}>
                    <Text style={styles.fbIcon}>{f.icon}</Text>
                    <Text style={styles.fbTitle}>{f.title}</Text>
                  </View>
                  <Text style={styles.fbPct}>{f.score}%</Text>
                </View>

                <View style={styles.track}>
                  <View style={[styles.fillDark, { width: `${Math.max(0, Math.min(100, f.score))}%` }]} />
                </View>

                <Text style={styles.fbHint}>"{f.hint}"</Text>
              </View>
            ))}

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>💡 Tip: Focus on your lowest-scoring areas to see the biggest improvements!</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💬  Instructor Comments</Text>

        <View style={[styles.commentsRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentCard}>
              <Text style={styles.commentDate}>{c.date}</Text>
              <Text style={styles.commentText}>{c.text}</Text>

              <View style={styles.commentRating}>
                <Text style={styles.star}>⭐</Text>
                <Text style={styles.ratingText}>{c.rating}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏅  Achievements & Milestones</Text>

        <View style={[styles.achRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          {achievements.map((a) => (
            <View key={a.id} style={[styles.achCard, a.earned ? styles.achEarned : styles.achLocked]}>
              <Text style={styles.achIcon}>{a.icon}</Text>
              <Text style={styles.achTitle}>{a.title}</Text>
              <Text style={styles.achSub}>{a.subtitle}</Text>

              <View style={[styles.earnedPill, a.earned ? styles.earnedOn : styles.earnedOff]}>
                <Text style={[styles.earnedText, a.earned ? styles.earnedTextOn : styles.earnedTextOff]}>
                  {a.earned ? "✓ Earned" : "Locked"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bigGreen}>
          <Text style={styles.bigGreenEmoji}>🎉</Text>
          <Text style={styles.bigGreenText}>You&apos;re on track to pass — keep practicing!</Text>
          <Text style={styles.bigGreenText}>You&apos;ve improved your overall score by 12% this month. Excellent progress!</Text>
        </View>

        <Pressable onPress={loadDashboard} style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}>
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>© 2025 DriveIQ. Student portal.</Text>
    </ScrollView>
  );
}

function InfoPill({
  label,
  value,
  icon,
  bg,
  border,
}: {
  label: string;
  value: string;
  icon: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={styles.infoPill}>
      <View style={[styles.infoIcon, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 28 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, fontWeight: "800", color: "#64748B" },

  hero: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6E8F0",
    backgroundColor: "#6D28D9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroHello: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 12, marginTop: 8, maxWidth: 520 },
  heroIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: { fontSize: 22 },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },

  progressRow: { marginTop: 12, gap: 12 },
  progressCol: { gap: 10 },
  progressTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: "#101828", fontWeight: "900", fontSize: 12 },
  progressMeta: { color: "#101828", fontWeight: "900", fontSize: 12 },
  progressHint: { color: "#667085", fontWeight: "800", fontSize: 11 },

  scoreRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreBig: { color: "#101828", fontWeight: "900", fontSize: 14 },
  scoreChip: {
    backgroundColor: "#0B1220",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreChipText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  goalBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBD3FF",
    backgroundColor: "#EEF6FF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  goalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBD3FF",
    backgroundColor: "#DDEBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  goalIcon: { fontSize: 16 },
  goalTitle: { color: "#101828", fontWeight: "900", fontSize: 12 },
  goalText: { color: "#101828", fontWeight: "800", fontSize: 11, marginTop: 4 },

  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    overflow: "hidden",
  },
  fillDark: { height: "100%", borderRadius: 999, backgroundColor: "#0B1220" },

  upcomingCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  upcomingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  upcomingTitle: { color: "#101828", fontWeight: "900", fontSize: 12 },
  countdownWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  countdownIcon: { fontSize: 14 },
  countdownText: { color: "#2563EB", fontWeight: "900", fontSize: 12 },

  upcomingRow: { marginTop: 12, gap: 12, alignItems: "center" },

  infoPill: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 170 },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { color: "#667085", fontWeight: "900", fontSize: 11 },
  infoValue: { color: "#101828", fontWeight: "900", fontSize: 12, marginTop: 2 },

  rescheduleBtn: {
    marginLeft: "auto",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rescheduleText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  grid: { gap: 14 },

  reportCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  reportTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  reportDate: { color: "#101828", fontWeight: "900", fontSize: 12 },
  reportSub: { color: "#667085", fontWeight: "800", fontSize: 11, marginTop: 6 },

  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  statusPassed: { backgroundColor: "#0B1220" },
  statusNeeds: { backgroundColor: "#E5E7EB" },
  statusPillText: { fontWeight: "900", fontSize: 11 },
  statusPassedText: { color: "#FFFFFF" },
  statusNeedsText: { color: "#101828" },

  reportBottom: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  reportScoreLabel: { color: "#101828", fontWeight: "800", fontSize: 12 },
  reportScoreValue: { fontWeight: "900" },

  viewReportBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  viewReportText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  fbHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fbLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  fbIcon: { fontSize: 14 },
  fbTitle: { color: "#101828", fontWeight: "900", fontSize: 12 },
  fbPct: { color: "#101828", fontWeight: "900", fontSize: 12 },
  fbHint: { marginTop: 8, color: "#667085", fontWeight: "800", fontSize: 11, fontStyle: "italic" },

  tipBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    padding: 12,
    marginTop: 6,
  },
  tipText: { color: "#1D4ED8", fontWeight: "900", fontSize: 12 },

  commentsRow: { marginTop: 12, gap: 12 },
  commentCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    minWidth: 260,
  },
  commentDate: { color: "#2563EB", fontWeight: "900", fontSize: 12 },
  commentText: { marginTop: 10, color: "#101828", fontWeight: "800", fontSize: 12, lineHeight: 18 },
  commentRating: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  star: { fontSize: 14 },
  ratingText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  achRow: { marginTop: 12, gap: 12 },
  achCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    minWidth: 200,
  },
  achEarned: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
  achLocked: { backgroundColor: "#F9FAFB", borderColor: "#EAECF0" },
  achIcon: { fontSize: 22, marginTop: 6 },
  achTitle: { marginTop: 10, color: "#101828", fontWeight: "900", fontSize: 12 },
  achSub: { marginTop: 8, color: "#667085", fontWeight: "800", fontSize: 11, textAlign: "center" },
  earnedPill: { marginTop: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  earnedOn: { backgroundColor: "#0B1220" },
  earnedOff: { backgroundColor: "#E5E7EB" },
  earnedText: { fontWeight: "900", fontSize: 11 },
  earnedTextOn: { color: "#FFFFFF" },
  earnedTextOff: { color: "#101828" },

  bigGreen: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#ECFDF3",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bigGreenEmoji: { fontSize: 20 },
  bigGreenText: { color: "#166534", fontWeight: "900", fontSize: 12, textAlign: "center" },

  footer: { marginTop: 2, textAlign: "center", color: "#98A2B3", fontSize: 11, fontWeight: "800" },

  joinLabel: { marginTop: 12, color: "#101828", fontWeight: "900", fontSize: 12, marginBottom: 8 },
  joinInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: "800",
  },
  joinBtn: {
    marginTop: 12,
    backgroundColor: "#0B1220",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: { color: "#FFFFFF", fontWeight: "900" },

  refreshBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#101828", fontWeight: "900", fontSize: 12 },
});
