import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio as ExpoAudio, type AVPlaybackStatus } from 'expo-av';
import { colors, getShadow, radius, sizes, spacing, typography } from '@/theme';

export interface RecordedAudioDraft {
  uri: string;
  durationMs: number;
  mimeType:
    | 'audio/mp4'
    | 'audio/mpeg'
    | 'audio/wav'
    | 'audio/x-wav'
    | 'audio/webm'
    | 'audio/ogg'
    | 'audio/aac';
}

interface AudioRecorderModalProps {
  visible: boolean;
  caption: string;
  onCaptionChange: (value: string) => void;
  isRecording: boolean;
  recordingDurationSeconds: number;
  recordedAudio: RecordedAudioDraft | null;
  isSending?: boolean;
  onStartRecording: () => Promise<void> | void;
  onStopRecording: () => Promise<void> | void;
  onDiscardRecording: () => Promise<void> | void;
  onClose: () => Promise<void> | void;
  onSend: () => Promise<void> | void;
}

function formatDuration(durationMs?: number): string {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSeconds(seconds: number): string {
  return formatDuration(seconds * 1000);
}

export function AudioRecorderModal({
  visible,
  caption,
  onCaptionChange,
  isRecording,
  recordingDurationSeconds,
  recordedAudio,
  isSending = false,
  onStartRecording,
  onStopRecording,
  onDiscardRecording,
  onClose,
  onSend,
}: AudioRecorderModalProps) {
  const soundRef = useRef<ExpoAudio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(
    recordedAudio?.durationMs ?? 0,
  );

  useEffect(() => {
    if (!visible) {
      setIsPlaying(false);
      setPlaybackPositionMs(0);
    }
  }, [visible]);

  useEffect(() => {
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(recordedAudio?.durationMs ?? 0);
    setIsPlaying(false);

    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [recordedAudio?.uri]);

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
    setPlaybackPositionMs(status.positionMillis ?? 0);
    setPlaybackDurationMs(status.durationMillis ?? recordedAudio?.durationMs ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPlaybackPositionMs(0);
      void soundRef.current?.setPositionAsync(0);
    }
  };

  const ensureSound = async () => {
    if (!recordedAudio) {
      return null;
    }

    if (soundRef.current) {
      return soundRef.current;
    }

    const { sound, status } = await ExpoAudio.Sound.createAsync(
      { uri: recordedAudio.uri },
      { shouldPlay: false },
      onPlaybackStatusUpdate,
    );

    soundRef.current = sound;

    if (status.isLoaded) {
      setPlaybackDurationMs(status.durationMillis ?? recordedAudio.durationMs);
    }

    return sound;
  };

  const handleTogglePlayback = async () => {
    const sound = await ensureSound();
    if (!sound) {
      return;
    }

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

  const handleDiscard = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    setIsPlaying(false);
    setPlaybackPositionMs(0);
    setPlaybackDurationMs(0);
    await onDiscardRecording();
  };

  const progress =
    playbackDurationMs > 0
      ? Math.min(1, playbackPositionMs / playbackDurationMs)
      : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Áudio no chat</Text>
                <Text style={styles.subtitle}>
                  Grave, revise e envie antes de soltar para a IA.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  void onClose();
                }}
                disabled={isSending}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!recordedAudio ? (
              <View style={styles.recordingPanel}>
                <View style={styles.heroIcon}>
                  <Ionicons
                    name={isRecording ? 'radio' : 'mic'}
                    size={28}
                    color={isRecording ? colors.error : colors.primary}
                  />
                </View>

                <Text style={styles.recordingTitle}>
                  {isRecording ? 'Gravando agora' : 'Pronto para gravar'}
                </Text>
                <Text style={styles.recordingHelp}>
                  {isRecording
                    ? 'Pare quando terminar para ouvir a prévia antes de enviar.'
                    : 'Abra o microfone, fale e revise o áudio antes de mandar.'}
                </Text>

                <Text style={styles.recordingTimer}>
                  {formatSeconds(recordingDurationSeconds)}
                </Text>

                <View style={styles.primaryRow}>
                  {isRecording ? (
                    <>
                      <TouchableOpacity
                        style={[styles.secondaryButton, styles.flexButton]}
                        onPress={() => {
                          void onClose();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.secondaryButtonText}>Cancelar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.primaryButton, styles.flexButton]}
                        onPress={() => {
                          void onStopRecording();
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="stop" size={18} color={colors.white} />
                        <Text style={styles.primaryButtonText}>Finalizar</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.fullWidthButton]}
                      onPress={() => {
                        void onStartRecording();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="mic" size={18} color={colors.white} />
                      <Text style={styles.primaryButtonText}>Começar gravação</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.previewPanel}>
                <TouchableOpacity
                  style={styles.previewCard}
                  onPress={() => {
                    void handleTogglePlayback();
                  }}
                  activeOpacity={0.82}
                >
                  <View style={styles.previewIcon}>
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={20}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.previewMeta}>
                    <Text style={styles.previewTitle}>Prévia do áudio</Text>
                    <Text style={styles.previewDuration}>
                      {formatDuration(playbackPositionMs || playbackDurationMs)} /{' '}
                      {formatDuration(playbackDurationMs || recordedAudio.durationMs)}
                    </Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[styles.progressFill, { width: `${progress * 100}%` }]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.captionBlock}>
                  <Text style={styles.captionLabel}>Mensagem opcional</Text>
                  <TextInput
                    style={styles.captionInput}
                    value={caption}
                    onChangeText={onCaptionChange}
                    placeholder="Diga o que a IA deve fazer com esse áudio"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={400}
                    textAlignVertical="top"
                    editable={!isSending}
                  />
                </View>

                <View style={styles.footerRow}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.flexButton]}
                    onPress={() => {
                      void handleDiscard();
                    }}
                    disabled={isSending}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryButtonText}>Regravar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, styles.flexButton]}
                    onPress={() => {
                      void onSend();
                    }}
                    disabled={isSending}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isSending ? 'time-outline' : 'send'}
                      size={18}
                      color={colors.white}
                    />
                    <Text style={styles.primaryButtonText}>
                      {isSending ? 'Enviando...' : 'Enviar áudio'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
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
  sheetWrapper: {
    justifyContent: 'flex-end',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
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
    maxWidth: 260,
  },
  closeButton: {
    width: sizes.touchMin,
    height: sizes.touchMin,
    borderRadius: sizes.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  recordingPanel: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  recordingTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  recordingHelp: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  recordingTimer: {
    marginTop: spacing.xl,
    fontSize: 34,
    lineHeight: 40,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  primaryRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  primaryButton: {
    minHeight: sizes.buttonHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    ...getShadow('sm'),
  },
  secondaryButton: {
    minHeight: sizes.buttonHeight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  flexButton: {
    flex: 1,
  },
  fullWidthButton: {
    width: '100%',
  },
  previewPanel: {
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  previewMeta: {
    flex: 1,
  },
  previewTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  previewDuration: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  progressTrack: {
    marginTop: spacing.sm,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  captionBlock: {
    gap: spacing.sm,
  },
  captionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  captionInput: {
    minHeight: 112,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
