import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';

export default function EditProfileScreen() {
  const { user } = useAuthStore();
  const { profile, updateProfile } = useProfileStore();

  const [avatar, setAvatar] = useState<string | null>(profile?.avatarUrl ?? null);
  const [pendingAvatar, setPendingAvatar] = useState<{
    base64: string;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  } | null>(null);
  const [shouldRemoveAvatar, setShouldRemoveAvatar] = useState(false);
  const [name, setName] = useState(
    profile?.displayName ?? user?.email?.split('@')[0] ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAvatar(profile?.avatarUrl ?? null);
    setName(profile?.displayName ?? user?.email?.split('@')[0] ?? '');
  }, [profile?.avatarUrl, profile?.displayName, user?.email]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso à sua galeria para selecionar uma foto.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64 || !asset.mimeType) {
        Alert.alert('Erro', 'Não consegui preparar essa imagem.');
        return;
      }

      if (
        asset.mimeType !== 'image/jpeg' &&
        asset.mimeType !== 'image/png' &&
        asset.mimeType !== 'image/webp'
      ) {
        Alert.alert('Formato não suportado', 'Use JPG, PNG ou WebP.');
        return;
      }

      setAvatar(asset.uri);
      setPendingAvatar({
        base64: asset.base64,
        mediaType: asset.mimeType,
      });
      setShouldRemoveAvatar(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso à câmera para tirar uma foto.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64 || !asset.mimeType) {
        Alert.alert('Erro', 'Não consegui preparar essa imagem.');
        return;
      }

      if (
        asset.mimeType !== 'image/jpeg' &&
        asset.mimeType !== 'image/png' &&
        asset.mimeType !== 'image/webp'
      ) {
        Alert.alert('Formato não suportado', 'Use JPG, PNG ou WebP.');
        return;
      }

      setAvatar(asset.uri);
      setPendingAvatar({
        base64: asset.base64,
        mediaType: asset.mimeType,
      });
      setShouldRemoveAvatar(false);
    }
  };

  const handleChoosePhoto = () => {
    if (Platform.OS === 'web') {
      void handlePickImage();
      return;
    }

    Alert.alert('Foto de Perfil', 'Como você quer adicionar sua foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar Foto', onPress: handleTakePhoto },
      { text: 'Escolher da Galeria', onPress: handlePickImage },
    ]);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updated = await updateProfile({
        displayName: name.trim() || null,
        avatar: shouldRemoveAvatar ? null : pendingAvatar ?? undefined,
      });

      if (!updated) {
        throw new Error('No profile returned');
      }

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert('Remover Foto', 'Deseja remover sua foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          setAvatar(null);
          setPendingAvatar(null);
          setShouldRemoveAvatar(true);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Editar Perfil',
          headerShown: true,
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: {
            ...typography.h3,
            fontFamily: 'Inter_600SemiBold',
            color: colors.textPrimary,
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
              accessibilityLabel="Voltar"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerButton}
              disabled={isSaving}
              accessibilityLabel="Salvar"
              accessibilityRole="button"
            >
              <Text style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleChoosePhoto}
              activeOpacity={0.8}
              accessibilityLabel="Alterar foto de perfil"
              accessibilityRole="button"
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={48} color={colors.primary} />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color={colors.white} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleChoosePhoto}
              style={styles.changePhotoButton}
              accessibilityLabel="Alterar foto"
              accessibilityRole="button"
            >
              <Text style={styles.changePhotoText}>Alterar foto</Text>
            </TouchableOpacity>

            {avatar && (
              <TouchableOpacity
                onPress={handleRemovePhoto}
                style={styles.removePhotoButton}
                accessibilityLabel="Remover foto"
                accessibilityRole="button"
              >
                <Text style={styles.removePhotoText}>Remover foto</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={styles.inputDisabled}>
                <Text style={styles.inputDisabledText}>{user?.email}</Text>
                <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
              </View>
              <Text style={styles.hint}>O e-mail não pode ser alterado</Text>
            </View>

            {user?.phone && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <View style={styles.inputDisabled}>
                  <Text style={styles.inputDisabledText}>{user.phone}</Text>
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  saveButton: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  saveButtonDisabled: {
    color: colors.textMuted,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.white,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...getShadow('md'),
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  changePhotoButton: {
    paddingVertical: spacing.sm,
  },
  changePhotoText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  removePhotoButton: {
    paddingVertical: spacing.xs,
  },
  removePhotoText: {
    ...typography.bodySmall,
    color: colors.error,
    fontFamily: 'Inter_500Medium',
  },
  formSection: {
    backgroundColor: colors.white,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    height: sizes.inputHeight,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  inputDisabled: {
    height: sizes.inputHeight,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDisabledText: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontFamily: 'Inter_400Regular',
  },
});
