import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';
import { SPECIALIZED_AGENTS, type SpecializedAgent } from '@/data/specialized-agents';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ITEM_HEIGHT = 44;
const COLLAPSED_HEIGHT = 0;

interface AgentsListProps {
  onSelectAgent: (agent: SpecializedAgent) => void | Promise<void>;
}

function AgentListItem({
  agent,
  onPress,
}: {
  agent: SpecializedAgent;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.agentItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={agent.name}
      accessibilityRole="button"
    >
      <View style={[styles.agentIcon, { backgroundColor: `${agent.color}20` }]}>
        <Ionicons name={agent.icon} size={18} color={agent.color} />
      </View>
      <Text style={styles.agentName} numberOfLines={1}>
        {agent.name}
      </Text>
    </TouchableOpacity>
  );
}

export function AgentsList({ onSelectAgent }: AgentsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedHeight = SPECIALIZED_AGENTS.length * ITEM_HEIGHT;
  const heightAnim = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = useCallback(() => {
    const toExpanded = !isExpanded;

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: toExpanded ? expandedHeight : COLLAPSED_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue: toExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    setIsExpanded(toExpanded);
  }, [isExpanded, heightAnim, rotateAnim, expandedHeight]);

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
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
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </Animated.View>
        <Text style={styles.headerTitle}>Agentes</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { height: heightAnim }]}>
        {SPECIALIZED_AGENTS.map((agent) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            onPress={() => onSelectAgent(agent)}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    overflow: 'hidden',
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingHorizontal: spacing.sm,
    paddingLeft: spacing.lg + spacing.xs,
    gap: spacing.sm,
  },
  agentIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
});
