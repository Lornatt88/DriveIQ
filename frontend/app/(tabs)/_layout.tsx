import React from "react";
import { View, StyleSheet, Pressable, Text, useWindowDimensions } from "react-native";
import { Tabs, router } from "expo-router";
import InstructorSidebar from "../components/InstructorSidebar";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isPhone = width < 900;

  const phoneHeaderRight = () =>
    isPhone ? (
      <Pressable onPress={() => router.push("/sidebar")} style={styles.headerBtn}>
        <Text style={styles.headerBtnText}>☰</Text>
      </Pressable>
    ) : null;

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <Tabs
          screenOptions={{
            headerShown: true,
            headerRight: phoneHeaderRight,
            tabBarActiveTintColor: "#0B1220",
          }}
        >
          <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
          <Tabs.Screen name="sessions" options={{ title: "Sessions" }} />
          <Tabs.Screen name="records" options={{ title: "Records" }} />
          <Tabs.Screen name="settings" options={{ title: "Settings" }} />
        </Tabs>
      </View>

      {/* Right sidebar only on big screens */}
      {!isPhone ? (
        <View style={styles.sidebar}>
          <InstructorSidebar />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#F5F7FB" },
  main: { flex: 1 },
  sidebar: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderLeftColor: "#EAECF0",
  },
  headerBtn: { marginRight: 14, padding: 6 },
  headerBtnText: { fontSize: 18, fontWeight: "900", color: "#0B1220" },
});
