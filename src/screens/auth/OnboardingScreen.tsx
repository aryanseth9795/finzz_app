import React, { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../../components/ui";
import { FinzzMark } from "../../components/brand/FinzzLogo";
import { ONBOARDING_SLIDES, ONBOARDING_VIDEOS } from "../../constants/onboarding";
import {
  isLastPage,
  markOnboardingSeenDefault,
  pageFromOffset,
} from "../../utils/onboarding";

/**
 * Backdrop behind the screenshots. The Play screenshots sit on an
 * indigo->blue gradient; a solid mid-indigo matches their edges closely enough
 * that letterboxing with resizeMode "contain" is not noticeable, and it reads
 * in both light and dark app themes because the slide supplies its own colour.
 */
const SLIDE_BACKDROP = "#2F3BC4";

type Page = { key: string } & ({ kind: "slide"; index: number } | { kind: "videos" });

const PAGES: Page[] = [
  ...ONBOARDING_SLIDES.map((s, i): Page => ({ key: s.key, kind: "slide", index: i })),
  { key: "videos", kind: "videos" },
];
const PAGE_COUNT = PAGES.length;

const OnboardingScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fromLink: boolean = !!route?.params?.fromLink;

  const listRef = useRef<FlatList<Page>>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [listHeight, setListHeight] = useState(0);
  const last = isLastPage(page, PAGE_COUNT);

  const goTo = useCallback((index: number) => {
    pageRef.current = index;
    setPage(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = pageFromOffset(e.nativeEvent.contentOffset.x, width, PAGE_COUNT);
    pageRef.current = p;
    setPage(p);
  };

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (pageRef.current > 0) {
          goTo(pageRef.current - 1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [goTo]),
  );

  const finish = (target: "Register" | "Login" | null) => {
    void markOnboardingSeenDefault(); // fire and forget, never blocks navigation
    if (fromLink) {
      // popTo, not navigate: navigate pushes a second Login/Register on top of
      // the one the link was opened from, and Back would land on the carousel.
      if (target) navigation.popTo(target);
      else navigation.goBack();
      return;
    }
    const routes = [{ name: "Landing" }, ...(target ? [{ name: target }] : [])];
    navigation.reset({ index: routes.length - 1, routes });
  };

  const renderPage = ({ item }: { item: Page }) => {
    if (item.kind === "slide") {
      const slide = ONBOARDING_SLIDES[item.index];
      return (
        <View style={[styles.page, { width, height: listHeight, backgroundColor: SLIDE_BACKDROP }]}>
          <Image
            source={slide.image}
            style={styles.slideImage}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={slide.label}
          />
        </View>
      );
    }
    return (
      <ScrollView
        style={{ width, height: listHeight, backgroundColor: colors.background }}
        contentContainerStyle={styles.videosContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.videosHeader}>
          <FinzzMark size={56} />
          <Text style={[styles.heading, { color: colors.text }]} accessibilityRole="header">
            Watch Finzz in action
          </Text>
        </View>
        {ONBOARDING_VIDEOS.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => navigation.navigate("VideoPlayer", { videoId: v.id })}
            accessibilityRole="button"
            accessibilityLabel={`Play ${v.title}, ${v.durationLabel}`}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.thumbWrap}>
              <Image source={v.poster} style={styles.thumb} resizeMode="cover" />
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={30} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                {v.subtitle}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {v.durationLabel} · {v.sizeLabel}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {!last ? (
          <Pressable
            onPress={() => finish(null)}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            hitSlop={8}
            style={styles.skip}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skip} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(p) => p.key}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.list}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              accessible
              accessibilityLabel={`Page ${i + 1} of ${PAGE_COUNT}`}
              style={[
                styles.dot,
                i === page
                  ? { width: 22, backgroundColor: colors.primary }
                  : { width: 8, backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>
        {last ? (
          <>
            <Button title="Create account" onPress={() => finish("Register")} fullWidth style={styles.btn} />
            <Button
              title="I already have an account"
              variant="ghost"
              onPress={() => finish("Login")}
              fullWidth
              style={styles.btn}
            />
          </>
        ) : (
          <Button title="Next" onPress={() => goTo(page + 1)} fullWidth style={styles.btn} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 4 },
  skip: { minHeight: 44, minWidth: 64, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontSize: 16, fontWeight: "600" },
  list: { flex: 1 },
  page: { alignItems: "center", justifyContent: "center" },
  slideImage: { width: "100%", height: "100%" },
  videosContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  videosHeader: { alignItems: "center", gap: 12, paddingVertical: 12 },
  heading: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 10, borderRadius: 16, borderWidth: 1 },
  thumbWrap: { width: 64, height: 114, borderRadius: 10, overflow: "hidden", backgroundColor: SLIDE_BACKDROP },
  thumb: { width: 64, height: 114 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSub: { fontSize: 13 },
  cardMeta: { fontSize: 12, marginTop: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 6 },
  dot: { height: 8, borderRadius: 4 },
  btn: { minHeight: 48 },
});

export default OnboardingScreen;
