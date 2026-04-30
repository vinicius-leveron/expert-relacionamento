import { TouchableOpacity, Text, View, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/theme';
import type { Conversation } from '@/stores/conversations.store';

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}

export function ConversationListItem({
  conversation,
  isActive,
  onPress,
  onDelete,
}: ConversationListItemProps) {
  const handleDelete = () => {
    Alert.alert(
      'Arquivar conversa',
      'Deseja realmente arquivar esta conversa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return 'Hoje';
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return `${diffDays} dias atrás`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.activeContainer]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Conversa: ${conversation.title}`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="chatbubble-outline"
          size={18}
          color={isActive ? colors.primary : colors.textMuted}
        />
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.title, isActive && styles.activeTitle]}
          numberOfLines={1}
        >
          {conversation.title}
        </Text>
        <Text style={styles.date}>{formatDate(conversation.updatedAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Arquivar conversa"
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
    marginVertical: 2,
    borderRadius: radius.md,
  },
  activeContainer: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.md - 3,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
  activeTitle: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.xs,
  },
});
