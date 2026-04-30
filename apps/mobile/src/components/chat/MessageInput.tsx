import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatAttachment } from '@/stores/chat.store';
import { colors, spacing, radius, sizes, getShadow, typography } from '@/theme';

interface MessageInputProps {
  onSend: (message: string) => Promise<void> | void;
  onPickAttachment: (
    draftText: string,
    clearDraft: () => void,
  ) => Promise<void> | void;
  onOpenAudioRecorder: (
    draftText: string,
    clearDraft: () => void,
  ) => Promise<void> | void;
  onRemoveAttachment: (attachmentId: string) => Promise<void> | void;
  onRetryAttachment: (attachmentId: string) => Promise<void> | void;
  attachments?: ChatAttachment[];
  disabled?: boolean;
  isUploadingAttachment?: boolean;
  placeholder?: string;
}

function getAttachmentStatusLabel(status: ChatAttachment['status']): string {
  switch (status) {
    case 'pending_upload':
      return 'Enviando';
    case 'uploaded':
      return 'Recebido';
    case 'processing':
      return 'Indexando';
    case 'ready':
      return 'Pronto';
    case 'failed':
      return 'Falhou';
    default:
      return status;
  }
}

export function MessageInput({
  onSend,
  onPickAttachment,
  onOpenAudioRecorder,
  onRemoveAttachment,
  onRetryAttachment,
  attachments = [],
  disabled = false,
  isUploadingAttachment = false,
  placeholder = 'Digite sua mensagem...',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const hasPendingUpload = attachments.some(
    (attachment) => attachment.status === 'pending_upload',
  );
  const sendableAttachments = attachments.filter(
    (attachment) => attachment.status !== 'failed',
  );

  const handleSend = async () => {
    if (
      (!text.trim() && sendableAttachments.length === 0) ||
      disabled ||
      isUploadingAttachment ||
      hasPendingUpload
    ) {
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    await onSend(text.trim());
    setText('');
  };

  const canSend =
    (text.trim().length > 0 || sendableAttachments.length > 0) &&
    !disabled &&
    !isUploadingAttachment &&
    !hasPendingUpload;

  return (
    <View style={styles.wrapper}>
      {attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentChip}>
              <View style={styles.attachmentMeta}>
                <Text numberOfLines={1} style={styles.attachmentName}>
                  {attachment.fileName}
                </Text>
                <Text style={styles.attachmentStatus}>
                  {getAttachmentStatusLabel(attachment.status)}
                </Text>
              </View>

              <View style={styles.attachmentActions}>
                {attachment.status === 'failed' && (
                  <TouchableOpacity
                    onPress={() => {
                      void onRetryAttachment(attachment.id);
                    }}
                    disabled={disabled}
                    style={styles.attachmentAction}
                  >
                    <Ionicons
                      name="refresh"
                      size={16}
                      color={colors.warningDark}
                    />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    void onRemoveAttachment(attachment.id);
                  }}
                  disabled={disabled}
                  style={styles.attachmentAction}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.container}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => {
            void onPickAttachment(text.trim(), () => setText(''));
          }}
          disabled={isUploadingAttachment}
          activeOpacity={0.7}
        >
          <Ionicons
            name="attach"
            size={sizes.iconMd}
            color={
              isUploadingAttachment
                ? colors.textMuted
                : colors.primary
            }
          />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            editable={!disabled}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>

        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => {
            void onOpenAudioRecorder(text.trim(), () => setText(''));
          }}
          disabled={isUploadingAttachment}
          activeOpacity={0.7}
        >
          <Ionicons
            name="mic"
            size={sizes.iconMd}
            color={
              isUploadingAttachment
                ? colors.textMuted
                : colors.primary
            }
          />
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            onPress={() => {
              void handleSend();
            }}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={sizes.iconMd}
              color={canSend ? colors.white : colors.textMuted}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachmentsContainer: {
    paddingHorizontal: spacing.sm + 4,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  attachmentMeta: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  attachmentName: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  attachmentStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  attachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attachmentAction: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  attachButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: sizes.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  audioButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: sizes.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: sizes.touchMin,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'Inter_400Regular',
  },
  sendButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: sizes.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
    ...getShadow('sm'),
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray200,
  },
});
