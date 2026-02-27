import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { router, usePathname, useSegments } from "expo-router";
import { Slot } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken } from "../../lib/token";

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { name: "dashboard", label: "Dashboard", icon: "⊞" },
  { name: "sessions",  label: "Sessions",  icon: "◷" },
  { name: "reports",   label: "Reports",   icon: "▤"  },
  { name: "profile",   label: "Profile",   icon: "○"  },
  { name: "settings",  label: "Settings",  icon: "⚙"  },
] as const;

type TabName = typeof TABS[number]["name"];

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function StudentTabsLayout() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [avatarLetter, setAvatarLetter] = useState("S");

  useEffect(() => {
    AsyncStorage.getItem("driveiq_user_name").then((name) => {
      if (name) {
        setUserName(name);
        setAvatarLetter(name.charAt(0).toUpperCase());
      }
    });
  }, []);

  // Derive active tab from current path
  const activeTab: TabName =
    (TABS.find((t) => pathname.includes(t.name))?.name as TabName) ?? "dashboard";

  const navigate = (tab: TabName) => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
    router.push(`/(studenttabs)/${tab}` as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Top Nav Bar ─────────────────────────────────────────────────── */}
      <View style={s.navbar}>

        {/* Logo */}
        <Pressable onPress={() => navigate("dashboard")} style={s.logoWrap}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>DI</Text>
          </View>
          <Text style={s.logoLabel}>DriveIQ</Text>
        </Pressable>

        {/* Desktop tabs (shown when wide enough) */}
        <View style={s.tabsRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.name;
            return (
              <Pressable
                key={tab.name}
                onPress={() => navigate(tab.name)}
                style={({ pressed }) => [
                  s.tab,
                  active && s.tabActive,
                  pressed && s.tabPressed,
                ]}
              >
                <Text style={[s.tabIcon, active && s.tabIconActive]}>
                  {tab.icon}
                </Text>
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* User avatar + dropdown */}
        <View style={{ position: "relative" }}>
          <Pressable style={s.userWrap} onPress={() => setUserDropdownOpen((v) => !v)}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{avatarLetter}</Text>
            </View>
            <Text style={s.userName}>{userName}</Text>
            <Text style={s.chevron}>⌄</Text>
          </Pressable>

          {userDropdownOpen && (
            <View style={s.userDropdown}>
              {[
                { label: "My Account",    action: () => navigate("profile") },
                { label: "Profile",       action: () => navigate("profile") },
                { label: "Settings",      action: () => navigate("settings") },
                { label: "Help & Support",action: () => {} },
                { label: "Sign Out",      action: async () => {
                    await clearToken();
                    await AsyncStorage.removeItem("driveiq_user_name");
                    await AsyncStorage.removeItem("driveiq_user_email");
                    await AsyncStorage.removeItem("driveiq_user_mobile");
                    router.replace("/");
                  }
                },
              ].map((item, i, arr) => (
                <Pressable
                  key={item.label}
                  onPress={() => { setUserDropdownOpen(false); item.action(); }}
                  style={({ pressed }) => [
                    s.userDropdownItem,
                    i < arr.length - 1 && s.userDropdownItemBorder,
                    item.label === "Sign Out" && s.userDropdownSignOut,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[
                    s.userDropdownText,
                    item.label === "Sign Out" && s.userDropdownSignOutText,
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Mobile hamburger */}
        <Pressable style={s.hamburger} onPress={() => setMenuOpen(true)}>
          <View style={s.hamburgerLine} />
          <View style={s.hamburgerLine} />
          <View style={s.hamburgerLine} />
        </Pressable>
      </View>

      {/* ── Mobile Dropdown Menu ─────────────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setMenuOpen(false)}>
          <View style={s.dropdown}>
            {TABS.map((tab) => {
              const active = activeTab === tab.name;
              return (
                <Pressable
                  key={tab.name}
                  onPress={() => navigate(tab.name)}
                  style={[s.dropdownItem, active && s.dropdownItemActive]}
                >
                  <Text style={s.dropdownIcon}>{tab.icon}</Text>
                  <Text style={[s.dropdownLabel, active && s.dropdownLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <View style={s.content}>
        <Slot />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const NAV_HEIGHT = 56;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC", overflow: "visible" },

  // Navbar
  navbar: {
    height: NAV_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    overflow: "visible",
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },

  // Logo
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 },
  logoBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center", justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoLabel: { color: "#2563EB", fontWeight: "900", fontSize: 15 },

  // Desktop tabs
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: "#0F172A" },
  tabPressed: { opacity: 0.7 },
  tabIcon: { fontSize: 14, color: "#6B7280" },
  tabIconActive: { color: "#FFFFFF" },
  tabLabel: { fontSize: 13, fontWeight: "700", color: "#374151" },
  tabLabelActive: { color: "#FFFFFF" },

  // User pill
  userWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#6D28D9",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  userName: { fontSize: 13, fontWeight: "700", color: "#101828" },
  chevron: { fontSize: 12, color: "#6B7280" },

  // Mobile hamburger (hidden on wide screens via opacity trick)
  hamburger: { padding: 8, gap: 4, display: "none" },
  hamburgerLine: {
    width: 20, height: 2,
    backgroundColor: "#374151", borderRadius: 2,
  },

  // Mobile modal dropdown
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: NAV_HEIGHT + 8,
    paddingRight: 16,
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 180,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
    }),
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dropdownItemActive: { backgroundColor: "#F5F3FF" },
  dropdownIcon: { fontSize: 16, color: "#6B7280" },
  dropdownLabel: { fontSize: 14, fontWeight: "700", color: "#374151" },
  dropdownLabelActive: { color: "#6D28D9" },

  // Content area
  content: { flex: 1, zIndex: 1 },

  // User dropdown
  userDropdown: {
    position: "absolute",
    top: 44,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 180,
    zIndex: 999,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  userDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  userDropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  userDropdownText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  userDropdownSignOut: { marginTop: 2 },
  userDropdownSignOutText: {
    color: "#DC2626",
    fontWeight: "800",
  },
});
