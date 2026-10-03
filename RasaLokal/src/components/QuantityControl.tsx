import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

type Props = { value: number; onChange: (value: number) => void };

export function QuantityControl({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.button} onPress={() => onChange(Math.max(1, value - 1))}>
        <AppIcon name="remove" size={15} color={COLORS.text} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={[styles.button, styles.plus]} onPress={() => onChange(value + 1)}>
        <AppIcon name="add" size={15} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: COLORS.primary },
  value: { width: 18, textAlign: 'center', fontSize: 14, fontWeight: '800', color: COLORS.text },
});
