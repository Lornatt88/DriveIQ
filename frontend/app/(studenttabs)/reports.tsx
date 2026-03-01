import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { apiGet } from "../../lib/api";
import {
  colors,
  card,
  page,
  space,
  shadow,
  radius,
} from "../../lib/theme";

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionSummary = {
  session_id: string;
  date: string;
  road_type: string;
  performance_score: number;
  passed: boolean;
  duration_minutes: number;
  window_summary: {
    total: number;
    normal: number;
    drowsy: number;
    aggressive: number;
  };
  instructor_name?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

function getScoreBg(score: number) {
  if (score >= 80) return colors.greenLight;
  if (score >= 60) return "#FEF9C3";
  return colors.redLight;
}

// ─── Mini Behavior Dots ─────────────────────────────────────────────────────

function MiniTimeline({
  summary,
}: {
  summary: SessionSummary["window_summary"];
}) {
  const total = summary.total || 30;
  const dots = [];
  let idx = 0;

  // Build a simplified visual: normal dots first, then drowsy, then aggressive
  // In practice you'd use the actual window order — this is just for the list preview
  for (let i = 0; i < summary.normal && idx < total; i++, idx++)
    dots.push("normal");
  for (let i = 0; i < summary.drowsy && idx < total; i++, idx++)
    dots.push("drowsy");
  for (let i = 0; i < summary.aggressive && idx < total; i++, idx++)
    dots.push("aggressive");

  const DOT_COLORS = {
    normal: colors.green,
    drowsy: colors.yellow,
    aggressive: colors.red,
  };

  return (
    <View style={ls.miniTimeline}>
      {dots.slice(0, 30).map((type, i) => (
        <View
          key={i}
          style={[
            ls.miniDot,
            { backgroundColor: DOT_COLORS[type as keyof typeof DOT_COLORS] },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Session Card ───────────────────────────────────────────────────────────

function SessionCard({
  session,
  onPress,
}: {
  session: SessionSummary;
  onPress: () => void;
}) {
  const scoreColor = getScoreColor(session.performance_score);
  const ws = session.window_summary;
  const flagged = ws.aggressive + ws.drowsy;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        card.base,
        ls.sessionCard,
        pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
      ]}
    >
      {/* Top row: date + score */}
      <View style={ls.cardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={ls.cardDate}>{session.date}</Text>
          <View style={ls.cardMetaRow}>
            <View style={ls.cardMetaItem}>
              <Ionicons name="car-outline" size={13} color={colors.subtext} />
              <Text style={ls.cardMetaText}>{session.road_type}</Text>
            </View>
            <View style={ls.cardMetaItem}>
              <Ionicons name="time-outline" size={13} color={colors.subtext} />
              <Text style={ls.cardMetaText}>{session.duration_minutes} min</Text>
            </View>
          </View>
        </View>

        {/* Score badge */}
        <View style={[ls.scoreBadge, { backgroundColor: getScoreBg(session.performance_score) }]}>
          <Text style={[ls.scoreBadgeText, { color: scoreColor }]}>
            {session.performance_score}
          </Text>
          <Text style={[ls.scoreBadgeUnit, { color: scoreColor }]}>/100</Text>
        </View>
      </View>

      {/* Mini timeline preview */}
      <MiniTimeline summary={ws} />

      {/* Bottom: status + flagged count */}
      <View style={ls.cardBottomRow}>
        <View style={ls.statusRow}>
          <View
            style={[
              ls.statusBadge,
              {
                backgroundColor: session.passed ? colors.greenLight : colors.redLight,
              },
            ]}
          >
            <Ionicons
              name={session.passed ? "checkmark-circle" : "close-circle"}
              size={14}
              color={session.passed ? colors.green : colors.red}
            />
            <Text
              style={[
                ls.statusText,
                { color: session.passed ? colors.greenDark ?? "#166534" : colors.redDark },
              ]}
            >
              {session.passed ? "Passed" : "Needs Improvement"}
            </Text>
          </View>

          {flagged > 0 && (
            <View style={ls.flaggedBadge}>
              <Ionicons name="warning-outline" size={12} color="#92400E" />
              <Text style={ls.flaggedText}>
                {flagged} flagged window{flagged > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportsListScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadSessions() {
    try {
      setError(null);
      const data = await apiGet("/sessions/my-reports");
      setSessions(data?.sessions ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  function onRefresh() {
    setRefreshing(true);
    loadSessions();
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading reports…</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red }]}>{error}</Text>
        <Pressable onPress={loadSessions} style={ls.retryBtn}>
          <Text style={ls.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={page.base}>
      <ScrollView
        contentContainerStyle={[page.content, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.purpleDark}
          />
        }
      >
        {/* Header */}
        <View style={ls.header}>
          <Text style={ls.headerTitle}>My Reports</Text>
          <Text style={ls.headerSub}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} completed
          </Text>
        </View>

        {/* Session List */}
        {sessions.length === 0 ? (
          <View style={[card.base, ls.emptyCard]}>
            <Ionicons name="document-text-outline" size={44} color={colors.muted} />
            <Text style={ls.emptyTitle}>No reports yet</Text>
            <Text style={ls.emptyText}>
              Your driving session reports will appear here after your instructor processes them.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onPress={() =>
                  router.push({
                    pathname: "/(studenttabs)/session-report",
                    params: { sessionId: session.session_id },
                  })
                }
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const ls = StyleSheet.create({
  // ── Header
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.subtext,
    marginTop: 4,
  },

  // ── Session Card
  sessionCard: {
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.subtext,
  },

  // ── Score badge
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scoreBadgeUnit: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 1,
  },

  // ── Mini timeline
  miniTimeline: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },

  // ── Bottom row
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  flaggedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  flaggedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },

  // ── Empty
  emptyCard: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.subtext,
    textAlign: "center",
    paddingHorizontal: 24,
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
