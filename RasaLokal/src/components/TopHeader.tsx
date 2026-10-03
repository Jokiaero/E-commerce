import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';

type Props = { title: string; back?: boolean; rightIcon?: string };

export function TopHeader({ title, back = true, rightIcon }: Props) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {back ? (
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <AppIcon name="chevron-back" size={24} color={COLORS.text} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.side, styles.right]}>
        {rightIcon ? <AppIcon name={rightIcon} size={22} color={COLORS.text} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  side: { width: 44, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  iconButton: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text },
});
