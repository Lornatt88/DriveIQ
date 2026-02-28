import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiGet, apiPost } from "../lib/api";
import { clearToken } from "../lib/token";

type SessionItem = {
  session_id: string;
  instructor_id?: string;
  trainee_id: string;
  vehicle_id?: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  notes?: string;
  created_at?: string;
  instructor_notes?: string;
};

export default function HomeScreen() {
  const [meLoading, setMeLoading] = useState(true);
  const [role, setRole] = useState<"instructor" | "trainee" | null>(null);
  const [me, setMe] = useState<any>(null);

  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  // Create session (instructor only)
  const [creating, setCreating] = useState(false);
  const [traineeId, setTraineeId] = useState("");
  const [vehicleId, setVehicleId] = useState("UNKNOWN");
  const [scheduledAt, setScheduledAt] = useState(""); // ISO string
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes] = useState("");

  const loadMe = useCallback(async () => {
    try {
      setMeLoading(true);
      const data = await apiGet("/auth/me");
      setMe(data);
      const r = (data?.role || "").toLowerCase();
      if (r === "instructor" || r === "trainee") setRole(r);
      else setRole(null);
    } catch (e: any) {
      setMe(null);
      setRole(null);
      Alert.alert("Auth Error", e?.message || "Failed to load user");
    } finally {
      setMeLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const data = await apiGet("/sessions");
      setSessions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setSessions([]);
      Alert.alert("Sessions Error", e?.message || "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadMe();
    await loadSessions();
  }, [loadMe, loadSessions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const lastScore = useMemo(() => {
    // If you want real “last score”, you need results endpoint per trainee/trip.
    // For now show count of sessions completed as a meaningful real stat.
    const completed = sessions.filter((s) => (s.status || "").toLowerCase() === "completed").length;
    return completed;
  }, [sessions]);

  const onCreateSession = async () => {
    const tid = traineeId.trim();
    if (!tid) {
      Alert.alert("Missing trainee_id", "Paste a trainee user_id here (from linked learner).");
      return;
    }

    // If user leaves scheduledAt empty, set to now as ISO
    const sched = scheduledAt.trim() || new Date().toISOString();

    const dur = parseInt(durationMin.trim() || "60", 10);
    if (Number.isNaN(dur) || dur <= 0) {
      Alert.alert("Invalid duration", "duration_min must be a positive number.");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        trainee_id: tid,
        vehicle_id: vehicleId.trim() || "UNKNOWN",
        scheduled_at: sched,
        duration_min: dur,
        notes: notes || "",
      };

      const res = await apiPost("/sessions", payload);
      Alert.alert("Session created", `session_id: ${res?.session_id || "—"}`);

      // clear inputs (keep vehicle maybe)
      setTraineeId("");
      setScheduledAt("");
      setNotes("");
      setDurationMin("60");

      await loadSessions();
    } catch (e: any) {
      Alert.alert("Create Session Error", e?.message || "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const onLogout = async () => {
    await clearToken();
    router.replace("/");
  };

  const renderSession = ({ item }: { item: SessionItem }) => {
    const title =
      role === "instructor"
        ? `Trainee: ${item.trainee_id}`
        : `Instructor session`;

    return (
      <Pressable
        style={({ pressed }) => [styles.sessionCard, pressed ? { opacity: 0.92 } : null]}
        onPress={() => router.push(`/lesson?session_id=${item.session_id}`)}
      >
        <View style={styles.sessionTopRow}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{(item.status || "scheduled").toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sessionSub} numberOfLines={1}>
          Session ID: {item.session_id}
        </Text>

        <Text style={styles.sessionSub} numberOfLines={1}>
          Vehicle: {item.vehicle_id || "UNKNOWN"} • Duration: {item.duration_min || 60} min
        </Text>

        <Text style={styles.sessionSub} numberOfLines={2}>
          Scheduled: {item.scheduled_at}
        </Text>
      </Pressable>
    );
  };

  if (meLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.centerText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sessions</Text>
          <Text style={styles.sub}>
            Signed in as: <Text style={styles.strong}>{me?.name || "—"}</Text> •{" "}
            <Text style={styles.strong}>{role || "—"}</Text>
          </Text>
          <Text style={styles.sub}>
            Completed sessions: <Text style={styles.score}>{lastScore}</Text>
          </Text>
        </View>

        <Pressable onPress={refreshAll} style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </Pressable>
      </View>

      {/* Instructor: Create session */}
      {role === "instructor" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Session (Instructor)</Text>
          <Text style={styles.cardText}>
            You can only create sessions for trainees linked to your instructor_id.
          </Text>

          <TextInput
            value={traineeId}
            onChangeText={setTraineeId}
            placeholder="trainee user_id (required)"
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={styles.row}>
            <TextInput
              value={vehicleId}
              onChangeText={setVehicleId}
              placeholder="vehicle_id (e.g. VEH-1234)"
              placeholderTextColor="#6B7280"
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
            />
            <TextInput
              value={durationMin}
              onChangeText={setDurationMin}
              placeholder="duration_min"
              placeholderTextColor="#6B7280"
              style={[styles.input, { width: 120, marginLeft: 10 }]}
              keyboardType="number-pad"
            />
          </View>

          <TextInput
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholder='scheduled_at ISO (leave empty for "now")'
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="none"
          />

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="notes (optional)"
            placeholderTextColor="#6B7280"
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            multiline
          />

          <Pressable
            disabled={creating}
            onPress={onCreateSession}
            style={({ pressed }) => [
              styles.primaryBtn,
              creating ? { opacity: 0.6 } : null,
              pressed ? { opacity: 0.92 } : null,
            ]}
          >
            <Text style={styles.primaryBtnText}>{creating ? "Creating…" : "Create Session"}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* List sessions */}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Your Sessions</Text>
        {sessionsLoading ? <ActivityIndicator /> : null}
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.session_id}
        renderItem={renderSession}
        contentContainerStyle={{ paddingBottom: 18 }}
        ListEmptyComponent={
          sessionsLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No sessions found</Text>
              <Text style={styles.emptySub}>
                Instructor: create one above. Trainee: wait for instructor to create one.
              </Text>
            </View>
          )
        }
      />

      <Pressable onPress={onLogout} style={({ pressed }) => [styles.linkBtn, pressed ? { opacity: 0.9 } : null]}>
        <Text style={styles.linkText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220", padding: 16, paddingTop: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  centerText: { marginTop: 10, color: "#9aa7bf", fontWeight: "800" },

  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { color: "#fff", fontSize: 26, fontWeight: "900" },
  sub: { marginTop: 6, color: "#9aa7bf", fontSize: 13, fontWeight: "700" },
  strong: { color: "#E5E7EB", fontWeight: "900" },
  score: { color: "#38bdf8", fontWeight: "900" },

  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e2a44",
    backgroundColor: "#111b2e",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },

  card: {
    marginTop: 16,
    backgroundColor: "#111b2e",
    borderWidth: 1,
    borderColor: "#1e2a44",
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  cardText: { color: "#9aa7bf", fontSize: 12, lineHeight: 18, marginBottom: 12 },

  input: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#1e2a44",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#E5E7EB",
    fontWeight: "800",
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },

  primaryBtn: { backgroundColor: "#38bdf8", padding: 14, borderRadius: 14, alignItems: "center", marginTop: 6 },
  primaryBtnText: { color: "#001018", fontWeight: "900", fontSize: 15 },

  listHeader: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#E5E7EB", fontWeight: "900", fontSize: 14 },

  sessionCard: {
    marginTop: 10,
    backgroundColor: "#111b2e",
    borderWidth: 1,
    borderColor: "#1e2a44",
    borderRadius: 16,
    padding: 14,
  },
  sessionTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sessionTitle: { color: "#fff", fontWeight: "900", fontSize: 13, flex: 1 },
  sessionSub: { marginTop: 6, color: "#9aa7bf", fontWeight: "800", fontSize: 11 },

  statusPill: { backgroundColor: "#0b1220", borderWidth: 1, borderColor: "#1e2a44", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  statusText: { color: "#E5E7EB", fontWeight: "900", fontSize: 10 },

  empty: { marginTop: 18, backgroundColor: "#111b2e", borderWidth: 1, borderColor: "#1e2a44", borderRadius: 16, padding: 16 },
  emptyTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  emptySub: { marginTop: 6, color: "#9aa7bf", fontWeight: "800", fontSize: 12, lineHeight: 18 },

  linkBtn: { marginTop: 10, alignItems: "center", paddingVertical: 12 },
  linkText: { color: "#9aa7bf", fontWeight: "800" },
});
