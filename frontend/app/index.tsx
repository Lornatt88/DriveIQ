import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";

import { apiPost, apiGet } from "../lib/api";
import { setToken } from "../lib/token";
import { API_BASE_URL } from "../lib/config";

type Role = "trainee" | "instructor";

export default function LoginScreen() {
  const [roleUI, setRoleUI] = useState<"student" | "instructor">("instructor");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const canLogin = useMemo(() => {
    return identifier.trim().length > 0 && password.trim().length > 0;
  }, [identifier, password]);

  const loginLabel =
    roleUI === "instructor" ? "Log In as Instructor" : "Log In as Student";

  const testBackend = async () => {
    try {
      const res = await apiGet("/health", { auth: false });
      Alert.alert(
        "Backend test ✅",
        `API_BASE_URL:\n${API_BASE_URL}\n\nResponse:\n${JSON.stringify(res)}`
      );
    } catch (e: any) {
      Alert.alert(
        "Backend test failed ❌",
        `API_BASE_URL:\n${API_BASE_URL}\n\nError:\n${e?.message || "Unknown"}`
      );
    }
  };

  const onLogin = async () => {
    if (!canLogin) return;

    try {
      const res = await apiPost("/auth/login", {
        email: identifier.trim().toLowerCase(),
        password,
      });

      await setToken(res.access_token);

      const backendRole: Role = res.user?.role;

      if (backendRole === "instructor") {
        router.replace("/(tabs)/dashboard");
      } else {
        router.replace("/(studenttabs)/dashboard");
      }
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Login failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>DI</Text>
          </View>
        </View>

        <Text style={styles.h1}>Welcome to DriveIQ</Text>
        <Text style={styles.h2}>Log in to access your dashboard</Text>

        <View style={styles.card}>
          <Text style={styles.roleLabel}>Choose Role</Text>
          <View style={styles.rolePills}>
            <Pressable
              onPress={() => setRoleUI("student")}
              style={[
                styles.rolePill,
                roleUI === "student" && styles.rolePillActive,
              ]}
            >
              <Text
                style={[
                  styles.rolePillText,
                  roleUI === "student" && styles.rolePillTextActive,
                ]}
              >
                Student
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRoleUI("instructor")}
              style={[
                styles.rolePill,
                roleUI === "instructor" && styles.rolePillActive,
              ]}
            >
              <Text
                style={[
                  styles.rolePillText,
                  roleUI === "instructor" && styles.rolePillTextActive,
                ]}
              >
                Instructor
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Enter your email"
              placeholderTextColor="#98A2B3"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#98A2B3"
              secureTextEntry
              style={styles.input}
            />
          </View>

          <View style={styles.rememberRow}>
            <Pressable
              onPress={() => setRemember((v) => !v)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>
          </View>

          <Pressable
            disabled={!canLogin}
            onPress={onLogin}
            style={[styles.loginBtn, !canLogin && styles.loginBtnDisabled]}
          >
            <Text style={styles.loginBtnText}>{loginLabel}</Text>
          </Pressable>

          {/* ✅ REGISTER BUTTON — THIS WAS MISSING */}
          <Pressable
            onPress={() => router.push("/signup")}
            style={styles.registerBtn}
          >
            <Text style={styles.registerText}>
              Don’t have an account? Register
            </Text>
          </Pressable>

          <Pressable onPress={testBackend} style={styles.testBtn}>
            <Text style={styles.testBtnText}>Test Backend Connection</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>©️ 2025 DriveIQ. All rights reserved.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    alignItems: "center",
  },
  logoWrap: { marginTop: 10, marginBottom: 10 },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  h1: { fontSize: 18, fontWeight: "800", color: "#101828", marginTop: 6 },
  h2: { fontSize: 13, color: "#667085", marginTop: 6, marginBottom: 14 },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },

  roleLabel: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  rolePills: { flexDirection: "row", gap: 10, marginBottom: 12 },
  rolePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  rolePillActive: { backgroundColor: "#0B1220", borderColor: "#0B1220" },
  rolePillText: { fontWeight: "900", fontSize: 12 },
  rolePillTextActive: { color: "#fff" },

  label: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1 },

  rememberRow: { marginTop: 12, marginBottom: 14 },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#D0D5DD",
    marginRight: 8,
  },
  checkboxOn: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  checkMark: { color: "#fff", fontSize: 12 },

  rememberText: { fontSize: 12 },

  loginBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0B1220",
  },
  loginBtnDisabled: { opacity: 0.45 },
  loginBtnText: { color: "#fff", fontWeight: "900" },

  registerBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  registerText: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
  },

  testBtn: { marginTop: 10, alignItems: "center" },
  testBtnText: { color: "#2563EB", fontWeight: "800", fontSize: 12 },

  footer: { marginTop: 16, color: "#98A2B3", fontSize: 11 },
});