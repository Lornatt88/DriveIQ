import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, G } from "react-native-svg";

type Report = {
  id: string;
  label: string; // dropdown label
  dateLabel: string;
  timeLabel: string;
  instructor: string;
  vehicleId: string;
  duration: string;
  score: number;
  status: "Passed" | "Needs Improvement";
  events: {
    harshBraking: number;
    laneDrift: number;
    missedSignal: number;
    speeding: number;
  };
  aiFeedback: Array<{
    title: string;
    body: string;
    tone: "info" | "warn" | "success";
    icon: keyof typeof Ionicons.glyphMap;
  }>;
  instructorComment: string;
  scoreTrend: number[]; // 6 sessions
  safePct: number; // 0-100
  unsafePct: number; // 0-100
  improvementPoints: number;
  nextSteps: string;
};

const COLORS = {
  pageBg: "#F6F7FB",
  cardBg: "#FFFFFF",
  border: "#E8EAF2",
  text: "#0F172A",
  subtext: "#64748B",
  darkBtn: "#0B1020",
  darkBtnText: "#FFFFFF",
  pillDark: "#0B1020",
  pillLightBg: "#F1F5F9",
  pillLightBorder: "#E2E8F0",
  blue: "#2563EB",
  purple: "#7C3AED",
  green: "#16A34A",
  yellow: "#F59E0B",
  red: "#EF4444",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function makeLinePath(values: number[], w: number, h: number, pad = 16) {
  const min = 0;
  const max = 100;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (innerW * i) / Math.max(1, values.length - 1);
    const y = pad + innerH * (1 - (clamp(v, min, max) - min) / (max - min));
    return { x, y };
  });

  const d = pts
    .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  return { d, pts };
}

function makePieArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export default function Reports() {
  const reports: Report[] = useMemo(
    () => [
      {
        id: "r1",
        label: "Nov 13, 2025 - John Davis",
        dateLabel: "Nov 13, 2025",
        timeLabel: "2:00 PM",
        instructor: "John Davis",
        vehicleId: "VEH-2847",
        duration: "45 min",
        score: 82,
        status: "Passed",
        events: { harshBraking: 2, laneDrift: 1, missedSignal: 0, speeding: 1 },
        aiFeedback: [
          {
            tone: "info",
            icon: "checkmark-circle-outline",
            title: "Speed Control Improvement",
            body:
              "You showed great improvement in speed control today — well done! However, you tend to brake late when approaching intersections. Try to anticipate stops earlier and begin braking gradually. Practicing smoother deceleration will help you maintain better control and comfort.",
          },
          {
            tone: "warn",
            icon: "alert-circle-outline",
            title: "Mirror Checks",
            body:
              "Your lane discipline is consistent, but mirror checks were missed twice. Make it a habit to check mirrors before every lane change or turn. This is crucial for safe driving and will help you develop better awareness of your surroundings.",
          },
          {
            tone: "success",
            icon: "checkmark-circle",
            title: "Overall Progress",
            body:
              "You're showing steady improvement across all metrics. Your confidence is growing, and your fundamentals are strong. Continue practicing the areas highlighted above, and you'll be ready for your test soon!",
          },
        ],
        instructorComment:
          "Sarah was focused and calm today. She handled roundabouts better than last time, showing good improvement in anticipation and positioning. She needs to work on smoother gear transitions — there were a few jerky changes during acceleration. Overall, excellent progress. Keep practicing the clutch control exercises we discussed.",
        scoreTrend: [58, 62, 65, 70, 76, 82],
        safePct: 85,
        unsafePct: 15,
        improvementPoints: 24,
        nextSteps:
          "Based on this session, we recommend booking a follow-up with John Davis to focus on braking techniques and mirror awareness. You're making great progress!",
      },
      {
        id: "r2",
        label: "Nov 11, 2025 - John Davis",
        dateLabel: "Nov 11, 2025",
        timeLabel: "1:00 PM",
        instructor: "John Davis",
        vehicleId: "VEH-1772",
        duration: "40 min",
        score: 76,
        status: "Passed",
        events: { harshBraking: 3, laneDrift: 2, missedSignal: 1, speeding: 1 },
        aiFeedback: [
          {
            tone: "info",
            icon: "information-circle-outline",
            title: "Braking Consistency",
            body:
              "Your braking is improving, but there were a few harsh stops. Start slowing down earlier to keep rides smooth and controlled.",
          },
          {
            tone: "warn",
            icon: "alert-circle-outline",
            title: "Lane Awareness",
            body:
              "Lane drift happened twice. Focus on steady steering and checking your lane position frequently.",
          },
          {
            tone: "success",
            icon: "checkmark-circle",
            title: "Confidence",
            body:
              "Your confidence is improving — keep practicing the basics and you’ll see steady gains.",
          },
        ],
        instructorComment:
          "Good session overall. Keep your hands relaxed and maintain consistent steering through turns. Great effort today.",
        scoreTrend: [55, 60, 63, 68, 72, 76],
        safePct: 82,
        unsafePct: 18,
        improvementPoints: 21,
        nextSteps:
          "Schedule another session focusing on lane discipline and smoother braking.",
      },
    ],
    []
  );

  const [selectedReportId, setSelectedReportId] = useState(reports[0].id);
  const [pickerOpen, setPickerOpen] = useState(false);

  const report = reports.find((r) => r.id === selectedReportId) ?? reports[0];

  function downloadPDF() {
    Alert.alert("Download PDF", "Hook this to your backend / file URL later.");
  }
  function shareWithGuardian() {
    Alert.alert("Share", "Hook this to share sheet / guardian email later.");
  }
  function scheduleFollowUp() {
    Alert.alert("Schedule Follow-Up", "You can route this to Sessions booking screen.");
    // Example later: router.push("/(studenttabs)/sessions");
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {/* Top header row */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.blue} />
            <Text style={styles.pageTitle}>Session Reports</Text>
          </View>
          <Text style={styles.pageSubtitle}>Detailed feedback and performance analysis</Text>
        </View>

        <Pressable onPress={() => setPickerOpen(true)} style={styles.dropdownBtn}>
          <Text style={styles.dropdownText}>{report.label}</Text>
          <Ionicons name="chevron-down" size={16} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Session Summary card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.blue} />
            <Text style={styles.sectionHeaderTitle}>Session Summary</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryItem
            tint="blue"
            icon="calendar"
            label="Date & Time"
            value={`${report.dateLabel}\n${report.timeLabel}`}
          />
          <SummaryItem
            tint="purple"
            icon="person"
            label="Instructor"
            value={report.instructor}
          />
          <SummaryItem
            tint="green"
            icon="car"
            label="Vehicle ID"
            value={report.vehicleId}
          />
          <SummaryItem
            tint="yellow"
            icon="time"
            label="Duration"
            value={report.duration}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.scoreBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreLabel}>Overall Driving Score</Text>
            <Text style={styles.scoreValue}>{report.score}%</Text>
          </View>

          <View style={styles.passedPill}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.passedPillText}>{report.status}</Text>
          </View>
        </View>
      </View>

      {/* Event Breakdown */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="warning-outline" size={18} color={COLORS.yellow} />
            <Text style={styles.sectionHeaderTitle}>Event Breakdown</Text>
          </View>
        </View>

        <View style={styles.eventGrid}>
          <EventBox tint="red" count={report.events.harshBraking} label="Harsh Braking" />
          <EventBox tint="orange" count={report.events.laneDrift} label="Lane Drift" />
          <EventBox tint="green" count={report.events.missedSignal} label="Missed Signal" />
          <EventBox tint="yellow" count={report.events.speeding} label="Speeding" />
        </View>
      </View>

      {/* AI Generated Feedback */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="bulb-outline" size={18} color={COLORS.yellow} />
            <Text style={styles.sectionHeaderTitle}>AI-Generated Feedback</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {report.aiFeedback.map((f) => (
            <FeedbackCard key={f.title} item={f} />
          ))}
        </View>
      </View>

      {/* Instructor Comments */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="chatbox-outline" size={18} color={COLORS.purple} />
            <Text style={styles.sectionHeaderTitle}>Instructor Comments</Text>
          </View>
        </View>

        <View style={styles.commentCard}>
          <View style={styles.commentTop}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {report.instructor
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.commentName}>{report.instructor}</Text>
                <View style={styles.instructorTag}>
                  <Text style={styles.instructorTagText}>Instructor</Text>
                </View>
              </View>
              <Text style={styles.commentBody}>"{report.instructorComment}"</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Charts row */}
      <View style={styles.chartsRow}>
        <View style={[styles.sectionCard, { flex: 1 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="trending-up-outline" size={18} color={COLORS.green} />
              <Text style={styles.sectionHeaderTitle}>Score Progress Over Time</Text>
            </View>
          </View>

          <LineChart values={report.scoreTrend} height={170} />

          <View style={styles.improveBanner}>
            <Ionicons name="checkbox-outline" size={16} color={COLORS.green} style={{ marginRight: 10 }} />
            <Text style={styles.improveText}>
              You've improved by <Text style={{ fontWeight: "900", color: COLORS.green }}>{report.improvementPoints} points</Text> since your first session!
            </Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { flex: 1 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.green} />
              <Text style={styles.sectionHeaderTitle}>Safe vs Unsafe Actions</Text>
            </View>
          </View>

          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <PieChart safe={report.safePct} unsafe={report.unsafePct} size={150} />
          </View>

          <View style={styles.safeRow}>
            <View style={[styles.safeBox, { backgroundColor: "#ECFDF3", borderColor: "#B7F2C8" }]}>
              <Text style={[styles.safePct, { color: COLORS.green }]}>{report.safePct}%</Text>
              <Text style={styles.safeLabel}>Safe Actions</Text>
            </View>
            <View style={[styles.safeBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
              <Text style={[styles.safePct, { color: COLORS.red }]}>{report.unsafePct}%</Text>
              <Text style={styles.safeLabel}>Unsafe Actions</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Route map placeholder */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="map-outline" size={18} color={COLORS.blue} />
            <Text style={styles.sectionHeaderTitle}>Session Route Map</Text>
          </View>
        </View>

        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={34} color="#94A3B8" style={{ marginBottom: 10 }} />
          <Text style={styles.mapTitle}>Route Map with Event Markers</Text>
          <Text style={styles.mapSub}>
            GPS tracking shows your route with markers for braking events, lane drifts, and speed changes
          </Text>
        </View>
      </View>

      {/* Report Actions */}
      <View style={styles.sectionCard}>
        <Text style={styles.actionsTitle}>Report Actions</Text>

        <View style={styles.actionsRow}>
          <Pressable onPress={downloadPDF} style={styles.darkButton}>
            <Ionicons name="download-outline" size={16} color={COLORS.darkBtnText} style={{ marginRight: 8 }} />
            <Text style={styles.darkButtonText}>Download PDF</Text>
          </Pressable>

          <Pressable onPress={shareWithGuardian} style={styles.outlineBtn}>
            <Ionicons name="share-social-outline" size={16} color={COLORS.text} style={{ marginRight: 8 }} />
            <Text style={styles.outlineBtnText}>Share with Parent/Guardian</Text>
          </Pressable>

          <Pressable onPress={scheduleFollowUp} style={styles.outlineBtn}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.text} style={{ marginRight: 8 }} />
            <Text style={styles.outlineBtnText}>Schedule Follow-Up Session</Text>
          </Pressable>
        </View>

        <View style={styles.nextStepsBox}>
          <Ionicons name="help-circle-outline" size={18} color={COLORS.blue} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextStepsTitle}>Next Steps</Text>
            <Text style={styles.nextStepsText}>{report.nextSteps}</Text>
          </View>
        </View>
      </View>

      {/* Report picker */}
      <BottomSheetSelect
        visible={pickerOpen}
        title="Select Report"
        options={reports.map((r) => ({ id: r.id, label: r.label }))}
        selectedId={selectedReportId}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          setSelectedReportId(id);
          setPickerOpen(false);
        }}
      />
    </ScrollView>
  );
}

/* ---------- small components ---------- */

function SummaryItem({
  tint,
  icon,
  label,
  value,
}: {
  tint: "blue" | "purple" | "green" | "yellow";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const bg =
    tint === "blue"
      ? "#EEF5FF"
      : tint === "purple"
      ? "#F4EFFF"
      : tint === "green"
      ? "#ECFDF3"
      : "#FFF7E6";

  const border =
    tint === "blue"
      ? "#BBD7FF"
      : tint === "purple"
      ? "#D6C6FF"
      : tint === "green"
      ? "#B7F2C8"
      : "#FFD48A";

  const iconColor =
    tint === "blue"
      ? COLORS.blue
      : tint === "purple"
      ? COLORS.purple
      : tint === "green"
      ? COLORS.green
      : COLORS.yellow;

  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIconBox, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

function EventBox({
  tint,
  count,
  label,
}: {
  tint: "red" | "orange" | "green" | "yellow";
  count: number;
  label: string;
}) {
  const bg =
    tint === "red"
      ? "#FEF2F2"
      : tint === "orange"
      ? "#FFF7ED"
      : tint === "green"
      ? "#ECFDF3"
      : "#FFF7E6";

  const border =
    tint === "red"
      ? "#FECACA"
      : tint === "orange"
      ? "#FED7AA"
      : tint === "green"
      ? "#B7F2C8"
      : "#FFD48A";

  const color =
    tint === "red"
      ? COLORS.red
      : tint === "orange"
      ? "#F97316"
      : tint === "green"
      ? COLORS.green
      : COLORS.yellow;

  return (
    <View style={[styles.eventBox, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.eventCount, { color }]}>{count}</Text>
      <Text style={styles.eventLabel}>{label}</Text>
    </View>
  );
}

function FeedbackCard({
  item,
}: {
  item: { title: string; body: string; tone: "info" | "warn" | "success"; icon: any };
}) {
  const bg =
    item.tone === "info"
      ? "#EDF5FF"
      : item.tone === "warn"
      ? "#F4EFFF"
      : "#ECFDF3";

  const border =
    item.tone === "info"
      ? "#BBD7FF"
      : item.tone === "warn"
      ? "#D6C6FF"
      : "#B7F2C8";

  const accent =
    item.tone === "info" ? COLORS.blue : item.tone === "warn" ? COLORS.purple : COLORS.green;

  return (
    <View style={[styles.feedbackCard, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.feedbackHeader}>
        <Ionicons name={item.icon} size={18} color={accent} style={{ marginRight: 10 }} />
        <Text style={[styles.feedbackTitle, { color: accent }]}>{item.title}</Text>
      </View>
      <Text style={styles.feedbackBody}>{item.body}</Text>
    </View>
  );
}

function LineChart({ values, height }: { values: number[]; height: number }) {
  const width = 320; // fixed-ish, works well on phones (it will scale inside)
  const { d, pts } = makeLinePath(values, width, height, 18);

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <Svg width={width} height={height}>
        {/* grid lines */}
        {[0, 25, 50, 75, 100].map((yVal) => {
          const y = 18 + (height - 36) * (1 - yVal / 100);
          return (
            <Path
              key={yVal}
              d={`M 18 ${y} L ${width - 18} ${y}`}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}

        {/* axis line */}
        <Path d={`M 18 ${height - 18} L ${width - 18} ${height - 18}`} stroke="#CBD5E1" strokeWidth={1} />

        {/* line */}
        <Path d={d} stroke={COLORS.blue} strokeWidth={3} fill="none" />

        {/* points */}
        {pts.map((p, idx) => (
          <Circle key={idx} cx={p.x} cy={p.y} r={5} fill={COLORS.blue} />
        ))}
      </Svg>

      <Text style={styles.chartLegend}>— Driving Score (%)</Text>

      <View style={styles.chartXRow}>
        {values.map((_, i) => (
          <Text key={i} style={styles.chartXLabel}>
            Session {i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PieChart({ safe, unsafe, size }: { safe: number; unsafe: number; size: number }) {
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const safeAngle = (Math.PI * 2 * safe) / 100;
  const start = -Math.PI / 2;
  const safeEnd = start + safeAngle;
  const unsafeEnd = start + Math.PI * 2;

  const safeArc = makePieArc(cx, cy, r, start, safeEnd);
  const unsafeArc = makePieArc(cx, cy, r, safeEnd, unsafeEnd);

  return (
    <Svg width={size} height={size}>
      <G>
        <Path d={safeArc} fill="#22C55E" />
        <Path d={unsafeArc} fill="#EF4444" />
      </G>
    </Svg>
  );
}

/* Bottom sheet select */
function BottomSheetSelect({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Ionicons name="close" size={18} color={COLORS.text} />
            </Pressable>
          </View>

          {options.map((opt) => {
            const isSel = opt.id === selectedId;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onSelect(opt.id)}
                style={[styles.sheetItem, isSel && styles.sheetItemSelected]}
              >
                <Text style={[styles.sheetItemText, isSel && styles.sheetItemTextSelected]}>{opt.label}</Text>
                {isSel ? <Ionicons name="checkmark" size={18} color={COLORS.blue} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.pageBg },
  pageContent: { padding: 16, paddingBottom: 28, gap: 14 },

  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pageTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  pageSubtitle: { marginTop: 4, color: COLORS.subtext, fontWeight: "600", fontSize: 12 },

  dropdownBtn: {
    minWidth: 190,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownText: { fontSize: 12, fontWeight: "800", color: COLORS.text, maxWidth: 220 },

  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeaderTitle: { fontSize: 13, fontWeight: "900", color: COLORS.text },

  summaryGrid: { gap: 12 },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: { color: COLORS.subtext, fontWeight: "800", fontSize: 12 },
  summaryValue: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginTop: 4, lineHeight: 16 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  scoreBox: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreLabel: { color: COLORS.subtext, fontWeight: "800", fontSize: 12 },
  scoreValue: { color: COLORS.text, fontWeight: "900", fontSize: 34, marginTop: 4 },

  passedPill: {
    backgroundColor: COLORS.pillDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  passedPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  eventGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  eventBox: {
    flexGrow: 1,
    flexBasis: "48%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  eventCount: { fontSize: 22, fontWeight: "900" },
  eventLabel: { marginTop: 6, color: COLORS.text, fontWeight: "800", fontSize: 12 },

  feedbackCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  feedbackHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  feedbackTitle: { fontSize: 13, fontWeight: "900" },
  feedbackBody: { color: COLORS.text, fontWeight: "600", fontSize: 12, lineHeight: 18 },

  commentCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  commentTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#6D67FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  commentName: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  instructorTag: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  instructorTagText: { color: COLORS.text, fontWeight: "900", fontSize: 10 },
  commentBody: { marginTop: 10, color: COLORS.text, fontWeight: "600", fontSize: 12, lineHeight: 18 },

  chartsRow: { gap: 14 },

  chartLegend: { marginTop: 6, color: COLORS.subtext, fontWeight: "800", fontSize: 12 },
  chartXRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4, marginTop: 8 },
  chartXLabel: { color: COLORS.subtext, fontWeight: "700", fontSize: 10 },

  improveBanner: {
    marginTop: 12,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#B7F2C8",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  improveText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },

  safeRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  safeBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  safePct: { fontSize: 18, fontWeight: "900" },
  safeLabel: { marginTop: 6, color: COLORS.text, fontWeight: "800", fontSize: 12 },

  mapPlaceholder: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  mapTitle: { color: COLORS.text, fontWeight: "900", fontSize: 13 },
  mapSub: { marginTop: 6, color: COLORS.subtext, fontWeight: "700", fontSize: 12, textAlign: "center", lineHeight: 18 },

  actionsTitle: { color: COLORS.text, fontWeight: "900", fontSize: 13, marginBottom: 12 },
  actionsRow: { gap: 10 },

  darkButton: {
    backgroundColor: COLORS.darkBtn,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  darkButtonText: { color: COLORS.darkBtnText, fontWeight: "900", fontSize: 12 },

  outlineBtn: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  nextStepsBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#BBD7FF",
    backgroundColor: "#EDF5FF",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  nextStepsTitle: { color: COLORS.blue, fontWeight: "900", fontSize: 12, marginBottom: 6 },
  nextStepsText: { color: COLORS.text, fontWeight: "700", fontSize: 12, lineHeight: 18 },

  /* bottom sheet */
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetItemSelected: { backgroundColor: "#EEF5FF" },
  sheetItemText: { fontSize: 12, fontWeight: "900", color: COLORS.text },
  sheetItemTextSelected: { color: COLORS.blue },
});
