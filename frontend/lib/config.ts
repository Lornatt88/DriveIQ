import { Platform } from "react-native";

// ====== CONFIG ======
const USE_NGROK = true;

// Your ngrok HTTPS URL (copy from ngrok terminal)
const NGROK_BASE = "https://steely-exultant-piper.ngrok-free.dev";

// Home Wi-Fi LAN IP (only if USE_NGROK = false)
const LAN_IP = "192.168.0.6";
const PORT = 8000;

// Android emulator only (not Expo Go on phone)
const ANDROID_EMULATOR_BASE = "http://10.0.2.2:8000";

// ====== EXPORT ======
export const API_BASE_URL = USE_NGROK
  ? NGROK_BASE
  : Platform.OS === "android"
  ? ANDROID_EMULATOR_BASE
  : `http://${LAN_IP}:${PORT}`;
