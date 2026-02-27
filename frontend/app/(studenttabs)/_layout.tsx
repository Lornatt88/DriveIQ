import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, Modal,
} from "react-native";
import { router, usePathname } from "expo-router";
import { Slot } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken } from "../../lib/token";
import { colors, type_, radius, space, shadow } from "../../lib/theme";

const TABS = [
  { name: "dashboard", label: "Dashboard", icon: "⊞" },
  { name: "sessions",  label: "Sessions",  icon: "◷" },
  { name: "reports",   label: "Reports",   icon: "▤" },
  { name: "profile",   label: "Profile",   icon: "○" },
  { name: "settings",  label: "Settings",  icon: "⚙" },
] as const;

type TabName = typeof TABS[number]["name"];
const NAV_HEIGHT = 56;

export default function StudentTabsLayout() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [avatarLetter, setAvatarLetter] = useState("S");

  useEffect(() => {
    AsyncStorage.getItem("driveiq_user_name").then((name) => {
      if (name) { setUserName(name); setAvatarLetter(name.charAt(0).toUpperCase()); }
    });
  }, []);

  const activeTab: TabName =
    (TABS.find((t) => pathname.includes(t.name))?.name as TabName) ?? "dashboard";

  const navigate = (tab: TabName) => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
    router.push(`/(studenttabs)/${tab}` as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.navbar}>
        {/* Logo */}
        <Pressable onPress={() => navigate("dashboard")} style={s.logoWrap}>
          <View style={s.logoBox}><Text style={s.logoText}>DI</Text></View>
          <Text style={s.logoLabel}>DriveIQ</Text>
        </Pressable>

        {/* Desktop tabs */}
        <View style={s.tabsRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.name;
            return (
              <Pressable key={tab.name} onPress={() => navigate(tab.name)}
                style={({ pressed }) => [s.tab, active && s.tabActive, pressed && s.tabPressed]}>
                <Text style={[s.tabIcon, active && s.tabIconActive]}>{tab.icon}</Text>
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* User avatar + dropdown */}
        <View style={{ position: "relative" }}>
          <Pressable style={s.userWrap} onPress={() => setUserDropdownOpen((v) => !v)}>
            <View style={s.avatar}><Text style={s.avatarText}>{avatarLetter}</Text></View>
            <Text style={s.userName}>{userName}</Text>
            <Text style={s.chevron}>⌄</Text>
          </Pressable>

          {userDropdownOpen && (
            <View style={s.userDropdown}>
              {[
                { label: "My Account",     action: () => navigate("profile")  },
                { label: "Profile",        action: () => navigate("profile")  },
                { label: "Settings",       action: () => navigate("settings") },
                { label: "Help & Support", action: () => {}                    },
                { label: "Sign Out", action: async () => {
                    await clearToken();
                    await AsyncStorage.multiRemove(["driveiq_user_name","driveiq_user_email","driveiq_user_mobile"]);
                    router.replace("/");
                  }
                },
              ].map((item, i, arr) => (
                <Pressable key={item.label}
                  onPress={() => { setUserDropdownOpen(false); item.action(); }}
                  style={({ pressed }) => [
                    s.ddItem,
                    i < arr.length - 1 && s.ddItemBorder,
                    item.label === "Sign Out" && s.ddSignOut,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[s.ddText, item.label === "Sign Out" && s.ddSignOutText]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Mobile hamburger */}
        <Pressable style={s.hamburger} onPress={() => setMenuOpen(true)}>
          <View style={s.hamburgerLine} /><View style={s.hamburgerLine} /><View style={s.hamburgerLine} />
        </Pressable>
      </View>

      {/* Mobile Menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setMenuOpen(false)}>
          <View style={s.mobileMenu}>
            {TABS.map((tab) => {
              const active = activeTab === tab.name;
              return (
                <Pressable key={tab.name} onPress={() => navigate(tab.name)}
                  style={[s.mobileItem, active && s.mobileItemActive]}>
                  <Text style={s.mobileIcon}>{tab.icon}</Text>
                  <Text style={[s.mobileLabel, active && s.mobileLabelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <View style={s.content}><Slot /></View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.pageBg, overflow: "visible" },

  navbar:  {
    height: NAV_HEIGHT,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    gap: space.sm,
    overflow: "visible",
    zIndex: 50,
    ...shadow.navbar,
  },

  // Logo
  logoWrap:  { flexDirection: "row", alignItems: "center", gap: space.sm, marginRight: space.sm },
  logoBox:   { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  logoText:  { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoLabel: { color: colors.blue, fontWeight: "900", fontSize: 15 },

  // Tabs
  tabsRow:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  tab:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm },
  tabActive:     { backgroundColor: colors.darkBtn },
  tabPressed:    { opacity: 0.7 },
  tabIcon:       { fontSize: 14, color: colors.subtext },
  tabIconActive: { color: "#FFFFFF" },
  tabLabel:      { fontSize: 13, fontWeight: "700", color: "#374151" },
  tabLabelActive:{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  // User pill
  userWrap:   { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.purpleDark, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  userName:   { fontSize: 13, fontWeight: "700", color: colors.textAlt },
  chevron:    { fontSize: 12, color: colors.subtext },

  // Hamburger
  hamburger:     { padding: space.sm, gap: 4, display: "none" },
  hamburgerLine: { width: 20, height: 2, backgroundColor: "#374151", borderRadius: 2 },

  // Mobile modal
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: NAV_HEIGHT + 8, paddingRight: space.lg },
  mobileMenu:      { backgroundColor: colors.cardBg, borderRadius: radius.input, borderWidth: 1, borderColor: colors.borderFaint, minWidth: 180, overflow: "hidden", ...shadow.dropdown },
  mobileItem:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
  mobileItemActive:{ backgroundColor: colors.purpleLight },
  mobileIcon:      { fontSize: 16, color: colors.subtext },
  mobileLabel:     { fontSize: 14, fontWeight: "700", color: "#374151" },
  mobileLabelActive:{ color: colors.purpleDark },

  // Content
  content: { flex: 1, zIndex: 1 },

  // User dropdown
  userDropdown: { position: "absolute", top: 44, right: 0, backgroundColor: colors.cardBg, borderRadius: radius.input, borderWidth: 1, borderColor: colors.borderFaint, minWidth: 180, zIndex: 999, ...shadow.dropdown },
  ddItem:       { paddingHorizontal: space.lg, paddingVertical: 13 },
  ddItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
  ddText:       { fontSize: 14, fontWeight: "700", color: "#374151" },
  ddSignOut:    { marginTop: 2 },
  ddSignOutText:{ color: colors.redDark, fontWeight: "800" },
});
