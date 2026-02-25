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

import { apiPost } from "../lib/api";
import { setToken } from "../lib/token";

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

  const studentMobileOk = useMemo(() => isValidMobile(mobile), [mobile]);
  const studentEmailOk = useMemo(() => isValidEmail(studentEmail), [studentEmail]);
  const instructorEmailOk = useMemo(() => isValidEmail(email), [email]);
  const instructorCodeOk = useMemo(() => instructorCode.trim().length >= 4, [instructorCode]);

  const passwordsOk = useMemo(() => {
    return password.length >= 6 && password === confirmPassword;
  }, [password, confirmPassword]);

  const canSignup = useMemo(() => {
    if (!passwordsOk) return false;

    if (role === "student") {
      return studentMobileOk && name.trim().length >= 2 && studentEmailOk;
    }
    return instructorEmailOk && instructorCodeOk;
  }, [
    role,
    passwordsOk,
    studentMobileOk,
    name,
    studentEmailOk,
    instructorEmailOk,
    instructorCodeOk,
  ]);

  const onSignup = async () => {
    if (!canSignup) return;

    try {
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

      // ✅ FIX: apiPost second argument MUST be the JSON body directly
      const res = await apiPost("/auth/register", payload);

      if (res?.access_token) {
        await setToken(res.access_token);
      }

      router.push({
        pathname: "/consent",
        params: { role },
      });
    } catch (e: any) {
      Alert.alert("Signup failed", e?.message || "Signup failed");
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
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#98A2B3"
                  style={styles.input}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  value={studentEmail}
                  onChangeText={setStudentEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              {!studentEmailOk && studentEmail.trim().length > 0 && (
                <Text style={styles.errorText}>Please enter a valid email.</Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Mobile Number</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter your mobile number (e.g. +971501234567)"
                  placeholderTextColor="#98A2B3"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>

              {!studentMobileOk && mobile.trim().length > 0 && (
                <Text style={styles.errorText}>
                  Please enter a valid mobile number (8–15 digits).
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Instructor Email</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter instructor email"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              {!instructorEmailOk && email.trim().length > 0 && (
                <Text style={styles.errorText}>Please enter a valid email.</Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Instructor Code</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  value={instructorCode}
                  onChangeText={setInstructorCode}
                  placeholder="Enter the code provided by the company"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </View>

              {!instructorCodeOk && instructorCode.trim().length > 0 && (
                <Text style={styles.errorText}>Instructor code is required.</Text>
              )}
            </>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password (min 6 chars)"
              placeholderTextColor="#98A2B3"
              secureTextEntry
              style={styles.input}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor="#98A2B3"
              secureTextEntry
              style={styles.input}
            />
          </View>

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          <Pressable
            disabled={!canSignup}
            onPress={onSignup}
            style={[styles.signupBtn, !canSignup && { opacity: 0.45 }]}
          >
            <Text style={styles.signupBtnText}>
              {role === "instructor" ? "Create Instructor Account" : "Create Account"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>© 2025 DriveIQ. All rights reserved.</Text>
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
  inputIcon: { marginRight: 8 },
  input: { flex: 1, color: "#101828", fontSize: 14 },

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
  signupBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  linkBtn: { marginTop: 14, alignItems: "center" },
  linkText: { color: "#475467", fontSize: 12, fontWeight: "700" },

  footer: {
    marginTop: 16,
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "700",
  },
});
