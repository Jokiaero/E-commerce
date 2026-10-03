import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import type { LocationMapProps } from './LocationMap.types';

export default function LocationMap({ coordinate, onCoordinateChange }: LocationMapProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pilih titik lokasi"
      style={styles.map}
      onPress={() => onCoordinateChange(coordinate)}
    >
      <View style={styles.icon}><AppIcon name="location" size={28} color={COLORS.primary} /></View>
      <Text style={styles.title}>Peta tidak tersedia di platform ini</Text>
      <Text style={styles.copy}>Buka lokasi ini di Google Maps untuk melihat peta.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#E9EFEA' },
  icon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: '#fff' },
  title: { marginTop: 12, fontSize: 14, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  copy: { marginTop: 5, fontSize: 11, lineHeight: 16, color: COLORS.secondaryText, textAlign: 'center' },
});