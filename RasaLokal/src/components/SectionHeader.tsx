import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';

type Props = {
  title: string;
  action?: string;
  onPress?: () => void;
};

export function SectionHeader({ title, action, onPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onPress} style={styles.actionRow}>
          <Text style={styles.action}>{action}</Text>
          <AppIcon name="chevron-forward" size={13} color={COLORS.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
