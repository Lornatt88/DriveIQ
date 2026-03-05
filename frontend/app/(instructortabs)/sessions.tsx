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
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet, apiPost, apiPatch } from "../../lib/api";

import { Picker } from "@react-native-picker/picker";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

type SessionStatus = "scheduled" | "active" | "completed" | "cancelled" | "confirmed";

type SessionDoc = {
  session_id: string | null;
  booking_id?: string;
  trainee_id: string;
  trainee_name?: string;
  instructor_id: string;
  vehicle_id: string | null;
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
    case "confirmed":
      return { bg: "#2563EB", text: "#fff", label: "Booked" };
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
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      loadSessionsInFlight.current = false;
      loadLearnersInFlight.current = false;
      openReportInFlight.current = false;
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ending / generating state
  const [endingId, setEndingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // post-end modal (notes + generate report)
  const [postEndModal, setPostEndModal] = useState<{ sessionId: string; traineeName: string } | null>(null);
  const [instructorNotes, setInstructorNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // edit notes in analysis panel
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesDraft, setEditNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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

  // Show a road type picker before starting
  const promptRoadType = (id: string) => {
    Alert.alert(
      "Select Road Type",
      "What type of road is this session on?",
      [
        { text: "Secondary", onPress: () => startSession(id, "Secondary") },
        { text: "Motorway", onPress: () => startSession(id, "Motorway") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const startSession = async (id: string, roadType: string) => {
    try {
      setLastAction(`Starting ${id}…`);
      await apiPost(`/sessions/${id}/start`, { road_type: roadType });
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
      setSelectedReport(null);
      setSelectedSessionId(sessionId);
      setEditingNotes(false);

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

    // Capture trainee name before async ops
    const s = sessions.find((x) => x.session_id === sessionId);
    const learner = learnerMap.get(s?.trainee_id || "");
    const traineeName = learner ? labelLearner(learner) : (s?.trainee_name || "Unknown");

    Alert.alert("End session?", "This will finalize the session.", [
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

            setLastAction("Session ended ✅");
            setTab("past");

            await loadSessions();

            // Show post-end modal for notes + report generation
            setInstructorNotes("");
            setPostEndModal({ sessionId, traineeName });
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

  // Open generate modal from the sessions list (for already-completed sessions)
  const openGenerateModal = (sessionId: string) => {
    const s = sessions.find((x) => x.session_id === sessionId);
    const learner = learnerMap.get(s?.trainee_id || "");
    const traineeName = learner ? labelLearner(learner) : (s?.trainee_name || "Unknown");
    // Pre-fill with existing notes if report is already open for this session
    const existing = selectedSessionId === sessionId ? (selectedReport?.instructor_notes || "") : "";
    setInstructorNotes(existing);
    setPostEndModal({ sessionId, traineeName });
  };

  // Called from the modal's Generate button
  const generateReport = async () => {
    if (!postEndModal) return;
    const { sessionId } = postEndModal;

    try {
      setGenerating(true);
      setGeneratingId(sessionId);
      setLastAction(`Generating report for ${sessionId}…`);

      await apiPost(`/sessions/${sessionId}/generate-feedback`, { instructor_notes: instructorNotes });
      if (!isMountedRef.current) return;

      setLastAction("Report generated ✅");
      setPostEndModal(null);
      setInstructorNotes("");

      await loadSessions();
      await openReport(sessionId);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const msg = friendlyError(e);
      setLastAction(`Generate failed ❌ ${msg}`);
      Alert.alert("Generate Report", msg);
    } finally {
      if (!isMountedRef.current) return;
      setGenerating(false);
      setGeneratingId(null);
    }
  };

  // Save notes without re-running ML
  const saveNotes = async () => {
    if (!selectedSessionId) return;
    try {
      setSavingNotes(true);
      await apiPatch(`/sessions/${selectedSessionId}/notes`, { instructor_notes: editNotesDraft });
      if (!isMountedRef.current) return;
      setSelectedReport((prev) => prev ? { ...prev, instructor_notes: editNotesDraft } : prev);
      setEditingNotes(false);
    } catch (e: any) {
      Alert.alert("Save Notes", friendlyError(e));
    } finally {
      if (!isMountedRef.current) return;
      setSavingNotes(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = sessions.filter((s) => {
      const keep = tab === "upcoming" ? s.status !== "completed" : s.status === "completed";
      if (!keep) return false;

      const learner = learnerMap.get(s.trainee_id);
      const name = learner ? labelLearner(learner) : s.trainee_id;

      const match =
        !q ||
        name.toLowerCase().includes(q) ||
        (s.session_id || "").toLowerCase().includes(q) ||
        (s.booking_id || "").toLowerCase().includes(q) ||
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
                {activeSession.session_id || activeSession.booking_id}
              </Text>
            </View>

            <Text style={styles.timer}>⏱ {msToClock(activeElapsed)}</Text>
            <Text style={styles.mutedSmall}>Timer starts only after you press "Start".</Text>

            <Pressable
              disabled={!!endingId || !activeSession.session_id}
              onPress={() => activeSession.session_id && endSession(activeSession.session_id)}
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
            <Text style={styles.warnTitle}>No linked trainees yet</Text>
            <Text style={styles.muted}>Trainees are linked when they book a session with you. Once booked, they will appear here.</Text>
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
          <Text style={styles.emptyTitle}>No {tab === "upcoming" ? "upcoming" : "past"} sessions</Text>
          <Text style={styles.emptySub}>
            {tab === "upcoming"
              ? "Bookings from students will appear here. Switch to Past to see completed sessions."
              : "Completed sessions will appear here once students finish their sessions."}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {filtered.map((s) => {
            const learner = learnerMap.get(s.trainee_id);
            const name = learner ? labelLearner(learner) : (s.trainee_name || s.trainee_id);
            const p = pillFor(s.status);
            const schedMs = safeParseMs(s.scheduled_at);
            const rowKey = s.session_id || s.booking_id || s.trainee_id;

            const isEndingThis = endingId === s.session_id;
            const isGeneratingThis = generatingId === s.session_id;
            const isConfirmed = s.status === "confirmed";
            const canStart = (s.status === "scheduled" || s.status === "confirmed") && !endingId && !generatingId;

            return (
              <View key={rowKey} style={styles.sessionRow}>
                <View style={styles.sessionTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(learner?.name || s.trainee_name, s.trainee_id)}</Text>
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
                      {s.session_id ? `ID: ${s.session_id}` : `Booking: ${s.booking_id}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  {isConfirmed ? (
                    <Meta icon="📋" label="Booking" value={s.booking_id || "—"} />
                  ) : (
                    <Meta icon="🚙" label="Vehicle" value={s.vehicle_id || "—"} />
                  )}
                  <Meta icon="📅" label="Date" value={formatDate(schedMs)} />
                  <Meta icon="🕒" label="Time" value={formatTime(schedMs)} />
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={!canStart}
                    onPress={() => {
                      if (isConfirmed && s.booking_id) promptRoadType(s.booking_id);
                      else if (s.session_id) promptRoadType(s.session_id);
                    }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      !canStart ? styles.actionBtnDisabled : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text style={styles.actionBtnText}>Start</Text>
                  </Pressable>

                  {!isConfirmed && (
                    <Pressable
                      disabled={s.status !== "active" || !!endingId}
                      onPress={() => s.session_id && endSession(s.session_id)}
                      style={({ pressed }) => [
                        styles.actionBtnEnd,
                        s.status !== "active" || !!endingId ? styles.actionBtnDisabled : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text style={styles.actionBtnText}>{isEndingThis ? "Ending…" : "End"}</Text>
                    </Pressable>
                  )}

                  {!isConfirmed && s.session_id && (
                    <Pressable
                      onPress={() => openReport(s.session_id!)}
                      disabled={!!endingId || !!generatingId}
                      style={({ pressed }) => [
                        styles.actionBtnOutline,
                        (!!endingId || !!generatingId) ? styles.actionBtnDisabled : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text style={styles.actionBtnOutlineText}>
                        {reportLoading ? "Loading…" : "View analysis"}
                      </Text>
                    </Pressable>
                  )}

                  {s.status === "completed" && s.session_id && (
                    <Pressable
                      disabled={!!generatingId || !!endingId}
                      onPress={() => openGenerateModal(s.session_id!)}
                      style={({ pressed }) => [
                        styles.actionBtnGenerate,
                        (!!generatingId || !!endingId) ? styles.actionBtnDisabled : null,
                        isGeneratingThis ? { opacity: 0.6 } : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text style={styles.actionBtnText}>
                        {isGeneratingThis ? "Generating…" : "Generate Report"}
                      </Text>
                    </Pressable>
                  )}
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
          <Text style={styles.muted}>Open any session → "View analysis"</Text>
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

            {/* Instructor Notes */}
            <View style={styles.notesSection}>
              <View style={styles.notesSectionHeader}>
                <Text style={styles.notesSectionTitle}>📝 Instructor Notes</Text>
                {!editingNotes && (
                  <Pressable
                    onPress={() => {
                      setEditNotesDraft(selectedReport.instructor_notes || "");
                      setEditingNotes(true);
                    }}
                  >
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                )}
              </View>

              {editingNotes ? (
                <>
                  <TextInput
                    value={editNotesDraft}
                    onChangeText={setEditNotesDraft}
                    multiline
                    numberOfLines={4}
                    placeholder="Add your notes and suggestions…"
                    placeholderTextColor="#98A2B3"
                    style={styles.notesInput}
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => setEditingNotes(false)}
                      style={styles.cancelNoteBtn}
                    >
                      <Text style={styles.cancelNoteBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveNotes}
                      disabled={savingNotes}
                      style={[styles.saveNoteBtn, savingNotes && { opacity: 0.6 }]}
                    >
                      <Text style={styles.saveNoteBtnText}>{savingNotes ? "Saving…" : "Save"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.notesText}>
                  {selectedReport.instructor_notes?.trim() || "No notes added yet."}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Post-end / Generate Report Modal */}
      <Modal
        visible={!!postEndModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!generating) setPostEndModal(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { if (!generating) setPostEndModal(null); }}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Session Ended</Text>
            <Text style={styles.modalSub}>with {postEndModal?.traineeName}</Text>

            <Text style={styles.modalLabel}>Instructor Notes</Text>
            <Text style={styles.modalHint}>Optional — your feedback will appear on the student's report.</Text>
            <TextInput
              value={instructorNotes}
              onChangeText={setInstructorNotes}
              multiline
              numberOfLines={5}
              placeholder="Add your feedback and suggestions for the student…"
              placeholderTextColor="#98A2B3"
              style={styles.modalTextInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                disabled={generating}
                onPress={() => { if (!generating) setPostEndModal(null); }}
                style={[styles.modalSkipBtn, generating && { opacity: 0.4 }]}
              >
                <Text style={styles.modalSkipText}>Skip for now</Text>
              </Pressable>
              <Pressable
                disabled={generating}
                onPress={generateReport}
                style={[styles.modalGenerateBtn, generating && { opacity: 0.6 }]}
              >
                {generating ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modalGenerateBtnText}>Generating…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalGenerateBtnText}>Generate Report →</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  actionBtnGenerate: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
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

  // Instructor notes in analysis panel
  notesSection: { marginTop: 14, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, padding: 12 },
  notesSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  notesSectionTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  editLink: { color: "#7C3AED", fontWeight: "900", fontSize: 12 },
  notesText: { color: "#667085", fontWeight: "700", fontSize: 13, lineHeight: 20 },
  notesInput: {
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#101828",
    fontSize: 13,
    textAlignVertical: "top",
  },
  cancelNoteBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAECF0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelNoteBtnText: { color: "#667085", fontWeight: "900", fontSize: 12 },
  saveNoteBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  saveNoteBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, fontWeight: "800", color: "#64748B" },

  empty: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 16, alignItems: "center" },
  emptyTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  emptySub: { marginTop: 6, color: "#667085", fontWeight: "800", fontSize: 12, textAlign: "center" },

  // Post-end modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    gap: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#101828" },
  modalSub: { fontSize: 13, fontWeight: "700", color: "#667085", marginBottom: 10 },
  modalLabel: { fontSize: 13, fontWeight: "900", color: "#101828", marginTop: 8 },
  modalHint: { fontSize: 11, fontWeight: "700", color: "#98A2B3", marginBottom: 6 },
  modalTextInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "700",
    color: "#101828",
    fontSize: 13,
    textAlignVertical: "top",
    marginTop: 4,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalSkipBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAECF0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  modalSkipText: { color: "#667085", fontWeight: "900", fontSize: 13 },
  modalGenerateBtn: {
    flex: 2,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGenerateBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
