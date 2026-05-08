import { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio as ExpoAudio, type AVPlaybackStatus } from 'expo-av';
import type {
  ChatAttachment,
  MessageClientState,
} from '@/stores/chat.store';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';
import {
  parseMessage,
  type ParsedComponent,
  type QuickRepliesData,
  type ArchetypeCardData,
  type DayCardData,
} from '@/utils/message-parser';
import { MarkdownText } from '@/utils/markdown-renderer';
import { QuickReplyButtons } from './QuickReplyButtons';
import { ArchetypeCard } from './ArchetypeCard';
import { JourneyCard } from './JourneyCard';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  image?: {
    url: string;
    mimeType?: string;
  };
  audio?: {
    url: string;
    mimeType?: string;
    durationMs?: number;
  };
  attachments?: ChatAttachment[];
  clientState?: MessageClientState;
  errorMessage?: string;
  timestamp?: string;
  showAvatar?: boolean;
  animated?: boolean;
  onQuickReply?: (option: string) => void;
  onArchetypePress?: () => void;
  onJourneyPress?: () => void;
  onRetryMessage?: () => void;
  isLastMessage?: boolean;
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

interface ComponentHandlers {
  onQuickReply?: (option: string) => void;
  onArchetypePress?: () => void;
  onJourneyPress?: () => void;
  isLastMessage?: boolean;
}

