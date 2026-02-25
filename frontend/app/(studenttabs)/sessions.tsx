import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet, apiPost } from "../../lib/api"; // ✅ add apiPost

type ReminderType = "upcoming" | "cancelled" | "report";

type Reminder = {
  id: string;
  type: ReminderType;
  title: string;
  time: string;
};

// Backend session shape (Mongo document)
type SessionDoc = {
  session_id: string;
  trainee_id: string;
  instructor_id: string;
  vehicle_id: string;
  scheduled_at: string; // stored as string
  duration_min: number;
  status: string; // "scheduled" (currently), could expand later
  notes?: string;
  created_at?: string;
};

type SessionStatus = "scheduled" | "pending" | "cancelled" | "completed";

type SessionRowVm = {
  id: string;
  studentId: string;
  initials: string;
  studentName: string;
  instructorName: string;
  status: SessionStatus;
  vehicleId: string;
  dateLabel: string;
  timeLabel: string;
  scheduledAtMs: number;
};

const STATUS_PILL: Record<
  SessionStatus,
  { bg: string; text: string; label: string; border: string }
> = {
  scheduled: { bg: "#0B1220", text: "#FFFFFF", label: "scheduled", border: "#0B1220" },
  pending: { bg: "#F2F4F7", text: "#344054", label: "pending", border: "#EAECF0" },
  cancelled: { bg: "#E11D48", text: "#FFFFFF", label: "cancelled", border: "#E11D48" },
  completed: { bg: "#16A34A", text: "#FFFFFF", label: "completed", border: "#16A34A" },
};

const REMINDER_STYLE: Record<
  ReminderType,
  { icon: string; iconBg: string; iconBorder: string; iconColor: string }
> = {
  upcoming: { icon: "🕒", iconBg: "#EFF6FF", iconBorder: "#DBEAFE", iconColor: "#2563EB" },
  cancelled: { icon: "⚠️", iconBg: "#FEF2F2", iconBorder: "#FECACA", iconColor: "#E11D48" },
  report: { icon: "✅", iconBg: "#ECFDF3", iconBorder: "#BBF7D0", iconColor: "#16A34A" },
};

