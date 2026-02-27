import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, G } from "react-native-svg";
import { colors, type_, radius, space, card, page, divider, tint as themeTint } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  id: string; label: string; dateLabel: string; timeLabel: string;
  instructor: string; vehicleId: string; duration: string;
  score: number; status: "Passed" | "Needs Improvement";
  events: { harshBraking: number; laneDrift: number; missedSignal: number; speeding: number };
  aiFeedback: Array<{ title: string; body: string; tone: "info" | "warn" | "success"; icon: keyof typeof Ionicons.glyphMap }>;
  instructorComment: string; scoreTrend: number[];
  safePct: number; unsafePct: number; improvementPoints: number; nextSteps: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function makeLinePath(values: number[], w: number, h: number, pad = 16) {
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const pts = values.map((v, i) => ({
    x: pad + (innerW * i) / Math.max(1, values.length - 1),
    y: pad + innerH * (1 - (clamp(v, 0, 100)) / 100),
  }));
  return { d: pts.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" "), pts };
}

function makePieArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function instructorInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  // TODO: Replace with real API call → apiGet("/reports") or similar
  const reports: Report[] = useMemo(() => [
    {
      id: "r1", label: "Nov 13, 2025 - Session 1",
      dateLabel: "Nov 13, 2025", timeLabel: "2:00 PM",
      instructor: "—", vehicleId: "—", duration: "45 min",
      score: 82, status: "Passed",
      events: { harshBraking: 2, laneDrift: 1, missedSignal: 0, speeding: 1 },
      aiFeedback: [
        { tone: "info",    icon: "checkmark-circle-outline",  title: "Speed Control Improvement", body: "You showed great improvement in speed control today — well done! However, you tend to brake late when approaching intersections. Try to anticipate stops earlier and begin braking gradually." },
        { tone: "warn",    icon: "alert-circle-outline",      title: "Mirror Checks",              body: "Your lane discipline is consistent, but mirror checks were missed twice. Make it a habit to check mirrors before every lane change or turn." },
        { tone: "success", icon: "checkmark-circle",          title: "Overall Progress",           body: "You're showing steady improvement across all metrics. Your confidence is growing, and your fundamentals are strong. Keep it up!" },
      ],
      instructorComment: "Handled session well. Good improvement in anticipation and positioning. Focus on smoother gear transitions during acceleration. Overall, excellent progress.",
      scoreTrend: [58, 62, 65, 70, 76, 82],
      safePct: 85, unsafePct: 15, improvementPoints: 24,
      nextSteps: "Focus on braking techniques and mirror awareness. You're making great progress — keep at it!",
    },
    {
      id: "r2", label: "Nov 11, 2025 - Session 2",
      dateLabel: "Nov 11, 2025", timeLabel: "1:00 PM",
      instructor: "—", vehicleId: "—", duration: "40 min",
      score: 76, status: "Passed",
      events: { harshBraking: 3, laneDrift: 2, missedSignal: 1, speeding: 1 },
      aiFeedback: [
        { tone: "info",    icon: "information-circle-outline", title: "Braking Consistency", body: "Your braking is improving, but there were a few harsh stops. Start slowing down earlier to keep rides smooth and controlled." },
        { tone: "warn",    icon: "alert-circle-outline",       title: "Lane Awareness",      body: "Lane drift happened twice. Focus on steady steering and checking your lane position frequently." },
        { tone: "success", icon: "checkmark-circle",           title: "Confidence",          body: "Your confidence is improving — keep practicing the basics and you'll see steady gains." },
      ],
      instructorComment: "Good session overall. Keep your hands relaxed and maintain consistent steering through turns. Great effort today.",
      scoreTrend: [55, 60, 63, 68, 72, 76],
      safePct: 82, unsafePct: 18, improvementPoints: 21,
      nextSteps: "Schedule another session focusing on lane discipline and smoother braking.",
    },
  ], []);

  const [selectedReportId, setSelectedReportId] = useState(reports[0].id);
  const [pickerOpen, setPickerOpen]             = useState(false);
  const report = reports.find((r) => r.id === selectedReportId) ?? reports[0];

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Ionicons name="document-text-outline" size={20} color={colors.blue} />
            <Text style={s.pageTitle}>Session Reports</Text>
          </View>
          <Text style={s.pageSubtitle}>Detailed feedback and performance analysis</Text>
        </View>
        <Pressable onPress={() => setPickerOpen(true)} style={s.dropdownBtn}>
          <Text style={s.dropdownText}>{report.label}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      </View>

      {/* Session Summary */}
      <View style={card.base}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={s.sectionHeaderTitle}>Session Summary</Text>
          </View>
        </View>

        <View style={s.summaryGrid}>
          <SummaryItem tintKey="blue"   icon="calendar"     label="Date & Time"  value={`${report.dateLabel}\n${report.timeLabel}`} />
          <SummaryItem tintKey="purple" icon="person"       label="Instructor"   value={report.instructor} />
          <SummaryItem tintKey="green"  icon="car"          label="Vehicle ID"   value={report.vehicleId} />
          <SummaryItem tintKey="yellow" icon="time"         label="Duration"     value={report.duration} />
        </View>

        <View style={divider.base} />

        <View style={s.scoreBox}>
          <View style={{ flex: 1 }}>
            <Text style={s.scoreLabel}>Overall Driving Score</Text>
            <Text style={s.scoreValue}>{report.score}%</Text>
          </View>
          <View style={[s.passedPill, { backgroundColor: report.status === "Passed" ? colors.darkBtn : colors.redDark }]}>
            <Ionicons name={report.status === "Passed" ? "checkmark" : "close"} size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={s.passedPillText}>{report.status}</Text>
          </View>
        </View>
      </View>

      {/* Event Breakdown */}
      <View style={card.base}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="warning-outline" size={18} color={colors.yellow} />
            <Text style={s.sectionHeaderTitle}>Event Breakdown</Text>
          </View>
        </View>
        <View style={s.eventGrid}>
          <EventBox tintKey="red"    count={report.events.harshBraking}  label="Harsh Braking" />
          <EventBox tintKey="orange" count={report.events.laneDrift}     label="Lane Drift" />
          <EventBox tintKey="green"  count={report.events.missedSignal}  label="Missed Signal" />
          <EventBox tintKey="yellow" count={report.events.speeding}      label="Speeding" />
        </View>
      </View>

      {/* AI Feedback */}
      <View style={card.base}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="bulb-outline" size={18} color={colors.yellow} />
            <Text style={s.sectionHeaderTitle}>AI-Generated Feedback</Text>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          {report.aiFeedback.map((f) => <FeedbackCard key={f.title} item={f} />)}
        </View>
      </View>

      {/* Instructor Comments */}
      <View style={card.base}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="chatbox-outline" size={18} color={colors.purple} />
            <Text style={s.sectionHeaderTitle}>Instructor Comments</Text>
          </View>
        </View>
        <View style={s.commentCard}>
          <View style={s.commentTop}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{instructorInitials(report.instructor)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={s.commentName}>{report.instructor}</Text>
                <View style={s.instructorTag}><Text style={s.instructorTagText}>Instructor</Text></View>
              </View>
              <Text style={s.commentBody}>"{report.instructorComment}"</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Charts */}
      <View style={s.chartsRow}>
        {/* Score trend */}
        <View style={[card.base, { flex: 1 }]}>
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderLeft}>
              <Ionicons name="trending-up-outline" size={18} color={colors.green} />
              <Text style={s.sectionHeaderTitle}>Score Progress Over Time</Text>
            </View>
          </View>
          <LineChart values={report.scoreTrend} height={170} />
          <View style={s.improveBanner}>
            <Ionicons name="checkbox-outline" size={16} color={colors.green} style={{ marginRight: 10 }} />
            <Text style={s.improveText}>
              You've improved by{" "}
              <Text style={{ fontWeight: "900", color: colors.green }}>{report.improvementPoints} points</Text>
              {" "}since your first session!
            </Text>
          </View>
        </View>

        {/* Safe vs unsafe */}
        <View style={[card.base, { flex: 1 }]}>
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderLeft}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
              <Text style={s.sectionHeaderTitle}>Safe vs Unsafe Actions</Text>
            </View>
          </View>
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <PieChart safe={report.safePct} unsafe={report.unsafePct} size={150} />
          </View>
          <View style={s.safeRow}>
            <View style={[s.safeBox, { backgroundColor: colors.greenLight, borderColor: colors.greenBorder }]}>
              <Text style={[s.safePct, { color: colors.green }]}>{report.safePct}%</Text>
              <Text style={s.safeLabel}>Safe Actions</Text>
            </View>
            <View style={[s.safeBox, { backgroundColor: colors.redLight, borderColor: colors.redBorder }]}>
              <Text style={[s.safePct, { color: colors.red }]}>{report.unsafePct}%</Text>
              <Text style={s.safeLabel}>Unsafe Actions</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Route Map */}
      <View style={card.base}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Ionicons name="map-outline" size={18} color={colors.blue} />
            <Text style={s.sectionHeaderTitle}>Session Route Map</Text>
          </View>
        </View>
        <View style={s.mapPlaceholder}>
          <Ionicons name="map" size={34} color="#94A3B8" style={{ marginBottom: 10 }} />
          <Text style={s.mapTitle}>Route Map with Event Markers</Text>
          <Text style={s.mapSub}>GPS tracking shows your route with markers for braking events, lane drifts, and speed changes</Text>
        </View>
      </View>

      {/* Report Actions */}
      <View style={card.base}>
        <Text style={s.actionsTitle}>Report Actions</Text>
        <View style={s.actionsRow}>
          <Pressable onPress={() => Alert.alert("Download PDF", "Hook this to your backend / file URL.")} style={s.darkButton}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={s.darkButtonText}>Download PDF</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert("Share", "Hook this to share sheet / guardian email.")} style={s.outlineBtn}>
            <Ionicons name="share-social-outline" size={16} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={s.outlineBtnText}>Share with Parent/Guardian</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert("Schedule Follow-Up", "Route to Sessions booking screen.")} style={s.outlineBtn}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={s.outlineBtnText}>Schedule Follow-Up Session</Text>
          </Pressable>
        </View>
        <View style={s.nextStepsBox}>
          <Ionicons name="help-circle-outline" size={18} color={colors.blue} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.nextStepsTitle}>Next Steps</Text>
            <Text style={s.nextStepsText}>{report.nextSteps}</Text>
          </View>
        </View>
      </View>

      {/* Report picker bottom sheet */}
      <BottomSheetSelect
        visible={pickerOpen} title="Select Report"
        options={reports.map((r) => ({ id: r.id, label: r.label }))}
        selectedId={selectedReportId}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => { setSelectedReportId(id); setPickerOpen(false); }}
      />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TINT_MAP = {
  blue:   { bg: themeTint.blue.bg,   border: themeTint.blue.border,   icon: colors.blue   },
  purple: { bg: themeTint.purple.bg, border: themeTint.purple.border, icon: colors.purple },
  green:  { bg: themeTint.green.bg,  border: themeTint.green.border,  icon: colors.green  },
  yellow: { bg: themeTint.yellow.bg, border: themeTint.yellow.border, icon: colors.yellow },
  red:    { bg: themeTint.red.bg,    border: themeTint.red.border,    icon: colors.red    },
  orange: { bg: "#FFF7ED", border: "#FED7AA", icon: "#F97316" },
} as const;

