import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet, apiPost } from "../../lib/api";

import { Picker } from "@react-native-picker/picker";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

type SessionStatus = "scheduled" | "active" | "completed" | "cancelled";

type SessionDoc = {
  session_id: string;
  trainee_id: string;
  instructor_id: string;
  vehicle_id: string;
  scheduled_at: string;
  duration_min: number;
  status: SessionStatus;
  notes?: string;
  created_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
};

type Learner = {
  user_id: string;
  role: "trainee";
  name?: string;
  email?: string;
};

type ReportResponse = {
  session: SessionDoc;
  analysis: {
    behavior: string;
    confidence: number;
    overall: number;
    badge: string;
    probs?: Record<string, number>;
  };
  ai_feedback: Array<{ priority?: string; title: string; message: string; icon?: string }>;
  instructor_notes?: string;
};

function safeParseMs(s?: string | null) {
  if (!s) return 0;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function initials(name?: string, id?: string) {
  const base = (name || id || "").trim();
  if (!base) return "—";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function labelLearner(l: Learner) {
  return l.name?.trim() || l.email?.trim() || l.user_id;
}

function setDatePart(base: Date, date: Date) {
  const d = new Date(base);
  d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return d;
}
function setTimePart(base: Date, time: Date) {
  const d = new Date(base);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

function pillFor(status: SessionStatus) {
  switch (status) {
    case "active":
      return { bg: "#16A34A", text: "#fff", label: "Active" };
    case "completed":
      return { bg: "#0B1220", text: "#fff", label: "Completed" };
    case "cancelled":
      return { bg: "#E11D48", text: "#fff", label: "Cancelled" };
    default:
      return { bg: "#EEF2F6", text: "#101828", label: "Scheduled" };
  }
}

function msToClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function friendlyError(e: any): string {
  const maybeDetail =
    e?.response?.data?.detail ||
    e?.data?.detail ||
    e?.response?.data?.message ||
    e?.message;

  const status = e?.response?.status || e?.status;
  if (status && maybeDetail) return `${status}: ${String(maybeDetail)}`;
  if (maybeDetail) return String(maybeDetail);
  return "Request failed.";
}

export default function SessionsScreen() {
  // ---------------------------
  // mounted guard (prevents Expo Router "inst of null" crash)
  // ---------------------------
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [learnersLoading, setLearnersLoading] = useState(true);

  const [learners, setLearners] = useState<Learner[]>([]);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  // create session fields
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [vehicleId, setVehicleId] = useState("VEH-0001");
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes] = useState("");

  // date/time picker
  const [scheduledDateTime, setScheduledDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setSeconds(0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // analysis panel
  const [selectedReport, setSelectedReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ending state
  const [endingId, setEndingId] = useState<string | null>(null);

  // debug / UX
  const [lastAction, setLastAction] = useState<string>("");

  // prevent overlapping fetches
  const loadSessionsInFlight = useRef(false);
  const loadLearnersInFlight = useRef(false);
  const openReportInFlight = useRef(false);

  const learnerMap = useMemo(() => {
    const m = new Map<string, Learner>();
    learners.forEach((l) => m.set(l.user_id, l));
    return m;
  }, [learners]);

  const activeSession = useMemo(() => sessions.find((s) => s.status === "active") || null, [sessions]);

  // timer tick (only if there is an active session)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [activeSession]);

  const activeElapsed = useMemo(() => {
    if (!activeSession) return 0;
    const startMs = safeParseMs(activeSession.started_at || null);
    if (!startMs) return 0;
    return Date.now() - startMs;
  }, [activeSession, tick]);

  const loadLearners = async () => {
    if (loadLearnersInFlight.current) return;
    loadLearnersInFlight.current = true;

    try {
      if (!isMountedRef.current) return;
      setLearnersLoading(true);
      setLastAction("Loading trainees…");

      const data = await apiGet("/instructor/learners");
      if (!isMountedRef.current) return;

      const arr: Learner[] = Array.isArray(data) ? data : [];
      setLearners(arr);

      // keep selected trainee stable
      if (!selectedLearnerId && arr.length > 0) setSelectedLearnerId(arr[0].user_id);

      setLastAction("Trainees loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setLearners([]);
      const msg = friendlyError(e);
      setLastAction(`Trainees failed ❌ ${msg}`);
      Alert.alert("Learners", msg);
    } finally {
      if (!isMountedRef.current) return;
      setLearnersLoading(false);
      loadLearnersInFlight.current = false;
    }
  };

  const loadSessions = async () => {
    if (loadSessionsInFlight.current) return;
    loadSessionsInFlight.current = true;

    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setLastAction("Loading sessions…");

      const data = await apiGet("/sessions");
      if (!isMountedRef.current) return;

      setSessions(Array.isArray(data) ? data : []);
      setLastAction("Sessions loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSessions([]);
      const msg = friendlyError(e);
      setLastAction(`Sessions failed ❌ ${msg}`);
      Alert.alert("Sessions", msg);
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
      loadSessionsInFlight.current = false;
    }
  };

  // Load on screen focus ONLY (removes double fetch + reduces crashes)
  useFocusEffect(
    useCallback(() => {
      loadLearners();
      loadSessions();
      return () => {};
    }, [])
  );

  const createSession = async () => {
    if (!selectedLearnerId) return Alert.alert("Pick trainee", "No linked trainee found.");
    const dur = Number(durationMin);
    if (!Number.isFinite(dur) || dur <= 0) return Alert.alert("Duration", "Enter a valid duration.");
    if (!vehicleId.trim()) return Alert.alert("Vehicle", "Enter vehicle ID.");

    try {
      setLastAction("Creating session…");
      await apiPost("/sessions", {
        trainee_id: selectedLearnerId,
        vehicle_id: vehicleId.trim(),
        scheduled_at: scheduledDateTime.toISOString(),
        duration_min: dur,
        notes: notes.trim() || "",
        road_type: "secondary",
      });

      if (!isMountedRef.current) return;
      setNotes("");
      setLastAction("Session created ✅");
      Alert.alert("✅ Scheduled", "Session created.");
      await loadSessions();
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const msg = friendlyError(e);
      setLastAction(`Create failed ❌ ${msg}`);
      Alert.alert("Create", msg);
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      setLastAction(`Starting ${sessionId}…`);
      await apiPost(`/sessions/${sessionId}/start`, {});
      if (!isMountedRef.current) return;
      setLastAction("Session started ✅");
      await loadSessions();
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const msg = friendlyError(e);
      setLastAction(`Start failed ❌ ${msg}`);
      Alert.alert("Start", msg);
    }
  };

  const openReport = async (sessionId: string) => {
    if (openReportInFlight.current) return;
    openReportInFlight.current = true;

    try {
      if (!isMountedRef.current) return;

      setLastAction(`Opening analysis for ${sessionId}…`);
      setReportLoading(true);

      // Force a visible update even if same session tapped twice
      setSelectedReport(null);

      const rep = await apiGet(`/sessions/${sessionId}/report`);
      if (!isMountedRef.current) return;

      if (!rep || typeof rep !== "object") {
        setLastAction("Analysis returned invalid data ❌");
        Alert.alert("Analysis", "Report returned empty/invalid data.");
        return;
      }

      setSelectedReport(rep as ReportResponse);
      setLastAction("Analysis loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSelectedReport(null);
      const msg = friendlyError(e);
      setLastAction(`Analysis failed ❌ ${msg}`);
      Alert.alert("Analysis", msg);
    } finally {
      if (!isMountedRef.current) return;
      setReportLoading(false);
      openReportInFlight.current = false;
    }
  };

  const endSession = async (sessionId: string) => {
    if (endingId) return;

    Alert.alert("End session?", "This will finalize the session and generate a report.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: async () => {
          try {
            if (!isMountedRef.current) return;

            setEndingId(sessionId);
            setLastAction(`Ending ${sessionId}…`);

            await apiPost(`/sessions/${sessionId}/end`, {});
            if (!isMountedRef.current) return;

            setLastAction("Session ended ✅ (loading report)");
            setTab("past"); // show completed session right away

            await loadSessions();
            await openReport(sessionId);
          } catch (e2: any) {
            if (!isMountedRef.current) return;
            const msg = friendlyError(e2);
            setLastAction(`End failed ❌ ${msg}`);
            Alert.alert("End", msg);
          } finally {
            if (!isMountedRef.current) return;
            setEndingId(null);
          }
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = sessions.filter((s) => {
      // upcoming = not completed, past = completed
      const keep = tab === "upcoming" ? s.status !== "completed" : s.status === "completed";
      if (!keep) return false;

      const learner = learnerMap.get(s.trainee_id);
      const name = learner ? labelLearner(learner) : s.trainee_id;

      const match =
        !q ||
        name.toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        (s.vehicle_id || "").toLowerCase().includes(q);

      return match;
    });

    list.sort((a, b) => {
      if (tab === "upcoming") return safeParseMs(a.scheduled_at) - safeParseMs(b.scheduled_at);
      return safeParseMs(b.ended_at || b.scheduled_at) - safeParseMs(a.ended_at || a.scheduled_at);
    });

    return list;
  }, [sessions, tab, query, learnerMap]);

  const onDatePicked = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (e.type === "dismissed" || !date) return;
    setScheduledDateTime((prev) => setDatePart(prev, date));
  };

  const onTimePicked = (e: DateTimePickerEvent, time?: Date) => {
    if (Platform.OS !== "ios") setShowTimePicker(false);
    if (e.type === "dismissed" || !time) return;
    setScheduledDateTime((prev) => setTimePart(prev, time));
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Sessions</Text>
      <Text style={styles.h2}>Schedule sessions, run them, then view the session analysis.</Text>

      {/* Live session */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Live Session</Text>
        {!activeSession ? (
          <Text style={styles.muted}>No active session</Text>
        ) : (
          <View style={{ marginTop: 10 }}>
            <View style={styles.liveRow}>
              <Text style={styles.liveLabel}>Active session:</Text>
              <Text style={styles.liveId} numberOfLines={1}>
                {activeSession.session_id}
              </Text>
            </View>

            <Text style={styles.timer}>⏱ {msToClock(activeElapsed)}</Text>
            <Text style={styles.mutedSmall}>Timer starts only after you press “Start”.</Text>

            <Pressable
              disabled={!!endingId}
              onPress={() => endSession(activeSession.session_id)}
              style={({ pressed }) => [
                styles.endBtn,
                !!endingId ? { opacity: 0.6 } : null,
                pressed ? { opacity: 0.9 } : null,
              ]}
            >
              <Text style={styles.endBtnText}>{endingId ? "Ending…" : "End Session"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Create Session */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Session</Text>
        <Text style={styles.muted}>Pick a linked trainee and schedule a session.</Text>

        {learnersLoading ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading trainees…</Text>
          </View>
        ) : learners.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.warnTitle}>No linked trainees</Text>
            <Text style={styles.muted}>Trainee must join using your join code first.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedLearnerId} onValueChange={(val) => setSelectedLearnerId(String(val))}>
                {learners.map((l) => (
                  <Picker.Item key={l.user_id} label={labelLearner(l)} value={l.user_id} />
                ))}
              </Picker>
            </View>

            <TextInput
              value={vehicleId}
              onChangeText={setVehicleId}
              placeholder="Vehicle ID (ex: VEH-0001)"
              placeholderTextColor="#98A2B3"
              style={styles.input}
            />

            <View style={styles.dtRow}>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [styles.dtBtn, pressed ? { opacity: 0.9 } : null]}
              >
                <Text style={styles.dtBtnText}>📅 {formatDate(scheduledDateTime.getTime())}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={({ pressed }) => [styles.dtBtn, pressed ? { opacity: 0.9 } : null]}
              >
                <Text style={styles.dtBtnText}>🕒 {formatTime(scheduledDateTime.getTime())}</Text>
              </Pressable>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={scheduledDateTime}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onDatePicked}
              />
            ) : null}

            {showTimePicker ? (
              <DateTimePicker
                value={scheduledDateTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onTimePicked}
              />
            ) : null}

            <TextInput
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="numeric"
              placeholder="Duration minutes (ex: 60)"
              placeholderTextColor="#98A2B3"
              style={styles.input}
            />

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="#98A2B3"
              style={styles.input}
            />

            <Pressable onPress={createSession} style={({ pressed }) => [styles.primaryBtn, pressed ? { opacity: 0.9 } : null]}>
              <Text style={styles.primaryBtnText}>Create Session</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <Pressable onPress={() => setTab("upcoming")} style={[styles.tabBtn, tab === "upcoming" ? styles.tabBtnOn : null]}>
          <Text style={[styles.tabText, tab === "upcoming" ? styles.tabTextOn : null]}>📅 Upcoming</Text>
        </Pressable>
        <Pressable onPress={() => setTab("past")} style={[styles.tabBtn, tab === "past" ? styles.tabBtnOn : null]}>
          <Text style={[styles.tabText, tab === "past" ? styles.tabTextOn : null]}>🕘 Past</Text>
        </Pressable>
      </View>

      {/* Search + Refresh */}
      <View style={styles.filterCard}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search trainee, session, vehicle…"
            placeholderTextColor="#98A2B3"
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={async () => {
            setSelectedReport(null);
            setLastAction("Refreshing…");
            await loadSessions();
          }}
          style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}
        >
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading sessions…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions</Text>
          <Text style={styles.emptySub}>Create one above, then refresh.</Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {filtered.map((s) => {
            const learner = learnerMap.get(s.trainee_id);
            const name = learner ? labelLearner(learner) : s.trainee_id;
            const p = pillFor(s.status);
            const schedMs = safeParseMs(s.scheduled_at);

            const isEndingThis = endingId === s.session_id;

            return (
              <View key={s.session_id} style={styles.sessionRow}>
                <View style={styles.sessionTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(learner?.name, s.trainee_id)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: p.bg }]}>
                        <Text style={[styles.pillText, { color: p.text }]}>{p.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.subLine} numberOfLines={1}>
                      ID: {s.session_id}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Meta icon="🚙" label="Vehicle" value={s.vehicle_id || "—"} />
                  <Meta icon="📅" label="Date" value={formatDate(schedMs)} />
                  <Meta icon="🕒" label="Time" value={formatTime(schedMs)} />
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={s.status !== "scheduled" || !!endingId}
                    onPress={() => startSession(s.session_id)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      s.status !== "scheduled" || !!endingId ? styles.actionBtnDisabled : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text style={styles.actionBtnText}>Start</Text>
                  </Pressable>

                  <Pressable
                    disabled={s.status !== "active" || !!endingId}
                    onPress={() => endSession(s.session_id)}
                    style={({ pressed }) => [
                      styles.actionBtnEnd,
                      s.status !== "active" || !!endingId ? styles.actionBtnDisabled : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text style={styles.actionBtnText}>{isEndingThis ? "Ending…" : "End"}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openReport(s.session_id)}
                    disabled={!!endingId}
                    style={({ pressed }) => [
                      styles.actionBtnOutline,
                      !!endingId ? styles.actionBtnDisabled : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text style={styles.actionBtnOutlineText}>
                      {reportLoading ? "Loading…" : "View analysis"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Analysis Panel */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session Analysis</Text>
        {lastAction ? <Text style={styles.mutedSmall}>{lastAction}</Text> : null}

        {reportLoading ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading analysis…</Text>
          </View>
        ) : !selectedReport ? (
          <Text style={styles.muted}>Open any session → “View analysis”</Text>
        ) : (
          <View style={{ marginTop: 10 }}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreBig}>{selectedReport.analysis?.overall ?? 0}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{selectedReport.analysis?.badge ?? "Improving"}</Text>
              </View>
            </View>

            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackTitle}>Key feedback</Text>
              <Text style={styles.feedbackText}>
                {selectedReport.analysis?.behavior ?? "Unknown"} • Confidence{" "}
                {Math.round(Number(selectedReport.analysis?.confidence ?? 0) * 100)}%
              </Text>

              {selectedReport.analysis?.probs ? (
                <Text style={styles.mutedSmall}>
                  Normal: {Math.round((selectedReport.analysis.probs?.Normal ?? 0) * 100)}% • Aggressive:{" "}
                  {Math.round((selectedReport.analysis.probs?.Aggressive ?? 0) * 100)}% • Drowsy:{" "}
                  {Math.round((selectedReport.analysis.probs?.Drowsy ?? 0) * 100)}%
                </Text>
              ) : null}
            </View>

            {selectedReport.ai_feedback?.length ? (
              <View style={{ marginTop: 10 }}>
                {selectedReport.ai_feedback.slice(0, 3).map((f, idx) => (
                  <View key={`${idx}-${f.title}`} style={styles.feedbackItem}>
                    <Text style={styles.feedbackItemTitle}>
                      {f.icon ? `${f.icon} ` : ""}{f.title}
                    </Text>
                    <Text style={styles.feedbackItemText}>{f.message}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 26 },

  h1: { fontSize: 22, fontWeight: "900", color: "#101828" },
  h2: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#667085", marginBottom: 14 },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  muted: { marginTop: 8, color: "#667085", fontWeight: "800", fontSize: 12 },
  mutedSmall: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 11 },
  warnTitle: { color: "#B91C1C", fontWeight: "900", marginTop: 6 },

  liveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveLabel: { color: "#667085", fontWeight: "900" },
  liveId: { flex: 1, color: "#101828", fontWeight: "900" },
  timer: { marginTop: 10, fontSize: 28, fontWeight: "900", color: "#101828" },

  endBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
  },
  endBtnText: { color: "#fff", fontWeight: "900" },

  pickerWrap: {
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: "700",
    color: "#101828",
  },

  dtRow: { flexDirection: "row", gap: 10 },
  dtBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dtBtnText: { fontWeight: "900", color: "#101828", fontSize: 12 },

  primaryBtn: {
    minHeight: 52,
    backgroundColor: "#0B1220",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },

  tabsWrap: { flexDirection: "row", backgroundColor: "#EEF2F6", borderRadius: 14, padding: 4, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabBtnOn: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#667085", fontWeight: "900", fontSize: 12 },
  tabTextOn: { color: "#101828" },

  filterCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  searchWrap: {
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
    gap: 10,
  },
  sessionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  studentName: { color: "#101828", fontWeight: "900", fontSize: 13, maxWidth: 240 },
  subLine: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 11 },

  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontWeight: "900", fontSize: 11 },

  metaRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaIcon: { fontSize: 14 },
  metaLabel: { color: "#667085", fontWeight: "800", fontSize: 11 },
  metaValue: { color: "#101828", fontWeight: "900", fontSize: 12 },

  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnEnd: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnOutline: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "900" },
  actionBtnOutlineText: { color: "#101828", fontWeight: "900" },
  actionBtnDisabled: { opacity: 0.35 },

  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreBig: { fontSize: 44, fontWeight: "900", color: "#101828" },
  badge: { backgroundColor: "#0B1220", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { color: "#fff", fontWeight: "900" },

  feedbackBox: { marginTop: 10, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, padding: 12 },
  feedbackTitle: { color: "#101828", fontWeight: "900" },
  feedbackText: { marginTop: 6, color: "#667085", fontWeight: "800" },

  feedbackItem: { marginTop: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, padding: 12 },
  feedbackItemTitle: { color: "#101828", fontWeight: "900" },
  feedbackItemText: { marginTop: 6, color: "#667085", fontWeight: "800" },

  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, fontWeight: "800", color: "#64748B" },

  empty: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 16, alignItems: "center" },
  emptyTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  emptySub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 12, textAlign: "center" },
});
