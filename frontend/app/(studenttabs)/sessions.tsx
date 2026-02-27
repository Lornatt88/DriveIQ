import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  useWindowDimensions, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet, apiPost } from "../../lib/api";
import { colors, type_, radius, space, card, page, tint } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderType = "upcoming" | "cancelled" | "report";
type Reminder     = { id: string; type: ReminderType; title: string; time: string };
type SessionDoc   = { session_id: string; trainee_id: string; instructor_id: string; vehicle_id: string; scheduled_at: string; duration_min: number; status: string; notes?: string; created_at?: string };
type SessionStatus= "scheduled" | "pending" | "cancelled" | "completed";
type SessionRowVm = { id: string; studentId: string; initials: string; studentName: string; instructorName: string; status: SessionStatus; vehicleId: string; dateLabel: string; timeLabel: string; scheduledAtMs: number };

const STATUS_PILL: Record<SessionStatus, { bg: string; text: string; label: string; border: string }> = {
  scheduled: { bg: colors.darkBtn,     text: "#FFFFFF",           label: "scheduled", border: colors.darkBtn     },
  pending:   { bg: "#F2F4F7",           text: colors.label,        label: "pending",   border: colors.border      },
  cancelled: { bg: colors.redDeep,     text: "#FFFFFF",           label: "cancelled", border: colors.redDeep     },
  completed: { bg: colors.green,       text: "#FFFFFF",           label: "completed", border: colors.green       },
};

const REMINDER_STYLE: Record<ReminderType, { icon: string; iconBg: string; iconBorder: string }> = {
  upcoming: { icon: "🕒", iconBg: tint.blue.bg,   iconBorder: tint.blue.border  },
  cancelled:{ icon: "⚠️", iconBg: tint.red.bg,    iconBorder: tint.red.border   },
  report:   { icon: "✅", iconBg: tint.green.bg,  iconBorder: tint.green.border },
};

