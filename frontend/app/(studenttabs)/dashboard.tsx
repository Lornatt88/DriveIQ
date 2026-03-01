import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useWindowDimensions, ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../../lib/api";
import { colors, type_, radius, space, shadow, card, btn, pill, page, divider, tint, TintKey } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = "Passed" | "Needs Improvement";
type RecentReport = { id: string; session_id: string; date: string; instructor: string; score: number; status: ReportStatus };
type FeedbackArea  = { id: string; title: string; score: number; hint: string; icon: string };
type CommentItem   = { id: string; date: string; text: string; rating: number };
type Achievement   = { id: string; title: string; subtitle: string; icon: string; earned: boolean };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [dash, setDash]       = useState<any>(null);
  const [storedName, setStoredName] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      // Load stored name as immediate fallback while API loads
      const name = await AsyncStorage.getItem("driveiq_user_name");
      if (name) setStoredName(name);

      const data = await apiGet("/dashboard/trainee");
      setDash(data);
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);
  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  // ── Data derivations — no hardcoded names or placeholder data ─────────────
  const studentName        = dash?.welcome?.name || storedName || "";
  const sessionsCompleted  = dash?.progress?.sessions_completed ?? 0;
  const sessionsTotal      = dash?.progress?.target_sessions ?? 0;
  const completedPct       = sessionsTotal > 0 ? Math.round((sessionsCompleted / sessionsTotal) * 100) : 0;
  const currentDrivingScore= dash?.progress?.current_score ?? 0;
  const scoreLabel         = dash?.welcome?.badge ?? "—";
  const goalText           = dash?.progress?.goal_text ?? "Complete sessions to unlock your next badge";
  const instructorName     = dash?.link?.instructor?.name ?? dash?.link?.instructor?.instructor_name ?? "—";

  const upcoming = useMemo(() => {
    const u = dash?.upcoming_session;
    if (!u) return null;
    const dateISO   = u?.dateISO || u?.date_iso || u?.date || "";
    const dateLabel = u?.dateLabel || u?.date_label || (dateISO ? new Date(dateISO).toLocaleDateString() : "—");
    const timeLabel = u?.timeLabel || u?.time_label || u?.time || "—";
    const instructor= u?.instructor || u?.instructor_name || instructorName || "—";
    const vehicle   = u?.vehicle || u?.vehicle_id || "—";
    return { dateISO, dateLabel, timeLabel, instructor, vehicle };
  }, [dash, instructorName]);

  const countdownLabel = useMemo(() => {
    if (!upcoming?.dateISO) return "—";
    const now  = new Date();
    const d    = new Date(upcoming.dateISO + "T00:00:00");
    const ms   = d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    if (Number.isNaN(days)) return "—";
    if (days > 1)  return `${days} days away`;
    if (days === 1) return "Tomorrow";
    if (days === 0) return "Today";
    return "Session passed";
  }, [upcoming?.dateISO]);

  // Only show real reports from the API — no hardcoded fallback data
  const reports: RecentReport[] = useMemo(() => {
    const list = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    return list.map((r: any, idx: number) => {
      const score    = r?.score?.overall ?? r?.score ?? 0;
      const status: ReportStatus = score >= 70 ? "Passed" : "Needs Improvement";
      const date     = r?.date_label || r?.date || (r?.created_at ? new Date(r.created_at).toLocaleDateString() : "—");
      const instructor = r?.instructor_name || r?.instructor || instructorName || "—";
      return { id: r?.id || r?._id || r?.trip_id || `rep-${idx}`, session_id: r?.session_id || "", date, instructor, score, status };
    });
  }, [dash, instructorName]);

  // Only show real feedback from the API — no hardcoded fallback data
  const feedback: FeedbackArea[] = useMemo(() => {
    const list = Array.isArray(dash?.ai_feedback) ? dash.ai_feedback : [];
    return list.map((f: any, idx: number) => ({
      id:    f?.id || `f-${idx}`,
      title: f?.title || f?.area || "Tip",
      score: typeof f?.score === "number" ? f.score : 0,
      hint:  f?.message || f?.hint || "",
      icon:  f?.icon || "💡",
    }));
  }, [dash]);

  // Only show real comments from the API — no hardcoded fallback data
  const comments: CommentItem[] = useMemo(() => {
    const list = Array.isArray(dash?.instructor_comments) ? dash.instructor_comments : [];
    return list.map((c: any, idx: number) => ({
      id:     c?.id || `c-${idx}`,
      date:   c?.date ?? (c?.created_at ? new Date(c.created_at).toLocaleDateString() : "—"),
      text:   c?.text || c?.comment || "",
      rating: c?.rating ?? 0,
    }));
  }, [dash]);

  // Only show real achievements from the API — no hardcoded fallback data
  const achievements: Achievement[] = useMemo(() => {
    const list = Array.isArray(dash?.achievements) ? dash.achievements : [];
    return list.map((a: any, idx: number) => ({
      id:       a?.id || `a-${idx}`,
      title:    a?.title || "Achievement",
      subtitle: a?.subtitle || a?.desc || "",
      icon:     a?.icon || "🏅",
      earned:   !!a?.earned,
    }));
  }, [dash]);

  const scoreBadgeColor =
    currentDrivingScore >= 85 ? colors.green :
    currentDrivingScore >= 70 ? colors.blue  : colors.redDark;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>

      {/* ── 1. Hero ───────────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroHello}>
            {studentName ? `Hello, ${studentName} 👋` : "Welcome back 👋"}
          </Text>
          <Text style={s.heroSub}>Great to see you back! Let's keep improving your driving skills.</Text>
        </View>
        <View style={s.heroIconBubble}><Text style={s.heroIconText}>🚗</Text></View>
      </View>

      {/* ── 2. Progress ──────────────────────────────────────────────────── */}
      <View style={card.base}>
        <SectionHeader icon="🏆" iconBg={colors.yellowBg} label="Your Progress" />

        <View style={[s.progressGrid, isWide && { flexDirection: "row" }]}>
          {/* Sessions */}
          <View style={[s.progressItem, isWide && { flex: 1 }]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Sessions Completed</Text>
              <Text style={s.progressMeta}>
                {sessionsTotal > 0 ? `${sessionsCompleted}/${sessionsTotal}` : `${sessionsCompleted}`}
              </Text>
            </View>
            <ProgressBar pct={completedPct} color={colors.purpleDark} />
            <Text style={s.progressHint}>
              {sessionsTotal > 0 ? `${Math.max(0, sessionsTotal - sessionsCompleted)} sessions remaining` : "No sessions yet"}
            </Text>
          </View>

          {/* Score */}
          <View style={[s.progressItem, isWide && { flex: 1 }]}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>Current Driving Score</Text>
              <View style={s.scoreBadgeRow}>
                <Text style={s.scoreBig}>{currentDrivingScore > 0 ? `${currentDrivingScore}%` : "—"}</Text>
                {scoreLabel !== "—" && (
                  <View style={[s.scoreBadge, { backgroundColor: scoreBadgeColor }]}>
                    <Text style={s.scoreBadgeText}>{scoreLabel}</Text>
                  </View>
                )}
              </View>
            </View>
            <ProgressBar pct={Math.min(100, Math.max(0, currentDrivingScore))} color={scoreBadgeColor} />
          </View>

          {/* Goal */}
          <View style={[s.goalBox, isWide && { flex: 1 }]}>
            <View style={s.goalIconWrap}><Text style={{ fontSize: 18 }}>🎯</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.goalTitle}>Next Goal</Text>
              <Text style={s.goalText}>{goalText}</Text>
            </View>
          </View>
        </View>

        {/* Upcoming session */}
        <View style={divider.base} />
        <SectionHeader icon="🗓️" iconBg={colors.greenBorderAlt} label="Upcoming Session" />

        {upcoming ? (
          <>
            <View style={[s.upcomingRow, isWide && { flexDirection: "row" }]}>
              <InfoPill label="Date"       value={upcoming.dateLabel}  icon="🗓️" bg={tint.indigo.bg} border={tint.indigo.border} />
              <InfoPill label="Time"       value={upcoming.timeLabel}  icon="🕑" bg={tint.purple.bg} border={tint.purple.border} />
              <InfoPill label="Instructor" value={upcoming.instructor} icon="👤" bg={tint.green.bg}  border={tint.green.border}  />
              <InfoPill label="Vehicle"    value={upcoming.vehicle}    icon="🚘" bg={tint.yellow.bg} border={colors.yellowBorder} />
            </View>
            <View style={s.countdownRow}>
              <Text style={s.countdownText}>🕒 {countdownLabel}</Text>
              <Pressable
                onPress={() => router.push("/(studenttabs)/sessions")}
                style={({ pressed }) => [s.outlineBtn, { marginTop: 0 }, pressed && { opacity: 0.8 }]}
              >
                <Text style={s.outlineBtnText}>Reschedule</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No upcoming sessions scheduled.</Text>
            <Pressable onPress={() => router.push("/(studenttabs)/sessions")} style={[s.outlineBtn, { marginTop: 0 }]}>
              <Text style={s.outlineBtnText}>View Sessions</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── 3. Reports + AI Feedback ─────────────────────────────────────── */}
      <View style={[s.twoCol, isWide && { flexDirection: "row" }]}>

        {/* Recent Reports */}
        <View style={[card.base, isWide && { flex: 1 }]}>
          <SectionHeader icon="📄" iconBg={colors.blueLighter} label="Recent Reports" />
          {reports.length === 0 ? (
            <EmptyState text="No reports yet. Complete a session to see your results." />
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {reports.map((r) => (
                <View key={r.id} style={s.reportCard}>
                  <View style={s.reportTop}>
                    <View>
                      <Text style={s.reportDate}>{r.date}</Text>
                      <Text style={s.reportSub}>Instructor: {r.instructor}</Text>
                    </View>
                    <View style={r.status === "Passed" ? s.statusPassed : s.statusNeeds}>
                      <Text style={[s.statusText, r.status === "Passed" ? s.statusPassedText : s.statusNeedsText]}>
                        {r.status === "Passed" ? "✓ Passed" : "Needs Work"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.reportBottom}>
                    <Text style={s.reportScoreLabel}>
                      Score: <Text style={[s.reportScoreValue, { color: r.score >= 70 ? colors.green : colors.redDark }]}>{r.score}%</Text>
                    </Text>
                    <Pressable
                      onPress={() => router.push({
                        pathname: "/(studenttabs)/session-report",
                        params: { sessionId: r.session_id },
                      })}
                      style={({ pressed }) => [s.outlineBtn, { marginTop: 0, paddingHorizontal: 12, paddingVertical: 8 }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.outlineBtnText}>View Report →</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI Feedback */}
        <View style={[card.base, isWide && { flex: 1 }]}>
          <SectionHeader icon="💡" iconBg="#FEF9C3" label="AI Feedback" />
          {feedback.length === 0 ? (
            <EmptyState text="AI feedback will appear after your first session." />
          ) : (
            <>
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
                    <ProgressBar pct={Math.min(100, Math.max(0, f.score))} color={colors.purpleDark} />
                    <Text style={s.fbHint}>"{f.hint}"</Text>
                  </View>
                ))}
              </View>
              <View style={s.tipBox}>
                <Text style={s.tipText}>💡 Focus on your lowest-scoring areas to see the biggest improvements!</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── 4. Instructor Comments ────────────────────────────────────────── */}
      <View style={card.base}>
        <SectionHeader icon="💬" iconBg={colors.purpleBorder} label="Instructor Comments" />
        {comments.length === 0 ? (
          <EmptyState text="Instructor comments will appear after your sessions." />
        ) : (
          <View style={[s.commentsGrid, isWide && { flexDirection: "row" }]}>
            {comments.map((c) => (
              <View key={c.id} style={[s.commentCard, isWide && { flex: 1 }]}>
                <View style={s.commentTop}>
                  <Text style={s.commentDate}>{c.date}</Text>
                  {c.rating > 0 && (
                    <View style={s.ratingRow}>
                      <Text style={{ fontSize: 13 }}>⭐</Text>
                      <Text style={s.ratingText}>{c.rating}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.commentText}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── 5. Achievements ──────────────────────────────────────────────── */}
      <View style={card.base}>
        <SectionHeader icon="🏅" iconBg={colors.yellowBg} label="Achievements & Milestones" />
        {achievements.length === 0 ? (
          <EmptyState text="Complete sessions to start earning achievements." />
        ) : (
          <>
            <View style={[s.achGrid, isWide && { flexDirection: "row" }]}>
              {achievements.map((a) => (
                <View key={a.id} style={[s.achCard, isWide && { flex: 1 }, a.earned ? s.achEarned : s.achLocked]}>
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
            <View style={s.motivationBanner}>
              <Text style={s.motivationEmoji}>🎉</Text>
              <Text style={s.motivationText}>You're on track to pass — keep practicing!</Text>
            </View>
          </>
        )}

        <Pressable onPress={loadDashboard} style={({ pressed }) => [s.outlineBtn, pressed && { opacity: 0.8 }]}>
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
  row:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  iconWrap:{ width: 34, height: 34, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  iconText:{ fontSize: 16 },
  label:   { ...type_.cardTitle },
});

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.borderFaint, overflow: "hidden", marginVertical: 6 },
  fill:  { height: "100%", borderRadius: radius.pill },
});

function InfoPill({ label, value, icon, bg, border }: { label: string; value: string; icon: string; bg: string; border: string }) {
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
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 160 },
  iconWrap:{ width: 38, height: 38, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label:   { ...type_.labelSm },
  value:   { ...type_.metaValue },
});

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 12, padding: 16, backgroundColor: colors.pageBg, borderRadius: radius.input, alignItems: "center" }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.subtext, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:    { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 32, gap: 14 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  // Hero
  hero:          { borderRadius: radius.cardXl, padding: space.xl, backgroundColor: colors.purpleDark, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: colors.purpleDeep, borderBottomWidth: 2 },
  heroHello:     { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  heroSub:       { color: "rgba(255,255,255,0.82)", fontWeight: "700", fontSize: 12, marginTop: 6, maxWidth: 280 },
  heroIconBubble:{ width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroIconText:  { fontSize: 26 },

  // Progress
  progressGrid:    { flexDirection: "column", gap: 16, marginTop: 12 },
  progressItem:    { gap: 2 },
  progressLabelRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel:   { ...type_.body, color: colors.label },
  progressMeta:    { ...type_.metaValue },
  progressHint:    { ...type_.bodySm },

  scoreBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBig:      { ...type_.scoreValue },
  scoreBadge:    { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText:{ color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  goalBox:     { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.input, borderWidth: 1, borderColor: colors.blueChip, backgroundColor: colors.blueLight, padding: space.md, marginTop: 4 },
  goalIconWrap:{ width: 40, height: 40, borderRadius: radius.input, borderWidth: 1, borderColor: colors.blueBorder, backgroundColor: colors.blueLighter, alignItems: "center", justifyContent: "center" },
  goalTitle:   { fontSize: 12, fontWeight: "900", color: colors.blueDark },
  goalText:    { fontSize: 11, fontWeight: "700", color: colors.blueDeep, marginTop: 3 },

  upcomingRow:   { flexDirection: "column", gap: 12, marginTop: 12 },
  countdownRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  countdownText: { fontSize: 12, fontWeight: "900", color: colors.blue },
  emptyBox:      { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, backgroundColor: colors.pageBg, borderRadius: radius.input },
  emptyText:     { fontSize: 12, fontWeight: "700", color: colors.subtext, flex: 1 },

  twoCol: { flexDirection: "column", gap: 14 },

  // Reports
  reportCard:      { borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pageBg, padding: space.md },
  reportTop:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  reportDate:      { ...type_.body, color: colors.textAlt, fontWeight: "900" },
  reportSub:       { ...type_.bodySm, marginTop: 4 },
  reportBottom:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  reportScoreLabel:{ fontSize: 12, fontWeight: "800", color: colors.label },
  reportScoreValue:{ fontWeight: "900", fontSize: 13 },

  statusPill:      { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusPassed:    { backgroundColor: "#DCFCE7", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusNeeds:     { backgroundColor: colors.redLight, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusText:      { fontSize: 11, fontWeight: "900" },
  statusPassedText:{ color: colors.green },
  statusNeedsText: { color: colors.redDark },

  // AI Feedback
  fbRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fbLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  fbTitle: { ...type_.body, fontWeight: "900", color: colors.textAlt },
  fbPct:   { fontSize: 12, fontWeight: "900", color: colors.purpleDark },
  fbHint:  { ...type_.bodySm, fontStyle: "italic" },
  tipBox:  { borderRadius: radius.input, borderWidth: 1, borderColor: colors.blueBorder, backgroundColor: "#EFF6FF", padding: space.md, marginTop: 8 },
  tipText: { fontSize: 12, fontWeight: "800", color: colors.blueDark },

  // Comments
  commentsGrid: { flexDirection: "column", gap: 12, marginTop: 12 },
  commentCard:  { borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pageBg, padding: space.md },
  commentTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentDate:  { fontSize: 12, fontWeight: "900", color: colors.purpleDark },
  ratingRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText:   { ...type_.body, fontWeight: "900", color: colors.textAlt },
  commentText:  { ...type_.bodyMedium, color: colors.label, marginTop: 10 },

  // Achievements
  achGrid:     { flexDirection: "column", gap: 10, marginTop: 12 },
  achCard:     { borderRadius: radius.card, borderWidth: 1, padding: 14, alignItems: "center" },
  achEarned:   { backgroundColor: colors.yellowLight, borderColor: colors.yellowBorder },
  achLocked:   { backgroundColor: colors.pageBg, borderColor: colors.border },
  achIcon:     { fontSize: 28 },
  achTitle:    { ...type_.body, fontWeight: "900", color: colors.textAlt, marginTop: 10 },
  achSub:      { ...type_.bodySm, textAlign: "center", marginTop: 6 },
  earnedPill:  { marginTop: 10, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  earnedOn:    { backgroundColor: colors.purpleDark },
  earnedOff:   { backgroundColor: colors.borderMid },
  earnedText:  { fontSize: 11, fontWeight: "900" },
  earnedTextOn:{ color: "#FFFFFF" },
  earnedTextOff:{ color: colors.subtextAlt },

  motivationBanner: { marginTop: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.greenBorder, backgroundColor: colors.greenLighter, padding: space.lg, alignItems: "center", gap: 6 },
  motivationEmoji:  { fontSize: 24 },
  motivationText:   { fontSize: 13, fontWeight: "900", color: colors.greenDark, textAlign: "center" },

  // Buttons
  outlineBtn:     { marginTop: 10, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, paddingVertical: 10, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { ...type_.btnOutline },

  footer: { ...type_.footer, marginTop: 8 },
});
