import { Alert, Linking } from 'react-native';

export async function openExternalLink(
  url: string | null | undefined,
  params?: {
    unavailableTitle?: string;
    unavailableMessage?: string;
    invalidMessage?: string;
  }
): Promise<boolean> {
  if (!url) {
    Alert.alert(
      params?.unavailableTitle ?? 'Link indisponível',
      params?.unavailableMessage ?? 'Esse link ainda não foi configurado.'
    );
    return false;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    Alert.alert(
      params?.unavailableTitle ?? 'Link indisponível',
      params?.invalidMessage ?? 'Não consegui abrir esse link neste dispositivo.'
    );
    return false;
  }

  await Linking.openURL(url);
  return true;
}
