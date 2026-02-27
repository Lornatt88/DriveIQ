/**
 * DriveIQ Design System — theme.ts
 * ─────────────────────────────────
 * Single source of truth for all design tokens.
 * Extracted from globals.css, all screen files, and Figma variable names.
 *
 * Usage:
 *   import { colors, type_, radius, space, shadow, card, input, btn, pill, page } from "../../lib/theme";
 */

import { Platform, StyleSheet } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Page backgrounds
  pageBg:         "#F8FAFC",
  pageBgAlt:      "#F6F7FB",
  cardBg:         "#FFFFFF",
  inputBg:        "#F9FAFB",

  // ── Dark theme (instructor home, lesson)
  darkBg:         "#0B1220",
  darkCard:       "#111B2E",
  darkBorder:     "#1E2A44",
  darkText:       "#E5E7EB",
  darkSubtext:    "#9AA7BF",
  darkAccent:     "#38BDF8",

  // ── Text
  text:           "#0F172A",
  textAlt:        "#101828",
  subtext:        "#64748B",
  subtextAlt:     "#667085",
  muted:          "#98A2B3",
  label:          "#344054",
  placeholder:    "#98A2B3",

  // ── Brand blue
  blue:           "#2563EB",
  blueDark:       "#1D4ED8",
  blueDeep:       "#1E40AF",
  blueLight:      "#EEF6FF",
  blueLighter:    "#DBEAFE",
  blueBorder:     "#BFDBFE",
  blueChip:       "#BBD3FF",
  blueNote:       "#EDF5FF",
  blueNoteBorder: "#BBD7FF",

  // ── Purple (hero, spinner, active badges, AI feedback %)
  purple:         "#7C3AED",
  purpleDark:     "#6D28D9",
  purpleDeep:     "#5B21B6",
  purpleLight:    "#F5F3FF",
  purpleLighter:  "#F4EFFF",
  purpleBorder:   "#DDD6FE",
  purpleBorderAlt:"#D6C6FF",
  purpleChip:     "#E5EDFF",
  avatarPurple:   "#6D67FF",

  // ── Green (success, completed, earned)
  green:          "#16A34A",
  greenDark:      "#166534",
  greenMid:       "#15803D",
  greenLight:     "#ECFDF3",
  greenLighter:   "#F0FDF4",
  greenBorder:    "#B7F2C8",
  greenBorderAlt: "#BBF7D0",

  // ── Yellow (achievements, badges)
  yellow:         "#F59E0B",
  yellowLight:    "#FFFBEB",
  yellowLighter:  "#FFF7E6",
  yellowBorder:   "#FCD34D",
  yellowBorderAlt:"#FFD48A",
  yellowBg:       "#FEF3C7",

  // ── Red (errors, cancelled, destructive)
  red:            "#EF4444",
  redDark:        "#DC2626",
  redDeep:        "#E11D48",
  redLight:       "#FEE2E2",
  redBorder:      "#FECACA",

  // ── Borders & dividers
  border:         "#EAECF0",
  borderAlt:      "#E8EAF2",
  borderLight:    "#F2F4F7",
  borderMid:      "#E2E8F0",
  borderFaint:    "#F3F4F6",

  // ── Primary dark button
  darkBtn:        "#0B1220",

  // ── Indigo (sessions avatar, chart)
  indigo:         "#4F46E5",
  indigoBg:       "#EEF2FF",
  indigoBorder:   "#C7D2FE",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// Named by semantic role to match Figma layer names.
// ─────────────────────────────────────────────────────────────────────────────

export const type_ = StyleSheet.create({
  // Page headings
  pageTitle:        { fontSize: 18, fontWeight: "900", color: colors.text },
  pageTitleLg:      { fontSize: 20, fontWeight: "900", color: colors.textAlt },
  pageSubtitle:     { fontSize: 12, fontWeight: "600", color: colors.subtext, marginTop: 4 },
  pageSubtitleBold: { fontSize: 12, fontWeight: "700", color: colors.subtextAlt },

  // Auth screens (login / signup)
  authTitle:    { fontSize: 18, fontWeight: "800", color: colors.textAlt, marginTop: 6 },
  authSubtitle: { fontSize: 13, color: colors.subtextAlt, marginTop: 6, marginBottom: 14 },

  // Cards / sections
  cardTitle:    { fontSize: 14, fontWeight: "900", color: colors.textAlt },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: colors.text },
  sectionSub:   { fontSize: 12, fontWeight: "700", color: colors.subtextAlt },

  // Score displays
  displayScore: { fontSize: 34, fontWeight: "900", color: colors.text },
  scoreValue:   { fontSize: 15, fontWeight: "900", color: colors.textAlt },
  scoreMid:     { fontSize: 18, fontWeight: "900" },

  // Body text
  body:         { fontSize: 12, fontWeight: "700",  color: colors.text,        lineHeight: 18 },
  bodyMedium:   { fontSize: 12, fontWeight: "600",  color: colors.text,        lineHeight: 18 },
  bodySm:       { fontSize: 11, fontWeight: "700",  color: colors.subtextAlt,  lineHeight: 16 },

  // Form labels
  label:        { fontSize: 12, fontWeight: "700",  color: colors.label,      marginBottom: 6 },
  labelBold:    { fontSize: 12, fontWeight: "900",  color: colors.textAlt,    marginBottom: 8 },
  labelSm:      { fontSize: 11, fontWeight: "800",  color: colors.subtextAlt },

  // Input text
  inputText:    { fontSize: 14, color: colors.textAlt },
  inputTextSm:  { fontSize: 12, fontWeight: "800", color: colors.text },

  // Buttons
  btnPrimary:   { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  btnSm:        { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  btnOutline:   { color: colors.label, fontWeight: "900", fontSize: 12 },

  // Pills & chips
  pill:         { fontSize: 11, fontWeight: "900" },
  chip:         { fontSize: 11, fontWeight: "900", color: colors.text },

  // Links
  link:         { fontSize: 12, fontWeight: "800", color: colors.blue },
  linkMuted:    { fontSize: 12, fontWeight: "700", color: colors.subtextAlt },

  // Meta (dates, IDs, vehicles)
  meta:         { fontSize: 11, fontWeight: "800", color: colors.subtextAlt },
  metaValue:    { fontSize: 12, fontWeight: "900", color: colors.textAlt, marginTop: 2 },

  // Footer
  footer:       { fontSize: 11, fontWeight: "700", color: colors.muted, textAlign: "center" },

  // Dark theme variants
  darkTitle:    { fontSize: 26, fontWeight: "900", color: "#FFFFFF" },
  darkHeading:  { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  darkBody:     { fontSize: 13, fontWeight: "700", color: colors.darkSubtext },
  darkBodySm:   { fontSize: 11, fontWeight: "800", color: colors.darkSubtext },
});

// ─────────────────────────────────────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────────────────────────────────────

export const space = {
  xs:     4,
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  xxl:    24,
  page:   16,
  card:   14,
  cardLg: 16,
};

// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  xs:     4,
  sm:     8,
  md:     10,
  input:  12,
  btn:    12,
  card:   14,
  cardLg: 16,
  cardXl: 18,
  logo:   16,
  tag:    10,
  icon:   12,
  pill:   999,
};

// ─────────────────────────────────────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  navbar: Platform.select({
    ios:     { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 3 },
  }),
  card: Platform.select({
    ios:     { shadowColor: "#101828", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 2 },
  }),
  dropdown: Platform.select({
    ios:     { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 8 },
  }),
  modal: Platform.select({
    ios:     { shadowColor: "#000", shadowOpacity: 0.2,  shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 12 },
  }),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const card = StyleSheet.create({
  base: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.card,
  },
  lg: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardLg,
    padding: space.cardLg,
  },
  inner: {
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: space.md,
  },
  dark: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: radius.cardLg,
    padding: space.cardLg,
  },
});

