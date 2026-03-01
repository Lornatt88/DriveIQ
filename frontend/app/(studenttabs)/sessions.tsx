import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal,
  useWindowDimensions, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiGet, apiPost, apiDelete } from "../../lib/api";
import { colors, type_, radius, space, card, page, tint } from "../../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type InstructorProfile = {
  instructor_id: string; name: string; bio: string; specialties: string[];
  experience_years: number; price_per_session: number; currency: string;
  vehicle: string; languages: string[]; location_area: string;
  rating: number; total_reviews: number; total_sessions: number;
};

type Slot = {
  slot_id: string; instructor_id: string; date: string;
  start_time: string; end_time: string; duration_min: number; status: string;
};

type Booking = {
  booking_id: string; instructor_id: string; instructor_name?: string;
  slot_date: string; start_time: string; end_time: string; status: string;
  session_id?: string;
};

type SessionDoc = {
  session_id: string; instructor_id: string; instructor_name?: string;
  status: string; road_type?: string; created_at?: string;
  started_at?: string; ended_at?: string;
};

type ResultDoc = {
  session_id: string; instructor_name?: string;
  analysis?: { behavior: string; overall: number; badge: string; confidence: number };
  ai_feedback?: any[]; instructor_comment?: { text: string; rating: number; date: string };
  created_at?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  catch { return "—"; }
}

