import { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useChatStore, type Message } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import {
  AudioRecorderModal,
  AttachmentPickerModal,
  ChatBubble,
  ChatHeader,
  MessageInput,
  QuickReplies,
  TypingIndicator,
  type RecordedAudioDraft,
} from '@/components/chat';
import { colors, spacing, typography, getShadow, sizes } from '@/theme';

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const {
    messages,
    pendingAttachments,
    sendMessage,
    sendImageMessage,
    sendAudioMessage,
    retryMessage,
    uploadAttachment,
    retryAttachment,
    removePendingAttachment,
    isLoading,
    isUploadingAttachment,
    connectSSE,
    disconnectSSE,
    conversationId,
    loadMessages,
  } = useChatStore();
  const { accessToken } = useAuthStore();
  const { fetchConversations, activeId, setActiveId } = useConversationsStore();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioDraftClearRef = useRef<(() => void) | null>(null);
  const pendingRecordedAudioUriRef = useRef<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingAudioDurationSeconds, setRecordingAudioDurationSeconds] = useState(0);
  const [isAudioRecorderVisible, setIsAudioRecorderVisible] = useState(false);
  const [isAttachmentPickerVisible, setIsAttachmentPickerVisible] = useState(false);
  const [audioCaptionDraft, setAudioCaptionDraft] = useState('');
  const [recordedAudioDraft, setRecordedAudioDraft] =
    useState<RecordedAudioDraft | null>(null);
  const [isSendingRecordedAudio, setIsSendingRecordedAudio] = useState(false);

  const hasMessages = messages.length > 0;

  // Inicializar conversas ao montar
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Sincronizar conversationId do chat store com activeId do conversations store
  useEffect(() => {
    if (conversationId && conversationId !== activeId) {
      setActiveId(conversationId);
    }
  }, [conversationId, activeId, setActiveId]);

  useEffect(() => {
    if (!activeId || activeId === conversationId) {
      return;
    }

    useChatStore.setState({
      messages: [],
      conversationId: activeId,
      pendingAttachments: [],
      isLoading: false,
    });

    void loadMessages();
  }, [activeId, conversationId, loadMessages]);

  useEffect(() => {
    if (accessToken) {
      connectSSE(accessToken);
    }
    return () => {
      disconnectSSE();
    };
  }, [accessToken, connectSSE, disconnectSSE]);

  const stopRecordingTicker = useCallback(() => {
    if (recordingTickerRef.current) {
      clearInterval(recordingTickerRef.current);
      recordingTickerRef.current = null;
    }
  }, []);

  const cleanupLocalAudioFile = useCallback(async (uri?: string | null) => {
    if (!uri) {
      return;
    }

    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      stopRecordingTicker();

      const recording = recordingRef.current;
      recordingRef.current = null;
      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => {});
      }

      if (pendingRecordedAudioUriRef.current) {
        void cleanupLocalAudioFile(pendingRecordedAudioUriRef.current);
        pendingRecordedAudioUriRef.current = null;
      }
    };
  }, [cleanupLocalAudioFile, stopRecordingTicker]);

  const handleOpenDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  useEffect(() => {
    // Animate empty state
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSend = async (text: string) => {
    try {
      await sendMessage(text);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Falha ao enviar mensagem:', error);
    }
  };

  const handleQuickReply = async (text: string) => {
    console.log('[QuickReply] Selecionado:', text);
    try {
      await handleSend(text);
    } catch (error) {
      console.error('[QuickReply] Erro ao enviar:', error);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: [
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/json',
        ],
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      await uploadAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: asset.size ?? 0,
      });
    } catch {
      Alert.alert('Falha no upload', 'Não consegui anexar esse arquivo agora.');
    }
  };

  const handlePickImage = async (draftText: string, clearDraft: () => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64 || !asset.mimeType) {
        throw new Error('Missing image payload');
      }

      if (
        asset.mimeType !== 'image/jpeg' &&
        asset.mimeType !== 'image/png' &&
        asset.mimeType !== 'image/webp'
      ) {
        Alert.alert('Formato não suportado', 'Use JPG, PNG ou WebP.');
        return;
      }

      await sendImageMessage({
        uri: asset.uri,
        base64: asset.base64,
        mediaType: asset.mimeType,
        caption: draftText || undefined,
      });
      clearDraft();
    } catch {
      console.error('Falha ao enviar imagem');
    }
  };

  const handleStartAudioRecording = async () => {
    if (isRecordingAudio) {
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microfone bloqueado',
          'Preciso da permissão de microfone para gravar o áudio.',
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setRecordingAudioDurationSeconds(0);
      setIsRecordingAudio(true);
      stopRecordingTicker();

      recordingTickerRef.current = setInterval(() => {
        void recording.getStatusAsync().then((status) => {
          if (!status.canRecord && status.durationMillis <= 0) {
            return;
          }

          setRecordingAudioDurationSeconds(
            Math.max(0, Math.round((status.durationMillis ?? 0) / 1000)),
          );
        });
      }, 500);
    } catch {
      Alert.alert(
        'Falha ao gravar',
        'Não consegui iniciar a gravação agora.',
      );
      setIsRecordingAudio(false);
      stopRecordingTicker();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const handleCancelAudioRecording = async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecordingAudio(false);
    setRecordingAudioDurationSeconds(0);
    stopRecordingTicker();

    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // noop
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const handleStopAudioRecording = async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    stopRecordingTicker();
    setIsRecordingAudio(false);

    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error('Missing recording file');
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      const durationMs =
        typeof status.durationMillis === 'number'
          ? status.durationMillis
          : recordingAudioDurationSeconds * 1000;

      pendingRecordedAudioUriRef.current = uri;
      setRecordedAudioDraft({
        uri,
        mimeType: 'audio/mp4',
        durationMs,
      });
      setRecordingAudioDurationSeconds(0);

      if (!fileInfo.exists) {
        console.warn('Recorded audio file is no longer available locally');
      }
    } catch {
      Alert.alert(
        'Falha ao enviar áudio',
        'Não consegui finalizar ou enviar esse áudio agora.',
      );
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const handleOpenAudioRecorder = (
    draftText: string,
    clearDraft: () => void,
  ) => {
    audioDraftClearRef.current = clearDraft;
    setAudioCaptionDraft(draftText);
    setIsAudioRecorderVisible(true);
  };

  const handleOpenAttachmentPicker = (
    draftText: string,
    clearDraft: () => void,
  ) => {
    audioDraftClearRef.current = clearDraft;
    setAudioCaptionDraft(draftText);
    setIsAttachmentPickerVisible(true);
  };

  const handleCloseAttachmentPicker = () => {
    setIsAttachmentPickerVisible(false);
  };

  const handleSelectAttachmentOption = async (
    option: 'image' | 'file' | 'audio',
  ) => {
    setIsAttachmentPickerVisible(false);

    if (option === 'image') {
      await handlePickImage(
        audioCaptionDraft,
        audioDraftClearRef.current ?? (() => {}),
      );
      return;
    }

    if (option === 'file') {
      await handlePickDocument();
      return;
    }

    handleOpenAudioRecorder(
      audioCaptionDraft,
      audioDraftClearRef.current ?? (() => {}),
    );
  };

  const handleDiscardRecordedAudio = async () => {
    if (recordedAudioDraft) {
      await cleanupLocalAudioFile(recordedAudioDraft.uri);
    }

    pendingRecordedAudioUriRef.current = null;
    setRecordedAudioDraft(null);
  };

  const handleCloseAudioRecorder = async () => {
    if (isSendingRecordedAudio) {
      return;
    }

    if (isRecordingAudio) {
      await handleCancelAudioRecording();
    }

    if (recordedAudioDraft) {
      await cleanupLocalAudioFile(recordedAudioDraft.uri);
      pendingRecordedAudioUriRef.current = null;
      setRecordedAudioDraft(null);
    }

    audioDraftClearRef.current = null;
    setAudioCaptionDraft('');
    setIsAudioRecorderVisible(false);
  };

  const handleSendRecordedAudio = async () => {
    if (!recordedAudioDraft || isSendingRecordedAudio) {
      return;
    }

    setIsSendingRecordedAudio(true);
    const nextCaption = audioCaptionDraft.trim();

    try {
      pendingRecordedAudioUriRef.current = null;

      await sendAudioMessage({
        uri: recordedAudioDraft.uri,
        mimeType: recordedAudioDraft.mimeType,
        durationMs: recordedAudioDraft.durationMs,
        caption: nextCaption.length > 0 ? nextCaption : undefined,
      });

      audioDraftClearRef.current?.();
      audioDraftClearRef.current = null;
      setAudioCaptionDraft('');
      setRecordedAudioDraft(null);
      setIsAudioRecorderVisible(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch {
      audioDraftClearRef.current = null;
      setAudioCaptionDraft('');
      setRecordedAudioDraft(null);
      setIsAudioRecorderVisible(false);
    } finally {
      setIsSendingRecordedAudio(false);
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    try {
      await retryMessage(messageId);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Falha ao reenviar mensagem:', error);
    }
  };

  const handleRetryAttachment = async (attachmentId: string) => {
    try {
      await retryAttachment(attachmentId);
    } catch {
      Alert.alert('Falha no retry', 'Ainda não consegui reenviar esse arquivo.');
    }
  };

  const handlePickAttachment = async (draftText: string, clearDraft: () => void) => {
    handleOpenAttachmentPicker(draftText, clearDraft);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isFirstOfGroup =
      index === 0 || messages[index - 1].role !== item.role;
    const isLastMessage = index === messages.length - 1;

    return (
      <ChatBubble
        role={item.role}
        content={item.content}
        image={item.image}
        audio={item.audio}
        attachments={item.attachments}
        clientState={item.clientState}
        errorMessage={item.errorMessage}
        timestamp={item.createdAt}
        showAvatar={item.role === 'assistant' && isFirstOfGroup}
        animated={isLastMessage}
        isLastMessage={isLastMessage}
        onQuickReply={handleQuickReply}
        onRetryMessage={
          item.role === 'user' && item.clientState === 'failed'
            ? () => {
                void handleRetryMessage(item.id);
              }
            : undefined
        }
      />
    );
  };

  const EmptyState = () => (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <View style={styles.emptyAvatar}>
        <Text style={styles.emptyAvatarText}>I</Text>
      </View>
      <Text style={styles.emptyTitle}>Oi, tudo bem?</Text>
      <Text style={styles.emptyText}>
        Eu sou a Isabela, sua coach de relacionamentos. Me conta, como posso te
        ajudar hoje?
      </Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ChatHeader isTyping={isLoading} onDrawerPress={handleOpenDrawer} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.flatList}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={!isLoading ? EmptyState : null}
          ListFooterComponent={<TypingIndicator visible={isLoading} />}
        />

        {/* Quick Replies - show only when no messages */}
        {!hasMessages && !isLoading && (
          <QuickReplies onSelect={handleQuickReply} />
        )}

        <MessageInput
          onSend={handleSend}
          onPickAttachment={handlePickAttachment}
          onOpenAudioRecorder={handleOpenAudioRecorder}
          onRemoveAttachment={removePendingAttachment}
          onRetryAttachment={handleRetryAttachment}
          attachments={pendingAttachments}
          disabled={isLoading}
          isUploadingAttachment={isUploadingAttachment}
        />

        <AttachmentPickerModal
          visible={isAttachmentPickerVisible}
          onClose={handleCloseAttachmentPicker}
          onSelect={handleSelectAttachmentOption}
        />

        <AudioRecorderModal
          visible={isAudioRecorderVisible}
          caption={audioCaptionDraft}
          onCaptionChange={setAudioCaptionDraft}
          isRecording={isRecordingAudio}
          recordingDurationSeconds={recordingAudioDurationSeconds}
          recordedAudio={recordedAudioDraft}
          isSending={isSendingRecordedAudio}
          onStartRecording={handleStartAudioRecording}
          onStopRecording={handleStopAudioRecording}
          onDiscardRecording={handleDiscardRecordedAudio}
          onClose={handleCloseAudioRecorder}
          onSend={handleSendRecordedAudio}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  flatList: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptyAvatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  emptyAvatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  emptyTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
});
