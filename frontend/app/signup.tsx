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
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

import { apiPost } from "../lib/api";
import { setToken } from "../lib/token";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Role = "student" | "instructor";

function isValidMobile(input: string) {
  const cleaned = input.trim();
  if (!cleaned) return false;

  const digitsOnly = cleaned.replace(/^\+/, "").replace(/\D/g, "");
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return false;

  return /^\+?\d+$/.test(cleaned);
}

function isValidEmail(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignupScreen() {
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  // Student fields
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [mobile, setMobile] = useState("");

  // Instructor fields
  const [email, setEmail] = useState("");
  const [instructorCode, setInstructorCode] = useState("");

  // Shared fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Track touched fields
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const studentMobileOk = useMemo(() => isValidMobile(mobile), [mobile]);
  const studentEmailOk = useMemo(() => isValidEmail(studentEmail), [studentEmail]);
  const instructorEmailOk = useMemo(() => isValidEmail(email), [email]);
  const instructorCodeOk = useMemo(() => instructorCode.trim().length >= 4, [instructorCode]);

  const passwordLengthOk = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const validationItems = useMemo(() => {
    if (role === "student") {
      return [
        { label: "Full name (2+ chars)",  ok: name.trim().length >= 2 },
        { label: "Valid email",            ok: studentEmailOk },
        { label: "Valid mobile number",    ok: studentMobileOk },
        { label: "Password (min 6 chars)", ok: passwordLengthOk },
        { label: "Passwords match",        ok: passwordsMatch },
      ];
    }
    return [
      { label: "Valid instructor email",     ok: instructorEmailOk },
      { label: "Instructor code (4+ chars)", ok: instructorCodeOk },
      { label: "Password (min 6 chars)",     ok: passwordLengthOk },
      { label: "Passwords match",            ok: passwordsMatch },
    ];
  }, [role, name, studentEmailOk, studentMobileOk, instructorEmailOk, instructorCodeOk, passwordLengthOk, passwordsMatch]);

  const canSignup = useMemo(() => validationItems.every((v) => v.ok), [validationItems]);

  const onSignup = async () => {
    console.log("[Signup] onSignup fired. canSignup:", canSignup);

    if (!canSignup) {
      const failing = validationItems.filter((v) => !v.ok).map((v) => `• ${v.label}`).join("\n");
      Alert.alert("Please fix the following", failing);
      return;
    }

    try {
      setLoading(true);
      const isStudent = role === "student";
      const backendRole = isStudent ? "trainee" : "instructor";

      const payload: any = {
        name: isStudent ? name.trim() : email.trim().split("@")[0] || "Instructor",
        email: (isStudent ? studentEmail : email).trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
        role: backendRole,
        mobile: isStudent ? mobile.trim() : undefined,
      };

      if (!isStudent) {
        payload.institute_code = instructorCode.trim();
      }

      console.log("[Signup] Sending payload:", JSON.stringify(payload));
      const res = await apiPost("/auth/register", payload);
      console.log("[Signup] Response:", JSON.stringify(res));

      if (res?.access_token) {
        await setToken(res.access_token);
        const savedName = isStudent ? name.trim() : email.trim().split("@")[0];
        await AsyncStorage.setItem("driveiq_user_name", savedName);
        await AsyncStorage.setItem("driveiq_user_email", (isStudent ? studentEmail : email).trim().toLowerCase());
        if (isStudent) {
          await AsyncStorage.setItem("driveiq_user_mobile", mobile.trim());
        }
      }

      router.push({ pathname: "/consent", params: { role } });
    } catch (e: any) {
      console.error("[Signup] Error:", e);
      Alert.alert("Signup failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>DI</Text>
          </View>
        </View>

        <Text style={styles.h1}>Create Account</Text>
        <Text style={styles.h2}>Sign up to start using DriveIQ</Text>

        <View style={styles.card}>
          <Text style={styles.roleLabel}>Choose Role</Text>

          <View style={styles.rolePills}>
            <Pressable
              onPress={() => setRole("student")}
              style={[styles.rolePill, role === "student" && styles.rolePillActive]}
            >
              <Text style={[styles.rolePillText, role === "student" && styles.rolePillTextActive]}>
                Student
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRole("instructor")}
              style={[styles.rolePill, role === "instructor" && styles.rolePillActive]}
            >
              <Text
                style={[
                  styles.rolePillText,
                  role === "instructor" && styles.rolePillTextActive,
                ]}
              >
                Instructor
              </Text>
            </Pressable>
          </View>

          {role === "student" ? (
            <>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrap, touched.name && name.trim().length < 2 && styles.inputError]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={() => touch("name")}
                  placeholder="Enter your full name"
                  placeholderTextColor="#98A2B3"
                  style={styles.input}
                />
                {touched.name && (name.trim().length >= 2 ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
              <View style={[styles.inputWrap, touched.studentEmail && !studentEmailOk && styles.inputError]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  value={studentEmail}
                  onChangeText={setStudentEmail}
                  onBlur={() => touch("studentEmail")}
                  placeholder="Enter your email"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                {touched.studentEmail && (studentEmailOk ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Mobile Number</Text>
              <View style={[styles.inputWrap, touched.mobile && !studentMobileOk && styles.inputError]}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  value={mobile}
                  onChangeText={setMobile}
                  onBlur={() => touch("mobile")}
                  placeholder="Enter your mobile number (e.g. +971501234567)"
                  placeholderTextColor="#98A2B3"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                {touched.mobile && (studentMobileOk ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Instructor Email</Text>
              <View style={[styles.inputWrap, touched.email && !instructorEmailOk && styles.inputError]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() => touch("email")}
                  placeholder="Enter instructor email"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                {touched.email && (instructorEmailOk ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Instructor Code</Text>
              <View style={[styles.inputWrap, touched.instructorCode && !instructorCodeOk && styles.inputError]}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  value={instructorCode}
                  onChangeText={setInstructorCode}
                  onBlur={() => touch("instructorCode")}
                  placeholder="Enter the code provided by the company"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="characters"
                  style={styles.input}
                />
                {touched.instructorCode && (instructorCodeOk ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
              </View>
            </>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={[styles.inputWrap, touched.password && !passwordLengthOk && styles.inputError]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => touch("password")}
              placeholder="Create a password (min 6 chars)"
              placeholderTextColor="#98A2B3"
              secureTextEntry
              style={styles.input}
            />
            {touched.password && (passwordLengthOk ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
          <View style={[styles.inputWrap, touched.confirmPassword && !passwordsMatch && styles.inputError]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() => touch("confirmPassword")}
              placeholder="Confirm password"
              placeholderTextColor="#98A2B3"
              secureTextEntry
              style={styles.input}
            />
            {touched.confirmPassword && (passwordsMatch ? <Text style={styles.checkIcon}>✓</Text> : <Text style={styles.crossIcon}>✗</Text>)}
          </View>

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          {/* Validation summary */}
          <View style={styles.validationBox}>
            <Text style={styles.validationTitle}>Requirements</Text>
            {validationItems.map((item, i) => (
              <View key={i} style={styles.validationRow}>
                <Text style={item.ok ? styles.validationCheck : styles.validationCross}>
                  {item.ok ? "✓" : "○"}
                </Text>
                <Text style={[styles.validationLabel, item.ok && styles.validationLabelDone]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onSignup}
            disabled={loading}
            style={({ pressed }) => [
              styles.signupBtn,
              !canSignup && styles.signupBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupBtnText}>
                {role === "instructor" ? "Create Instructor Account" : "Create Account"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>© 2025 DriveIQ. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  page: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: "center",
  },

  logoWrap: { marginBottom: 10 },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 18, fontWeight: "900" },

  h1: { fontSize: 18, fontWeight: "800", color: "#101828" },
  h2: {
    fontSize: 13,
    color: "#667085",
    marginTop: 6,
    marginBottom: 14,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    ...Platform.select({
      ios: {
        shadowColor: "#101828",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },

  roleLabel: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  rolePills: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  rolePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  rolePillActive: {
    backgroundColor: "#0B1220",
    borderColor: "#0B1220",
  },
  rolePillText: { fontWeight: "900", fontSize: 12, color: "#101828" },
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
  inputError: { borderColor: "#FCA5A5", backgroundColor: "#FFF5F5" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: "#101828", fontSize: 14 },
  checkIcon: { color: "#16A34A", fontWeight: "900", fontSize: 14 },
  crossIcon: { color: "#DC2626", fontWeight: "900", fontSize: 14 },

  errorText: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "700",
  },

  signupBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0B1220",
  },
  signupBtnDisabled: { backgroundColor: "#6B7280" },
  signupBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  validationBox: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    backgroundColor: "#F5F8FF",
    padding: 12,
    gap: 6,
  },
  validationTitle: { fontSize: 11, fontWeight: "900", color: "#344054", marginBottom: 4 },
  validationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  validationCheck: { fontSize: 13, color: "#16A34A", fontWeight: "900", width: 16 },
  validationCross: { fontSize: 13, color: "#9CA3AF", fontWeight: "900", width: 16 },
  validationLabel: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  validationLabelDone: { color: "#16A34A" },

  linkBtn: { marginTop: 14, alignItems: "center" },
  linkText: { color: "#475467", fontSize: 12, fontWeight: "700" },

  footer: {
    marginTop: 16,
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "700",
  },
});