function safeParseDateMs(input: string): number { const ms = Date.parse(input); return Number.isFinite(ms) ? ms : 0; }
function formatDateLabel(ms: number) { if (!ms) return "—"; return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }); }
function formatTimeLabel(ms: number) { if (!ms) return "—"; return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function initialsFromName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "")).toUpperCase() || "—";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const { width } = useWindowDimensions();
  const isWide    = width >= 900;

  const [tab, setTab]               = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"All Status" | SessionStatus>("All Status");
  const [viewMode, setViewMode]     = useState<"list" | "calendar">("list");
  const [loading, setLoading]       = useState(true);
  const [rawSessions, setRawSessions] = useState<SessionDoc[]>([]);
  const [learners, setLearners]     = useState<any[]>([]);
  const [creating, setCreating]     = useState(false);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [vehicleId, setVehicleId]   = useState("VEH-0001");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString());
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes]           = useState("");

  const reminders: Reminder[] = useMemo(() => [
    { id: "r1", type: "upcoming", title: "Upcoming sessions show here after you create them", time: "—" },
    { id: "r2", type: "report",   title: "Reports appear after sessions are completed", time: "—" },
  ], []);

  const loadLearners = async () => {
    try {
      const data = await apiGet("/instructor/learners");
      const arr  = Array.isArray(data) ? data : [];
      setLearners(arr);
      if (!selectedTraineeId && arr.length) setSelectedTraineeId(arr[0].user_id);
    } catch { setLearners([]); }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/sessions");
      setRawSessions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRawSessions([]);
      Alert.alert("Sessions Error", e?.message || "Failed to load sessions");
    } finally { setLoading(false); }
  };

  const createSession = async () => {
    if (!selectedTraineeId) { Alert.alert("No learner selected", "A trainee must join your instructor code first."); return; }
    try {
      setCreating(true);
      const res = await apiPost("/sessions", {
        trainee_id: selectedTraineeId, vehicle_id: vehicleId || "UNKNOWN",
        scheduled_at: scheduledAt, duration_min: Math.max(1, Number(durationMin) || 60), notes: notes || "",
      });
      Alert.alert("Session created ✅", `session_id: ${res?.session_id || "OK"}`);
      await loadSessions();
    } catch (e: any) { Alert.alert("Create failed", e?.message || "Failed to create session");
    } finally { setCreating(false); }
  };

  useEffect(() => { loadLearners(); loadSessions(); }, []);
  useFocusEffect(useCallback(() => { loadLearners(); loadSessions(); }, []));

  const traineeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) { if (l?.user_id) m[l.user_id] = l?.name || ""; }
    return m;
  }, [learners]);

  const sessionsVm: SessionRowVm[] = useMemo(() => rawSessions.map((s) => {
    const ms     = safeParseDateMs(s.scheduled_at);
    const status = (s.status || "scheduled") as SessionStatus;
    const realName = traineeNameById[s.trainee_id] || "";
    return {
      id: s.session_id, studentId: s.trainee_id,
      initials: realName ? initialsFromName(realName) : (s.trainee_id.slice(0, 2) || "NA").toUpperCase(),
      studentName: realName || `Trainee ${s.trainee_id.slice(0, 6).toUpperCase()}`,
      instructorName: "You", status, vehicleId: s.vehicle_id || "UNKNOWN",
      dateLabel: formatDateLabel(ms), timeLabel: formatTimeLabel(ms), scheduledAtMs: ms,
    };
  }), [rawSessions, traineeNameById]);

  const nowMs = Date.now();
  const list  = useMemo(() => {
    const base   = sessionsVm;
    const split  = base.filter((s) => !s.scheduledAtMs ? tab === "upcoming" : tab === "upcoming" ? s.scheduledAtMs >= nowMs : s.scheduledAtMs < nowMs);
    return [...split].sort((a, b) => tab === "upcoming" ? a.scheduledAtMs - b.scheduledAtMs : b.scheduledAtMs - a.scheduledAtMs);
  }, [sessionsVm, tab, nowMs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      const matchQuery  = !q || s.studentName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.vehicleId.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All Status" || s.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [list, query, statusFilter]);

  return (
    <ScrollView style={$.page} contentContainerStyle={$.content}>
      <Text style={$.h1}>Training Sessions</Text>
      <Text style={$.h2}>Manage upcoming bookings and review past session performance</Text>

      {/* Create Session */}
      <View style={$.createCard}>
        <Text style={$.createTitle}>Create Session</Text>
        <Text style={$.createSub}>Pick a linked trainee and create a real backend session.</Text>

        <View style={$.createRow}>
          <DropdownMock
            value={selectedTraineeId ? (traineeNameById[selectedTraineeId] || selectedTraineeId.slice(0, 10)) : "Select Trainee"}
            options={learners.length ? learners.map((l) => l.user_id) : ["No linked learners"]}
            onChange={(v) => { if (learners.some((l) => l.user_id === v)) setSelectedTraineeId(v); }}
            renderLabel={(id) => traineeNameById[id] || `Trainee ${id?.slice(0, 6)?.toUpperCase?.() || ""}`}
          />
        </View>

        {[
          { value: vehicleId, onChange: setVehicleId, placeholder: "Vehicle ID (e.g. VEH-2847)" },
          { value: scheduledAt, onChange: setScheduledAt, placeholder: "scheduled_at ISO e.g. 2026-02-12T10:00:00Z" },
          { value: durationMin, onChange: setDurationMin, placeholder: "Duration minutes (e.g. 60)", keyboardType: "numeric" as const },
          { value: notes, onChange: setNotes, placeholder: "Notes (optional)" },
        ].map((f, i) => (
          <View key={i} style={$.createRow}>
            <TextInput value={f.value} onChangeText={f.onChange} placeholder={f.placeholder}
              placeholderTextColor={colors.placeholder} keyboardType={f.keyboardType}
              style={$.createInput} />
          </View>
        ))}

        <Pressable onPress={createSession} disabled={creating}
          style={({ pressed }) => [$.createBtn, creating ? { opacity: 0.6 } : null, pressed ? { opacity: 0.9 } : null]}>
          <Text style={$.createBtnText}>{creating ? "Creating…" : "Create Session"}</Text>
        </Pressable>
      </View>

      {/* Reminders */}
      <View style={$.remindersCard}>
        <View style={$.remHeader}>
          <View style={$.remTitleRow}>
            <Text style={$.remBell}>🔔</Text>
            <Text style={$.remTitle}>Notifications & Reminders</Text>
          </View>
          <View style={$.remBadge}><Text style={$.remBadgeText}>{reminders.length}</Text></View>
        </View>
        <View style={{ marginTop: space.md }}>
          {reminders.map((r) => {
            const st = REMINDER_STYLE[r.type];
            return (
              <View key={r.id} style={$.remItem}>
                <View style={[$.remIcon, { backgroundColor: st.iconBg, borderColor: st.iconBorder }]}>
                  <Text style={{ fontSize: 14 }}>{st.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={$.remItemTitle}>{r.title}</Text>
                  <Text style={$.remItemTime}>{r.time}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tabs */}
      <View style={$.tabsWrap}>
        {(["upcoming", "past"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[$.tabBtn, tab === t && $.tabBtnOn]}>
            <Text style={[$.tabText, tab === t && $.tabTextOn]}>
              {t === "upcoming" ? "📅  Upcoming Bookings" : "🕘  Past Sessions"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filter Bar */}
      <View style={$.filterCard}>
        <View style={[$.filterRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          <View style={$.searchWrap}>
            <Text style={$.searchIcon}>🔎</Text>
            <TextInput value={query} onChangeText={setQuery}
              placeholder="Search by trainee ID, session ID, or vehicle..."
              placeholderTextColor={colors.placeholder} style={$.searchInput} />
          </View>
          <View style={[$.filterRight, isWide ? { justifyContent: "flex-end" } : null]}>
            <DropdownMock
              value={statusFilter} onChange={(v) => setStatusFilter(v as any)}
              options={["All Status", "scheduled", "completed", "cancelled", "pending"]}
            />
            <View style={$.viewToggle}>
              {(["list", "calendar"] as const).map((m) => (
                <Pressable key={m} onPress={() => setViewMode(m)} style={[$.viewBtn, viewMode === m && $.viewBtnOn]}>
                  <Text style={[$.viewBtnText, viewMode === m && $.viewBtnTextOn]}>
                    {m === "list" ? "List" : "📅"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={loadSessions} style={({ pressed }) => [$.refreshBtn, pressed ? { opacity: 0.9 } : null]}>
              <Text style={$.refreshBtnText}>↻ Refresh</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Session list */}
      {loading ? (
        <View style={$.center}>
          <ActivityIndicator size="large" color={colors.purpleDark} />
          <Text style={page.centerText}>Loading sessions…</Text>
        </View>
      ) : viewMode === "calendar" ? (
        <View style={$.calendarMock}>
          <Text style={$.calendarMockTitle}>Calendar view coming soon</Text>
          <Text style={$.calendarMockSub}>Your session data is loaded — calendar UI is in progress.</Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {filtered.length === 0 ? (
            <View style={$.empty}>
              <Text style={$.emptyTitle}>No sessions found</Text>
              <Text style={$.emptySub}>Create a session above then refresh.</Text>
            </View>
          ) : (
            filtered.map((row) => <SessionRow key={row.id} s={row} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionRow({ s: vm }: { s: SessionRowVm }) {
  const p = STATUS_PILL[vm.status] || STATUS_PILL.scheduled;
  return (
    <View style={$.sessionRow}>
      <View style={$.sessionLeft}>
        <View style={$.avatar}><Text style={$.avatarText}>{vm.initials}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={$.nameRow}>
            <Text style={$.studentName} numberOfLines={1}>{vm.studentName}</Text>
            <View style={[$.statusPill, { backgroundColor: p.bg, borderColor: p.border }]}>
              <Text style={[$.statusPillText, { color: p.text }]}>{p.label}</Text>
            </View>
          </View>
          <Text style={$.instructorLine}>🆔 Session: {vm.id}</Text>
        </View>
      </View>
      <View style={$.sessionRight}>
        <MetaItem icon="🚙" label="Vehicle" value={vm.vehicleId} bg={tint.blue.bg}   border={tint.blue.border}  />
        <MetaItem icon="📅" label="Date"    value={vm.dateLabel} bg={tint.green.bg}  border={tint.green.border} />
        <MetaItem icon="🕒" label="Time"    value={vm.timeLabel} bg={tint.purple.bg} border={tint.purple.border}/>
        <Pressable onPress={() => Alert.alert("Next", `Create a report screen: GET /sessions/${vm.id}/report`)}
          style={({ pressed }) => [$.moreBtn, pressed ? { opacity: 0.7 } : null]}>
          <Text style={$.moreText}>⋮</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaItem({ icon, label, value, bg, border }: { icon: string; label: string; value: string; bg: string; border: string }) {
  return (
    <View style={$.metaItem}>
      <View style={[$.metaIconCircle, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View>
        <Text style={$.metaLabel}>{label}</Text>
        <Text style={$.metaValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function DropdownMock({ value, options, onChange, renderLabel }: { value: string; options: string[]; onChange: (v: string) => void; renderLabel?: (v: string) => string }) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <Pressable onPress={() => onChange(options[(index + 1) % options.length])}
      style={({ pressed }) => [$.dropdown, pressed ? { opacity: 0.9 } : null]}>
      <Text style={$.dropdownText}>{renderLabel ? renderLabel(value) : value}</Text>
      <Text style={$.dropdownChevron}>▾</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const $ = StyleSheet.create({
  // Screen
  page:    { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: space.page, paddingBottom: 26 },
  h1: { ...type_.pageTitleLg },
  h2: { marginTop: 6, ...type_.pageSubtitleBold, marginBottom: 14 },

  // Create card
  createCard:    { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14, marginBottom: space.md },
  createTitle:   { ...type_.sectionTitle },
  createSub:     { marginTop: 6, ...type_.labelSm, fontWeight: "800" },
  createRow:     { marginTop: 10 },
  createInput:   { minHeight: 46, paddingHorizontal: space.md, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, color: colors.textAlt, fontWeight: "800", fontSize: 12 },
  createBtn:     { marginTop: space.md, minHeight: 46, borderRadius: radius.input, backgroundColor: colors.darkBtn, alignItems: "center", justifyContent: "center" },
  createBtnText: { ...type_.btnSm },

  // Reminders
  remindersCard: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  remHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remTitleRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  remBell:       { fontSize: 14 },
  remTitle:      { ...type_.sectionTitle },
  remBadge:      { backgroundColor: colors.redDeep, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  remBadgeText:  { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  remItem:       { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.card, padding: space.md, marginBottom: 10 },
  remIcon:       { width: 36, height: 36, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  remItemTitle:  { ...type_.body, fontWeight: "800" },
  remItemTime:   { marginTop: 6, ...type_.meta },

  // Tabs
  tabsWrap:  { marginTop: 14, flexDirection: "row", backgroundColor: "#EEF2F6", borderRadius: radius.card, padding: 4 },
  tabBtn:    { flex: 1, paddingVertical: 10, borderRadius: radius.input, alignItems: "center" },
  tabBtnOn:  { backgroundColor: colors.cardBg },
  tabText:   { color: colors.subtextAlt, fontWeight: "900", fontSize: 12 },
  tabTextOn: { color: colors.textAlt },

  // Filter bar
  filterCard:     { marginTop: space.md, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: space.md },
  filterRow:      { gap: 10 },
  searchWrap:     { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: space.md },
  searchIcon:     { marginRight: 8, fontSize: 14 },
  searchInput:    { flex: 1, color: colors.textAlt, fontSize: 13, fontWeight: "700" },
  filterRight:    { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  dropdown:       { minHeight: 46, minWidth: 160, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input },
  dropdownText:   { color: colors.textAlt, fontWeight: "800", fontSize: 12, flex: 1 },
  dropdownChevron:{ color: colors.subtextAlt, fontWeight: "900" },
  viewToggle:     { flexDirection: "row", backgroundColor: "#EEF2F6", borderRadius: radius.input, padding: 3 },
  viewBtn:        { paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md },
  viewBtnOn:      { backgroundColor: colors.darkBtn },
  viewBtnText:    { color: colors.subtextAlt, fontWeight: "900", fontSize: 12 },
  viewBtnTextOn:  { color: "#FFFFFF" },
  refreshBtn:     { minHeight: 46, paddingHorizontal: 14, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, alignItems: "center", justifyContent: "center" },
  refreshBtnText: { ...type_.body, fontWeight: "900", color: colors.textAlt },

  // States
  center:           { alignItems: "center", justifyContent: "center", padding: space.lg },
  calendarMock:     { marginTop: space.md, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: space.lg, alignItems: "center" },
  calendarMockTitle:{ ...type_.sectionTitle },
  calendarMockSub:  { marginTop: 6, ...type_.labelSm, fontWeight: "800" },
  empty:            { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: space.lg, alignItems: "center" },
  emptyTitle:       { ...type_.sectionTitle },
  emptySub:         { marginTop: 6, ...type_.labelSm, fontWeight: "800", textAlign: "center" },

  // Session row
  sessionRow:     { marginTop: 10, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  sessionLeft:    { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  avatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.indigoBg, alignItems: "center", justifyContent: "center" },
  avatarText:     { color: colors.indigo, fontWeight: "900", fontSize: 12 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  studentName:    { ...type_.sectionTitle, maxWidth: 220 },
  instructorLine: { marginTop: 6, ...type_.meta },
  statusPill:     { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontWeight: "900", fontSize: 11 },
  sessionRight:   { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap", justifyContent: "flex-end" },
  metaItem:       { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 220 },
  metaIconCircle: { width: 36, height: 36, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  metaLabel:      { ...type_.meta },
  metaValue:      { ...type_.metaValue },
  moreBtn:        { width: 34, height: 34, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardBg },
  moreText:       { color: colors.textAlt, fontWeight: "900", fontSize: 16 },
});
