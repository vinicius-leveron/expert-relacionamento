import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, getShadow } from '@/theme';
import type { SpecializedAgent } from '@/data/specialized-agents';

interface AgentCardProps {
  agent: SpecializedAgent;
  onPress: (agent: SpecializedAgent) => void;
}

const CARD_WIDTH = 100;
const CARD_HEIGHT = 110;

export function AgentCard({ agent, onPress }: AgentCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(agent)}
      activeOpacity={0.7}
      accessibilityLabel={`Agente ${agent.name}`}
      accessibilityHint={agent.description}
      accessibilityRole="button"
    >
      <View style={[styles.iconContainer, { backgroundColor: `${agent.color}20` }]}>
        <Ionicons name={agent.icon} size={26} color={agent.color} />
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {agent.shortName}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('sm'),
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 16,
  },
});