type TintMapKey = keyof typeof TINT_MAP;

function SummaryItem({ tintKey, icon, label, value }: { tintKey: TintMapKey; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const t = TINT_MAP[tintKey];
  return (
    <View style={st.summaryItem}>
      <View style={[st.summaryIconBox, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Ionicons name={icon} size={18} color={t.icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.summaryLabel}>{label}</Text>
        <Text style={st.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

function EventBox({ tintKey, count, label }: { tintKey: TintMapKey; count: number; label: string }) {
  const t = TINT_MAP[tintKey];
  return (
    <View style={[st.eventBox, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[st.eventCount, { color: t.icon }]}>{count}</Text>
      <Text style={st.eventLabel}>{label}</Text>
    </View>
  );
}

function FeedbackCard({ item }: { item: { title: string; body: string; tone: "info" | "warn" | "success"; icon: keyof typeof Ionicons.glyphMap } }) {
  const t = item.tone === "info" ? TINT_MAP.blue : item.tone === "warn" ? TINT_MAP.purple : TINT_MAP.green;
  return (
    <View style={[st.feedbackCard, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={st.feedbackHeader}>
        <Ionicons name={item.icon} size={18} color={t.icon} style={{ marginRight: 10 }} />
        <Text style={[st.feedbackTitle, { color: t.icon }]}>{item.title}</Text>
      </View>
      <Text style={st.feedbackBody}>{item.body}</Text>
    </View>
  );
}

function LineChart({ values, height }: { values: number[]; height: number }) {
  const width = 320;
  const { d, pts } = makeLinePath(values, width, height, 18);
  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <Svg width={width} height={height}>
        {[0, 25, 50, 75, 100].map((yVal) => {
          const y = 18 + (height - 36) * (1 - yVal / 100);
          return <Path key={yVal} d={`M 18 ${y} L ${width - 18} ${y}`} stroke={colors.borderFaint} strokeWidth={1} />;
        })}
        <Path d={`M 18 ${height - 18} L ${width - 18} ${height - 18}`} stroke="#CBD5E1" strokeWidth={1} />
        <Path d={d} stroke={colors.blue} strokeWidth={3} fill="none" />
        {pts.map((p, idx) => <Circle key={idx} cx={p.x} cy={p.y} r={5} fill={colors.blue} />)}
      </Svg>
      <Text style={st.chartLegend}>— Driving Score (%)</Text>
      <View style={st.chartXRow}>
        {values.map((_, i) => <Text key={i} style={st.chartXLabel}>S{i + 1}</Text>)}
      </View>
    </View>
  );
}

function PieChart({ safe, unsafe, size }: { safe: number; unsafe: number; size: number }) {
  const r  = size / 2 - 6, cx = size / 2, cy = size / 2;
  const safeAngle = (Math.PI * 2 * safe) / 100;
  const start     = -Math.PI / 2;
  return (
    <Svg width={size} height={size}>
      <G>
        <Path d={makePieArc(cx, cy, r, start, start + safeAngle)} fill="#22C55E" />
        <Path d={makePieArc(cx, cy, r, start + safeAngle, start + Math.PI * 2)} fill={colors.red} />
      </G>
    </Svg>
  );
}

function BottomSheetSelect({ visible, title, options, selectedId, onSelect, onClose }: {
  visible: boolean; title: string; options: Array<{ id: string; label: string }>;
  selectedId: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.sheetOverlay} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={st.sheetClose}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          {options.map((opt) => {
            const isSel = opt.id === selectedId;
            return (
              <Pressable key={opt.id} onPress={() => onSelect(opt.id)}
                style={[st.sheetItem, isSel && st.sheetItemSelected]}>
                <Text style={[st.sheetItemText, isSel && st.sheetItemTextSelected]}>{opt.label}</Text>
                {isSel && <Ionicons name="checkmark" size={18} color={colors.blue} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { flex: 1, backgroundColor: colors.pageBgAlt },
  pageContent: { padding: space.page, paddingBottom: 28, gap: 14 },

  topRow:      { flexDirection: "row", alignItems: "center", gap: space.md },
  titleRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  pageTitle:   { ...type_.pageTitle },
  pageSubtitle:{ ...type_.pageSubtitle },

  dropdownBtn: { minWidth: 190, backgroundColor: colors.pageBg, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dropdownText:{ fontSize: 12, fontWeight: "800", color: colors.text, maxWidth: 220 },

  sectionHeaderRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.md },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sectionHeaderTitle:{ ...type_.sectionTitle },

  summaryGrid: { gap: space.md },

  scoreBox:      { backgroundColor: colors.indigoBg, borderWidth: 1, borderColor: colors.indigoBorder, borderRadius: radius.input, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreLabel:    { ...type_.labelSm, fontWeight: "800" },
  scoreValue:    { ...type_.displayScore, marginTop: 4 },
  passedPill:    { borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  passedPillText:{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  eventGrid: { flexDirection: "row", gap: space.md, flexWrap: "wrap" },

  commentCard:    { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, padding: 14, backgroundColor: colors.cardBg },
  commentTop:     { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  avatarCircle:   { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  avatarText:     { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  commentName:    { ...type_.sectionTitle },
  instructorTag:  { backgroundColor: colors.pageBg, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  instructorTagText:{ ...type_.chip, fontSize: 10 },
  commentBody:    { marginTop: 10, ...type_.bodyMedium },

  chartsRow:    { gap: 14 },
  improveBanner:{ marginTop: space.md, backgroundColor: colors.greenLight, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radius.input, padding: space.md, flexDirection: "row", alignItems: "center" },
  improveText:  { ...type_.body, color: colors.text, flex: 1 },

  safeRow: { flexDirection: "row", gap: space.md, marginTop: 10 },
  safeBox: { flex: 1, borderWidth: 1, borderRadius: radius.input, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  safePct: { fontSize: 18, fontWeight: "900" },
  safeLabel:{ marginTop: 6, ...type_.body, fontWeight: "800" },

  mapPlaceholder: { borderWidth: 1, borderColor: "#CBD5E1", borderStyle: "dashed", borderRadius: radius.input, backgroundColor: colors.pageBg, padding: space.xxl, alignItems: "center", justifyContent: "center", minHeight: 150 },
  mapTitle:       { ...type_.sectionTitle },
  mapSub:         { marginTop: 6, ...type_.labelSm, fontWeight: "700", textAlign: "center", lineHeight: 18 },

  actionsTitle: { ...type_.sectionTitle, marginBottom: space.md },
  actionsRow:   { gap: 10 },
  darkButton:   { backgroundColor: colors.darkBtn, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  darkButtonText:{ ...type_.btnSm },
  outlineBtn:   { borderWidth: 1, borderColor: colors.borderMid, backgroundColor: colors.cardBg, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  outlineBtnText:{ ...type_.btnOutline },

  nextStepsBox:  { marginTop: 14, borderWidth: 1, borderColor: colors.blueNoteBorder, backgroundColor: colors.blueNote, borderRadius: radius.input, padding: 14, flexDirection: "row", alignItems: "flex-start" },
  nextStepsTitle:{ color: colors.blue, fontWeight: "900", fontSize: 12, marginBottom: 6 },
  nextStepsText: { ...type_.body, fontWeight: "700" },
});

// Shared styles for sub-components
const st = StyleSheet.create({
  summaryItem:   { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryIconBox:{ width: 44, height: 44, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  summaryLabel:  { ...type_.labelSm, fontWeight: "800" },
  summaryValue:  { ...type_.body, fontWeight: "900", marginTop: 4, lineHeight: 16 },

  eventBox:   { flexGrow: 1, flexBasis: "48%", borderWidth: 1, borderRadius: radius.input, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 80 },
  eventCount: { fontSize: 22, fontWeight: "900" },
  eventLabel: { marginTop: 6, ...type_.body, fontWeight: "800" },

  feedbackCard:   { borderWidth: 1, borderRadius: radius.input, padding: 14 },
  feedbackHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  feedbackTitle:  { fontSize: 13, fontWeight: "900" },
  feedbackBody:   { ...type_.bodyMedium },

  chartLegend: { marginTop: 6, ...type_.labelSm, fontWeight: "800" },
  chartXRow:   { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4, marginTop: 8 },
  chartXLabel: { ...type_.meta, fontSize: 10 },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.35)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: colors.cardBg, borderTopLeftRadius: radius.cardXl, borderTopRightRadius: radius.cardXl, padding: 14 },
  sheetHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderAlt, marginBottom: 6 },
  sheetTitle:   { ...type_.cardTitle },
  sheetClose:   { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.pageBg, alignItems: "center", justifyContent: "center" },
  sheetItem:    { paddingVertical: space.md, paddingHorizontal: 10, borderRadius: radius.input, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetItemSelected:    { backgroundColor: "#EEF5FF" },
  sheetItemText:        { fontSize: 12, fontWeight: "900", color: colors.text },
  sheetItemTextSelected:{ color: colors.blue },
});
