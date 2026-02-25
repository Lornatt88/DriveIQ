import "react-native-gesture-handler";
import { Stack } from "expo-router";

export const unstable_settings = {
  ignore: ["lib", "components", "notification"],
};


export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
