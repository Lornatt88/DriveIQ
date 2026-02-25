import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiGet } from "../../lib/api";

type AlertType = "danger" | "warning" | "info";
type AlertBehavior = "harsh_braking" | "lane_deviation" | "drowsiness" | "aggressive_driving";

type AlertItem = {
  id: string;
  type: AlertType;
  behavior: AlertBehavior;
  title: string;
  time: string;
};

const ALERT_STYLES: Record<
  AlertType,
  { bg: string; border: string; title: string; icon: string; badgeBg: string; badgeBorder: string; badgeText: string }
> = {
  danger: {
    bg: "#FEF2F2",
    border: "#FECACA",
    title: "#B91C1C",
    icon: "⛔",
    badgeBg: "#FEE2E2",
    badgeBorder: "#FECACA",
    badgeText: "#991B1B",
  },
  warning: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    title: "#B45309",
    icon: "⚠️",
    badgeBg: "#FEF3C7",
    badgeBorder: "#FDE68A",
    badgeText: "#92400E",
  },
  info: {
    bg: "#EFF6FF",
    border: "#BFDBFE",
    title: "#1D4ED8",
    icon: "ℹ️",
    badgeBg: "#DBEAFE",
    badgeBorder: "#BFDBFE",
    badgeText: "#1D4ED8",
  },
};

const BEHAVIOR_META: Record<AlertBehavior, { label: string; short: string }> = {
  harsh_braking: { label: "Harsh braking", short: "Harsh braking" },
  lane_deviation: { label: "Lane deviation", short: "Lane deviation" },
  drowsiness: { label: "Drowsiness", short: "Drowsiness" },
  aggressive_driving: { label: "Aggressive driving", short: "Aggressive driving" },
};

function safeParseMs(input?: string) {
  if (!input) return 0;
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `00:${mm}:${ss}`;
}

