import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '@/stores/profile.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  SettingsItem,
  SettingsSection,
  SettingsDivider,
  ActionGrid,
} from '@/components/settings';
import { SubscriptionCard } from '@/components/profile';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { openCheckoutUrl } from '@/utils/checkout';
import { appLinks } from '@/config/app-links';
import { openExternalLink } from '@/utils/external-link';
import { captureAnalyticsEvent } from '@/analytics/posthog';

export default function SettingsScreen() {
  const { profile } = useProfileStore();
  const { logout, user } = useAuthStore();
  const canOpenCheckoutInCurrentClient =
    Platform.OS === 'web' || profile?.commerce.nativeCheckoutMode === 'external_link';

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação é irreversível.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            // TODO: Implementar exclusão de conta
          },
        },
      ]
    );
  };

  const handleOpenSubscription = () => {
    captureAnalyticsEvent('settings_subscription_clicked');
    router.push('/(app)/subscription');
  };

  const handleOpenCheckout = () => {
    if (!canOpenCheckoutInCurrentClient) {
      Alert.alert(
        'Assinatura disponível no site',
        'Neste app a contratação fica bloqueada. Use o site oficial para assinar e depois volte para acompanhar seu acesso.'
      );
      return;
    }

    captureAnalyticsEvent('settings_checkout_clicked');
    void openCheckoutUrl(profile?.commerce.checkoutUrl);
  };

  const handleOpenHelp = () => {
    captureAnalyticsEvent('settings_help_clicked');
    router.push('/(app)/help');
  };

  const formatPhoneNumber = (phone?: string | null) => {
    if (!phone) return undefined;
    // Mask phone number for privacy
    if (phone.length > 8) {
      return `${phone.slice(0, 4)}...${phone.slice(-4)}`;
    }
    return phone;
  };

  const formatEmail = (email?: string | null) => {
    if (!email) return undefined;
    const [local, domain] = email.split('@');
    if (local.length > 4) {
      return `${local.slice(0, 4)}...@${domain}`;
    }
    return email;
  };

  const actionItems = [
    {
      icon: 'notifications-outline' as const,
      label: 'Notificações',
      onPress: () => {
        // TODO: Implementar tela de notificações
      },
      color: colors.info,
    },
    {
      icon: 'color-palette-outline' as const,
      label: 'Tema',
      disabled: true,
      color: colors.primary,
    },
    {
      icon: 'lock-closed-outline' as const,
      label: 'Privacidade',
      disabled: true,
      color: colors.warning,
    },
    {
      icon: 'analytics-outline' as const,
      label: 'Meus Dados',
      disabled: true,
      color: colors.success,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Configurações',
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: {
            ...typography.h3,
            fontFamily: 'Inter_600SemiBold',
            color: colors.textPrimary,
          },
          headerShadowVisible: false,
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <Text style={styles.headerButtonText}>OK</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Subscription Card */}
        <View style={styles.subscriptionSection}>
          <SubscriptionCard
            isActive={profile?.access.hasActiveSubscription}
            planName={profile?.subscription?.planId ?? 'Premium'}
            onSubscribePress={handleOpenCheckout}
            onManagePress={handleOpenSubscription}
          />
        </View>

        {/* Action Grid */}
        <View style={styles.section}>
          <ActionGrid items={actionItems} />
        </View>

        {/* Account Section */}
        <SettingsSection title="Conta">
          <SettingsItem
            icon="call-outline"
            label="Telefone"
            value={formatPhoneNumber(user?.phone)}
            onPress={() => {}}
          />
          <SettingsDivider />
          <SettingsItem
            icon="mail-outline"
            label="E-mail"
            value={formatEmail(user?.email)}
            onPress={() => {}}
          />
          <SettingsDivider />
          <SettingsItem
            icon="link-outline"
            label="Contas conectadas"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Suporte">
          <SettingsItem
            icon="help-circle-outline"
            label="Central de Ajuda"
            onPress={handleOpenHelp}
          />
          <SettingsDivider />
          <SettingsItem
            icon="chatbubble-outline"
            label="Falar com Suporte"
            onPress={() => {
              void openExternalLink(appLinks.supportUrl, {
                unavailableTitle: 'Suporte indisponível',
                unavailableMessage: 'O canal de suporte ainda não foi configurado neste build.',
              });
            }}
          />
          <SettingsDivider />
          <SettingsItem
            icon="document-text-outline"
            label="Termos de Uso"
            onPress={() => {
              router.push('/(auth)/legal?document=terms');
            }}
          />
          <SettingsDivider />
          <SettingsItem
            icon="shield-checkmark-outline"
            label="Política de Privacidade"
            onPress={() => {
              router.push('/(auth)/legal?document=privacy');
            }}
          />
        </SettingsSection>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
            accessibilityLabel="Sair da conta"
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          accessibilityLabel="Excluir conta"
          accessibilityRole="button"
        >
          <Text style={styles.deleteButtonText}>Excluir Conta</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Perpétuo v1.0.0</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButtonText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  subscriptionSection: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  section: {
    padding: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...getShadow('sm'),
  },
  logoutButtonText: {
    ...typography.body,
    color: colors.error,
    fontFamily: 'Inter_600SemiBold',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  deleteButtonText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'underline',
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.xxl,
    fontFamily: 'Inter_400Regular',
  },
});
