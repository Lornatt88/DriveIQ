import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LessonScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lesson</Text>
      <Text style={styles.sub}>This is a placeholder lesson screen.</Text>

      <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220", padding: 24, paddingTop: 64 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub: { marginTop: 10, color: "#9aa7bf", fontSize: 14, fontWeight: "700" },
  btn: { marginTop: 18, backgroundColor: "#38bdf8", padding: 14, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#001018", fontWeight: "900", fontSize: 16 },
});