function formatDuration(durationMs?: number): string {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function AudioPreview({
  audio,
  isUser,
  hasSpacingAbove,
}: {
  audio: NonNullable<ChatBubbleProps['audio']>;
  isUser: boolean;
  hasSpacingAbove: boolean;
}) {
  const soundRef = useRef<ExpoAudio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(audio.durationMs ?? 0);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    setIsPlaying(status.isPlaying);
    setDurationMs(status.durationMillis ?? audio.durationMs ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      void soundRef.current?.setPositionAsync(0);
    }
  };

  const ensureSound = async () => {
    if (soundRef.current) {
      return soundRef.current;
    }

    const { sound, status } = await ExpoAudio.Sound.createAsync(
      { uri: audio.url },
      { shouldPlay: false },
      onPlaybackStatusUpdate,
    );

    soundRef.current = sound;

    if (status.isLoaded) {
      setDurationMs(status.durationMillis ?? audio.durationMs ?? 0);
    }

    return sound;
  };

  const handleTogglePlayback = async () => {
    const sound = await ensureSound();
    const status = await sound.getStatusAsync();

    if (!status.isLoaded) {
      return;
    }

    if (status.isPlaying) {
      await sound.pauseAsync();
      return;
    }

    if (
      typeof status.durationMillis === 'number' &&
      status.positionMillis >= status.durationMillis - 250
    ) {
      await sound.setPositionAsync(0);
    }

    await sound.playAsync();
  };

  return (
    <TouchableOpacity
      style={[
        styles.audioCard,
        isUser ? styles.userAudioCard : styles.assistantAudioCard,
        hasSpacingAbove ? styles.audioWithSpacing : null,
      ]}
      onPress={() => {
        void handleTogglePlayback();
      }}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.audioIcon,
          isUser ? styles.userAudioIcon : styles.assistantAudioIcon,
        ]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={isUser ? colors.primary : colors.white}
        />
      </View>

      <View style={styles.audioMeta}>
        <Text
          style={[
            styles.audioLabel,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {isPlaying ? 'Reproduzindo áudio' : 'Áudio enviado'}
        </Text>
        <Text
          style={[
            styles.audioDuration,
            isUser ? styles.userAttachmentStatus : styles.assistantAttachmentStatus,
          ]}
        >
          {formatDuration(durationMs)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function renderComponent(
  component: ParsedComponent,
  index: number,
  handlers: ComponentHandlers
) {
  const { type, data } = component;
  const { onQuickReply, onArchetypePress, onJourneyPress, isLastMessage } = handlers;

  switch (type) {
    case 'quick_replies':
      // Só mostra botões na última mensagem
      if (!isLastMessage) return null;
      return (
        <QuickReplyButtons
          key={`qr-${index}`}
          data={data as QuickRepliesData}
          onSelect={onQuickReply || (() => {})}
        />
      );
    case 'archetype_card':
      return (
        <ArchetypeCard
          key={`ac-${index}`}
          data={data as ArchetypeCardData}
          onPress={onArchetypePress}
        />
      );
    case 'day_card':
      return (
        <JourneyCard
          key={`jc-${index}`}
          data={data as DayCardData}
          onPress={onJourneyPress}
        />
      );
    default:
      return null;
  }
}

export function ChatBubble({
  role,
  content,
  image,
  audio,
  attachments = [],
  clientState,
  errorMessage,
  timestamp,
  showAvatar = true,
  animated = true,
  onQuickReply,
  onArchetypePress,
  onJourneyPress,
  onRetryMessage,
  isLastMessage = false,
}: ChatBubbleProps) {
  const isUser = role === 'user';
  const fadeAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animated ? 20 : 0)).current;

  // Parse message para extrair componentes interativos (apenas para mensagens do assistente)
  const parsed = useMemo(() => {
    if (isUser) {
      return { text: content, components: [] };
    }
    return parseMessage(content);
  }, [content, isUser]);

  const hasContent = parsed.text.trim().length > 0;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [animated, fadeAnim, slideAnim]);

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {!isUser && showAvatar && (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>I</Text>
          </View>
        </View>
      )}

      {!isUser && !showAvatar && <View style={styles.avatarSpacer} />}

      <View style={styles.bubbleWrapper}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {attachments.map((attachment) => (
                <View
                  key={attachment.id}
                  style={[
                    styles.attachmentCard,
                    isUser ? styles.userAttachmentCard : styles.assistantAttachmentCard,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.attachmentName,
                      isUser ? styles.userText : styles.assistantText,
                    ]}
                  >
                    {attachment.fileName}
                  </Text>
                  <Text
                    style={[
                      styles.attachmentStatus,
                      isUser ? styles.userAttachmentStatus : styles.assistantAttachmentStatus,
                    ]}
                  >
                    {getAttachmentStatusLabel(attachment.status)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {image?.url && (
            <Image
              source={{ uri: image.url }}
              style={[
                styles.imagePreview,
                hasContent || attachments.length > 0 ? styles.imageWithSpacing : null,
              ]}
              resizeMode="cover"
            />
          )}

          {audio?.url && (
            <AudioPreview
              audio={audio}
              isUser={isUser}
              hasSpacingAbove={hasContent || attachments.length > 0 || Boolean(image?.url)}
            />
          )}

          {hasContent && (
            isUser ? (
              <Text
                style={[
                  styles.text,
                  styles.userText,
                  attachments.length > 0 || image?.url || audio?.url ? styles.textWithAttachments : null,
                ]}
              >
                {content}
              </Text>
            ) : (
              <MarkdownText
                style={[
                  styles.text,
                  styles.assistantText,
                  attachments.length > 0 || image?.url || audio?.url ? styles.textWithAttachments : null,
                ]}
              >
                {parsed.text}
              </MarkdownText>
            )
          )}

          {/* Componentes interativos extraídos da mensagem */}
          {!isUser && parsed.components.length > 0 && (
            <View style={styles.componentsContainer}>
              {parsed.components.map((component, index) =>
                renderComponent(component, index, {
                  onQuickReply,
                  onArchetypePress,
                  onJourneyPress,
                  isLastMessage,
                })
              )}
            </View>
          )}
        </View>

        {timestamp && (
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.assistantTimestamp,
            ]}
          >
            {formatTime(timestamp)}
          </Text>
        )}

        {isUser && clientState === 'sending' && (
          <View style={styles.messageStateRow}>
            <Ionicons
              name="time-outline"
              size={12}
              color={colors.textMuted}
            />
            <Text style={styles.messageStateText}>Enviando...</Text>
          </View>
        )}

        {isUser && clientState === 'failed' && (
          <View style={styles.messageStateRow}>
            <Ionicons
              name="alert-circle-outline"
              size={12}
              color={colors.error}
            />
            <Text style={[styles.messageStateText, styles.messageStateError]}>
              {errorMessage || 'Não foi possível enviar'}
            </Text>
            {onRetryMessage && (
              <TouchableOpacity
                onPress={onRetryMessage}
                style={styles.retryButton}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>Tentar de novo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm + 4,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: spacing.sm,
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  avatarSpacer: {
    width: sizes.avatarSm + spacing.sm,
  },
  avatar: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: sizes.avatarSm / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('sm'),
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  bubble: {
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  attachmentsContainer: {
    gap: spacing.xs,
  },
  componentsContainer: {
    marginTop: spacing.sm,
  },
  attachmentCard: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  userAttachmentCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  assistantAttachmentCard: {
    backgroundColor: colors.gray100,
  },
  attachmentName: {
    ...typography.body,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  attachmentStatus: {
    ...typography.caption,
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  userAttachmentStatus: {
    color: 'rgba(255,255,255,0.78)',
  },
  assistantAttachmentStatus: {
    color: colors.textSecondary,
  },
  imagePreview: {
    width: 220,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  imageWithSpacing: {
    marginTop: spacing.sm,
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  audioWithSpacing: {
    marginTop: spacing.sm,
  },
  userAudioCard: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  assistantAudioCard: {
    backgroundColor: colors.gray100,
  },
  audioIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAudioIcon: {
    backgroundColor: colors.surface,
  },
  assistantAudioIcon: {
    backgroundColor: colors.primary,
  },
  audioMeta: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  audioLabel: {
    ...typography.body,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  audioDuration: {
    ...typography.caption,
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
    ...getShadow('sm'),
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
  },
  textWithAttachments: {
    marginTop: spacing.sm,
  },
  userText: {
    color: colors.white,
    fontFamily: 'Inter_400Regular',
  },
  assistantText: {
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  timestamp: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  userTimestamp: {
    textAlign: 'right',
    marginRight: spacing.xs,
  },
  assistantTimestamp: {
    textAlign: 'left',
    marginLeft: spacing.xs,
  },
  messageStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  messageStateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    flexShrink: 1,
  },
  messageStateError: {
    color: colors.errorDark,
  },
  retryButton: {
    marginLeft: spacing.xs,
  },
  retryButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
