import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radius, getShadow } from '@/theme';

function formatUserCount(count: number): string {
  if (count >= 1000) {
    const formatted = (count / 1000).toFixed(1).replace('.0', '');
    return `${formatted}mil`;
  }
  return count.toString();
}

interface ExploreCardProps {
  title: string;
  gradient: [string, string];
  activeUsers?: number;
  onPress: () => void;
  width: number;
  height: number;
}

export function ExploreCard({
  title,
  gradient,
  activeUsers,
  onPress,
  width,
  height,
}: ExploreCardProps) {
  return (
    <TouchableOpacity
      style={[styles.container, { width, height }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Overlay for better text contrast */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.5, 1]}
          style={styles.overlay}
        />

        {/* User count badge */}
        {activeUsers !== undefined && (
          <View style={styles.badge}>
            <Ionicons name="person" size={12} color={colors.white} />
            <Text style={styles.badgeText}>{formatUserCount(activeUsers)}</Text>
          </View>
        )}

        {/* Title at bottom */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...getShadow('md'),
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
