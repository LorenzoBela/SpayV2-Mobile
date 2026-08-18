import { ReleaseChangelog } from '../types/changelog';

export const BUNDLED_CHANGELOGS: ReleaseChangelog[] = [
  {
    version: '1.0.0',
    versionCode: 32,
    releaseType: 'hybrid',
    releaseDate: '2026-08-17T10:30:00.000Z',
    title: 'In-App Updates & Push Notification Engine',
    summary:
      'Introduces automatic in-app APK update downloads, refined background push notification channels, and upgraded native build compatibility.',
    isCritical: true,
    highlights: [
      {
        type: 'feature',
        title: 'In-App Update Management',
        description: 'Directly download and install Android package updates from within the application.',
        rawCommit: '26f4101 feat: implement app update service and refactor Android notification channel configurations and testing',
      },
      {
        type: 'fix',
        title: 'Android Notification Channels',
        description: 'Resolved silent background drop issues and configured priority notification delivery.',
        rawCommit: '45555e7 fix: remove dead notification guard in displayFcmRemoteMessage',
      },
      {
        type: 'improvement',
        title: 'Native Engine Upgrades',
        description: 'Enhanced CMake build paths and native toolchains for React Native 0.85 compatibility.',
        rawCommit: 'c5f0bbc chore: add AdminMore screen, configure Android build stability, and patch CMake paths for React Native 0.85 compatibility',
      },
    ],
  },
  {
    version: '0.9.9',
    versionCode: 31,
    releaseType: 'ota',
    releaseDate: '2026-08-14T14:15:00.000Z',
    title: 'Privacy Curtain & Background Network Sync',
    summary:
      'Added an app switcher privacy curtain to protect financial data, automated background offline reconciliation, and tactile haptics.',
    highlights: [
      {
        type: 'security',
        title: 'App Switcher Privacy Curtain',
        description: 'Shields sensitive account numbers and balances when switching between active apps.',
        rawCommit: '7e86429 feat: add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support.',
      },
      {
        type: 'feature',
        title: 'Background Network Sync',
        description: 'Automatically retries queued financial mutations when internet connectivity is restored.',
        rawCommit: '7e86429 feat: add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support.',
      },
      {
        type: 'improvement',
        title: 'Tactile Haptic Feedback',
        description: 'Integrated responsive vibration feedback for biometric gates and transaction submissions.',
        rawCommit: '7e86429 feat: add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support.',
      },
      {
        type: 'fix',
        title: 'Network Exception Handling',
        description: 'Enhanced global error boundaries to prevent unexpected network drops from closing the session.',
        rawCommit: '7e86429 feat: add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support.',
      },
    ],
  },
  {
    version: '0.9.8',
    versionCode: 30,
    releaseType: 'apk',
    releaseDate: '2026-08-09T09:45:00.000Z',
    title: 'Settings Hub & Modular Navigation',
    summary:
      'Revamped user settings structure with modular preference sections, fine-grained notification options, and simplified tab flows.',
    highlights: [
      {
        type: 'feature',
        title: 'Centralized Settings Hub',
        description: 'Unified user profile, privacy controls, and data export options in one clean layout.',
        rawCommit: 'bd3489a feat: add mobile navigation structure, settings screen, update management, and FCM notification services',
      },
      {
        type: 'improvement',
        title: 'Smoother Screen Transitions',
        description: 'Optimized navigation stacks for lower transition latency on entry-level Android devices.',
        rawCommit: '0bb9989 feat: add admin navigation types, screens, and centralized control panel',
      },
      {
        type: 'fix',
        title: 'Notification Listener Cleanup',
        description: 'Prevented memory retention in unmounted push notification event listeners.',
        rawCommit: '9d794b8 feat: implement push notification system with Expo, FCM integration, and associated UI components',
      },
    ],
  },
  {
    version: '0.9.7',
    versionCode: 29,
    releaseType: 'ota',
    releaseDate: '2026-08-03T16:20:00.000Z',
    title: 'Administrative Expense Management',
    summary:
      'Comprehensive expense tracking and administrative analytics with category breakdowns and detailed audit trails.',
    highlights: [
      {
        type: 'feature',
        title: 'Expense Management Dashboard',
        description: 'Administrative tools for categorizing operational expenditures and generating summaries.',
        rawCommit: 'ccd3386 feat: implement administrative expense management service and dashboard screens',
      },
      {
        type: 'improvement',
        title: 'Audit Trail Logging',
        description: 'Immutable logging for administrative status changes and spending approvals.',
        rawCommit: '24015f4 feat: implement admin expenses dashboard services, screens, and testing infrastructure',
      },
      {
        type: 'fix',
        title: 'Chart Memory Footprint',
        description: 'Optimized chart components to reduce heap consumption during long administrative sessions.',
        rawCommit: '24015f4 feat: implement admin expenses dashboard services, screens, and testing infrastructure',
      },
    ],
  },
  {
    version: '0.9.6',
    versionCode: 28,
    releaseType: 'apk',
    releaseDate: '2026-07-28T11:10:00.000Z',
    title: 'Dynamic Island HUD & Animated Splash',
    summary:
      'Introduced Dynamic Island status alerts for real-time transaction updates and a branded animated splash screen.',
    highlights: [
      {
        type: 'feature',
        title: 'Dynamic Island Status Pill',
        description: 'Interactive heads-up indicator displaying real-time payment states and security notices.',
        rawCommit: '1518dcf feat: implement Dynamic Island notification system with biometric authentication and custom management modals',
      },
      {
        type: 'feature',
        title: 'Animated Launch Splash',
        description: 'Seamless branded entrance screen eliminating visual layout jump during app bootstrap.',
        rawCommit: 'e3cf827 feat: implement AnimatedSplashScreen and integrate into AppNavigator for improved launch experience',
      },
      {
        type: 'improvement',
        title: 'Usage Telemetry',
        description: 'Integrated privacy-focused event metrics to identify UI bottlenecks and crash rates.',
        rawCommit: 'c024673 feat: integrate PostHog analytics for mobile app event tracking',
      },
      {
        type: 'fix',
        title: 'Launch Auth Race Condition',
        description: 'Guaranteed authentication token resolution prior to dismissing initial splash view.',
        rawCommit: 'e3cf827 feat: implement AnimatedSplashScreen and integrate into AppNavigator for improved launch experience',
      },
    ],
  },
  {
    version: '0.9.5',
    versionCode: 27,
    releaseType: 'ota',
    releaseDate: '2026-07-21T15:00:00.000Z',
    title: 'Biometric App Lock & Profile Management',
    summary:
      'Added biometric fingerprint and face unlock protection, PIN fallback gates, and customizable profile settings.',
    highlights: [
      {
        type: 'security',
        title: 'Biometric & PIN App Gate',
        description: 'Configurable automatic security lock requiring biometric or PIN verification on app resume.',
        rawCommit: '4423fc8 feat: implement biometric authentication and PIN lock security layer with application state monitoring',
      },
      {
        type: 'feature',
        title: 'Profile Customization',
        description: 'Updated user profile management including name, avatar selection, and credential changes.',
        rawCommit: 'f11e7e1 feat: implement user profile management, biometric authentication, and secure settings infrastructure',
      },
      {
        type: 'improvement',
        title: 'Keystore Encryption',
        description: 'Secured local authentication tokens with hardware-backed native keystore encryption.',
        rawCommit: '368d2ed fix(security): harden auth, api routes, and mobile storage',
      },
      {
        type: 'fix',
        title: 'Biometric Cancellation Flow',
        description: 'Gracefully restored fallback PIN prompt when user cancels native biometric dialog.',
        rawCommit: '3332e76 feat: implement biometric and PIN-based app lock authentication flow with overlay, re-auth modal, and service integration',
      },
    ],
  },
  {
    version: '0.9.4',
    versionCode: 26,
    releaseType: 'ota',
    releaseDate: '2026-07-14T08:30:00.000Z',
    title: 'NootAi Financial Assistant',
    summary:
      'Integrated AI-powered financial copilot with conversational spending insights, safety guardrails, and real-time streaming responses.',
    highlights: [
      {
        type: 'feature',
        title: 'NootAi Smart Assistant',
        description: 'Conversational assistant providing instant budget summaries and personalized savings tips.',
        rawCommit: 'c9dc425 feat: add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration',
      },
      {
        type: 'security',
        title: 'AI Safety Guardrails',
        description: 'Client-side prompt validation to prevent sensitive data disclosure in conversations.',
        rawCommit: 'c9dc425 feat: add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration',
      },
      {
        type: 'improvement',
        title: 'Streaming Response UI',
        description: 'Zero-lag word-by-word streaming for immediate response display.',
        rawCommit: 'c9dc425 feat: add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration',
      },
      {
        type: 'fix',
        title: 'Chat Inverted Scroll Stability',
        description: 'Eliminated scroll position jumps when appending new messages to the active chat.',
        rawCommit: 'c9dc425 feat: add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration',
      },
    ],
  },
  {
    version: '0.9.3',
    versionCode: 25,
    releaseType: 'apk',
    releaseDate: '2026-07-02T13:40:00.000Z',
    title: 'Offline Mutation Queue & Inactivity Guard',
    summary:
      'Enabled full offline mutation queuing with cryptographic idempotency keys and automatic session timeout guards.',
    highlights: [
      {
        type: 'feature',
        title: 'Offline Action Queue',
        description: 'Submit transactions and records while offline; changes sync automatically when back online.',
        rawCommit: '5ba7b84 feat: implement offline mutation queue with idempotency, inactivity guard, and associated utilities',
      },
      {
        type: 'security',
        title: 'Inactivity Timeout Guard',
        description: 'Automatically locks application after period of idle background time.',
        rawCommit: '588ce69 feat: implement mobile inactivity timeout and integrate into app navigator',
      },
      {
        type: 'improvement',
        title: 'Statement & Data Export',
        description: 'Export financial records to formatted CSV and PDF files.',
        rawCommit: 'e564f84 feat: implement client and admin settings screens with profile management, data export, and biometric security features',
      },
      {
        type: 'fix',
        title: 'Duplicate Transaction Protection',
        description: 'Client-side UUID idempotency tokens eliminate accidental double-charge mutations.',
        rawCommit: '5ba7b84 feat: implement offline mutation queue with idempotency, inactivity guard, and associated utilities',
      },
    ],
  },
  {
    version: '0.9.2',
    versionCode: 24,
    releaseType: 'ota',
    releaseDate: '2026-06-22T10:15:00.000Z',
    title: 'Salary Countdown Flip Card & Weather',
    summary:
      'Introduced 3D flip card animations for payday countdowns, accurate tax calculators, and live localized weather widgets.',
    highlights: [
      {
        type: 'feature',
        title: 'Interactive Salary Countdown Card',
        description: '3D animated flip card displaying remaining days until payday and calculated net earnings.',
        rawCommit: '261266a feat: implement AdminSalaryScreen with animated flip card countdown and paycheck management modals',
      },
      {
        type: 'feature',
        title: 'Localized Weather Telemetry',
        description: 'Live temperature and atmospheric conditions widget for daily expense planning.',
        rawCommit: 'f2cdfa7 feat: implement comprehensive weather widget, admin dashboard modules, and core application navigation/service infrastructure',
      },
      {
        type: 'improvement',
        title: 'Payroll Calculation Engine',
        description: 'Refined multi-bracket tax estimation and deduction breakdowns.',
        rawCommit: '482bd71 feat: implement BudgetScreen, WishlistScreen, and salary/tax utilities to support financial tracking and planning.',
      },
      {
        type: 'fix',
        title: 'Android Backface Flip Glitch',
        description: 'Fixed visual flickering during 180-degree card flip animation on Android devices.',
        rawCommit: '261266a feat: implement AdminSalaryScreen with animated flip card countdown and paycheck management modals',
      },
    ],
  },
  {
    version: '0.9.0',
    versionCode: 23,
    releaseType: 'apk',
    releaseDate: '2026-06-11T12:00:00.000Z',
    title: 'S-Pay V2 Core Foundation & Smooth Virtualization',
    summary:
      'Initial release of S-Pay V2 mobile architecture with ultra-fast list virtualization, query batching, and dark UI.',
    highlights: [
      {
        type: 'feature',
        title: 'Client & Admin Core Foundation',
        description: 'Complete transaction management, digital wallet dashboard, and order tracking systems.',
        rawCommit: 'aa06e4a feat: implement mobile client and admin dashboard screens with core navigation and utility modules',
      },
      {
        type: 'improvement',
        title: 'High-Speed List Virtualization',
        description: 'Fluid 60fps scrolling for extensive transaction histories with zero stutter.',
        rawCommit: '99cb1ce perf: optimize query loading, batching and mobile virtualization',
      },
      {
        type: 'improvement',
        title: 'Background Query Prefetching',
        description: 'Intelligent background data preloading for near-instantaneous screen loads.',
        rawCommit: '7b09bb2 feat: implement client query hooks, background idle prefetch, and navigation structure for mobile app',
      },
      {
        type: 'security',
        title: 'Automatic Session Refresh',
        description: 'Silent token verification and automated renewal to prevent session dropouts.',
        rawCommit: '7d0cb67 feat: implement core mobile architecture with client and admin screens, navigation, and service utilities',
      },
    ],
  },
];
