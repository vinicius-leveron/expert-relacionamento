import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { Sentry, sentryEnabled } from './sentry';

export function SentryScreenTracker() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!sentryEnabled || !pathname || previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    Sentry.setTag('current_route', pathname);
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: pathname,
      level: 'info',
      type: 'navigation',
    });
  }, [pathname]);

  return null;
}
