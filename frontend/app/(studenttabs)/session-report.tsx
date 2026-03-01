import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { apiGet } from "../../lib/api";
import {
  colors,
  type_,
  radius,
  space,
  card,
  page,
  shadow,
  divider,
} from "../../lib/theme";

// ─── Enable LayoutAnimation on Android ──────────────────────────────────────

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ──────────────────────────────────────────────────────────────────

type TriggerFeature = {
  feature: string;
  value: number;
  unit: string;
};

type WindowData = {
  window_id: number;
  predicted_label: "Normal" | "Aggressive" | "Drowsy";
  alert_cause: string;
  severity: number;
  knn_distance: number;
  trigger_features: TriggerFeature[];
  feedback?: string; // LLM-generated feedback
  start_time?: string;
  end_time?: string;
  is_flagged?: boolean;
};

type SessionReport = {
  session_id: string;
  road_type: string;
  performance_score: number;
  total_windows: number;
  window_summary: {
    total: number;
    normal: number;
    drowsy: number;
    aggressive: number;
  };
  windows: WindowData[];
  summary_feedback?: string;
  date?: string;
  instructor?: string;
};

type FilterMode = "all" | "abnormal" | "aggressive" | "drowsy" | "normal";

// ─── Color Helpers ──────────────────────────────────────────────────────────

const LABEL_COLORS = {
  Normal: {
    bg: colors.greenLight,
    border: colors.greenBorder,
    text: colors.greenDark ?? "#166534",
    dot: colors.green,
    icon: "checkmark-circle" as const,
  },
  Aggressive: {
    bg: colors.redLight,
    border: colors.redBorder,
    text: colors.redDark,
    dot: colors.red,
    icon: "warning" as const,
  },
  Drowsy: {
    bg: "#FEF9C3",
    border: colors.yellowBorder,
    text: "#92400E",
    dot: colors.yellow,
    icon: "moon" as const,
  },
};

function getLabelStyle(label: string) {
  return LABEL_COLORS[label as keyof typeof LABEL_COLORS] ?? LABEL_COLORS.Normal;
}

function getScoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

function severityLabel(s: number): string {
  if (s <= 2) return "Low";
  if (s <= 5) return "Medium";
  if (s <= 7) return "High";
  return "Critical";
}

function severityColor(s: number): string {
  if (s <= 2) return colors.green;
  if (s <= 5) return colors.yellow;
  if (s <= 7) return "#F97316"; // orange
  return colors.red;
}

// ─── Section Header (reusable) ──────────────────────────────────────────────

function SectionHeader({
  icon,
  iconBg,
  label,
  right,
}: {
  icon: string;
  iconBg: string;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={s.sectionHeaderLeft}>
        <View style={[s.sectionIcon, { backgroundColor: iconBg }]}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <Text style={s.sectionTitle}>{label}</Text>
      </View>
      {right}
    </View>
  );
}

// ─── Score Ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Background ring */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.borderLight,
        }}
      />
      {/* Progress ring (approximated with border) */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRightColor: "transparent",
          borderBottomColor: score > 50 ? color : "transparent",
          borderLeftColor: score > 75 ? color : "transparent",
          transform: [{ rotate: "-45deg" }],
        }}
      />
      <Text style={[s.scoreValue, { color }]}>{score}</Text>
      <Text style={s.scoreLabel}>/ 100</Text>
    </View>
  );
}

// ─── Window Block (in the timeline grid) ────────────────────────────────────

function WindowBlock({
  window: w,
  isSelected,
  onPress,
  index,
}: {
  window: WindowData;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}) {
  const labelStyle = getLabelStyle(w.predicted_label);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          s.windowBlock,
          { backgroundColor: labelStyle.bg, borderColor: labelStyle.border },
          isSelected && {
            borderColor: labelStyle.dot,
            borderWidth: 2.5,
            ...(Platform.OS === "ios"
            ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 }
            : { elevation: 2 }),
          },
        ]}
      >
        <View style={[s.windowDot, { backgroundColor: labelStyle.dot }]} />
        <Text style={[s.windowBlockNum, { color: labelStyle.text }]}>
          {w.window_id + 1}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Filter Chip ────────────────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
  color: chipColor,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.filterChip,
        active && { backgroundColor: chipColor, borderColor: chipColor },
      ]}
    >
      {!active && <View style={[s.chipDot, { backgroundColor: chipColor }]} />}
      <Text
        style={[
          s.filterChipText,
          active && { color: "#FFFFFF", fontWeight: "700" },
        ]}
      >
        {label} ({count})
      </Text>
    </Pressable>
  );
}

// ─── Feedback Panel (expanded window detail) ────────────────────────────────

