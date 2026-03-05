import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../lib/api";
import { colors, card, page } from "../../lib/theme";

// ─── Types ──────────────────────────────────────────────────────────────────

type Summary = {
  total_learners: number;
  avg_score: number;
  total_sessions: number;
  rating: number;
  total_reviews: number;
};

type Booking = {
  booking_id: string;
  trainee_id: string;
  trainee_name: string;
  slot_date: string;   // "2026-03-05"
  start_time: string;  // "09:00"
  duration_min?: number;
  road_type?: string;
};

type RecentSession = {
  session_id: string;
  trainee_name?: string;
  trainee_id?: string;
  road_type?: string;
  status: string;
  performance_score?: number;
  passed?: boolean;
  created_at?: string;
  started_at?: string;
  ended_at?: string;
};

type Learner = {
  user_id: string;
  name?: string;
  email?: string;
};

type ActiveSession = {
  session_id: string;
  trainee_name?: string;
  trainee_id?: string;
  road_type?: string;
  started_at?: string;
};

type DashData = {
  summary: Summary;
  learners: Learner[];
  recent_sessions: RecentSession[];
  upcoming_bookings: Booking[];
  active_session: ActiveSession | null;
  profile: any;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function formatBookingDate(slot_date: string, start_time: string) {
  try {
    const [y, m, d] = slot_date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayLabel = date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return { day: dayLabel, time: start_time };
  } catch {
    return { day: slot_date, time: start_time };
  }
}

function formatSessionDate(iso?: string) {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isToday(slot_date: string) {
  const today = new Date().toISOString().slice(0, 10);
  return slot_date === today;
}

function isTomorrow(slot_date: string) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return slot_date === t.toISOString().slice(0, 10);
}

function dayLabel(slot_date: string) {
  if (isToday(slot_date)) return "Today";
  if (isTomorrow(slot_date)) return "Tomorrow";
  return formatBookingDate(slot_date, "").day;
}

function scoreColor(s: number) {
  if (s >= 80) return colors.green;
  if (s >= 60) return colors.yellow;
  return colors.red;
}
function scoreBg(s: number) {
  if (s >= 80) return colors.greenLight;
  if (s >= 60) return "#FEF9C3";
  return colors.redLight;
}

function useLiveTimer(startedAt?: string) {
  const startMs = useMemo(() => {
    if (!startedAt) return 0;
    const ms = Date.parse(startedAt);
    return isFinite(ms) ? ms : 0;
  }, [startedAt]);

  const [elapsed, setElapsed] = useState(() =>
    startMs ? Math.floor((Date.now() - startMs) / 1000) : 0
  );

  useEffect(() => {
    if (!startMs) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startMs) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, [startMs]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return [h, m, s]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View style={[ds.kpiCard, card.base]}>
      <Text style={[ds.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={ds.kpiLabel}>{label}</Text>
      {sub ? <Text style={ds.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={ds.sectionHeader}>
      <Text style={ds.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={ds.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={ds.emptyRow}>
      <Text style={ds.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Active Session Banner ───────────────────────────────────────────────────

function ActiveSessionBanner({ session }: { session: ActiveSession }) {
  const timer = useLiveTimer(session.started_at);
  return (
    <Pressable
      onPress={() => router.push("/(instructortabs)/sessions" as any)}
      style={({ pressed }) => [ds.activeBanner, pressed && { opacity: 0.93 }]}
    >
      <View style={ds.activePulse}>
        <View style={ds.activeDot} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ds.activeLive}>LIVE SESSION</Text>
        <Text style={ds.activeStudent}>
          {session.trainee_name ?? "Student"}
          {session.road_type ? `  ·  ${session.road_type}` : ""}
        </Text>
      </View>
      <View style={ds.activeRight}>
        <Text style={ds.activeTimer}>{timer}</Text>
        <View style={ds.activeGo}>
          <Text style={ds.activeGoText}>Manage →</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Booking Row ─────────────────────────────────────────────────────────────

function BookingRow({ booking, isLast }: { booking: Booking; isLast: boolean }) {
  const { time } = formatBookingDate(booking.slot_date, booking.start_time);
  const label = dayLabel(booking.slot_date);
  const highlight = isToday(booking.slot_date);

  return (
    <View style={[ds.bookingRow, !isLast && ds.rowBorder]}>
      <View style={[ds.bookingDateBox, highlight && ds.bookingDateBoxToday]}>
        <Text style={[ds.bookingDayLabel, highlight && { color: colors.purpleDark }]}>
          {label}
        </Text>
        <Text style={[ds.bookingTime, highlight && { color: colors.purpleDark }]}>{time}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ds.bookingName}>{booking.trainee_name || "—"}</Text>
        {booking.road_type ? (
          <Text style={ds.bookingMeta}>{booking.road_type} road</Text>
        ) : null}
      </View>
      {highlight && (
        <View style={ds.todayPill}>
          <Text style={ds.todayPillText}>Today</Text>
        </View>
      )}
    </View>
  );
}

// ─── Recent Session Row ───────────────────────────────────────────────────────

function RecentSessionRow({
  session,
  isLast,
}: {
  session: RecentSession;
  isLast: boolean;
}) {
  const score = session.performance_score ?? 0;
  const passed = session.passed ?? score >= 60;
  const name = session.trainee_name || session.trainee_id || "—";
  const dateStr = formatSessionDate(session.ended_at || session.created_at);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(instructortabs)/sessions" as any,
          params: { highlight: session.session_id },
        })
      }
      style={({ pressed }) => [ds.sessionRow, !isLast && ds.rowBorder, pressed && { opacity: 0.85 }]}
    >
      {/* Avatar */}
      <View style={ds.sessionAvatar}>
        <Text style={ds.sessionAvatarText}>{initials(name)}</Text>
      </View>

      {/* Name + meta */}
      <View style={{ flex: 1 }}>
        <Text style={ds.sessionName}>{name}</Text>
        <Text style={ds.sessionMeta}>
          {dateStr}
          {session.road_type ? `  ·  ${session.road_type}` : ""}
        </Text>
      </View>

      {/* Score badge */}
      <View style={[ds.scoreBadge, { backgroundColor: scoreBg(score) }]}>
        <Text style={[ds.scoreText, { color: scoreColor(score) }]}>{score}</Text>
        <Text style={[ds.scoreUnit, { color: scoreColor(score) }]}>/100</Text>
      </View>

      {/* Pass/fail */}
      <Ionicons
        name={passed ? "checkmark-circle" : "close-circle"}
        size={18}
        color={passed ? colors.green : colors.red}
        style={{ marginLeft: 6 }}
      />
    </Pressable>
  );
}

// ─── Learner Row ─────────────────────────────────────────────────────────────

function LearnerRow({ learner, isLast }: { learner: Learner; isLast: boolean }) {
  const name = learner.name || learner.email || learner.user_id;
  return (
    <View style={[ds.learnerRow, !isLast && ds.rowBorder]}>
      <View style={ds.learnerAvatar}>
        <Text style={ds.learnerAvatarText}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ds.learnerName}>{name}</Text>
        {learner.email ? <Text style={ds.learnerEmail}>{learner.email}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function InstructorDashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const d = await apiGet("/dashboard/instructor");
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red, marginTop: 8 }]}>{error ?? "No data"}</Text>
        <Pressable onPress={load} style={ds.retryBtn}>
          <Text style={ds.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { summary, learners, recent_sessions, upcoming_bookings, active_session } = data;

  // Only show completed sessions in recents
  const recents = recent_sessions
    .filter((s) => s.status === "completed")
    .slice(0, 5);

  const upcomingSorted = [...upcoming_bookings]
    .sort((a, b) => {
      const da = `${a.slot_date}T${a.start_time}`;
      const db = `${b.slot_date}T${b.start_time}`;
      return da < db ? -1 : da > db ? 1 : 0;
    })
    .slice(0, 5);

  const ratingLabel =
    summary.avg_score >= 85 ? "Excellent" :
    summary.avg_score >= 70 ? "Good" :
    summary.avg_score >= 50 ? "Developing" : "Needs Focus";

  return (
    <ScrollView
      style={page.base}
      contentContainerStyle={[page.content, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── KPI Strip ─────────────────────────────────────────────────── */}
      <View style={[ds.kpiStrip, isWide && { flexDirection: "row" }]}>
        <KpiCard
          label="My Learners"
          value={String(summary.total_learners)}
          sub="total enrolled"
        />
        <KpiCard
          label="Sessions Done"
          value={String(summary.total_sessions)}
          sub="completed"
        />
        <KpiCard
          label="Avg Score"
          value={summary.avg_score ? `${summary.avg_score}` : "—"}
          sub={ratingLabel}
          accent={summary.avg_score ? scoreColor(summary.avg_score) : undefined}
        />
        <KpiCard
          label="Rating"
          value={summary.rating ? summary.rating.toFixed(1) : "—"}
          sub={summary.total_reviews ? `${summary.total_reviews} reviews` : "no reviews yet"}
          accent={summary.rating >= 4 ? colors.green : undefined}
        />
      </View>

      {/* ── Active Session Banner ──────────────────────────────────────── */}
      {active_session && <ActiveSessionBanner session={active_session} />}

      {/* ── Two-column section on wide screens ────────────────────────── */}
      <View style={[ds.twoCol, isWide && { flexDirection: "row", gap: 14 }]}>

        {/* Upcoming Bookings */}
        <View style={[card.base, ds.colCard, isWide && { flex: 1 }]}>
          <SectionHeader
            title="Upcoming Bookings"
            action="All Sessions →"
            onAction={() => router.push("/(instructortabs)/sessions" as any)}
          />
          {upcomingSorted.length === 0 ? (
            <EmptyRow text="No upcoming bookings" />
          ) : (
            upcomingSorted.map((b, i) => (
              <BookingRow
                key={b.booking_id}
                booking={b}
                isLast={i === upcomingSorted.length - 1}
              />
            ))
          )}
        </View>

        {/* Recent Sessions */}
        <View style={[card.base, ds.colCard, isWide && { flex: 1 }]}>
          <SectionHeader
            title="Recent Sessions"
            action="View All →"
            onAction={() => router.push("/(instructortabs)/sessions" as any)}
          />
          {recents.length === 0 ? (
            <EmptyRow text="No completed sessions yet" />
          ) : (
            recents.map((s, i) => (
              <RecentSessionRow
                key={s.session_id}
                session={s}
                isLast={i === recents.length - 1}
              />
            ))
          )}
        </View>
      </View>

      {/* ── My Learners ────────────────────────────────────────────────── */}
      <View style={[card.base, ds.colCard]}>
        <SectionHeader
          title="My Learners"
          action="View Records →"
          onAction={() => router.push("/(instructortabs)/records" as any)}
        />
        {learners.length === 0 ? (
          <EmptyRow text="No learners yet — they'll appear once a student books you" />
        ) : (
          learners.slice(0, 6).map((l, i) => (
            <LearnerRow
              key={l.user_id}
              learner={l}
              isLast={i === Math.min(learners.length, 6) - 1}
            />
          ))
        )}
      </View>

      {/* ── How Sessions Work (if no sessions yet) ─────────────────────── */}
      {summary.total_sessions === 0 && !active_session && (
        <View style={[card.base, ds.guideCard]}>
          <Text style={ds.guideTitle}>How sessions work</Text>
          <View style={ds.guideSteps}>
            <GuideStep n="1" text="A student books a time slot through their app" />
            <GuideStep n="2" text='Go to Sessions → tap "Start" — select road type (Motorway / Secondary)' />
            <GuideStep n="3" text="Drive — data is recorded in 4-minute windows automatically" />
            <GuideStep n="4" text='End the session → tap "Generate Report" to run the ML analysis' />
            <GuideStep n="5" text="Student sees their full report with scores, alerts, and AI feedback" />
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function GuideStep({ n, text }: { n: string; text: string }) {
  return (
    <View style={ds.guideStep}>
      <View style={ds.guideNum}>
        <Text style={ds.guideNumText}>{n}</Text>
      </View>
      <Text style={ds.guideStepText}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const ds = StyleSheet.create({
  // ── KPI strip
  kpiStrip: {
    flexDirection: "column",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
    minWidth: 0,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtext,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 1,
  },

  // ── Active session banner
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  activePulse: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
  },
  activeLive: {
    fontSize: 10,
    fontWeight: "900",
    color: "#22C55E",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  activeStudent: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  activeRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  activeTimer: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  activeGo: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeGoText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ── Section layout
  twoCol: {
    flexDirection: "column",
    gap: 14,
    marginBottom: 14,
  },
  colCard: {
    gap: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.purpleDark,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyRow: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },

  // ── Booking row
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  bookingDateBox: {
    width: 72,
    alignItems: "flex-start",
  },
  bookingDateBoxToday: {},
  bookingDayLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.subtext,
  },
  bookingTime: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
    marginTop: 1,
  },
  bookingName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  bookingMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.subtext,
    marginTop: 1,
  },
  todayPill: {
    backgroundColor: colors.purpleLight ?? "#EDE9FE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.purpleDark,
  },

  // ── Recent session row
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 10,
  },
  sessionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionAvatarText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.purpleDark,
  },
  sessionName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  sessionMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.subtext,
    marginTop: 1,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 15,
    fontWeight: "900",
  },
  scoreUnit: {
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 1,
  },

  // ── Learner row
  learnerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 10,
  },
  learnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  learnerAvatarText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2563EB",
  },
  learnerName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  learnerEmail: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.subtext,
    marginTop: 1,
  },

  // ── Guide card
  guideCard: {
    padding: 16,
    marginBottom: 14,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 14,
  },
  guideSteps: {
    gap: 12,
  },
  guideStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  guideNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.purpleDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  guideNumText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  guideStepText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.subtext,
    lineHeight: 19,
  },

  // ── Retry
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.purpleDark,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
