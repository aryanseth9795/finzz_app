import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SITE_ORIGINS } from "../../constants/links";
import { findOnboardingVideo } from "../../constants/onboarding";
import { buildVideoHtml, isAllowedVideoRequest } from "../../utils/videoPlayerHtml";

const LOAD_TIMEOUT_MS = 15000;
const ORIGIN_WHITELIST: string[] = [...SITE_ORIGINS];
const originOf = (url: string): string =>
  SITE_ORIGINS.find((o) => url.startsWith(`${o}/`)) ?? SITE_ORIGINS[0];

type PlayerState = "loading" | "playing" | "error";

const VideoPlayerScreen = ({ route, navigation }: any) => {
  const { videoId } = (route?.params ?? {}) as { videoId?: string };
  const video = findOnboardingVideo(String(videoId ?? ""));
  const { theme } = useTheme();
  const { colors, fontSize: fs, borderRadius: br } = theme;
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<PlayerState>("loading");
  const [attempt, setAttempt] = useState(0);
  // Which candidate host is being tried; advances silently on a pre-play failure.
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const videoUrl = video ? video.urls[Math.min(index, video.urls.length - 1)] : "";
  const playingRef = useRef(false);
  const failRef = useRef<() => void>(() => {});

  const close = useCallback(() => navigation.goBack(), [navigation]);

  const html = useMemo(() => {
    if (!video) return "";
    try {
      return buildVideoHtml(videoUrl);
    } catch {
      return "";
    }
  }, [video, videoUrl]);

  // 15 s without the video starting to play counts as a failed load.
  useEffect(() => {
    if (!video || !html) return;
    playingRef.current = false;
    setState("loading");
    const timer = setTimeout(() => {
      if (!playingRef.current) failRef.current();
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt, index, video, html]);

  // Before "playing": try the next host if there is one (keeping the loading
  // poster), else show the error state.
  const fail = useCallback(() => {
    if (playingRef.current || !video) return;
    if (indexRef.current + 1 < video.urls.length) {
      indexRef.current += 1;
      setIndex(indexRef.current);
    } else {
      setState("error");
    }
  }, [video]);

  const retry = useCallback(() => {
    indexRef.current = 0;
    setIndex(0);
    setAttempt((n) => n + 1);
  }, []);

  failRef.current = fail;

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let type: unknown;
    try {
      type = JSON.parse(event.nativeEvent.data)?.type;
    } catch {
      return;
    }
    if (type === "playing" || type === "loadedmetadata") {
      // loadedmetadata = this host is serving a real video. Stop the load
      // timer and drop the overlay so the <video> controls are reachable even
      // if autoplay doesn't start; a slow 28 MB download is not a failure.
      playingRef.current = true;
      setState("playing");
    } else if (type === "error") {
      // After the video started, a stream error can't be fixed by switching
      // host mid-way: show the error state (Retry starts over).
      if (playingRef.current) setState("error");
      else fail();
    }
    // "ended": keep the player so the user can replay with the controls.
  }, [fail]);

  const allowRequest = useCallback(
    (req: { url: string }) => (video ? isAllowedVideoRequest(req.url, videoUrl) : false),
    [video, videoUrl],
  );

  if (!video || !html) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="videocam-off-outline" size={40} color={colors.textTertiary} />
        <Text style={{ color: colors.text, fontSize: fs.md, marginTop: 12 }}>Video not found</Text>
        <TouchableOpacity
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.button, { backgroundColor: colors.primary, borderRadius: br.md }]}
        >
          <Text style={{ color: colors.textInverse, fontWeight: "600", fontSize: fs.md }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: "#000" }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={close}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: fs.lg, fontWeight: "700" }}>
            {video.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: "rgba(255,255,255,0.7)", fontSize: fs.sm, marginTop: 1 }}
          >
            {video.durationLabel} · {video.sizeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.fill}>
        {state !== "error" && (
          <WebView
            key={`${attempt}-${index}`}
            source={{ html, baseUrl: originOf(videoUrl) }}
            originWhitelist={ORIGIN_WHITELIST}
            onShouldStartLoadWithRequest={allowRequest}
            onMessage={onMessage}
            onError={fail}
            onHttpError={fail}
            javaScriptEnabled
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowFileAccess={false}
            setSupportMultipleWindows={false}
            domStorageEnabled={false}
            allowsLinkPreview={false}
            dataDetectorTypes={["none"]}
            style={styles.webview}
          />
        )}

        {state === "loading" && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#000" }]}
          >
            <Image source={video.poster} style={styles.poster} resizeMode="contain" />
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
          </View>
        )}

        {state === "error" && (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#000" }]}>
            <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.7)" />
            <Text
              style={{ color: "#fff", fontSize: fs.md, marginTop: 12, textAlign: "center" }}
            >
              Couldn't load the video. Check your connection and try again.
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Retry"
                style={[styles.button, { backgroundColor: colors.primary, borderRadius: br.md }]}
              >
                <Text style={{ color: colors.textInverse, fontWeight: "600", fontSize: fs.md }}>
                  Retry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[
                  styles.button,
                  { borderColor: "#fff", borderWidth: 1.5, borderRadius: br.md },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: fs.md }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#000",
  },
  closeButton: { padding: 6, marginRight: 8 },
  headerText: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#000" },
  poster: { width: "100%", height: "100%", opacity: 0.6 },
  spinner: { position: "absolute" },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 12 },
});

export default VideoPlayerScreen;
