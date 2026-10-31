import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { IMAGES } from '@/constants/data';
import { parseRecoveryLink, recoveryRedirectUrl } from '@/lib/passwordRecovery';
import { useHydrated } from '@/hooks/useHydrated';
import { supabase } from '@/lib/supabase';

const SPLASH_DURATION_MS = 1800;

export default function SplashScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hydrated = useHydrated();
  const rotation = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(0)).current;
  const brandEntrance = useRef(new Animated.Value(0)).current;
  const taglineEntrance = useRef(new Animated.Value(0)).current;
  const loadingPulse = useRef(new Animated.Value(0)).current;
  const footerEntrance = useRef(new Animated.Value(0)).current;
  const recoveryLink = parseRecoveryLink(params);

  useEffect(() => {
    if (recoveryLink.kind !== 'none') return;
    const spinner = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 850,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(logoPulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(logoPulse, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const loadingAnimation = Animated.loop(Animated.sequence([
      Animated.timing(loadingPulse, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(loadingPulse, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const entrance = Animated.stagger(140, [
      Animated.spring(brandEntrance, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }),
      Animated.timing(taglineEntrance, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(footerEntrance, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);
    spinner.start();
    pulse.start();
    loadingAnimation.start();
    entrance.start();

    let active = true;
    const startedAt = Date.now();
    void supabase.auth.getSession().then(({ data }) => {
      const remainingTime = Math.max(0, SPLASH_DURATION_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (!active) return;
        if (data.session?.user) {
          router.replace('/(tabs)');
        } else {
          router.replace({
            pathname: '/account-details',
            params: { section: 'login', authMode: 'signIn', returnTo: '/(tabs)' },
          });
        }
      }, remainingTime);
    }).catch(() => {
      setTimeout(() => {
        if (active) router.replace({
          pathname: '/account-details',
          params: { section: 'login', authMode: 'signIn', returnTo: '/(tabs)' },
        });
      }, SPLASH_DURATION_MS);
    });

    return () => {
      active = false;
      spinner.stop();
      pulse.stop();
      loadingAnimation.stop();
      entrance.stop();
    };
  }, [brandEntrance, footerEntrance, loadingPulse, logoPulse, recoveryLink.kind, rotation, router, taglineEntrance]);

  // Dashboard-generated reset emails may return to the configured Site URL (the home page).
  if (hydrated && recoveryLink.kind !== 'none') {
    return <Redirect href={recoveryRedirectUrl(params)} />;
  }
  return (
    <ImageBackground source={{ uri: IMAGES.productHero }} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.brandArea}>
          <Animated.View style={[styles.logoCircle, { transform: [
            { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            { scale: logoPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
          ] }]}>
            <AppIcon name="restaurant" size={34} color={COLORS.primary} />
          </Animated.View>
          <Animated.Text style={[styles.brand, {
            opacity: brandEntrance,
            transform: [
              { translateY: brandEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: brandEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          }]}><Text style={styles.orange}>Rasa</Text>Lokal</Animated.Text>
          <Animated.Text style={[styles.tagline, {
            opacity: taglineEntrance,
            transform: [{ translateX: taglineEntrance.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }],
          }]}>Kuliner Lokal, UMKM Naik Kelas</Animated.Text>
          <Animated.View style={[styles.loadingRow, {
            opacity: loadingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
            transform: [{ translateY: loadingPulse.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }],
          }]}>
            <Animated.View style={[styles.loadingDot, { transform: [{ scale: loadingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) }] }]} />
            <Text style={styles.loadingText}>Menyiapkan RasaLokal...</Text>
          </Animated.View>
        </View>
        <Animated.Text style={[styles.footer, {
          opacity: footerEntrance,
          transform: [{ translateY: footerEntrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }]}>Kuliner lokal dalam satu aplikasi</Animated.Text>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 90, paddingBottom: 32 },
  brandArea: { alignItems: 'center' },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  orange: { color: COLORS.primary2 },
  tagline: { marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  loadingRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary2 },
  loadingText: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '600' },
  footer: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
