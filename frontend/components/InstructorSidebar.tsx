import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from "react-native";
import { apiGet } from "../lib/api";

type StudentStatus = "Active" | "Scheduled" | "Learner";

const STATUS_COLOR: Record<StudentStatus, string> = {
  Active:    "#22C55E",
  Scheduled: "#60A5FA",
  Learner:   "#94A3B8",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const today = new Date();
    const diff = today.getDate() - d.getDate();
    if (d.toDateString() === today.toDateString()) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return "—"; }
}

export default function InstructorSidebar() {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [learners, setLearners] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession]     = useState<any>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);

  useEffect(() => {
    let done = 0;
    const finish = () => { done++; if (done >= 2) setLoading(false); };

    apiGet("/dashboard/instructor")
      .then((dash) => {
        setLearners(dash.learners ?? []);
        setActiveSession(dash.active_session ?? null);
        setUpcomingBookings(dash.upcoming_bookings ?? []);
      })
      .catch(() => {})
      .finally(finish);

    apiGet("/sessions")
      .then((allSessions) => {
        const raw = Array.isArray(allSessions) ? allSessions : [];
        // keep only real sessions (not booking stubs which have session_id: null)
        const real = raw.filter((s: any) => !!s.session_id);
        setSessions(real);
      })
      .catch(() => {})
      .finally(finish);
  }, []);

  const scheduledIds = useMemo(
    () => new Set(upcomingBookings.map((b: any) => b.trainee_id)),
    [upcomingBookings]
  );

  const studentRows = useMemo(() => {
    return learners.map((l: any) => {
      let status: StudentStatus = "Learner";
      if (activeSession?.trainee_id === l.user_id) status = "Active";
      else if (scheduledIds.has(l.user_id))        status = "Scheduled";
      return { id: l.user_id, name: l.name || l.email || "Unknown", status };
    });
  }, [learners, activeSession, scheduledIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return studentRows;
    return studentRows.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, studentRows]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    learners.forEach((l: any) => { if (l.user_id) m[l.user_id] = l.name || "Unknown"; });
    return m;
  }, [learners]);

  const historyRows = useMemo(() => {
    return sessions
      .filter((s: any) => s.status !== "active" && s.status !== "processing")
      .slice(0, 8)
      .map((s: any) => ({
        id:    s.session_id || s._id || Math.random().toString(),
        name:  s.trainee_name || nameMap[s.trainee_id] || "Unknown",
        date:  fmtDate(s.ended_at || s.end_time || s.created_at || ""),
        score: typeof s.performance_score === "number" ? s.performance_score : null,
      }));
  }, [sessions, nameMap]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.wrap}>
        <Text style={styles.sidebarTitle}>My Students</Text>

        {/* ── Student List ─────────────────────────────────────────── */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            Student List{learners.length > 0 ? ` (${learners.length})` : ""}
          </Text>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔎</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search students..."
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ marginTop: 16 }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>
              {learners.length === 0 ? "No students yet." : "No matches."}
            </Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {filtered.map((s) => (
                <View key={s.id} style={styles.studentRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(s.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s.status] }]} />
                      <Text style={styles.studentStatus}>{s.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Session History ────────────────────────────────────── */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Recent Sessions</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ marginTop: 12 }} />
          ) : historyRows.length === 0 ? (
            <Text style={styles.empty}>No completed sessions yet.</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {historyRows.map((h) => (
                <View key={h.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyName}>{h.name}</Text>
                    <Text style={styles.historyTime}>{h.date}</Text>
                  </View>
                  {h.score !== null ? (
                    <View style={styles.scorePill}>
                      <Text style={styles.scorePillText}>{h.score}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noScore}>—</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  wrap: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },
  sidebarTitle: { color: "#101828", fontWeight: "900", fontSize: 13, marginBottom: 10 },

  block:      { marginTop: 12 },
  blockTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },
  empty:      { marginTop: 12, fontSize: 12, fontWeight: "700", color: "#98A2B3" },

  searchWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchIcon:  { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: "#101828", fontSize: 13 },

  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText:    { color: "#4F46E5", fontWeight: "900" },
  studentName:   { color: "#101828", fontWeight: "800", fontSize: 13 },
  dot:           { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  studentStatus: { color: "#667085", fontWeight: "700", fontSize: 12 },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyName:   { color: "#101828", fontWeight: "800", fontSize: 13 },
  historyTime:   { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 4 },
  scorePill:     { minWidth: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" },
  scorePillText: { color: "#101828", fontWeight: "900", fontSize: 12 },
  noScore:       { color: "#98A2B3", fontWeight: "700", fontSize: 12 },
});
