import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../lib/api";
import { colors, card, page } from "../../lib/theme";

// ─── Types ──────────────────────────────────────────────────────────────────

type Outcome = "Passed" | "Failed";
type DriverProfile = "Drowsy" | "Aggressive" | "Normal";

type LearnerRecord = {
  learnerId: string;
  initials: string;
  name: string;
  lastSessionDate: string;
  sessionCount: number;
  roadType: string;
  score: number;
  outcome: Outcome;
  profile: DriverProfile;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function profileFrom(label?: string): DriverProfile {
  const x = (label || "").toLowerCase();
  if (x.includes("drowsy")) return "Drowsy";
  if (x.includes("aggressive")) return "Aggressive";
  return "Normal";
}

function roadTypeFrom(result: any): string {
  if (result?.road_type) return result.road_type;
  const csv: string = result?.dataset_used?.csv || "";
  if (csv.toLowerCase().includes("motorway")) return "Motorway";
  if (csv.toLowerCase().includes("secondary")) return "Secondary";
  return "—";
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return isFinite(ms)
    ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

function scoreColor(s: number) {
  if (s >= 80) return colors.green;
  if (s >= 60) return colors.yellow;
  return colors.red;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProfilePill({ profile }: { profile: DriverProfile }) {
  const cfg = {
    Normal:     { bg: colors.greenLight,  text: colors.green,      label: "Normal" },
    Drowsy:     { bg: colors.redLight,    text: colors.red,         label: "Drowsy" },
    Aggressive: { bg: "#FEF3C7",          text: "#B45309",          label: "Aggressive" },
  }[profile];
  return (
    <View style={[rs.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[rs.pillText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View style={[card.base, rs.kpiCard]}>
      <View style={[rs.kpiIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rs.kpiLabel}>{label}</Text>
        <Text style={rs.kpiValue}>{value}</Text>
        <Text style={rs.kpiSub}>{sub}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function RecordsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const PAGE_SIZE = isWide ? 8 : 5;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learners, setLearners] = useState<any[]>([]);
  const [resultsRaw, setResultsRaw] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"All" | Outcome>("All");
  const [profileFilter, setProfileFilter] = useState<"All" | DriverProfile>("All");
  const [pageNum, setPageNum] = useState(1);

  async function load() {
    try {
      setError(null);
      setLoading(true);
      const [l, r] = await Promise.all([
        apiGet("/instructor/learners"),
        apiGet("/records/instructor"),
      ]);
      setLearners(Array.isArray(l) ? l : []);
      setResultsRaw(Array.isArray(r) ? r : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  // Map user_id → name
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) {
      if (l?.user_id) m[l.user_id] = l?.name || l?.email || l.user_id;
    }
    return m;
  }, [learners]);

  // Aggregate results per learner (one row per learner, latest result on top)
  const all: LearnerRecord[] = useMemo(() => {
    const byTrainee = new Map<string, any[]>();
    for (const r of resultsRaw) {
      const tid = r?.trainee_id || "_unknown";
      if (!byTrainee.has(tid)) byTrainee.set(tid, []);
      byTrainee.get(tid)!.push(r);
    }

    return Array.from(byTrainee.entries()).map(([traineeId, results]) => {
      // Sort newest first
      results.sort((a, b) => {
        const da = a?.created_at ? Date.parse(a.created_at) : 0;
        const db = b?.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      });
      const latest = results[0];
      const scores = results
        .map((r) => (typeof r?.analysis?.overall === "number" ? r.analysis.overall : 0))
        .filter((s) => s > 0);
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const name = nameById[traineeId] || traineeId;
      return {
        learnerId: traineeId,
        initials: initials(name),
        name,
        lastSessionDate: formatDate(latest?.created_at),
        sessionCount: results.length,
        roadType: roadTypeFrom(latest),
        score: avgScore,
        outcome: (avgScore >= 60 ? "Passed" : "Failed") as Outcome,
        profile: profileFrom(latest?.analysis?.behavior),
      };
    });
  }, [resultsRaw, nameById]);

  // KPI aggregates
  const drowsyCount     = useMemo(() => all.filter((r) => r.profile === "Drowsy").length,     [all]);
  const aggressiveCount = useMemo(() => all.filter((r) => r.profile === "Aggressive").length, [all]);
  const normalCount     = useMemo(() => all.filter((r) => r.profile === "Normal").length,     [all]);
  const total = all.length;

  const drowsyPct     = Math.round((drowsyCount     / Math.max(1, total)) * 100);
  const aggressivePct = Math.round((aggressiveCount / Math.max(1, total)) * 100);
  const normalPct     = Math.round((normalCount     / Math.max(1, total)) * 100);

  // Filtered + paginated
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      const matchQ = !q || r.name.toLowerCase().includes(q) || r.learnerId.toLowerCase().includes(q);
      const matchO = outcomeFilter === "All" || r.outcome === outcomeFilter;
      const matchP = profileFilter === "All" || r.profile === profileFilter;
      return matchQ && matchO && matchP;
    });
  }, [all, search, outcomeFilter, profileFilter]);

  useEffect(() => { setPageNum(1); }, [search, outcomeFilter, profileFilter, isWide]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(pageNum, totalPages);
  const startIdx   = (safePage - 1) * PAGE_SIZE;
  const pageItems  = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const endIdx     = startIdx + pageItems.length;

  function cycleOutcome() {
    setOutcomeFilter((v) => v === "All" ? "Passed" : v === "Passed" ? "Failed" : "All");
  }
  function cycleProfile() {
    setProfileFilter((v) => v === "All" ? "Normal" : v === "Normal" ? "Drowsy" : v === "Drowsy" ? "Aggressive" : "All");
  }

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading records…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red, marginTop: 8 }]}>{error}</Text>
        <Pressable onPress={load} style={rs.retryBtn}>
          <Text style={rs.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={page.base}
      contentContainerStyle={[page.content, { paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View>
        <Text style={rs.h1}>Learner Records</Text>
        <Text style={rs.h2}>
          {total} learner{total !== 1 ? "s" : ""} · performance and session history
        </Text>
      </View>

      {/* KPI strip */}
      <View style={[rs.kpiStrip, isWide && { flexDirection: "row" }]}>
        <KpiCard
          icon="checkmark-circle-outline"
          label="Normal profile"
          value={`${normalPct}%`}
          sub={`${normalCount} learner${normalCount !== 1 ? "s" : ""}`}
          iconBg={colors.greenLight}
          iconColor={colors.green}
        />
        <KpiCard
          icon="moon-outline"
          label="Drowsy profile"
          value={`${drowsyPct}%`}
          sub={`${drowsyCount} learner${drowsyCount !== 1 ? "s" : ""}`}
          iconBg={colors.redLight}
          iconColor={colors.red}
        />
        <KpiCard
          icon="warning-outline"
          label="Aggressive profile"
          value={`${aggressivePct}%`}
          sub={`${aggressiveCount} learner${aggressiveCount !== 1 ? "s" : ""}`}
          iconBg="#FEF3C7"
          iconColor="#B45309"
        />
      </View>

      {/* Filters */}
      <View style={[card.base, rs.filterCard]}>
        <View style={[rs.filterRow, isWide && { flexDirection: "row" }]}>
          {/* Search */}
          <View style={rs.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or ID…"
              placeholderTextColor={colors.muted}
              style={rs.searchInput}
            />
          </View>

          {/* Outcome toggle */}
          <Pressable onPress={cycleOutcome} style={rs.filterBtn}>
            <Text style={rs.filterBtnText}>
              {outcomeFilter === "All" ? "All Outcomes" : outcomeFilter}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.subtext} />
          </Pressable>

          {/* Profile toggle */}
          <Pressable onPress={cycleProfile} style={rs.filterBtn}>
            <Text style={rs.filterBtnText}>
              {profileFilter === "All" ? "All Profiles" : profileFilter}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.subtext} />
          </Pressable>
        </View>
      </View>

      {/* Table — wide */}
      {isWide ? (
        <View style={[card.base, rs.tableCard]}>
          {/* Header */}
          <View style={rs.tableHeader}>
            <Text style={[rs.th, { flex: 2.4 }]}>Learner</Text>
            <Text style={[rs.th, { flex: 1 }]}>Sessions</Text>
            <Text style={[rs.th, { flex: 1.4 }]}>Last Session</Text>
            <Text style={[rs.th, { flex: 1 }]}>Road Type</Text>
            <Text style={[rs.th, { flex: 1.6 }]}>Avg Score</Text>
            <Text style={[rs.th, { flex: 1 }]}>Outcome</Text>
            <Text style={[rs.th, { flex: 1, textAlign: "right" }]}>Profile</Text>
          </View>

          {pageItems.length === 0 ? (
            <View style={rs.emptyTable}>
              <Text style={rs.emptyText}>No records match your filters</Text>
            </View>
          ) : (
            pageItems.map((r, i) => (
              <View
                key={r.learnerId}
                style={[rs.tr, i < pageItems.length - 1 && rs.trBorder]}
              >
                {/* Learner */}
                <View style={[rs.tdCell, { flex: 2.4, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                  <View style={rs.avatar}>
                    <Text style={rs.avatarText}>{r.initials}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={rs.tdName} numberOfLines={1}>{r.name}</Text>
                    <Text style={rs.tdSub} numberOfLines={1}>{r.learnerId}</Text>
                  </View>
                </View>

                <Text style={[rs.tdText, { flex: 1 }]}>{r.sessionCount}</Text>
                <Text style={[rs.tdText, { flex: 1.4 }]}>{r.lastSessionDate}</Text>
                <Text style={[rs.tdText, { flex: 1 }]}>{r.roadType}</Text>

                {/* Score bar */}
                <View style={[rs.tdCell, { flex: 1.6 }]}>
                  <View style={rs.scoreRow}>
                    <View style={rs.scoreTrack}>
                      <View
                        style={[
                          rs.scoreFill,
                          {
                            width: `${Math.max(0, Math.min(100, r.score))}%` as any,
                            backgroundColor: scoreColor(r.score),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[rs.scoreNum, { color: scoreColor(r.score) }]}>{r.score}</Text>
                  </View>
                </View>

                {/* Outcome */}
                <View style={[rs.tdCell, { flex: 1 }]}>
                  <View
                    style={[
                      rs.outcomePill,
                      { backgroundColor: r.outcome === "Passed" ? colors.darkBtn : colors.red },
                    ]}
                  >
                    <Text style={rs.outcomeText}>{r.outcome}</Text>
                  </View>
                </View>

                {/* Profile */}
                <View style={[rs.tdCell, { flex: 1, alignItems: "flex-end" }]}>
                  <ProfilePill profile={r.profile} />
                </View>
              </View>
            ))
          )}

          {/* Footer + pagination */}
          <View style={rs.tableFooter}>
            <Text style={rs.footerText}>
              {filtered.length === 0
                ? "No results"
                : `${startIdx + 1}–${endIdx} of ${filtered.length}`}
            </Text>
            <Pagination page={safePage} total={totalPages} onPage={setPageNum} />
          </View>
        </View>
      ) : (
        /* Mobile cards */
        <View style={{ gap: 12 }}>
          {pageItems.length === 0 ? (
            <View style={[card.base, rs.emptyCard]}>
              <Text style={rs.emptyText}>No records match your filters</Text>
            </View>
          ) : (
            pageItems.map((r) => (
              <View key={r.learnerId} style={[card.base, rs.mobileCard]}>
                <View style={rs.mobileTop}>
                  <View style={rs.avatar}>
                    <Text style={rs.avatarText}>{r.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={rs.mobileName} numberOfLines={1}>{r.name}</Text>
                    <Text style={rs.mobileSub}>{r.learnerId}</Text>
                  </View>
                  <ProfilePill profile={r.profile} />
                </View>

                <View style={rs.mobileMeta}>
                  <MiniTag label="Sessions" value={String(r.sessionCount)} />
                  <MiniTag label="Last Session" value={r.lastSessionDate} />
                  <MiniTag label="Road Type" value={r.roadType} />
                </View>

                <View style={rs.mobileScoreRow}>
                  <View style={rs.scoreTrack}>
                    <View
                      style={[
                        rs.scoreFill,
                        {
                          width: `${Math.max(0, Math.min(100, r.score))}%` as any,
                          backgroundColor: scoreColor(r.score),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[rs.scoreNum, { color: scoreColor(r.score), marginLeft: 8 }]}>
                    {r.score}/100
                  </Text>
                  <View
                    style={[
                      rs.outcomePill,
                      { backgroundColor: r.outcome === "Passed" ? colors.darkBtn : colors.red, marginLeft: 8 },
                    ]}
                  >
                    <Text style={rs.outcomeText}>{r.outcome}</Text>
                  </View>
                </View>
              </View>
            ))
          )}

          <View style={[card.base, rs.mobileFooter]}>
            <Text style={rs.footerText}>
              {filtered.length === 0
                ? "No results"
                : `${startIdx + 1}–${endIdx} of ${filtered.length}`}
            </Text>
            <Pagination page={safePage} total={totalPages} onPage={setPageNum} />
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
}) {
  const half = 2;
  let start = Math.max(1, page - half);
  let end   = Math.min(total, start + 4);
  start      = Math.max(1, end - 4);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <View style={rs.pagination}>
      <Pressable
        onPress={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        style={[rs.pageBtn, page === 1 && { opacity: 0.4 }]}
      >
        <Ionicons name="chevron-back" size={14} color={colors.text} />
        <Text style={rs.pageBtnText}>Prev</Text>
      </Pressable>

      {nums.map((n) => (
        <Pressable
          key={n}
          onPress={() => onPage(n)}
          style={[rs.pageNum, n === page && rs.pageNumOn]}
        >
          <Text style={[rs.pageNumText, n === page && rs.pageNumTextOn]}>{n}</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => onPage(Math.min(total, page + 1))}
        disabled={page === total}
        style={[rs.pageBtn, page === total && { opacity: 0.4 }]}
      >
        <Text style={rs.pageBtnText}>Next</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.text} />
      </Pressable>
    </View>
  );
}

// ─── MiniTag ─────────────────────────────────────────────────────────────────

function MiniTag({ label, value }: { label: string; value: string }) {
  return (
    <View style={rs.miniTag}>
      <Text style={rs.miniLabel}>{label}</Text>
      <Text style={rs.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const rs = StyleSheet.create({
  // ── Header
  h1: { fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 13, fontWeight: "600", color: colors.subtext, marginTop: 4 },

  // ── KPI
  kpiStrip: { flexDirection: "column", gap: 10 },
  kpiCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 0,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: colors.subtext },
  kpiValue: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 2 },
  kpiSub:   { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 1 },

  // ── Filters
  filterCard: { padding: 14 },
  filterRow:  { gap: 10, flexDirection: "column" },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignSelf: "flex-start",
  },
  filterBtnText: { fontSize: 13, fontWeight: "800", color: colors.text },

  // ── Table
  tableCard: { padding: 0, overflow: "hidden" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  th: { fontSize: 11, fontWeight: "900", color: colors.subtext, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 13, alignItems: "center" },
  trBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tdCell: {},
  tdText: { fontSize: 13, fontWeight: "700", color: colors.text },
  tdName: { fontSize: 13, fontWeight: "900", color: colors.text },
  tdSub:  { fontSize: 11, fontWeight: "600", color: colors.subtext, marginTop: 1 },

  emptyTable: { paddingVertical: 32, alignItems: "center" },
  emptyCard:  { paddingVertical: 32, alignItems: "center" },
  emptyText:  { fontSize: 13, fontWeight: "700", color: colors.muted },

  tableFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: "wrap",
    gap: 10,
  },
  footerText: { fontSize: 12, fontWeight: "700", color: colors.subtext },

  // ── Avatar
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 13, fontWeight: "900", color: "#4F46E5" },

  // ── Score
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.borderLight, overflow: "hidden" },
  scoreFill:  { height: "100%", borderRadius: 99 },
  scoreNum:   { fontSize: 13, fontWeight: "900", minWidth: 28 },

  // ── Outcome pill
  outcomePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  outcomeText: { fontSize: 11, fontWeight: "900", color: "#FFFFFF" },

  // ── Profile pill
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "800" },

  // ── Mobile cards
  mobileCard: { gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  mobileTop:  { flexDirection: "row", alignItems: "center", gap: 10 },
  mobileName: { fontSize: 14, fontWeight: "900", color: colors.text },
  mobileSub:  { fontSize: 11, fontWeight: "600", color: colors.subtext, marginTop: 1 },
  mobileMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mobileScoreRow: { flexDirection: "row", alignItems: "center" },
  mobileFooter: { padding: 12 },

  // ── MiniTag
  miniTag: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  miniLabel: { fontSize: 10, fontWeight: "800", color: colors.muted },
  miniValue: { fontSize: 12, fontWeight: "900", color: colors.text, marginTop: 2 },

  // ── Pagination
  pagination: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  pageBtnText: { fontSize: 12, fontWeight: "800", color: colors.text },
  pageNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumOn: { backgroundColor: colors.darkBtn, borderColor: colors.darkBtn },
  pageNumText:   { fontSize: 13, fontWeight: "800", color: colors.text },
  pageNumTextOn: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },

  // ── Retry
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.purpleDark,
  },
  retryBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