function safeParseDateMs(input: string): number {
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDateLabel(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function formatTimeLabel(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function initialsFromName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  const out = (a + b).toUpperCase();
  return out || "—";
}

export default function SessionsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState<"All Status" | SessionStatus>("All Status");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const [loading, setLoading] = useState(true);
  const [rawSessions, setRawSessions] = useState<SessionDoc[]>([]);

  // ✅ learners for REAL NAMES + creating sessions
  const [learners, setLearners] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // quick create fields (minimal)
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState("VEH-0001");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString());
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes] = useState("");

  // ====== Optional reminders (still mock) ======
  const reminders: Reminder[] = useMemo(
    () => [
      { id: "r1", type: "upcoming", title: "Upcoming sessions show here after you create them", time: "—" },
      { id: "r2", type: "report", title: "Reports appear in Session Report endpoint", time: "—" },
    ],
    []
  );

  const loadLearners = async () => {
    try {
      const data = await apiGet("/instructor/learners");
      const arr = Array.isArray(data) ? data : [];
      setLearners(arr);
      if (!selectedTraineeId && arr.length) setSelectedTraineeId(arr[0].user_id);
    } catch (e: any) {
      setLearners([]);
      // don’t spam alert if user isn’t instructor, but show once:
      // Alert.alert("Learners Error", e?.message || "Failed to load learners");
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await apiGet("/sessions");
      setRawSessions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setRawSessions([]);
      Alert.alert("Sessions Error", e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!selectedTraineeId) {
      Alert.alert("No learner selected", "A trainee must join your instructor code first.");
      return;
    }

    try {
      setCreating(true);
      const res = await apiPost("/sessions", {
        trainee_id: selectedTraineeId,
        vehicle_id: vehicleId || "UNKNOWN",
        scheduled_at: scheduledAt, // ISO string
        duration_min: Math.max(1, Number(durationMin) || 60),
        notes: notes || "",
      });

      Alert.alert("Session created ✅", `session_id: ${res?.session_id || "OK"}`);
      await loadSessions();
    } catch (e: any) {
      Alert.alert("Create failed", e?.message || "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadLearners();
    loadSessions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLearners();
      loadSessions();
    }, [])
  );

  // map trainee_id -> name
  const traineeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) {
      if (l?.user_id) m[l.user_id] = l?.name || "";
    }
    return m;
  }, [learners]);

  const sessionsVm: SessionRowVm[] = useMemo(() => {
    return rawSessions.map((s) => {
      const ms = safeParseDateMs(s.scheduled_at);
      const status = (s.status || "scheduled") as SessionStatus;

      const realName = traineeNameById[s.trainee_id] || "";
      const displayName = realName ? realName : `Trainee ${s.trainee_id.slice(0, 6).toUpperCase()}`;

      return {
        id: s.session_id,
        studentId: s.trainee_id,
        initials: realName ? initialsFromName(realName) : (s.trainee_id.slice(0, 2) || "NA").toUpperCase(),
        studentName: displayName,
        instructorName: "You",
        status,
        vehicleId: s.vehicle_id || "UNKNOWN",
        dateLabel: formatDateLabel(ms),
        timeLabel: formatTimeLabel(ms),
        scheduledAtMs: ms,
      };
    });
  }, [rawSessions, traineeNameById]);

  const nowMs = Date.now();

  const list = useMemo(() => {
    const base = sessionsVm;

    const split = base.filter((s) => {
      if (!s.scheduledAtMs) return tab === "upcoming";
      return tab === "upcoming" ? s.scheduledAtMs >= nowMs : s.scheduledAtMs < nowMs;
    });

    const sorted = [...split].sort((a, b) =>
      tab === "upcoming" ? a.scheduledAtMs - b.scheduledAtMs : b.scheduledAtMs - a.scheduledAtMs
    );

    return sorted;
  }, [sessionsVm, tab, nowMs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      const matchQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.vehicleId.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);

      const matchStatus = statusFilter === "All Status" || s.status === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [list, query, statusFilter]);

  const reminderBadge = reminders.length;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.h1}>Training Sessions</Text>
      <Text style={styles.h2}>Manage upcoming bookings and review past session performance</Text>

      {/* ✅ Quick Create Session (minimal) */}
      <View style={styles.createCard}>
        <Text style={styles.createTitle}>Create Session</Text>
        <Text style={styles.createSub}>Pick a linked trainee and create a real backend session.</Text>

        <View style={styles.createRow}>
          <DropdownMock
            value={
              selectedTraineeId
                ? (traineeNameById[selectedTraineeId] || selectedTraineeId.slice(0, 10))
                : "Select Trainee"
            }
            options={
              learners.length
                ? learners.map((l) => l.user_id)
                : ["No linked learners"]
            }
            onChange={(v) => {
              // DropdownMock cycles; if we used ids, set directly:
              if (learners.some((l) => l.user_id === v)) setSelectedTraineeId(v);
            }}
            renderLabel={(id) => traineeNameById[id] || `Trainee ${id?.slice(0, 6)?.toUpperCase?.() || ""}`}
          />
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={vehicleId}
            onChangeText={setVehicleId}
            placeholder="Vehicle ID (e.g. VEH-2847)"
            placeholderTextColor="#98A2B3"
            style={styles.createInput}
          />
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholder="scheduled_at (ISO) e.g. 2026-02-12T10:00:00Z"
            placeholderTextColor="#98A2B3"
            style={styles.createInput}
          />
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={durationMin}
            onChangeText={setDurationMin}
            placeholder="Duration minutes (e.g. 60)"
            placeholderTextColor="#98A2B3"
            keyboardType="numeric"
            style={styles.createInput}
          />
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor="#98A2B3"
            style={styles.createInput}
          />
        </View>

        <Pressable
          onPress={createSession}
          disabled={creating}
          style={({ pressed }) => [
            styles.createBtn,
            creating ? { opacity: 0.6 } : null,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <Text style={styles.createBtnText}>{creating ? "Creating…" : "Create Session"}</Text>
        </Pressable>
      </View>

      {/* Notifications & Reminders */}
      <View style={styles.remindersCard}>
        <View style={styles.remHeader}>
          <View style={styles.remTitleRow}>
            <Text style={styles.remBell}>🔔</Text>
            <Text style={styles.remTitle}>Notifications & Reminders</Text>
          </View>

          <View style={styles.remBadge}>
            <Text style={styles.remBadgeText}>{reminderBadge}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          {reminders.map((r) => {
            const st = REMINDER_STYLE[r.type];
            return (
              <View key={r.id} style={styles.remItem}>
                <View style={[styles.remIcon, { backgroundColor: st.iconBg, borderColor: st.iconBorder }]}>
                  <Text style={{ fontSize: 14 }}>{st.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.remItemTitle}>{r.title}</Text>
                  <Text style={styles.remItemTime}>{r.time}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <Pressable
          onPress={() => setTab("upcoming")}
          style={[styles.tabBtn, tab === "upcoming" ? styles.tabBtnOn : null]}
        >
          <Text style={[styles.tabText, tab === "upcoming" ? styles.tabTextOn : null]}>
            📅  Upcoming Bookings
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("past")}
          style={[styles.tabBtn, tab === "past" ? styles.tabBtnOn : null]}
        >
          <Text style={[styles.tabText, tab === "past" ? styles.tabTextOn : null]}>
            🕘  Past Sessions
          </Text>
        </Pressable>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterCard}>
        <View style={[styles.filterRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔎</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by trainee ID, session ID, or vehicle..."
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
            />
          </View>

          <View style={[styles.filterRight, isWide ? { justifyContent: "flex-end" } : null]}>
            <DropdownMock
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as any)}
              options={["All Status", "scheduled", "completed", "cancelled", "pending"]}
            />

            <View style={styles.viewToggle}>
              <Pressable
                onPress={() => setViewMode("list")}
                style={[styles.viewBtn, viewMode === "list" ? styles.viewBtnOn : null]}
              >
                <Text style={[styles.viewBtnText, viewMode === "list" ? styles.viewBtnTextOn : null]}>
                  List
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setViewMode("calendar")}
                style={[styles.viewBtn, viewMode === "calendar" ? styles.viewBtnOn : null]}
              >
                <Text style={[styles.viewBtnText, viewMode === "calendar" ? styles.viewBtnTextOn : null]}>
                  📅
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={loadSessions}
              style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}
            >
              <Text style={styles.refreshBtnText}>↻ Refresh</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Loading */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading sessions…</Text>
        </View>
      ) : viewMode === "calendar" ? (
        <View style={styles.calendarMock}>
          <Text style={styles.calendarMockTitle}>Calendar view (mock)</Text>
          <Text style={styles.calendarMockSub}>You already have real data — calendar UI later.</Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sessions found</Text>
              <Text style={styles.emptySub}>Create a session above then refresh.</Text>
            </View>
          ) : (
            filtered.map((s) => <SessionRow key={s.id} s={s} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

function SessionRow({ s }: { s: SessionRowVm }) {
  const pill = STATUS_PILL[s.status] || STATUS_PILL.scheduled;

  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{s.initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.studentName} numberOfLines={1}>
              {s.studentName}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
              <Text style={[styles.statusPillText, { color: pill.text }]}>{pill.label}</Text>
            </View>
          </View>

          <Text style={styles.instructorLine}>🆔 Session: {s.id}</Text>
        </View>
      </View>

      <View style={styles.sessionRight}>
        <MetaItem icon="🚙" label="Vehicle" value={s.vehicleId} bg="#EFF6FF" border="#DBEAFE" />
        <MetaItem icon="📅" label="Date" value={s.dateLabel} bg="#ECFDF3" border="#BBF7D0" />
        <MetaItem icon="🕒" label="Time" value={s.timeLabel} bg="#F3E8FF" border="#E9D5FF" />

        <Pressable
          onPress={() => Alert.alert("Next", `Create a report screen: GET /sessions/${s.id}/report`)}
          style={({ pressed }) => [styles.moreBtn, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.moreText}>⋮</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  label,
  value,
  bg,
  border,
}: {
  icon: string;
  label: string;
  value: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={styles.metaItem}>
      <View style={[styles.metaIconCircle, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DropdownMock({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderLabel?: (v: string) => string;
}) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <Pressable
      onPress={() => {
        const next = options[(index + 1) % options.length];
        onChange(next);
      }}
      style={({ pressed }) => [styles.dropdown, pressed ? { opacity: 0.9 } : null]}
    >
      <Text style={styles.dropdownText}>
        {renderLabel ? renderLabel(value) : value}
      </Text>
      <Text style={styles.dropdownChevron}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 26 },

  h1: { fontSize: 20, fontWeight: "900", color: "#101828" },
  h2: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#667085", marginBottom: 14 },

  // ✅ create card
  createCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  createTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  createSub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 12 },
  createRow: { marginTop: 10 },
  createInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    color: "#101828",
    fontWeight: "800",
    fontSize: 12,
  },
  createBtn: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  remindersCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },
  remHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  remBell: { fontSize: 14 },
  remTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  remBadge: { backgroundColor: "#E11D48", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  remBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  remItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F2F4F7",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  remIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  remItemTitle: { color: "#101828", fontWeight: "800", fontSize: 12 },
  remItemTime: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 11 },

  tabsWrap: {
    marginTop: 14,
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabBtnOn: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#667085", fontWeight: "900", fontSize: 12 },
  tabTextOn: { color: "#101828" },

  filterCard: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 12,
  },
  filterRow: { gap: 10 },

  searchWrap: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: "#101828", fontSize: 13, fontWeight: "700" },

  filterRight: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },

  dropdown: {
    minHeight: 46,
    minWidth: 160,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
  },
  dropdownText: { color: "#101828", fontWeight: "800", fontSize: 12, flex: 1 },
  dropdownChevron: { color: "#667085", fontWeight: "900" },

  viewToggle: { flexDirection: "row", backgroundColor: "#EEF2F6", borderRadius: 12, padding: 3 },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  viewBtnOn: { backgroundColor: "#0B1220" },
  viewBtnText: { color: "#667085", fontWeight: "900", fontSize: 12 },
  viewBtnTextOn: { color: "#FFFFFF" },

  refreshBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  sessionRow: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 12 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  studentName: { color: "#101828", fontWeight: "900", fontSize: 13, maxWidth: 220 },
  instructorLine: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 11 },

  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: { fontWeight: "900", fontSize: 11 },

  sessionRight: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" },

  metaItem: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 220 },
  metaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metaLabel: { color: "#667085", fontWeight: "800", fontSize: 11 },
  metaValue: { color: "#101828", fontWeight: "900", fontSize: 12, marginTop: 2 },

  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  moreText: { color: "#101828", fontWeight: "900", fontSize: 16 },

  calendarMock: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  calendarMockTitle: { color: "#101828", fontWeight: "900" },
  calendarMockSub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 12 },

  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, fontWeight: "800", color: "#64748B" },

  empty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  emptySub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 12, textAlign: "center" },
});
