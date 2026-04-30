import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { captureAnalyticsScreen, posthogEnabled } from './posthog';

export function PostHogScreenTracker() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!posthogEnabled || !pathname || previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    captureAnalyticsScreen(pathname, { pathname });
  }, [pathname]);

  return null;
}
