import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { apiGet } from "../../lib/api";

type Outcome = "Passed" | "Failed";
type DriverProfile = "Drowsy" | "Aggressive" | "Normal";

type LearnerRecord = {
  id: string;
  learnerId: string;     // trainee_id
  initials: string;
  name: string;
  lastSessionDate: string;
  vehicle: string;
  score: number;
  outcome: Outcome;
  profile: DriverProfile;
};

function initialsFromName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  const out = (a + b).toUpperCase();
  return out || "—";
}

function profileFromLabel(label?: string): DriverProfile {
  const x = (label || "").toLowerCase();
  if (x.includes("drowsy")) return "Drowsy";
  if (x.includes("aggressive")) return "Aggressive";
  return "Normal";
}

export default function RecordsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const PAGE_SIZE = isWide ? 8 : 4;

  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<any[]>([]);
  const [recordsRaw, setRecordsRaw] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"All Outcomes" | Outcome>("All Outcomes");
  const [vehicleFilter, setVehicleFilter] = useState<"All Vehicles" | string>("All Vehicles");
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      const [l, r] = await Promise.all([
        apiGet("/instructor/learners"),
        apiGet("/records"), // ✅ you will add this endpoint
      ]);
      setLearners(Array.isArray(l) ? l : []);
      setRecordsRaw(Array.isArray(r) ? r : []);
    } catch (e: any) {
      setLearners([]);
      setRecordsRaw([]);
      Alert.alert("Records Error", e?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) {
      if (l?.user_id) m[l.user_id] = l?.name || "";
    }
    return m;
  }, [learners]);

  // expected backend records rows shape (recommended):
  // [{ trainee_id, last_session_at, vehicle_id, score, outcome, label }]
  const all: LearnerRecord[] = useMemo(() => {
    return recordsRaw.map((x: any) => {
      const traineeId = x?.trainee_id || x?.learner_id || "";
      const name = nameById[traineeId] || traineeId || "—";
      const score = typeof x?.score === "number" ? x.score : 0;
      const outcome: Outcome = (x?.outcome || (score >= 70 ? "Passed" : "Failed")) as Outcome;
      const vehicle = x?.vehicle_id || "—";
      const last = x?.last_session_at ? new Date(x.last_session_at).toLocaleDateString() : "—";
      const profile = profileFromLabel(x?.label);

      return {
        id: `${traineeId}-${vehicle}-${last}`,
        learnerId: traineeId,
        initials: initialsFromName(name),
        name,
        lastSessionDate: last,
        vehicle,
        score,
        outcome,
        profile,
      };
    });
  }, [recordsRaw, nameById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      const matchesQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.learnerId.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q);

      const matchesOutcome = outcomeFilter === "All Outcomes" || r.outcome === outcomeFilter;
      const matchesVehicle = vehicleFilter === "All Vehicles" || r.vehicle === vehicleFilter;

      return matchesQ && matchesOutcome && matchesVehicle;
    });
  }, [all, search, outcomeFilter, vehicleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, outcomeFilter, vehicleFilter, isWide]);

  // KPI distribution
  const total = all.length;
  const drowsyCount = all.filter((r) => r.profile === "Drowsy").length;
  const aggressiveCount = all.filter((r) => r.profile === "Aggressive").length;
  const normalCount = all.filter((r) => r.profile === "Normal").length;

  const drowsyPct = Math.round((drowsyCount / Math.max(1, total)) * 100);
  const aggressivePct = Math.round((aggressiveCount / Math.max(1, total)) * 100);
  const normalPct = Math.round((normalCount / Math.max(1, total)) * 100);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(filtered.length, startIndex + PAGE_SIZE);
  const pageItems = filtered.slice(startIndex, endIndex);

  const onView = (r: LearnerRecord) => {
    Alert.alert("Report", `Open report for ${r.name} (${r.learnerId})`);
    // later: router.push(`/records/${r.learnerId}`)
  };

  const toggleOutcome = () =>
    setOutcomeFilter((v) => (v === "All Outcomes" ? "Passed" : v === "Passed" ? "Failed" : "All Outcomes"));

  const toggleVehicle = () => {
    // cycle vehicles present in data
    const vehicles = Array.from(new Set(all.map((x) => x.vehicle))).filter(Boolean);
    const opts = ["All Vehicles", ...vehicles];
    const idx = Math.max(0, opts.indexOf(vehicleFilter));
    setVehicleFilter(opts[(idx + 1) % opts.length]);
  };

  const renderPagination = () => {
    const goPrev = () => setPage((p) => Math.max(1, p - 1));
    const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, safePage - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    const nums: number[] = [];
    for (let i = start; i <= end; i++) nums.push(i);

    return (
      <View style={styles.pagination}>
        <Pressable
          onPress={goPrev}
          disabled={safePage === 1}
          style={({ pressed }) => [styles.pageBtn, safePage === 1 ? styles.disabledBtn : null, pressed ? { opacity: 0.9 } : null]}
        >
          <Text style={styles.pageBtnText}>Previous</Text>
        </Pressable>

        {nums.map((n) => (
          <Pressable
            key={n}
            onPress={() => setPage(n)}
            style={({ pressed }) => [styles.pageNum, n === safePage ? styles.pageNumOn : null, pressed ? { opacity: 0.9 } : null]}
          >
            <Text style={n === safePage ? styles.pageNumTextOn : styles.pageNumText}>{n}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={goNext}
          disabled={safePage === totalPages}
          style={({ pressed }) => [styles.pageBtn, safePage === totalPages ? styles.disabledBtn : null, pressed ? { opacity: 0.9 } : null]}
        >
          <Text style={styles.pageBtnText}>Next</Text>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.page, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontWeight: "900", color: "#667085" }}>Loading records…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Learner Records</Text>
      <Text style={styles.h2}>View performance outcomes and session history</Text>

      <View style={[styles.kpiRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
        <KPIPressable
          title="% Drowsy Drivers"
          value={`${drowsyPct}%`}
          sub={`${drowsyCount} learner${drowsyCount === 1 ? "" : "s"}`}
          subColor="#B91C1C"
          icon="😴"
          iconBg="#FEF2F2"
          iconBorder="#FECACA"
          onPress={() => {}}
        />
        <KPIPressable
          title="% Aggressive Drivers"
          value={`${aggressivePct}%`}
          sub={`${aggressiveCount} learner${aggressiveCount === 1 ? "" : "s"}`}
          subColor="#B45309"
          icon="⚡"
          iconBg="#FFFBEB"
          iconBorder="#FDE68A"
          onPress={() => {}}
        />
        <KPIPressable
          title="% Normal Drivers"
          value={`${normalPct}%`}
          sub={`${normalCount} learner${normalCount === 1 ? "" : "s"}`}
          subColor="#16A34A"
          icon="✅"
          iconBg="#DCFCE7"
          iconBorder="#BBF7D0"
          onPress={() => {}}
        />
      </View>

      <View style={styles.filterCard}>
        <View style={[styles.filterRow, isWide ? { flexDirection: "row" } : { flexDirection: "column" }]}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔎</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, ID, or vehicle..."
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
            />
          </View>

          <Pressable onPress={toggleOutcome} style={styles.dropdown}>
            <Text style={styles.dropdownText}>{outcomeFilter}</Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </Pressable>

          <Pressable onPress={toggleVehicle} style={styles.dropdown}>
            <Text style={styles.dropdownText}>{vehicleFilter}</Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </Pressable>
        </View>

        <View style={styles.exportRow}>
          <Pressable style={({ pressed }) => [styles.exportBtn, pressed ? { opacity: 0.9 } : null]} onPress={() => Alert.alert("Export", "Export PDF (needs backend)")} >
            <Text style={styles.exportText}>⬇️  Export PDF</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.exportBtn, pressed ? { opacity: 0.9 } : null]} onPress={() => Alert.alert("Export", "Export CSV (needs backend)")} >
            <Text style={styles.exportText}>⬇️  Export CSV</Text>
          </Pressable>
        </View>
      </View>

      {isWide ? (
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2.2 }]}>Learner Name</Text>
            <Text style={[styles.th, { flex: 1 }]}>ID</Text>
            <Text style={[styles.th, { flex: 1.6 }]}>Last Session Date</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Vehicle</Text>
            <Text style={[styles.th, { flex: 1.8 }]}>Driving Score</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Outcome</Text>
            <Text style={[styles.th, { flex: 1.1, textAlign: "right" }]}>Report</Text>
          </View>

          {pageItems.map((r) => (
            <View key={r.id} style={styles.tr}>
              <View style={[styles.tdCell, { flex: 2.2, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{r.initials}</Text>
                </View>
                <Text style={styles.nameText} numberOfLines={1}>{r.name}</Text>
              </View>

              <Text style={[styles.tdText, { flex: 1 }]}>{r.learnerId}</Text>
              <Text style={[styles.tdText, { flex: 1.6 }]}>{r.lastSessionDate}</Text>
              <Text style={[styles.tdText, { flex: 1.2 }]}>{r.vehicle}</Text>

              <View style={[styles.tdCell, { flex: 1.8 }]}>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreTrack}>
                    <View
                      style={[
                        styles.scoreFill,
                        {
                          width: `${Math.max(0, Math.min(100, r.score))}%`,
                          backgroundColor: r.score >= 70 ? "#22C55E" : "#EF4444",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.scoreText}>{r.score}%</Text>
                </View>
              </View>

              <View style={[styles.tdCell, { flex: 1.2 }]}>
                <View style={[styles.outcomePill, r.outcome === "Passed" ? styles.passPill : styles.failPill]}>
                  <Text style={styles.outcomeText}>{r.outcome}</Text>
                </View>
              </View>

              <View style={[styles.tdCell, { flex: 1.1, alignItems: "flex-end" }]}>
                <Pressable style={({ pressed }) => [styles.viewBtn, pressed ? { opacity: 0.9 } : null]} onPress={() => onView(r)}>
                  <Text style={styles.viewBtnText}>📄  View</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.tableFooter}>
            <Text style={styles.footerText}>
              Showing {filtered.length === 0 ? 0 : startIndex + 1} to {endIndex} of {filtered.length} results
            </Text>
            {renderPagination()}
          </View>
        </View>
      ) : (
        <View style={styles.mobileListWrap}>
          {pageItems.map((r) => (
            <View key={r.id} style={styles.mobileCard}>
              <View style={styles.mobileTopRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{r.initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.mobileName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.mobileSub} numberOfLines={1}>{r.learnerId} • {r.lastSessionDate}</Text>
                </View>

                <View style={[styles.outcomePill, r.outcome === "Passed" ? styles.passPill : styles.failPill]}>
                  <Text style={styles.outcomeText}>{r.outcome}</Text>
                </View>
              </View>

              <View style={styles.mobileMidRow}>
                <MiniTag label="Vehicle" value={r.vehicle} />
                <MiniTag label="Score" value={`${r.score}%`} />
              </View>

              <View style={styles.mobileScoreRow}>
                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${Math.max(0, Math.min(100, r.score))}%`,
                        backgroundColor: r.score >= 70 ? "#22C55E" : "#EF4444",
                      },
                    ]}
                  />
                </View>

                <Pressable style={({ pressed }) => [styles.mobileViewBtn, pressed ? { opacity: 0.9 } : null]} onPress={() => onView(r)}>
                  <Text style={styles.mobileViewText}>📄 View</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.mobileFooter}>
            <Text style={styles.footerText}>
              Showing {filtered.length === 0 ? 0 : startIndex + 1} to {endIndex} of {filtered.length} results
            </Text>
            {renderPagination()}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function KPIPressable({
  title, value, sub, subColor, icon, iconBg, iconBorder, onPress,
}: {
  title: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: string;
  iconBg: string;
  iconBorder: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.kpiCard, pressed ? { opacity: 0.92 } : null]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiTitle}>{title}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 }}>
          <Text style={styles.kpiValue}>{value}</Text>
          {sub ? <Text style={[styles.kpiSub, { color: subColor || "#667085" }]}>{sub}</Text> : null}
        </View>
      </View>

      <View style={[styles.kpiIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
    </Pressable>
  );
}

function MiniTag({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniTag}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 26 },

  h1: { color: "#101828", fontWeight: "900", fontSize: 20 },
  h2: { marginTop: 6, color: "#667085", fontWeight: "700", fontSize: 12, marginBottom: 14 },

  kpiRow: { gap: 12, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 76 },
  kpiTitle: { color: "#667085", fontWeight: "800", fontSize: 12 },
  kpiValue: { color: "#101828", fontWeight: "900", fontSize: 20 },
  kpiSub: { fontWeight: "900", fontSize: 12 },
  kpiIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  filterCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 12, marginBottom: 14 },
  filterRow: { gap: 10 },

  searchWrap: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 14, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: "#101828", fontWeight: "700" },

  dropdown: { minHeight: 46, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#F9FAFB", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownText: { color: "#101828", fontWeight: "800", fontSize: 12 },
  dropdownCaret: { color: "#667085", fontWeight: "900" },

  exportRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  exportBtn: { borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#FFFFFF", paddingVertical: 10, paddingHorizontal: 12 },
  exportText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  tableCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, overflow: "hidden" },
  tableHeader: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EAECF0", backgroundColor: "#FFFFFF" },
  th: { color: "#667085", fontWeight: "900", fontSize: 11 },

  tr: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F7", alignItems: "center" },
  tdCell: {},
  tdText: { color: "#101828", fontWeight: "800", fontSize: 12 },

  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 12 },
  nameText: { color: "#101828", fontWeight: "900", fontSize: 12, maxWidth: 220 },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: "#E2E8F0", overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 99 },
  scoreText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  outcomePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" },
  passPill: { backgroundColor: "#0B1220" },
  failPill: { backgroundColor: "#E11D48" },
  outcomeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },

  viewBtn: { borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#FFFFFF", paddingVertical: 8, paddingHorizontal: 10 },
  viewBtnText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  tableFooter: { paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  footerText: { color: "#667085", fontWeight: "800", fontSize: 12 },

  mobileListWrap: { gap: 12 },
  mobileCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 12 },
  mobileTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mobileName: { color: "#101828", fontWeight: "900", fontSize: 14 },
  mobileSub: { marginTop: 2, color: "#667085", fontWeight: "800", fontSize: 12 },

  mobileMidRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  miniTag: { flexGrow: 1, minWidth: 110, borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#F9FAFB", paddingVertical: 8, paddingHorizontal: 10 },
  miniLabel: { color: "#667085", fontWeight: "900", fontSize: 10 },
  miniValue: { marginTop: 3, color: "#101828", fontWeight: "900", fontSize: 12 },

  mobileScoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  mobileViewBtn: { borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#FFFFFF", paddingVertical: 10, paddingHorizontal: 12 },
  mobileViewText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  mobileFooter: { marginTop: 2, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 12 },

  pagination: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  pageBtn: { borderRadius: 10, borderWidth: 1, borderColor: "#EAECF0", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  pageBtnText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  pageNum: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: "#EAECF0", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pageNumOn: { backgroundColor: "#0B1220", borderColor: "#0B1220" },
  pageNumText: { color: "#101828", fontWeight: "900", fontSize: 12 },
  pageNumTextOn: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },

  disabledBtn: { opacity: 0.45 },
});
