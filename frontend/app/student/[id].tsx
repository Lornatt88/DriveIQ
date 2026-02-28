import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

type StudentStatus = "Active" | "Completed" | "Scheduled";

const STATUS_COLOR: Record<StudentStatus, string> = {
  Active: "#22C55E",
  Completed: "#94A3B8",
  Scheduled: "#60A5FA",
};

// Temporary mock (until backend connects)
const MOCK_STUDENTS: Record<
  string,
  { id: string; initials: string; name: string; status: StudentStatus }
> = {
  s1: { id: "s1", initials: "SM", name: "Sarah Mitchell", status: "Active" },
  s2: { id: "s2", initials: "MC", name: "Michael Chen", status: "Completed" },
  s3: { id: "s3", initials: "ER", name: "Emma Rodriguez", status: "Scheduled" },
  s4: { id: "s4", initials: "JW", name: "James Wilson", status: "Active" },
  s5: { id: "s5", initials: "OT", name: "Olivia Taylor", status: "Completed" },
};

export default function StudentProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const student = useMemo(() => {
    if (!id) return null;
    return MOCK_STUDENTS[String(id)] ?? null;
  }, [id]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Student Profile</Text>
        <Text style={styles.subTitle}>ID: {String(id ?? "")}</Text>
      </View>

      {student ? (
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{student.initials}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{student.name}</Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: STATUS_COLOR[student.status] },
                  ]}
                />
                <Text style={styles.statusText}>{student.status}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Last Session</Text>
              <Text style={styles.kValue}>Not connected</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Average Score</Text>
              <Text style={styles.kValue}>Not connected</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Notes</Text>
              <Text style={styles.kValue}>Not connected</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>

            <Pressable style={styles.actionBtn}>
              <Text style={styles.actionText}>Start Session (mock)</Text>
            </Pressable>

            <Pressable style={[styles.actionBtn, { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }]}>
              <Text style={[styles.actionText, { color: "#0B1220" }]}>View Full History (mock)</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Student not found</Text>
          <Text style={styles.emptyText}>
            This ID does not exist in mock data yet.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 28 },

  header: {
    paddingVertical: 10,
    marginBottom: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4, alignSelf: "flex-start" },
  backText: { color: "#2563EB", fontWeight: "900", fontSize: 13 },

  title: { color: "#0B1220", fontWeight: "900", fontSize: 22, marginTop: 8 },
  subTitle: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 6 },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },

  topRow: { flexDirection: "row", alignItems: "center" },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 16 },

  name: { color: "#101828", fontWeight: "900", fontSize: 16 },

  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: "#667085", fontWeight: "800", fontSize: 12 },

  section: { marginTop: 16 },
  sectionTitle: { color: "#101828", fontWeight: "900", fontSize: 13, marginBottom: 10 },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F4F7",
  },
  kLabel: { color: "#667085", fontWeight: "800", fontSize: 12 },
  kValue: { color: "#101828", fontWeight: "900", fontSize: 12 },

  actionBtn: {
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#0B1220",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    alignItems: "center",
  },
  actionText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },

  empty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },
  emptyTitle: { color: "#101828", fontWeight: "900", fontSize: 14 },
  emptyText: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 6 },
});