function FeedbackPanel({ window: w }: { window: WindowData }) {
  const labelStyle = getLabelStyle(w.predicted_label);
  const startMin = w.window_id * 4;
  const endMin = startMin + 4;
  const timeStr = w.start_time ?? `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
  const endStr = w.end_time ?? `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  return (
    <View style={[s.feedbackPanel, { borderLeftColor: labelStyle.dot }]}>
      {/* Header */}
      <View style={s.feedbackHeader}>
        <View style={s.feedbackHeaderLeft}>
          <Ionicons
            name={labelStyle.icon}
            size={20}
            color={labelStyle.dot}
          />
          <View>
            <Text style={s.feedbackTitle}>
              Window {w.window_id + 1} — {w.predicted_label}
            </Text>
            <Text style={s.feedbackTime}>
              {timeStr} → {endStr}
            </Text>
          </View>
        </View>
        <View style={[s.severityBadge, { backgroundColor: severityColor(w.severity) + "18" }]}>
          <Text style={[s.severityText, { color: severityColor(w.severity) }]}>
            {severityLabel(w.severity)} ({w.severity.toFixed(1)})
          </Text>
        </View>
      </View>

      {/* Alert Cause */}
      {w.alert_cause && w.alert_cause !== "No alert" && (
        <View style={s.alertCauseRow}>
          <Ionicons name="alert-circle" size={16} color={colors.yellow} />
          <Text style={s.alertCauseText}>
            Alert: <Text style={{ fontWeight: "700" }}>{w.alert_cause}</Text>
          </Text>
        </View>
      )}

      {/* Trigger Features */}
      {w.trigger_features && w.trigger_features.length > 0 && (
        <View style={s.triggerSection}>
          <Text style={s.triggerLabel}>Key Metrics</Text>
          <View style={s.triggerGrid}>
            {w.trigger_features.map((tf, idx) => (
              <View key={idx} style={s.triggerCard}>
                <Text style={s.triggerFeatureName}>{tf.feature}</Text>
                <Text style={s.triggerFeatureValue}>
                  {typeof tf.value === "number" ? tf.value.toFixed(2) : tf.value}{" "}
                  <Text style={s.triggerFeatureUnit}>{tf.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LLM Feedback */}
      {w.feedback ? (
        <View style={s.llmFeedback}>
          <View style={s.llmFeedbackHeader}>
            <Ionicons name="sparkles" size={16} color={colors.purpleDark} />
            <Text style={s.llmFeedbackTitle}>AI Feedback</Text>
          </View>
          <Text style={s.llmFeedbackText}>{w.feedback}</Text>
        </View>
      ) : (
        <View style={[s.llmFeedback, { backgroundColor: colors.borderLight }]}>
          <Text style={[s.llmFeedbackText, { color: colors.subtext, fontStyle: "italic" }]}>
            Feedback not yet generated for this window.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Behavior Breakdown Bar ─────────────────────────────────────────────────

function BehaviorBar({
  normal,
  aggressive,
  drowsy,
  total,
}: {
  normal: number;
  aggressive: number;
  drowsy: number;
  total: number;
}) {
  const nPct = (normal / total) * 100;
  const aPct = (aggressive / total) * 100;
  const dPct = (drowsy / total) * 100;

  return (
    <View>
      <View style={s.behaviorBarTrack}>
        {nPct > 0 && (
          <View style={[s.behaviorBarSeg, { flex: nPct, backgroundColor: colors.green, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
        )}
        {dPct > 0 && (
          <View style={[s.behaviorBarSeg, { flex: dPct, backgroundColor: colors.yellow }]} />
        )}
        {aPct > 0 && (
          <View style={[s.behaviorBarSeg, { flex: aPct, backgroundColor: colors.red, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
        )}
      </View>
      <View style={s.behaviorLegend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.green }]} />
          <Text style={s.legendText}>Normal {normal}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.yellow }]} />
          <Text style={s.legendText}>Drowsy {drowsy}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.red }]} />
          <Text style={s.legendText}>Aggressive {aggressive}</Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SessionReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");

  // ── Fetch report data ──────────────────────────────────────────────────

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);

      // Fetch both timeline and report endpoints
      const [timelineData, reportData] = await Promise.all([
        apiGet(`/sessions/${sessionId}/timeline`),
        apiGet(`/sessions/${sessionId}/report`),
      ]);

      // Merge into a single report object
      const merged: SessionReport = {
        session_id: sessionId ?? "",
        road_type: timelineData.road_type,
        performance_score: reportData.overall_score?.score ?? 0,
        total_windows: timelineData.total_windows,
        window_summary: reportData.window_summary ?? {
          total: timelineData.total_windows,
          normal: 0,
          drowsy: 0,
          aggressive: 0,
        },
        windows: timelineData.windows ?? [],
        date: reportData.session_summary?.date,
        instructor: reportData.session_summary?.instructor,
      };

      // Calculate window_summary from windows if not provided
      if (!reportData.window_summary) {
        const ws = { total: merged.windows.length, normal: 0, drowsy: 0, aggressive: 0 };
        merged.windows.forEach((w) => {
          const label = w.predicted_label?.toLowerCase();
          if (label === "normal") ws.normal++;
          else if (label === "drowsy") ws.drowsy++;
          else if (label === "aggressive") ws.aggressive++;
        });
        merged.window_summary = ws;
      }

      setReport(merged);

      // Auto-select first abnormal window if any
      const firstAbnormal = merged.windows.find(
        (w) => w.predicted_label !== "Normal"
      );
      if (firstAbnormal) {
        setSelectedWindow(firstAbnormal.window_id);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const filteredWindows = useMemo(() => {
    if (!report) return [];
    switch (filter) {
      case "abnormal":
        return report.windows.filter((w) => w.predicted_label !== "Normal");
      case "aggressive":
        return report.windows.filter((w) => w.predicted_label === "Aggressive");
      case "drowsy":
        return report.windows.filter((w) => w.predicted_label === "Drowsy");
      case "normal":
        return report.windows.filter((w) => w.predicted_label === "Normal");
      default:
        return report.windows;
    }
  }, [report, filter]);

  const selectedWindowData = useMemo(() => {
    if (selectedWindow === null || !report) return null;
    return report.windows.find((w) => w.window_id === selectedWindow) ?? null;
  }, [report, selectedWindow]);

  // ── Navigation between abnormal windows ────────────────────────────────

  const abnormalWindows = useMemo(() => {
    if (!report) return [];
    return report.windows
      .filter((w) => w.predicted_label !== "Normal")
      .map((w) => w.window_id);
  }, [report]);

  function jumpToNext() {
    if (abnormalWindows.length === 0) return;
    const currentIdx = abnormalWindows.indexOf(selectedWindow ?? -1);
    const nextIdx = (currentIdx + 1) % abnormalWindows.length;
    selectWindow(abnormalWindows[nextIdx]);
  }

  function jumpToPrev() {
    if (abnormalWindows.length === 0) return;
    const currentIdx = abnormalWindows.indexOf(selectedWindow ?? -1);
    const prevIdx =
      currentIdx <= 0 ? abnormalWindows.length - 1 : currentIdx - 1;
    selectWindow(abnormalWindows[prevIdx]);
  }

  function selectWindow(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedWindow(id);
  }

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading report…</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red, marginTop: 12 }]}>
          {error ?? "Report not found"}
        </Text>
        <Pressable
          onPress={loadReport}
          style={[s.retryBtn]}
        >
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { window_summary: ws } = report;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={page.base}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[page.content, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back Button ──────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backBtnText}>Back</Text>
        </Pressable>

        {/* ── 1. Session Overview Card ─────────────────────────────────── */}
        <View style={[card.base, s.overviewCard]}>
          <View style={s.overviewTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.overviewTitle}>Session Report</Text>
              <View style={s.metaRow}>
                {report.date && (
                  <View style={s.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.subtext} />
                    <Text style={s.metaText}>{report.date}</Text>
                  </View>
                )}
                <View style={s.metaItem}>
                  <Ionicons name="car-outline" size={14} color={colors.subtext} />
                  <Text style={s.metaText}>{report.road_type}</Text>
                </View>
                <View style={s.metaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.subtext} />
                  <Text style={s.metaText}>
                    {report.total_windows * 4} min ({report.total_windows} windows)
                  </Text>
                </View>
              </View>
            </View>
            <ScoreRing score={report.performance_score} size={90} />
          </View>

          <View style={divider.base} />

          {/* Behavior Breakdown */}
          <BehaviorBar
            normal={ws.normal}
            aggressive={ws.aggressive}
            drowsy={ws.drowsy}
            total={ws.total}
          />
        </View>

        {/* ── 2. Window Timeline ───────────────────────────────────────── */}
        <View style={card.base}>
          <SectionHeader
            icon="📊"
            iconBg={colors.blueLighter ?? "#DBEAFE"}
            label="Window Timeline"
            right={
              abnormalWindows.length > 0 ? (
                <View style={s.navArrows}>
                  <Pressable onPress={jumpToPrev} hitSlop={8} style={s.arrowBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={s.navLabel}>
                    {selectedWindow !== null
                      ? `${abnormalWindows.indexOf(selectedWindow) + 1}/${abnormalWindows.length}`
                      : `${abnormalWindows.length} flagged`}
                  </Text>
                  <Pressable onPress={jumpToNext} hitSlop={8} style={s.arrowBtn}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>
              ) : null
            }
          />

          {/* Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.filterRow}
            contentContainerStyle={{ gap: 8 }}
          >
            <FilterChip
              label="All"
              count={ws.total}
              active={filter === "all"}
              color={colors.blue}
              onPress={() => setFilter("all")}
            />
            <FilterChip
              label="Abnormal"
              count={ws.aggressive + ws.drowsy}
              active={filter === "abnormal"}
              color="#F97316"
              onPress={() => setFilter("abnormal")}
            />
            <FilterChip
              label="Aggressive"
              count={ws.aggressive}
              active={filter === "aggressive"}
              color={colors.red}
              onPress={() => setFilter("aggressive")}
            />
            <FilterChip
              label="Drowsy"
              count={ws.drowsy}
              active={filter === "drowsy"}
              color={colors.yellow}
              onPress={() => setFilter("drowsy")}
            />
            <FilterChip
              label="Normal"
              count={ws.normal}
              active={filter === "normal"}
              color={colors.green}
              onPress={() => setFilter("normal")}
            />
          </ScrollView>

          {/* Timeline Grid */}
          <View style={s.timelineGrid}>
            {filteredWindows.map((w, idx) => (
              <WindowBlock
                key={w.window_id}
                window={w}
                index={idx}
                isSelected={selectedWindow === w.window_id}
                onPress={() => selectWindow(w.window_id)}
              />
            ))}
            {filteredWindows.length === 0 && (
              <Text style={s.emptyTimeline}>
                No windows match this filter.
              </Text>
            )}
          </View>

          {/* Time axis labels */}
          {filter === "all" && report.windows.length > 0 && (
            <View style={s.timeAxis}>
              <Text style={s.timeAxisLabel}>0:00</Text>
              <Text style={s.timeAxisLabel}>
                {(() => {
                  const mid = Math.floor(report.windows.length / 2) * 4;
                  return `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
                })()}
              </Text>
              <Text style={s.timeAxisLabel}>
                {(() => {
                  const end = report.windows.length * 4;
                  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* ── 3. Selected Window Detail ────────────────────────────────── */}
        {selectedWindowData ? (
          <FeedbackPanel window={selectedWindowData} />
        ) : (
          <View style={[card.base, s.noSelectionCard]}>
            <Ionicons name="hand-left-outline" size={28} color={colors.muted} />
            <Text style={s.noSelectionText}>
              Tap a window above to see detailed feedback
            </Text>
          </View>
        )}

        {/* ── 4. Session Summary (LLM) ─────────────────────────────────── */}
        {report.summary_feedback && (
          <View style={card.base}>
            <SectionHeader
              icon="🧠"
              iconBg={colors.purpleLighter ?? "#F4EFFF"}
              label="Session Summary"
            />
            <View style={s.summaryBox}>
              <Ionicons name="sparkles" size={18} color={colors.purpleDark} />
              <Text style={s.summaryText}>{report.summary_feedback}</Text>
            </View>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // ── Back button
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  // ── Section header
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },

  // ── Overview card
  overviewCard: {
    // extra styling if needed
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.subtext,
  },

  // ── Score Ring
  scoreValue: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: -2,
  },

  // ── Behavior Bar
  behaviorBarTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.borderLight,
    overflow: "hidden",
    marginBottom: 10,
  },
  behaviorBarSeg: {
    height: "100%",
  },
  behaviorLegend: {
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.subtext,
  },

  // ── Filter chips
  filterRow: {
    marginBottom: 14,
    flexGrow: 0,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },

  // ── Navigation arrows
  navArrows: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtext,
    minWidth: 40,
    textAlign: "center",
  },

  // ── Timeline Grid
  timelineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  windowBlock: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  windowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  windowBlockNum: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyTimeline: {
    fontSize: 13,
    color: colors.subtext,
    fontStyle: "italic",
    paddingVertical: 12,
  },

  // ── Time axis
  timeAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  timeAxisLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
  },

  // ── Feedback Panel
  feedbackPanel: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card ?? 16,
    padding: space.card ?? 16,
    borderLeftWidth: 4,
    ...(Platform.OS === "ios"
  ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 }
  : { elevation: 2 }),
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  feedbackHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  feedbackTime: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.subtext,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Alert cause
  alertCauseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  alertCauseText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#92400E",
  },

  // ── Trigger features
  triggerSection: {
    marginBottom: 12,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  triggerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  triggerCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: colors.pageBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  triggerFeatureName: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.subtext,
    marginBottom: 4,
  },
  triggerFeatureValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  triggerFeatureUnit: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
  },

  // ── LLM Feedback
  llmFeedback: {
    backgroundColor: colors.purpleLight,
    borderRadius: 10,
    padding: 14,
  },
  llmFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  llmFeedbackTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.purpleDark,
  },
  llmFeedbackText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 20,
  },

  // ── No selection
  noSelectionCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  noSelectionText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },

  // ── Summary box
  summaryBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.purpleLight,
    borderRadius: 10,
    padding: 14,
    alignItems: "flex-start",
  },
  summaryText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 20,
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
