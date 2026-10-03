import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { IMAGES } from '@/constants/data';

export default function SplashScreen() {
  const router = useRouter();
  return (
    <ImageBackground source={{ uri: IMAGES.productHero }} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.brandArea}>
          <View style={styles.logoCircle}>
            <AppIcon name="restaurant" size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.brand}><Text style={styles.orange}>Rasa</Text>Lokal</Text>
          <Text style={styles.tagline}>Kuliner Lokal, UMKM Naik Kelas</Text>
        </View>
        <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Mulai Sekarang</Text>
          <AppIcon name="arrow-forward" size={19} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 90, paddingBottom: 28 },
  brandArea: { alignItems: 'center' },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  orange: { color: COLORS.primary2 },
  tagline: { marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  button: { height: 54, borderRadius: 16, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
