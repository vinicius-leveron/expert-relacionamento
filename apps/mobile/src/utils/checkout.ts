import { openExternalLink } from './external-link';

export async function openCheckoutUrl(checkoutUrl: string | null | undefined): Promise<boolean> {
  return openExternalLink(checkoutUrl, {
    unavailableTitle: 'Assinatura indisponível',
    unavailableMessage:
      'Ainda não consegui carregar o link de assinatura. Tente novamente em instantes.',
    invalidMessage: 'Não consegui abrir o checkout neste dispositivo.',
  });
}
