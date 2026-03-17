// @aerocab/mobile-ui — Shared React Native components, API base, auth store factory

// UI Components
export { Button } from './components/ui/Button';
export { Input } from './components/ui/Input';
export { default as SplashScreen } from './components/SplashScreen';
export { Icon } from './components/ui/Icon';
export type { IconProps } from './components/ui/Icon';
export { TabIcon } from './components/ui/TabIcon';
export { ScreenHeader } from './components/ui/ScreenHeader';
export { EmptyState } from './components/ui/EmptyState';
export { OfflineBanner } from './components/ui/OfflineBanner';
export { ErrorBoundary } from './components/ui/ErrorBoundary';
export { ErrorFallback } from './components/ui/ErrorFallback';
export { toastConfig } from './components/ui/ToastConfig';

// Skeletons
export { Skeleton, SkeletonCircle } from './components/ui/Skeleton';
export { DriverCardSkeleton } from './components/skeletons/DriverCardSkeleton';
export { ConversationSkeleton } from './components/skeletons/ConversationSkeleton';
export { FlightCardSkeleton } from './components/skeletons/FlightCardSkeleton';

// Theme & Constants
export { theme } from './constants/theme';

// Services
export { ApiClient, ApiError, API_BASE_URL } from './services/api-base';

// Stores
export { createAuthStore } from './stores/createAuthStore';
export type { AuthState } from './stores/createAuthStore';

// Hooks
export { useHaptic } from './hooks/useHaptic';
export { useApi } from './hooks/useApi';
export { useNetworkStatus } from './hooks/useNetworkStatus';
export { useRefresh } from './hooks/useRefresh';
