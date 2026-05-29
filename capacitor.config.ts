import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shinely.app",
  appName: "Shinely",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Remove this block before production builds — it enables live-reload from a dev server
    // url: "http://YOUR_DEV_IP:8080",
    // cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
    backgroundColor: "#F5F0FF",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#F5F0FF",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#F5F0FF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#A855F7",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "Light",
      backgroundColor: "#F5F0FF",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#A855F7",
    },
  },
};

export default config;
