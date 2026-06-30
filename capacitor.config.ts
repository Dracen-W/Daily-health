import type { CapacitorConfig } from "@capacitor/cli";

const mobileServerUrl = process.env.MOBILE_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.dailyhealth.mobile",
  appName: "Daily Health",
  webDir: "mobile-web",
  server: {
    allowNavigation: ["*"],
    cleartext: true,
    ...(mobileServerUrl ? { url: mobileServerUrl } : {})
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
