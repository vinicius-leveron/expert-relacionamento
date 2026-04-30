import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme';
import { ActionCard } from './ActionCard';
import { Ionicons } from '@expo/vector-icons';

interface ActionGridItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
}

interface ActionGridProps {
  items: ActionGridItem[];
}

export function ActionGrid({ items }: ActionGridProps) {
  // Split items into rows of 2
  const rows: ActionGridItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item, itemIndex) => (
            <ActionCard
              key={itemIndex}
              icon={item.icon}
              label={item.label}
              onPress={item.onPress}
              color={item.color}
              disabled={item.disabled}
            />
          ))}
          {/* Add placeholder if odd number of items in last row */}
          {row.length === 1 && <View style={styles.placeholder} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  placeholder: {
    flex: 1,
  },
});
