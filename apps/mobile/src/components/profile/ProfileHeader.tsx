import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';
import { Badge } from '@/components/ui';

const ARCHETYPE_DATA = {
  ansioso: { name: 'Ansioso', icon: 'heart' as const, color: '#EC4899' },
  seguro: { name: 'Seguro', icon: 'shield-checkmark' as const, color: '#10B981' },
  evitante: { name: 'Evitante', icon: 'shield' as const, color: '#3B82F6' },
  desorganizado: { name: 'Desorganizado', icon: 'shuffle' as const, color: '#F59E0B' },
};

interface ProfileHeaderProps {
  name?: string;
  email?: string;
  archetype?: string;
  avatarUrl?: string | null;
  onEditPress?: () => void;
  onSettingsPress?: () => void;
}

export function ProfileHeader({
  name,
  email,
  archetype,
  avatarUrl,
  onEditPress,
  onSettingsPress,
}: ProfileHeaderProps) {
  const archetypeData = archetype
    ? ARCHETYPE_DATA[archetype as keyof typeof ARCHETYPE_DATA]
    : null;

  const displayName = name || email?.split('@')[0] || 'Usuário';

  return (
    <View style={styles.container}>
      {/* Settings Button */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={onSettingsPress}
        accessibilityLabel="Configurações"
        accessibilityRole="button"
      >
        <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={onEditPress}
        activeOpacity={0.8}
        accessibilityLabel="Alterar foto de perfil"
        accessibilityRole="button"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.primary} />
          </View>
        )}
        <View style={styles.editAvatarBadge}>
          <Ionicons name="camera" size={14} color={colors.white} />
        </View>
      </TouchableOpacity>

      {/* Name + Badge */}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{displayName}</Text>
        {archetypeData && (
          <Badge
            label={archetypeData.name}
            variant="custom"
            color={archetypeData.color}
            icon={archetypeData.icon}
            size="md"
          />
        )}
      </View>

      {/* Email */}
      {email && <Text style={styles.email}>{email}</Text>}

      {/* Edit Button */}
      <TouchableOpacity
        style={styles.editButton}
        onPress={onEditPress}
        activeOpacity={0.8}
        accessibilityLabel="Editar perfil"
        accessibilityRole="button"
      >
        <Ionicons name="pencil" size={16} color={colors.primary} />
        <Text style={styles.editButtonText}>Editar perfil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  settingsButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: sizes.avatarXl,
    height: sizes.avatarXl,
    borderRadius: sizes.avatarXl / 2,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...getShadow('sm'),
  },
  avatarImage: {
    width: sizes.avatarXl,
    height: sizes.avatarXl,
    borderRadius: sizes.avatarXl / 2,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontFamily: 'Inter_400Regular',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.surface,
  },
  editButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
});