export const input = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  wrapError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  wrapDark: {
    backgroundColor: colors.darkBg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  field:     { flex: 1, color: colors.textAlt, fontSize: 14 },
  fieldSm:   { flex: 1, color: colors.text, fontWeight: "800", fontSize: 12, padding: 0 },
  fieldDark: { flex: 1, color: "#E5E7EB", fontWeight: "800" },
});

export const btn = StyleSheet.create({
  primary: {
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkBtn,
  },
  primaryDisabled: { backgroundColor: "#6B7280" },
  outline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  darkAccent: {
    backgroundColor: colors.darkAccent,
    padding: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
  danger: {
    backgroundColor: colors.redDark,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: "center",
  },
});

export const pill = StyleSheet.create({
  base:       { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  dark:       { backgroundColor: colors.darkBtn,   borderColor: colors.darkBtn,         borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  light:      { backgroundColor: "#F2F4F7",         borderColor: colors.border,          borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  passed:     { backgroundColor: "#DCFCE7",          borderColor: colors.greenBorderAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  failed:     { backgroundColor: colors.redLight,    borderColor: colors.redBorder,       borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  blue:       { backgroundColor: colors.purpleChip,  borderColor: colors.blueChip,        borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  cancelled:  { backgroundColor: colors.redDeep,     borderColor: colors.redDeep,         borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  completed:  { backgroundColor: colors.green,       borderColor: colors.green,           borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
});

export const avatar = StyleSheet.create({
  sm:   { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.purpleDark,  alignItems: "center", justifyContent: "center" },
  md:   { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.indigoBg,    alignItems: "center", justifyContent: "center" },
  lg:   { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  xl:   { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  textSm: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  textMd: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  textLg: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  textXl: { color: "#FFFFFF", fontWeight: "900", fontSize: 30 },
  // Sessions-specific (indigo tint)
  sessions: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.indigoBg, alignItems: "center", justifyContent: "center" },
  sessionsText: { color: colors.indigo, fontWeight: "900", fontSize: 12 },
});

export const page = StyleSheet.create({
  base:      { flex: 1, backgroundColor: colors.pageBg },
  alt:       { flex: 1, backgroundColor: colors.pageBgAlt },
  content:   { padding: space.page, paddingBottom: 32, gap: 14 },
  dark:      { flex: 1, backgroundColor: colors.darkBg, padding: space.page, paddingTop: 60 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  centerText:{ marginTop: 12, fontSize: 13, fontWeight: "800", color: colors.subtext },
});

export const divider = StyleSheet.create({
  base:  { height: 1, backgroundColor: colors.border,      marginVertical: space.card },
  faint: { height: 1, backgroundColor: colors.borderLight, marginVertical: space.lg  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC TINT PALETTES
// Used for icon boxes, info banners, tinted card backgrounds.
// ─────────────────────────────────────────────────────────────────────────────

export const tint = {
  blue:   { bg: "#EFF6FF",           border: colors.blueLighter,    icon: colors.blue      },
  purple: { bg: colors.purpleLight,  border: colors.purpleBorder,   icon: colors.purpleDark},
  green:  { bg: colors.greenLight,   border: colors.greenBorderAlt, icon: colors.green     },
  yellow: { bg: colors.yellowLight,  border: colors.yellowBorder,   icon: colors.yellow    },
  red:    { bg: colors.redLight,     border: colors.redBorder,      icon: colors.redDeep   },
  indigo: { bg: colors.indigoBg,     border: colors.indigoBorder,   icon: colors.indigo    },
} as const;

export type TintKey = keyof typeof tint;
