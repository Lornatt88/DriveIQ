import React from "react";
import { SafeAreaView, View, StyleSheet, Pressable, Text } from "react-native";
import { router } from "expo-router";
import InstructorSidebar from "./components/InstructorSidebar";

export default function SidebarScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.title}>Menu</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        <InstructorSidebar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  top: {
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 18, fontWeight: "900" },
  title: { fontSize: 14, fontWeight: "900", color: "#0B1220" },
  body: { flex: 1, padding: 12 },
});