function initialsFromName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  const out = (a + b).toUpperCase();
  return out || "—";
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);

  const [learners, setLearners] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  const [isActive, setIsActive] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [audioVisual, setAudioVisual] = useState(true);

  async function loadAll() {
    try {
      setLoading(true);

      const [d, l, s] = await Promise.all([
        apiGet("/dashboard/instructor"),
        apiGet("/instructor/learners"),
        apiGet("/sessions"),
      ]);

      setDash(d);
      setLearners(Array.isArray(l) ? l : []);
      setSessions(Array.isArray(s) ? s : []);
    } catch (e: any) {
      setDash(null);
      setLearners([]);
      setSessions([]);
      Alert.alert("Dashboard Error", e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const summary = dash?.summary || {};
  const joinCode = dash?.join_code || "—";

  const sessionRating = typeof summary?.avg_score === "number" ? summary.avg_score : 0;
  const passed = typeof summary?.passed === "number" ? summary.passed : 0;
  const failed = typeof summary?.failed === "number" ? summary.failed : 0;
  const totalLearners = typeof summary?.total_learners === "number" ? summary.total_learners : learners.length;

  // pick a “live” session: nearest upcoming by scheduled_at
  const liveSession = useMemo(() => {
    const now = Date.now();
    const upcoming = sessions
      .map((x) => ({ ...x, ms: safeParseMs(x?.scheduled_at) }))
      .filter((x) => x.ms >= now)
      .sort((a, b) => a.ms - b.ms);
    return upcoming[0] || null;
  }, [sessions]);

  const traineeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) {
      if (l?.user_id) m[l.user_id] = l?.name || "";
    }
    return m;
  }, [learners]);

  const vehicleId = liveSession?.vehicle_id || "—";
  const traineeId = liveSession?.trainee_id || "";
  const studentName = traineeId ? (traineeNameById[traineeId] || traineeId) : "—";
  const studentInitials = traineeId ? initialsFromName(traineeNameById[traineeId] || traineeId) : "—";

  const scheduledAtMs = safeParseMs(liveSession?.scheduled_at);
  const liveStatusLabel = liveSession ? "Active" : "No Active Session";

  useEffect(() => {
    // very simple timer mock if you want “live”
    if (!liveSession) {
      setIsActive(false);
      setDurationSec(0);
      return;
    }
    setIsActive(true);

    const start = Date.now();
    const t = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(t);
  }, [liveSession]);

  const ratingLabel = useMemo(() => {
    if (sessionRating >= 85) return "Excellent";
    if (sessionRating >= 70) return "Good";
    return "Needs Work";
  }, [sessionRating]);

  const alerts: AlertItem[] = useMemo(() => {
    const n = dash?.alerts?.high_severity_events ?? 0;
    if (n > 0) {
      return [
        {
          id: "sev-high",
          type: "danger",
          behavior: "aggressive_driving",
          title: `${n} High Severity Event(s) Detected`,
          time: "—",
        },
      ];
    }
    return [
      {
        id: "no-alerts",
        type: "info",
        behavior: "lane_deviation",
        title: "No high severity alerts",
        time: "—",
      },
    ];
  }, [dash]);

  const scoreSeries = useMemo(() => {
    // still mock unless backend returns history
    return [75, 72, 68, 71, 79, 82];
  }, []);

  const safePct = 87; // still mock (unless backend provides)
  const durationLabel = formatDuration(durationSec);

  const onPause = () => setIsActive((v) => !v);
  const onEnd = () => {
    setIsActive(false);
    setDurationSec(0);
  };
  const onFlag = () => {
    router.push("/records");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.joinRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Instructor Join Code</Text>
            <Text style={styles.joinCode}>{joinCode}</Text>
            <Text style={styles.joinSub}>Learners linked: {totalLearners}</Text>
            <Text style={styles.joinSub}>Passed: {passed} • Failed: {failed}</Text>
          </View>
          <Pressable
            onPress={loadAll}
            style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}
          >
            <Text style={styles.refreshBtnText}>↻ Refresh</Text>
          </Pressable>
        </View>
      </View>

      {/* Live Training Session (NOW REAL: based on nearest upcoming session) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Training Session</Text>

        <View style={styles.liveRow}>
          <View style={styles.statusCol}>
            <View style={[styles.statusPill, liveSession ? styles.statusActive : styles.statusPaused]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: liveSession ? "#22C55E" : "#94A3B8" },
                ]}
              />
              <Text style={styles.statusText}>{liveStatusLabel}</Text>
            </View>

            {liveSession && scheduledAtMs ? (
              <Text style={[styles.joinSub, { marginTop: 10 }]}>
                Scheduled: {new Date(scheduledAtMs).toLocaleString()}
              </Text>
            ) : null}
          </View>

          <View style={styles.liveInfoCol}>
            <View style={styles.liveInfoTopRow}>
              <View style={styles.metaItem}>
                <View style={styles.metaIconCircle}>
                  <Text style={styles.metaIcon}>🚗</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Vehicle ID</Text>
                  <Text style={styles.metaValue}>{vehicleId}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  if (!traineeId) return;
                  router.push(`/student/${traineeId}`);
                }}
                style={({ pressed }) => [styles.metaItem, pressed ? { opacity: 0.85 } : null]}
                hitSlop={8}
              >
                <View
                  style={[
                    styles.metaIconCircle,
                    { backgroundColor: "#F3E8FF", borderColor: "#E9D5FF" },
                  ]}
                >
                  <Text style={[styles.metaIcon, { color: "#7C3AED" }]}>👤</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Student</Text>
                  <Text style={styles.metaValue}>
                    {studentName} {traineeId ? `(${studentInitials})` : ""}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.liveInfoBottomRow}>
              <View style={styles.metaItem}>
                <View
                  style={[
                    styles.metaIconCircle,
                    { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
                  ]}
                >
                  <Text style={[styles.metaIcon, { color: "#16A34A" }]}>⏱️</Text>
                </View>
                <View>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{liveSession && isActive ? durationLabel : "—"}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.grid, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
        <View style={[styles.col, isWide ? { flex: 1 } : null]}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>

            <View style={{ marginTop: 12 }}>
              {alerts.map((a) => {
                const s = ALERT_STYLES[a.type];
                const b = BEHAVIOR_META[a.behavior];

                return (
                  <Pressable
                    key={a.id}
                    style={({ pressed }) => [
                      styles.alertCard,
                      { backgroundColor: s.bg, borderColor: s.border },
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <View style={styles.alertRow}>
                      <Text style={styles.alertIcon}>{s.icon}</Text>

                      <View style={{ flex: 1 }}>
                        <View style={styles.alertTopRow}>
                          <View
                            style={[
                              styles.behaviorBadge,
                              { backgroundColor: s.badgeBg, borderColor: s.badgeBorder },
                            ]}
                          >
                            <Text style={[styles.behaviorBadgeText, { color: s.badgeText }]}>
                              {b.short}
                            </Text>
                          </View>

                          <Text style={styles.alertTimeInline}>🕒 {a.time}</Text>
                        </View>

                        <Text style={[styles.alertTitle, { color: s.title }]}>{a.title}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={[styles.col, isWide ? { flex: 1 } : null]}>
          <View style={styles.card}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionTitle}>Performance Summary</Text>

              <View style={styles.ratingWrap}>
                <Text style={styles.ratingValue}>{sessionRating || 0}</Text>
                <View style={styles.ratingPill}>
                  <Text style={styles.ratingPillText}>{ratingLabel}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.chartTitle}>Driving Score Over Time</Text>
            <View style={styles.lineChart}>
              <View style={styles.lineChartGrid} />
              <LineDots values={scoreSeries} />
              <View style={styles.lineChartLabels}>
                {["14:00", "14:10", "14:20", "14:30", "14:40", "14:50"].map((t) => (
                  <Text key={t} style={styles.axisLabel}>
                    {t}
                  </Text>
                ))}
              </View>
            </View>

            <Text style={[styles.chartTitle, { marginTop: 16 }]}>Safe vs Unsafe Actions</Text>
            <View style={styles.safeRow}>
              <DonutMock percent={safePct} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <LegendRow dot="#10B981" label="Safe Actions" value={`${safePct}%`} />
                <LegendRow dot="#EF4444" label="Unsafe Actions" value={`${100 - safePct}%`} />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session Controls</Text>

        <View style={[styles.controlsRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          <Pressable
            onPress={onPause}
            disabled={!liveSession}
            style={({ pressed }) => [
              styles.controlBtn,
              !liveSession ? { opacity: 0.5 } : null,
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={styles.controlBtnText}>{isActive ? "⏸️  Pause" : "▶️  Resume"}</Text>
          </Pressable>

          <Pressable
            onPress={onEnd}
            disabled={!liveSession}
            style={({ pressed }) => [
              styles.controlBtn,
              styles.controlEnd,
              !liveSession ? { opacity: 0.5 } : null,
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={[styles.controlBtnText, styles.controlEndText]}>⛔  End Session</Text>
          </Pressable>

          <Pressable
            onPress={onFlag}
            style={({ pressed }) => [
              styles.controlBtn,
              styles.controlFlag,
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={[styles.controlBtnText, styles.controlFlagText]}>🏳️  Flag Incident</Text>
          </Pressable>

          <View style={styles.toggleWrap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Audio/Visual Feedback</Text>
              <Text style={styles.toggleSub}>Enable cues during the session</Text>
            </View>
            <Switch value={audioVisual} onValueChange={setAudioVisual} />
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        © 2025 DriveIQ. For authorized instructor use only. Data transmitted may be monitored for quality assurance.
      </Text>
    </ScrollView>
  );
}

function LineDots({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return (
    <View style={styles.lineDotsWrap}>
      {values.map((v, i) => {
        const yPct = (v - min) / range;
        const top = 86 - yPct * 68;

        const isLast = i === values.length - 1;
        return (
          <View key={`${v}-${i}`} style={styles.dotCol}>
            <View style={[styles.dot, { top }]} />
            {!isLast ? <View style={styles.connector} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function DonutMock({ percent }: { percent: number }) {
  return (
    <View style={styles.donutOuter}>
      <View style={styles.donutInner}>
        <Text style={styles.donutValue}>{percent}%</Text>
        <Text style={styles.donutLabel}>Safe</Text>
      </View>
    </View>
  );
}

function LegendRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: dot }]} />
      <Text style={styles.legendText}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 28 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, fontWeight: "800", color: "#64748B" },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  cardTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },

  joinRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  joinCode: { marginTop: 8, fontSize: 18, fontWeight: "900", color: "#0B1220", letterSpacing: 1 },
  joinSub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 11 },

  refreshBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  liveRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusCol: { width: 160, alignItems: "flex-start", justifyContent: "center" },
  liveInfoCol: { flex: 1, marginLeft: 12 },
  liveInfoTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14, flexWrap: "wrap" },
  liveInfoBottomRow: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    minWidth: 160,
  },
  statusActive: { backgroundColor: "#ECFDF3", borderColor: "#BBF7D0" },
  statusPaused: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: "#0F172A", fontWeight: "900", fontSize: 12, flexShrink: 0 },

  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  metaIcon: { fontSize: 14 },
  metaLabel: { color: "#667085", fontWeight: "800", fontSize: 11 },
  metaValue: { color: "#101828", fontWeight: "900", fontSize: 12, marginTop: 2 },

  grid: { gap: 14 },
  col: { gap: 14 },

  sectionTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },

  alertCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  alertRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  alertIcon: { fontSize: 16, marginTop: 2 },

  alertTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 },

  behaviorBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  behaviorBadgeText: { fontWeight: "900", fontSize: 11 },

  alertTimeInline: { color: "#64748B", fontWeight: "800", fontSize: 11 },
  alertTitle: { fontWeight: "900", fontSize: 12 },

  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ratingWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingValue: { color: "#101828", fontWeight: "900", fontSize: 14 },
  ratingPill: { backgroundColor: "#0B1220", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  ratingPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  chartTitle: { marginTop: 12, color: "#101828", fontWeight: "900", fontSize: 12 },

  lineChart: { marginTop: 10, borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, padding: 12, backgroundColor: "#FFFFFF" },
  lineChartGrid: { height: 90, borderRadius: 12, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#F2F4F7" },
  lineDotsWrap: { position: "absolute", left: 12, right: 12, top: 12, height: 90, flexDirection: "row", alignItems: "stretch", justifyContent: "space-between" },
  dotCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563EB", borderWidth: 2, borderColor: "#E0EAFF" },
  connector: { position: "absolute", top: 45, left: "55%", right: "-45%", height: 2, backgroundColor: "#93C5FD", borderRadius: 2, opacity: 0.9 },
  lineChartLabels: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { color: "#667085", fontWeight: "800", fontSize: 10 },

  safeRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  donutOuter: { width: 92, height: 92, borderRadius: 46, borderWidth: 12, borderColor: "#10B981", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  donutInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EAECF0" },
  donutValue: { color: "#101828", fontWeight: "900", fontSize: 13 },
  donutLabel: { color: "#667085", fontWeight: "800", fontSize: 10, marginTop: 2 },

  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { flex: 1, color: "#101828", fontWeight: "800", fontSize: 12 },
  legendValue: { color: "#101828", fontWeight: "900", fontSize: 12 },

  controlsRow: { marginTop: 12, gap: 10 },
  controlBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  controlBtnText: { color: "#101828", fontWeight: "900", fontSize: 13 },
  controlEnd: { backgroundColor: "#E11D48", borderColor: "#E11D48" },
  controlEndText: { color: "#FFFFFF" },
  controlFlag: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
  controlFlagText: { color: "#92400E" },

  toggleWrap: { flex: 1.2, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between" },
  toggleTitle: { color: "#101828", fontWeight: "900", fontSize: 12 },
  toggleSub: { marginTop: 4, color: "#667085", fontWeight: "800", fontSize: 11 },

  footer: { marginTop: 4, color: "#98A2B3", fontSize: 11, fontWeight: "800", textAlign: "center" },
});
