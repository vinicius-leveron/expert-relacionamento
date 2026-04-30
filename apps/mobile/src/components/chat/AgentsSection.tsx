import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import { AgentCard } from './AgentCard';
import { SPECIALIZED_AGENTS, type SpecializedAgent } from '@/data/specialized-agents';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const COLLAPSED_HEIGHT = 0;
const EXPANDED_HEIGHT = 150;

interface AgentsSectionProps {
  visible?: boolean;
  onSelectAgent: (agent: SpecializedAgent) => void | Promise<void>;
}

export function AgentsSection({ visible = true, onSelectAgent }: AgentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const heightAnim = useRef(new Animated.Value(EXPANDED_HEIGHT)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const toggleExpanded = useCallback(() => {
    const toExpanded = !isExpanded;

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: toExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue: toExpanded ? 0 : 1,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: toExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    setIsExpanded(toExpanded);
  }, [isExpanded, heightAnim, rotateAnim, opacityAnim]);

  if (!visible) return null;

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityLabel={isExpanded ? 'Recolher agentes' : 'Expandir agentes'}
        accessibilityRole="button"
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Agentes Especializados</Text>
          <Text style={styles.headerSubtitle}>Toque para iniciar</Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { height: heightAnim, opacity: opacityAnim }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={isExpanded}
        >
          {SPECIALIZED_AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onPress={onSelectAgent} />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  content: {
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
});
