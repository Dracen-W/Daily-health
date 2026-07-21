import { FontAwesome6 } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../../src/state/AppProvider";
import { colors } from "../../src/ui/styles";

export default function TabLayout() {
  const { locale, setLocale, t } = useApp();

  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: "#FFFFFF" },
      headerTitleStyle: { color: colors.text, fontWeight: "700" },
      headerLeft: () => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16 }}>
          <View style={{ width: 32, height: 32, backgroundColor: colors.leaf, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
            <FontAwesome6 name="heart-pulse" size={16} color="#FFFFFF" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{t("app.name")}</Text>
        </View>
      ),
      headerRight: () => (
        <View style={{ marginRight: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <FontAwesome6 name="language" size={14} color="#64748B" />
          <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2, borderWidth: 1, borderColor: "#E2E8F0" }}>
            {(["en", "zh-CN"] as const).map((lang) => {
              const active = locale === lang;
              return (
                <Pressable
                  key={lang}
                  onPress={() => setLocale(lang)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: active ? "#FFFFFF" : "transparent",
                    shadowColor: active ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: active ? 0.1 : 0,
                    shadowRadius: 1,
                    elevation: active ? 1 : 0,
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: active ? "700" : "500",
                    color: active ? colors.leaf : "#64748B"
                  }}>
                    {lang === "en" ? "EN" : "中文"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ),
      headerTitle: "", // Logo covers the left, so we clear the center title to avoid overlap
      tabBarActiveTintColor: colors.leaf,
      tabBarInactiveTintColor: "#75807A",
      tabBarStyle: { borderTopColor: "#DCE7DF", backgroundColor: "#FFFFFF", height: 60, paddingBottom: 8 }
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <FontAwesome6 name="house" size={18} color={color} /> }} />
      <Tabs.Screen name="smart-scan" options={{ title: "Smart Scan", tabBarIcon: ({ color }) => <FontAwesome6 name="wand-magic-sparkles" size={18} color={color} /> }} />
      <Tabs.Screen name="recipes" options={{ title: "Recipes", tabBarIcon: ({ color }) => <FontAwesome6 name="utensils" size={18} color={color} /> }} />
      <Tabs.Screen name="food-log" options={{ title: "Food Log", tabBarIcon: ({ color }) => <FontAwesome6 name="list-check" size={18} color={color} /> }} />
      <Tabs.Screen name="water" options={{ title: "Water", tabBarIcon: ({ color }) => <FontAwesome6 name="droplet" size={18} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: ({ color }) => <FontAwesome6 name="user" size={18} color={color} /> }} />

      {/* Hidden tabs reachable via Me or Home */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="exercise" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="my-recipes" options={{ href: null }} />
      <Tabs.Screen name="status" options={{ href: null }} />
      <Tabs.Screen name="wellness" options={{ href: null }} />
    </Tabs>
  );
}
