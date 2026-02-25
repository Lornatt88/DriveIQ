import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

type StudentStatus = "Active" | "Completed" | "Scheduled";

type Student = {
  id: string;
  initials: string;
  name: string;
  status: StudentStatus;
};

type HistoryItem = {
  id: string;
  name: string;
  timeLabel: string;
  score: number;
};

type NotificationItem = {
  id: string;
  title: string;
  timeLabel: string;
  isNew?: boolean;
};

const STATUS_COLOR: Record<StudentStatus, string> = {
  Active: "#22C55E",
  Completed: "#94A3B8",
  Scheduled: "#60A5FA",
};

export default function InstructorSidebar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const students: Student[] = [
    { id: "s1", initials: "SM", name: "Sarah Mitchell", status: "Active" },
    { id: "s2", initials: "MC", name: "Michael Chen", status: "Completed" },
    { id: "s3", initials: "ER", name: "Emma Rodriguez", status: "Scheduled" },
    { id: "s4", initials: "JW", name: "James Wilson", status: "Active" },
    { id: "s5", initials: "OT", name: "Olivia Taylor", status: "Completed" },
  ];

  const sessionHistory: HistoryItem[] = [
    { id: "h1", name: "Sarah Mitchell", timeLabel: "Today, 2:15 PM", score: 82 },
    { id: "h2", name: "Michael Chen", timeLabel: "Today, 11:30 AM", score: 76 },
    { id: "h3", name: "Emma Rodriguez", timeLabel: "Yesterday, 4:00 PM", score: 88 },
  ];

  // ✅ Make notifications stateful so we can mark them as read
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: "n1", title: "Report ready for Student A", timeLabel: "5 min ago", isNew: true },
    { id: "n2", title: "Session scheduled for 3:30 PM", timeLabel: "1 hour ago", isNew: true },
    { id: "n3", title: "Vehicle VEH-2847 maintenance due", timeLabel: "2 hours ago", isNew: false },
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, students]);

  const newCount = useMemo(
    () => notifications.filter((n) => n.isNew).length,
    [notifications]
  );

  const openNotification = (id: string) => {
    // ✅ mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isNew: false } : n))
    );

    // ✅ open details screen
    router.push(`/notification/${id}`);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.wrap}>
        <Text style={styles.sidebarTitle}>Sidebar</Text>

        {/* Student List */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Student List</Text>

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

          <View style={{ marginTop: 10 }}>
            {filtered.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/student/${s.id}`)}
                style={({ pressed }) => [
                  styles.studentRow,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{s.initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{s.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s.status] }]} />
                    <Text style={styles.studentStatus}>{s.status}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Session History */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Session History</Text>

          <View style={{ marginTop: 10 }}>
            {sessionHistory.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{h.name}</Text>
                  <Text style={styles.historyTime}>{h.timeLabel}</Text>
                </View>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillText}>{h.score}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.block}>
          <View style={styles.notifHeader}>
            <Text style={styles.blockTitle}>Notifications</Text>
            {newCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{newCount}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 10 }}>
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => openNotification(n.id)}
                style={({ pressed }) => [
                  styles.notifCard,
                  n.isNew && styles.notifCardNew,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  {n.isNew ? <View style={styles.newDot} /> : null}
                </View>
                <Text style={styles.notifTime}>{n.timeLabel}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  wrap: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },
  sidebarTitle: { color: "#101828", fontWeight: "900", fontSize: 13, marginBottom: 10 },

  block: { marginTop: 12 },
  blockTitle: { color: "#101828", fontWeight: "900", fontSize: 13 },

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
  searchIcon: { marginRight: 8, fontSize: 14 },
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#4F46E5", fontWeight: "900" },
  studentName: { color: "#101828", fontWeight: "800", fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
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
  historyName: { color: "#101828", fontWeight: "800", fontSize: 13 },
  historyTime: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 4 },
  scorePill: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#EAECF0",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  scorePillText: { color: "#101828", fontWeight: "900", fontSize: 12 },

  notifHeader: { flexDirection: "row", alignItems: "center" },
  badge: {
    marginLeft: 8,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  notifCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  // subtle emphasis for new notifications
  notifCardNew: {
    borderColor: "#93C5FD",
    backgroundColor: "#EAF2FF",
  },
  notifTitle: { color: "#0F172A", fontWeight: "800", fontSize: 12, flex: 1 },
  notifTime: { color: "#64748B", fontWeight: "700", fontSize: 11, marginTop: 6 },

  // little dot on the right of title when new
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginLeft: 8,
  },
});
