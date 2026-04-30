import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getShadow, radius, sizes, spacing, typography } from '@/theme';

type AttachmentPickerOption = 'image' | 'file' | 'audio';

interface AttachmentPickerModalProps {
  visible: boolean;
  onClose: () => Promise<void> | void;
  onSelect: (option: AttachmentPickerOption) => Promise<void> | void;
}

const OPTIONS: Array<{
  key: AttachmentPickerOption;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: 'image',
    title: 'Imagem',
    subtitle: 'Escolher da galeria para análise visual',
    icon: 'image-outline',
  },
  {
    key: 'file',
    title: 'Arquivo',
    subtitle: 'PDF, TXT, Markdown ou JSON',
    icon: 'document-text-outline',
  },
  {
    key: 'audio',
    title: 'Áudio',
    subtitle: 'Gravar voz e enviar para transcrição',
    icon: 'mic-outline',
  },
];

export function AttachmentPickerModal({
  visible,
  onClose,
  onSelect,
}: AttachmentPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        void onClose();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            void onClose();
          }}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Anexar no chat</Text>
          <Text style={styles.subtitle}>Escolha o tipo de envio</Text>

          <View style={styles.optionList}>
            {OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.optionCard}
                activeOpacity={0.82}
                onPress={() => {
                  void onSelect(option.key);
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={option.icon} size={20} color={colors.primary} />
                </View>

                <View style={styles.optionMeta}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            activeOpacity={0.8}
            onPress={() => {
              void onClose();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...getShadow('md'),
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray300,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  optionList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: sizes.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  optionMeta: {
    flex: 1,
  },
  optionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  optionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
    minHeight: sizes.buttonHeight,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    marginTop: spacing.lg,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
});