function starsString(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const { width } = useWindowDimensions();

  // ── State ──────────────────────────────────────────────────────────
  const [loading, setLoading]                 = useState(true);
  const [instructors, setInstructors]         = useState<InstructorProfile[]>([]);
  const [bookings, setBookings]               = useState<Booking[]>([]);
  const [sessions, setSessions]               = useState<SessionDoc[]>([]);
  const [results, setResults]                 = useState<ResultDoc[]>([]);
  const [dashData, setDashData]               = useState<any>(null);

  // Filters
  const [langFilter, setLangFilter]           = useState("All");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");

  // Booking modal
  const [showBooking, setShowBooking]         = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<InstructorProfile | null>(null);
  const [slots, setSlots]                     = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading]       = useState(false);
  const [selectedSlot, setSelectedSlot]       = useState<Slot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // ── Data Loading ───────────────────────────────────────────────────

  const loadAll = async () => {
    try {
      setLoading(true);
      const [instData, bookData, sessData, dashResp] = await Promise.all([
        apiGet("/instructors"),
        apiGet("/bookings/me"),
        apiGet("/sessions"),
        apiGet("/dashboard/trainee"),
      ]);
      setInstructors(Array.isArray(instData) ? instData : []);
      setBookings(Array.isArray(bookData) ? bookData : []);
      setSessions(Array.isArray(sessData) ? sessData : []);
      setDashData(dashResp);

      // Load results for past sessions
      try {
        const recData = await apiGet("/records/trainee");
        setResults(Array.isArray(recData) ? recData : []);
      } catch { setResults([]); }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useFocusEffect(useCallback(() => { loadAll(); }, []));

  // ── Derived Data ───────────────────────────────────────────────────

  const sessionsCompleted = dashData?.progress?.sessions_completed ?? 0;
  const targetSessions    = dashData?.progress?.target_sessions ?? 10;
  const currentScore      = dashData?.progress?.current_score ?? 0;
  const badge             = dashData?.welcome?.badge ?? "—";
  const studentName       = dashData?.welcome?.name ?? "";

  const upcomingBookings = useMemo(
    () => bookings.filter(b => b.status === "confirmed").sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [bookings]
  );

  const completedSessions = useMemo(
    () => sessions.filter(s => s.status === "completed").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [sessions]
  );

  const resultsBySession = useMemo(() => {
    const map: Record<string, ResultDoc> = {};
    for (const r of results) { if (r.session_id) map[r.session_id] = r; }
    return map;
  }, [results]);

  // Language options from real data
  const allLanguages = useMemo(() => {
    const set = new Set<string>();
    instructors.forEach(i => i.languages?.forEach(l => set.add(l)));
    return ["All", ...Array.from(set).sort()];
  }, [instructors]);

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    instructors.forEach(i => i.specialties?.forEach(s => set.add(s)));
    return ["All", ...Array.from(set).sort()];
  }, [instructors]);

  const filteredInstructors = useMemo(() => {
    return instructors.filter(i => {
      if (langFilter !== "All" && !(i.languages || []).includes(langFilter)) return false;
      if (specialtyFilter !== "All" && !(i.specialties || []).includes(specialtyFilter)) return false;
      return true;
    });
  }, [instructors, langFilter, specialtyFilter]);

  // AI feedback & comments from dashboard
  const aiFeedback          = dashData?.ai_feedback ?? [];
  const instructorComments  = dashData?.instructor_comments ?? [];

  // ── Booking Flow ───────────────────────────────────────────────────

  const openBookingModal = async (instructor: InstructorProfile) => {
    setSelectedInstructor(instructor);
    setSelectedSlot(null);
    setShowBooking(true);
    setSlotsLoading(true);
    try {
      const data = await apiGet(`/instructors/${instructor.instructor_id}/availability`);
      setSlots(Array.isArray(data) ? data : []);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  };

  const confirmBooking = async () => {
    if (!selectedSlot) { Alert.alert("Select a time slot"); return; }
    try {
      setBookingInProgress(true);
      const res = await apiPost("/bookings", { slot_id: selectedSlot.slot_id });
      Alert.alert("Booked! ✅", `Session with ${res?.instructor_name || selectedInstructor?.name} on ${fmtDate(selectedSlot.start_time)} at ${fmtTime(selectedSlot.start_time)}`);
      setShowBooking(false);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Booking failed", e?.message || "Could not book slot");
    } finally { setBookingInProgress(false); }
  };

  const cancelBooking = async (bookingId: string) => {
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No" },
      { text: "Yes, cancel", style: "destructive", onPress: async () => {
        try {
          await apiDelete(`/bookings/${bookingId}`);
          Alert.alert("Cancelled");
          await loadAll();
        } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
      }},
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading sessions…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>

      {/* ═══ 1. WELCOME BANNER ═══════════════════════════════════════ */}
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Ready to book your next driving session?</Text>
        </View>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{sessionsCompleted}/{targetSessions}</Text>
            <Text style={s.heroStatLabel}>Sessions</Text>
          </View>
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{currentScore}%</Text>
            <Text style={s.heroStatLabel}>Score</Text>
          </View>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>{badge}</Text>
          </View>
        </View>
      </View>

      {/* ═══ 2. BOOK A NEW SESSION ═══════════════════════════════════ */}
      <SectionHeader icon="📅" title="Book a New Session" />

      {/* Filters */}
      <View style={s.filterRow}>
        <FilterChips label="Language" options={allLanguages} value={langFilter} onChange={setLangFilter} />
        <FilterChips label="Specialty" options={allSpecialties} value={specialtyFilter} onChange={setSpecialtyFilter} />
      </View>

      {/* Instructor Cards */}
      {filteredInstructors.length === 0 ? (
        <EmptyCard text="No instructors match your filters" />
      ) : (
        <View style={s.instructorGrid}>
          {filteredInstructors.map(inst => (
            <Pressable key={inst.instructor_id} style={s.instCard} onPress={() => openBookingModal(inst)}>
              <View style={s.instTop}>
                <View style={s.instAvatar}>
                  <Text style={s.instAvatarText}>{initials(inst.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.instName}>{inst.name}</Text>
                  <View style={s.instRatingRow}>
                    <Text style={s.instStars}>{starsString(inst.rating)}</Text>
                    <Text style={s.instRatingNum}>{inst.rating.toFixed(1)}</Text>
                    <Text style={s.instReviews}>({inst.total_reviews})</Text>
                  </View>
                </View>
              </View>

              <View style={s.instMeta}>
                <Text style={s.instMetaText}>🌐 {(inst.languages || []).join(", ") || "—"}</Text>
                <Text style={s.instMetaText}>🚗 {inst.vehicle || "—"}</Text>
                <Text style={s.instMetaText}>📍 {inst.location_area || "—"}</Text>
                <Text style={s.instMetaText}>💰 {inst.price_per_session} {inst.currency}/session</Text>
              </View>

              <View style={s.instSpecialties}>
                {(inst.specialties || []).map((sp, i) => (
                  <View key={i} style={s.specPill}>
                    <Text style={s.specText}>{sp}</Text>
                  </View>
                ))}
              </View>

              <View style={s.instBtn}>
                <Text style={s.instBtnText}>Select & Book</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* ═══ 3. UPCOMING SESSIONS ════════════════════════════════════ */}
      <SectionHeader icon="🕒" title="Upcoming Sessions" count={upcomingBookings.length} />

      {upcomingBookings.length === 0 ? (
        <EmptyCard text="No upcoming sessions. Browse instructors above to book one!" />
      ) : (
        upcomingBookings.map(b => (
          <View key={b.booking_id} style={s.upcomingCard}>
            <View style={s.upcomingTop}>
              <View style={s.upcomingAvatar}>
                <Text style={s.upcomingAvatarText}>{initials(b.instructor_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.upcomingName}>{b.instructor_name || "Instructor"}</Text>
                <Text style={s.upcomingDate}>{fmtDate(b.start_time)} at {fmtTime(b.start_time)}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: b.status === "confirmed" ? colors.green : colors.borderMid }]}>
                <Text style={s.statusPillText}>{b.status}</Text>
              </View>
            </View>
            <View style={s.upcomingActions}>
              <Pressable style={s.cancelBtn} onPress={() => cancelBooking(b.booking_id)}>
                <Text style={s.cancelBtnText}>✕ Cancel</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* ═══ 4. PAST SESSIONS ════════════════════════════════════════ */}
      <SectionHeader icon="📋" title="Past Sessions" count={completedSessions.length} />

      {completedSessions.length === 0 ? (
        <EmptyCard text="No completed sessions yet" />
      ) : (
        completedSessions.slice(0, 8).map(sess => {
          const result = resultsBySession[sess.session_id];
          const score = result?.analysis?.overall ?? 0;
          const behavior = result?.analysis?.behavior ?? "—";
          const outcome = score >= 70 ? "Passed" : "Needs Improvement";
          const outcomeColor = score >= 70 ? colors.green : colors.redDark;

          return (
            <Pressable key={sess.session_id} style={s.pastCard}
              onPress={() => Alert.alert("Report", `View report for session ${sess.session_id.slice(0, 8)}`)}>
              <View style={s.pastTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pastDate}>{fmtDate(sess.created_at)}</Text>
                  <Text style={s.pastInstructor}>Instructor: {sess.instructor_name || "—"}</Text>
                </View>
                <View style={[s.outcomePill, { backgroundColor: score >= 70 ? "#DCFCE7" : colors.redLight }]}>
                  <Text style={[s.outcomeText, { color: outcomeColor }]}>{outcome}</Text>
                </View>
              </View>
              <View style={s.pastBottom}>
                <View>
                  <Text style={s.pastScoreLabel}>Score</Text>
                  <Text style={[s.pastScore, { color: outcomeColor }]}>{score}%</Text>
                </View>
                <View style={s.viewReportBtn}>
                  <Text style={s.viewReportText}>📄 View Report</Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}

      {/* ═══ 5. FEEDBACK & COMMENTS ══════════════════════════════════ */}
      {(aiFeedback.length > 0 || instructorComments.length > 0) && (
        <>
          <SectionHeader icon="💬" title="Recent Feedback" />
          {aiFeedback.map((f: any, i: number) => (
            <View key={`fb-${i}`} style={[s.feedbackCard, { backgroundColor: tint.blue.bg, borderColor: tint.blue.border }]}>
              <Text style={{ fontSize: 18 }}>{f.icon || "💡"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.feedbackTitle, { color: colors.blueDark }]}>{f.title || "Tip"}</Text>
                <Text style={[s.feedbackMsg, { color: colors.blueDeep }]}>{f.message || ""}</Text>
              </View>
            </View>
          ))}
          {instructorComments.map((c: any, i: number) => (
            <View key={`ic-${i}`} style={[s.feedbackCard, { backgroundColor: tint.purple.bg, borderColor: tint.purple.border }]}>
              <Text style={{ fontSize: 18 }}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.feedbackTitle, { color: colors.purpleDark }]}>Instructor Comment</Text>
                <Text style={[s.feedbackMsg, { color: colors.purpleDeep || colors.purpleDark }]}>{c.text || ""}</Text>
                {c.rating > 0 && <Text style={s.feedbackRating}>{"⭐".repeat(c.rating)}</Text>}
              </View>
            </View>
          ))}
        </>
      )}

      {/* ═══ MOTIVATION BANNER ═══════════════════════════════════════ */}
      <View style={s.motivationBanner}>
        <Text style={{ fontSize: 28 }}>🎉</Text>
        <Text style={s.motivationTitle}>You're building confidence — keep going!</Text>
        <Text style={s.motivationSub}>{targetSessions - sessionsCompleted} more sessions to complete your training program</Text>
      </View>

      {/* ═══ BOOKING MODAL ═══════════════════════════════════════════ */}
      <Modal visible={showBooking} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Book Your Session</Text>
                <Pressable onPress={() => setShowBooking(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </Pressable>
              </View>

              {selectedInstructor && (
                <>
                  {/* Instructor summary */}
                  <View style={s.modalInstRow}>
                    <View style={s.modalInstAvatar}>
                      <Text style={s.modalInstAvatarText}>{initials(selectedInstructor.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalInstName}>{selectedInstructor.name}</Text>
                      <Text style={s.modalInstMeta}>
                        {starsString(selectedInstructor.rating)} {selectedInstructor.rating.toFixed(1)} · {(selectedInstructor.languages || []).join(", ")}
                      </Text>
                      <Text style={s.modalInstMeta}>
                        {selectedInstructor.price_per_session} {selectedInstructor.currency}/session
                      </Text>
                    </View>
                  </View>

                  {/* Available slots — day columns with time rows */}
                  <Text style={s.modalSectionTitle}>Available Time Slots</Text>

                  {slotsLoading ? (
                    <ActivityIndicator style={{ marginVertical: 20 }} />
                  ) : slots.length === 0 ? (
                    <Text style={s.modalEmpty}>No available slots in the next 2 weeks</Text>
                  ) : (
                    <View style={s.scheduleGrid}>
                      {(() => {
                        // Group slots by date
                        const byDate: Record<string, Slot[]> = {};
                        slots.forEach(slot => {
                          const key = fmtDate(slot.start_time);
                          if (!byDate[key]) byDate[key] = [];
                          byDate[key].push(slot);
                        });
                        const dateKeys = Object.keys(byDate);

                        return (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={s.scheduleColumns}>
                              {dateKeys.map(dateKey => (
                                <View key={dateKey} style={s.scheduleCol}>
                                  <Text style={s.scheduleColHeader}>{dateKey}</Text>
                                  {byDate[dateKey].map(slot => {
                                    const selected = selectedSlot?.slot_id === slot.slot_id;
                                    return (
                                      <Pressable
                                        key={slot.slot_id}
                                        style={[s.scheduleSlot, selected && s.scheduleSlotSelected]}
                                        onPress={() => setSelectedSlot(slot)}
                                      >
                                        <Text style={[s.scheduleSlotText, selected && { color: "#FFF" }]}>
                                          {fmtTime(slot.start_time)}
                                        </Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        );
                      })()}
                    </View>
                  )}

                  {/* Summary */}
                  {selectedSlot && (
                    <View style={s.bookingSummary}>
                      <Text style={s.bookingSummaryTitle}>✅ Booking Summary</Text>
                      <Text style={s.bookingSummaryText}>
                        Session with {selectedInstructor.name} on {fmtDate(selectedSlot.start_time)} at {fmtTime(selectedSlot.start_time)}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={s.modalActions}>
                    <Pressable
                      style={[s.confirmBtn, (!selectedSlot || bookingInProgress) && { opacity: 0.5 }]}
                      onPress={confirmBooking}
                      disabled={!selectedSlot || bookingInProgress}>
                      <Text style={s.confirmBtnText}>
                        {bookingInProgress ? "Booking…" : "✓ Confirm Booking"}
                      </Text>
                    </Pressable>
                    <Pressable style={s.modalCancelBtn} onPress={() => setShowBooking(false)}>
                      <Text style={s.modalCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={s.countBadge}><Text style={s.countBadgeText}>{count}</Text></View>
      )}
    </View>
  );
}

function FilterChips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterChipsScroll}>
      {options.map(opt => (
        <Pressable key={opt} style={[s.filterChip, value === opt && s.filterChipActive]} onPress={() => onChange(opt)}>
          <Text style={[s.filterChipText, value === opt && s.filterChipTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={s.emptyCard}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:    { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 40, gap: 12 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  // Hero
  hero:          { borderRadius: radius.cardXl, padding: space.xl, backgroundColor: colors.purpleDark, gap: 14 },
  heroTitle:     { color: "#FFF", fontWeight: "900", fontSize: 16 },
  heroSub:       { color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 12, marginTop: 4 },
  heroStats:     { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  heroStat:      { alignItems: "center" },
  heroStatNum:   { color: "#FFF", fontWeight: "900", fontSize: 20 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 11, marginTop: 2 },
  heroBadge:     { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: "#FFF", fontWeight: "900", fontSize: 11 },

  // Section header
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  sectionTitle:  { ...type_.sectionTitle, flex: 1 },
  countBadge:    { backgroundColor: colors.purpleDark, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText:{ color: "#FFF", fontWeight: "900", fontSize: 10 },

  // Filters
  filterRow:           { gap: 8, marginBottom: 4 },
  filterChipsScroll:   { marginBottom: 6 },
  filterChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, marginRight: 8 },
  filterChipActive:    { backgroundColor: colors.purpleDark, borderColor: colors.purpleDark },
  filterChipText:      { fontWeight: "800", fontSize: 12, color: colors.label },
  filterChipTextActive:{ color: "#FFF" },

  // Instructor cards
  instructorGrid: { gap: 12 },
  instCard:       { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  instTop:        { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  instAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.purpleDark, alignItems: "center", justifyContent: "center" },
  instAvatarText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
  instName:       { fontWeight: "900", fontSize: 14, color: colors.textAlt },
  instRatingRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  instStars:      { color: "#F59E0B", fontSize: 12 },
  instRatingNum:  { fontWeight: "900", fontSize: 12, color: colors.textAlt },
  instReviews:    { fontSize: 11, color: colors.subtext },
  instMeta:       { gap: 4, marginBottom: 10 },
  instMetaText:   { fontSize: 12, fontWeight: "700", color: colors.label },
  instSpecialties:{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  specPill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pageBg },
  specText:       { fontSize: 11, fontWeight: "800", color: colors.label },
  instBtn:        { backgroundColor: colors.purpleDark, borderRadius: radius.input, paddingVertical: 12, alignItems: "center" },
  instBtnText:    { color: "#FFF", fontWeight: "900", fontSize: 13 },

  // Upcoming cards
  upcomingCard:      { backgroundColor: colors.cardBg, borderWidth: 2, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  upcomingTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  upcomingAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purpleDark, alignItems: "center", justifyContent: "center" },
  upcomingAvatarText:{ color: "#FFF", fontWeight: "900", fontSize: 13 },
  upcomingName:      { fontWeight: "900", fontSize: 13, color: colors.textAlt },
  upcomingDate:      { fontSize: 12, fontWeight: "700", color: colors.subtext, marginTop: 2 },
  statusPill:        { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText:    { color: "#FFF", fontWeight: "900", fontSize: 11, textTransform: "capitalize" as any },
  upcomingActions:   { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 10 },
  cancelBtn:         { borderWidth: 1, borderColor: colors.redDark, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 8 },
  cancelBtnText:     { color: colors.redDark, fontWeight: "900", fontSize: 12 },

  // Past sessions
  pastCard:       { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  pastTop:        { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  pastDate:       { fontWeight: "900", fontSize: 13, color: colors.textAlt },
  pastInstructor: { fontSize: 12, fontWeight: "700", color: colors.subtext, marginTop: 3 },
  outcomePill:    { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  outcomeText:    { fontWeight: "900", fontSize: 11 },
  pastBottom:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  pastScoreLabel: { fontSize: 11, fontWeight: "700", color: colors.label },
  pastScore:      { fontWeight: "900", fontSize: 20 },
  viewReportBtn:  { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.cardBg },
  viewReportText: { fontWeight: "900", fontSize: 12, color: colors.textAlt },

  // Feedback
  feedbackCard:  { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: radius.card, borderWidth: 1, marginBottom: 8 },
  feedbackTitle: { fontWeight: "900", fontSize: 13, marginBottom: 3 },
  feedbackMsg:   { fontSize: 12, fontWeight: "700", lineHeight: 18 },
  feedbackRating:{ marginTop: 4, fontSize: 12 },

  // Motivation
  motivationBanner: { marginTop: 8, borderRadius: radius.card, borderWidth: 2, borderColor: "#BBF7D0", backgroundColor: "#F0FDF4", padding: space.lg, alignItems: "center", gap: 6 },
  motivationTitle:  { fontWeight: "900", fontSize: 14, color: "#166534", textAlign: "center" },
  motivationSub:    { fontSize: 12, fontWeight: "700", color: "#15803D", textAlign: "center" },

  // Empty
  emptyCard: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: space.lg, alignItems: "center" },
  emptyText: { fontWeight: "800", fontSize: 12, color: colors.subtext, textAlign: "center" },

  // Modal
  modalOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard:         { backgroundColor: colors.cardBg, borderRadius: radius.cardXl, maxHeight: "85%" as any, padding: 20 },
  modalHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:        { fontWeight: "900", fontSize: 18, color: colors.textAlt },
  modalClose:        { fontSize: 22, color: colors.subtext, padding: 4 },
  modalInstRow:      { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.pageBg, borderRadius: radius.card, padding: 14, marginBottom: 16 },
  modalInstAvatar:   { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.purpleDark, alignItems: "center", justifyContent: "center" },
  modalInstAvatarText:{ color: "#FFF", fontWeight: "900", fontSize: 16 },
  modalInstName:     { fontWeight: "900", fontSize: 15, color: colors.textAlt },
  modalInstMeta:     { fontSize: 12, fontWeight: "700", color: colors.subtext, marginTop: 2 },
  modalSectionTitle: { fontWeight: "900", fontSize: 14, color: colors.textAlt, marginBottom: 10 },
  modalEmpty:        { textAlign: "center", color: colors.subtext, fontWeight: "700", fontSize: 12, marginVertical: 20 },

  // Schedule grid (day columns with time rows)
  scheduleGrid:        { marginBottom: 16 },
  scheduleColumns:     { flexDirection: "row", gap: 10 },
  scheduleCol:         { alignItems: "center", minWidth: 80 },
  scheduleColHeader:   { fontWeight: "900", fontSize: 11, color: colors.textAlt, marginBottom: 8, textAlign: "center" },
  scheduleSlot:        { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.pageBg, marginBottom: 6, width: "100%" as any, alignItems: "center" },
  scheduleSlotSelected:{ backgroundColor: colors.purpleDark, borderColor: colors.purpleDark },
  scheduleSlotText:    { fontWeight: "700", fontSize: 12, color: colors.label },

  // Booking summary
  bookingSummary:     { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: radius.card, padding: 14, marginBottom: 16 },
  bookingSummaryTitle:{ fontWeight: "900", fontSize: 13, color: "#1E40AF", marginBottom: 4 },
  bookingSummaryText: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },

  // Modal actions
  modalActions:   { gap: 10, marginTop: 8 },
  confirmBtn:     { backgroundColor: colors.purpleDark, borderRadius: radius.input, paddingVertical: 14, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
  modalCancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingVertical: 12, alignItems: "center" },
  modalCancelText:{ fontWeight: "900", fontSize: 13, color: colors.textAlt },
});
