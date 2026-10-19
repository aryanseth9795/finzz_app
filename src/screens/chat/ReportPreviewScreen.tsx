import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// The class-based File/Paths API in expo-file-system 19 has no rename that
// accepts a bare URI string; the legacy module keeps the simple, typed
// moveAsync/cacheDirectory pair, so the preview uses that.
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { getChatExportHtmlApi } from "../../api/statsApi";
import { describeError } from "../../api/axios";
import { logger } from "../../utils/logger";
import {
  isStaleReportFile,
  parseExportResponse,
  PDF_SHARE_OPTIONS,
  ParsedExport,
  REPORT_WEBVIEW_PROPS,
} from "../../utils/report";

// iOS ignores the @page margins in the report CSS, so give printToFileAsync
// explicit ones (points).
const IOS_PDF_MARGINS = { top: 36, right: 36, bottom: 36, left: 36 };

// The shared PDF can't be deleted right after sharing (Android targets such as
// Drive / Nearby Share read the file later), so stale ones are swept instead.
const sweepStaleReports = async (): Promise<void> => {
  try {
    const base = FileSystem.cacheDirectory;
    if (!base) return;
    const names = await FileSystem.readDirectoryAsync(base);
    await Promise.all(
      names.filter(isStaleReportFile).map((name) =>
        FileSystem.deleteAsync(`${base}${name}`, { idempotent: true }).catch(() => undefined),
      ),
    );
  } catch {
    // best-effort cleanup
  }
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; report: ParsedExport };

const ReportPreviewScreen = ({ route, navigation }: any) => {
  const { chatId, year, month, friendName } = route.params as {
    chatId: string;
    year: number;
    month: number;
    friendName?: string;
  };
  const { theme } = useTheme();
  const { colors, fontSize: fs, borderRadius: br } = theme;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState<"share" | "print" | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    sweepStaleReports();
    return () => {
      mountedRef.current = false;
      sweepStaleReports();
    };
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState({ status: "loading" });
    try {
      const res = await getChatExportHtmlApi(chatId, year, month);
      const report = parseExportResponse(res.data, { friendName, year, month });
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({ status: "ready", report });
    } catch (error) {
      logger.error("Failed to load report", error);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setState({ status: "error", message: describeError(error) });
    }
  }, [chatId, year, month, friendName]);

  useEffect(() => {
    load();
  }, [load]);

  const report = state.status === "ready" ? state.report : null;

  // Only the initial HTML load and about:blank may load; any link or redirect
  // is refused rather than handed to Linking.
  const initialLoadAllowedRef = useRef(true);
  useEffect(() => {
    initialLoadAllowedRef.current = true;
  }, [report]);
  const allowRequest = useCallback((req: { url: string }) => {
    if (req.url === "about:blank") return true;
    if (initialLoadAllowedRef.current) {
      initialLoadAllowedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const handleShare = async () => {
    if (!report || busyRef.current) return;
    busyRef.current = true;
    setBusy("share");
    let tempUri: string | null = null;
    let shared = false;
    try {
      await sweepStaleReports();
      const { uri } = await Print.printToFileAsync({
        html: report.html,
        width: 595,
        height: 842,
        ...(Platform.OS === "ios" ? { margins: IOS_PDF_MARGINS } : {}),
      });
      tempUri = uri;

      const base = FileSystem.cacheDirectory;
      if (base) {
        const target = `${base}${report.fileName}`;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: target });
        tempUri = target;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(tempUri, PDF_SHARE_OPTIONS);
      shared = true;
    } catch (error) {
      logger.error("Failed to share report", error);
      Alert.alert("Couldn't share the report", describeError(error));
    } finally {
      // Keep the file once it has been handed to the share sheet; the sweep
      // removes it later. Delete immediately only when sharing never happened.
      if (tempUri && !shared) {
        try {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        } catch {
          // best-effort cleanup
        }
      }
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (!report || busyRef.current) return;
    busyRef.current = true;
    setBusy("print");
    try {
      await Print.printAsync({ html: report.html });
    } catch (error) {
      logger.error("Failed to print report", error);
      Alert.alert("Couldn't print the report", describeError(error));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  };

  const subtitle = report
    ? `${report.periodLabel} · ${friendName ?? "Friend"}`
    : friendName ?? "";

  const disabled = busy !== null || !report;

  return (
    <SafeAreaWrapper>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={{ color: colors.text, fontSize: fs.lg, fontWeight: "700" }}>
            Report
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, fontSize: fs.sm, marginTop: 1 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {state.status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: fs.md, marginTop: 12 }}>
              Preparing your report…
            </Text>
          </View>
        )}

        {state.status === "error" && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} />
            <Text
              style={{
                color: colors.text,
                fontSize: fs.md,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {state.message}
            </Text>
            <TouchableOpacity
              onPress={load}
              style={[
                styles.retry,
                { backgroundColor: colors.primary, borderRadius: br.md },
              ]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.textInverse, fontWeight: "600", fontSize: fs.md }}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {report && (
          <WebView
            source={{ html: report.html }}
            {...REPORT_WEBVIEW_PROPS}
            originWhitelist={[...REPORT_WEBVIEW_PROPS.originWhitelist]}
            dataDetectorTypes={[...REPORT_WEBVIEW_PROPS.dataDetectorTypes]}
            onShouldStartLoadWithRequest={allowRequest}
            scalesPageToFit={Platform.OS === "android"}
            style={styles.webview}
          />
        )}
      </View>

      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={handleShare}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Share PDF"
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primary,
              borderRadius: br.md,
              opacity: disabled && busy !== "share" ? 0.5 : 1,
            },
          ]}
        >
          {busy === "share" ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color={colors.textInverse} />
              <Text style={[styles.actionLabel, { color: colors.textInverse, fontSize: fs.md }]}>
                Share PDF
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePrint}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Print"
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 1.5,
              borderRadius: br.md,
              opacity: disabled && busy !== "print" ? 0.5 : 1,
            },
          ]}
        >
          {busy === "print" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="print-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.primary, fontSize: fs.md }]}>
                Print
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 6, marginRight: 8 },
  headerText: { flex: 1 },
  body: { flex: 1, backgroundColor: "#F1F5F9" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  retry: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 12 },
  webview: { flex: 1, backgroundColor: "#F1F5F9" },
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { fontWeight: "600" },
});

export default ReportPreviewScreen;
