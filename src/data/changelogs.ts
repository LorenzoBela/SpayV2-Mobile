import { ReleaseChangelog } from '../types/changelog';

export const BUNDLED_CHANGELOGS: ReleaseChangelog[] = [
  {
    "version": "1.0.0",
    "versionCode": 37,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-27T10:00:00.000Z",
    "title": "Salary Due Date Management & TypeScript Isolation",
    "summary": "Introduces editable paycheck due dates, payment confirmation reversal workflows, and optimized memory caching for stats.",
    "highlights": [
      {
        "type": "feature",
        "title": "Enable TypeScript build error ignoring and refine tsconfig include/exclude patterns",
        "description": "Added enable typescript build error ignoring and refine tsconfig include/exclude patterns to expand features and improve usability.",
        "rawCommit": "b5a2818 feat: enable TypeScript build error ignoring and refine tsconfig include/exclude patterns"
      },
      {
        "type": "improvement",
        "title": "Streamline .vercelignore to focus on test configurations and essential files",
        "description": "Enhanced streamline .vercelignore to focus on test configurations and essential files for better stability and clean performance.",
        "rawCommit": "7b39e67 refactor: streamline .vercelignore to focus on test configurations and essential files"
      },
      {
        "type": "improvement",
        "title": "Update dependencies and clean up code",
        "description": "Enhanced update dependencies and clean up code for better stability and clean performance.",
        "rawCommit": "47ee76c chore: update dependencies and clean up code"
      },
      {
        "type": "fix",
        "title": "Update caching logic in getPublicStats to prioritize L1 cache and handle Redis errors more gracefully",
        "description": "Resolved an issue with update caching logic in getpublicstats to prioritize l1 cache and handle redis errors more gracefully to ensure smooth, error-free operation.",
        "rawCommit": "0c039b5 fix: update caching logic in getPublicStats to prioritize L1 cache and handle Redis errors more gracefully"
      },
      {
        "type": "improvement",
        "title": "Modernization loading component styles and structure; update orders pagination logic; modify admin action to aggregate unpaid payment amounts",
        "description": "Enhanced modernization loading component styles and structure; update orders pagination logic; modify admin action to aggregate unpaid payment amounts for better stability and clean performance.",
        "rawCommit": "5895b14 chore: Refactor loading component styles and structure; update orders pagination logic; modify admin action to aggregate unpaid payment amounts"
      },
      {
        "type": "improvement",
        "title": "Update loading components and styles for improved UI consistency",
        "description": "Enhanced update loading components and styles for improved ui consistency for better stability and clean performance.",
        "rawCommit": "b31eef2 refactor: update loading components and styles for improved UI consistency"
      },
      {
        "type": "feature",
        "title": "Add functionality to edit payment due dates and revert payments",
        "description": "Added add functionality to edit payment due dates and revert payments to expand features and improve usability.",
        "rawCommit": "2b66b7c feat: add functionality to edit payment due dates and revert payments"
      },
      {
        "type": "improvement",
        "title": "Stable Build for V37",
        "description": "Enhanced stable build for v37 for better stability and clean performance.",
        "rawCommit": "e6607b1 chore: Stable Build for V37"
      },
      {
        "type": "feature",
        "title": "Implement landing page and role selection system with responsive UI components",
        "description": "Added implement landing page and role selection system with responsive ui components to expand features and improve usability.",
        "rawCommit": "9af7d83 feat: implement landing page and role selection system with responsive UI components"
      },
      {
        "type": "feature",
        "title": "Implement Redis caching layer with L1 memory support and version-based invalidation for server services and admin views",
        "description": "Added implement redis caching layer with l1 memory support and version-based invalidation for server services and admin views to expand features and improve usability.",
        "rawCommit": "47108b0 feat: implement Redis caching layer with L1 memory support and version-based invalidation for server services and admin views"
      },
      {
        "type": "feature",
        "title": "Implement Philippine 13th-Month & Tax Calculator and admin salary dashboard",
        "description": "Added implement philippine 13th-month & tax calculator and admin salary dashboard to expand features and improve usability.",
        "rawCommit": "7b70b67 feat: implement Philippine tax/13th-month calculator and admin salary dashboard"
      },
      {
        "type": "feature",
        "title": "Implement admin reminders, role selection, and client notifications screens",
        "description": "Added implement admin reminders, role selection, and client notifications screens to expand features and improve usability.",
        "rawCommit": "a4ec8fc feat: implement admin reminders, role selection, and client notifications screens"
      }
    ],
    "isCritical": false
  },
  {
    "version": "0.9.9",
    "versionCode": 36,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-24T10:00:00.000Z",
    "title": "Android Home Screen Widgets & Philippine Salary Engine",
    "summary": "Adds native Android home screen widgets for quick balance checks, 13th-month pay calculators, and real-time reminder triggers.",
    "highlights": [
      {
        "type": "feature",
        "title": "Implement comprehensive Android home screen widgets for client and admin dashboards with native Android home screen widgets.",
        "description": "Added implement comprehensive android home screen widgets for client and admin dashboards with native android home screen widgets. to expand features and improve usability.",
        "rawCommit": "46396bb feat: implement comprehensive Android home screen widgets for client and admin dashboards with native Kotlin providers and XML layouts."
      },
      {
        "type": "feature",
        "title": "Implement notification utilities and payment reminder logic with reliability checks",
        "description": "Added implement notification utilities and payment reminder logic with reliability checks to expand features and improve usability.",
        "rawCommit": "81c74c6 feat: implement notification utilities and payment reminder logic with unit tests"
      },
      {
        "type": "feature",
        "title": "Implement client dashboard with budget overview and sync utilities",
        "description": "Added implement client dashboard with budget overview and sync utilities to expand features and improve usability.",
        "rawCommit": "d2a602f feat: implement client dashboard with budget overview and sync utilities"
      },
      {
        "type": "feature",
        "title": "Implement biometric step-up authentication, weather service, and dynamic island notification context with related UI components and tests.",
        "description": "Added implement biometric step-up authentication, weather service, and dynamic island notification context with related ui components and tests. to expand features and improve usability.",
        "rawCommit": "e0dc85c feat: implement biometric step-up authentication, weather service, and dynamic island notification context with related UI components and tests."
      },
      {
        "type": "improvement",
        "title": "Admin Fix",
        "description": "Enhanced admin fix for better stability and clean performance.",
        "rawCommit": "fe2c06d chore: Admin Fix"
      },
      {
        "type": "feature",
        "title": "Implement DynamicIsland context and components with integrated weather service for user notifications",
        "description": "Added implement dynamicisland context and components with integrated weather service for user notifications to expand features and improve usability.",
        "rawCommit": "c85e956 feat: implement DynamicIsland context and components with integrated weather service for user notifications"
      }
    ],
    "isCritical": false
  },
  {
    "version": "0.9.8",
    "versionCode": 35,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-20T10:00:00.000Z",
    "title": "MFA Device Trust & Assisted Purchase Requests",
    "summary": "Adds trusted-device biometric authentication with encrypted cookies, product link scraping, and dynamic variation ordering.",
    "highlights": [
      {
        "type": "feature",
        "title": "Implement trusted device authentication management system with secure bank-grade encryption encrypted login badges",
        "description": "Added implement trusted device authentication management system with secure bank-grade encryption encrypted login badges to expand features and improve usability.",
        "rawCommit": "5786f02 feat: implement MFA device trust management system with secure WebCrypto HMAC cookies"
      },
      {
        "type": "feature",
        "title": "Implement dynamic in-app changelog feed and history viewer with automated update tracking",
        "description": "Added implement dynamic in-app changelog feed and history viewer with automated update tracking to expand features and improve usability.",
        "rawCommit": "d38a7bb feat: implement dynamic in-app changelog feed and history viewer with automated update tracking"
      },
      {
        "type": "feature",
        "title": "Implement purchase request workflow with product scraping, dynamic variations, and admin management views",
        "description": "Added implement purchase request workflow with product scraping, dynamic variations, and admin management views to expand features and improve usability.",
        "rawCommit": "1de9152 feat: implement purchase request workflow with product scraping, dynamic variations, and admin management views"
      },
      {
        "type": "feature",
        "title": "REQUESTS: Add buy requests pipeline with multi-tier cache and admin dashboard",
        "description": "Added add buy requests pipeline with multi-tier cache and admin dashboard to expand features and improve usability.",
        "rawCommit": "d21da49 feat: add buy requests pipeline with multi-tier cache and admin dashboard"
      },
      {
        "type": "feature",
        "title": "Initialize mobile app navigation structure, admin management modules, and client-facing feature screens",
        "description": "Added initialize mobile app navigation structure, admin management modules, and client-facing feature screens to expand features and improve usability.",
        "rawCommit": "d8e7a37 feat: initialize mobile app navigation structure, admin management modules, and client-facing feature screens"
      },
      {
        "type": "feature",
        "title": "Implement app update service and modernization Android notification channel configurations and testing",
        "description": "Added implement app update service and modernization android notification channel configurations and testing to expand features and improve usability.",
        "rawCommit": "26f4101 feat: implement app update service and refactor Android notification channel configurations and testing"
      },
      {
        "type": "feature",
        "title": "Add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support.",
        "description": "Added add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support. to expand features and improve usability.",
        "rawCommit": "7e86429 feat: add biometric lock, privacy curtain, global error handling, and background network reconciliation with haptic feedback support."
      }
    ],
    "isCritical": true
  },
  {
    "version": "0.9.7",
    "versionCode": 34,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-16T10:00:00.000Z",
    "title": "High-Priority Push Notifications & 3D Stage",
    "summary": "Configured instant background push notification channels, 3D interactive hero visuals, and real-time payment synchronization.",
    "highlights": [
      {
        "type": "feature",
        "title": "Implement push notifications notification service and notification utility logic",
        "description": "Added implement push notifications notification service and notification utility logic to expand features and improve usability.",
        "rawCommit": "4baca8e feat: implement FCM notification service and notification utility logic"
      },
      {
        "type": "feature",
        "title": "Implement notification system infrastructure and payment reminder logic",
        "description": "Added implement notification system infrastructure and payment reminder logic to expand features and improve usability.",
        "rawCommit": "780446b feat: implement notification system infrastructure and payment reminder logic"
      },
      {
        "type": "feature",
        "title": "Add mobile navigation structure, settings screen, update management, and push notifications notification services",
        "description": "Added add mobile navigation structure, settings screen, update management, and push notifications notification services to expand features and improve usability.",
        "rawCommit": "bd3489a feat: add mobile navigation structure, settings screen, update management, and FCM notification services"
      },
      {
        "type": "feature",
        "title": "Implement push notification system with Expo, push notifications integration, and associated UI components",
        "description": "Added implement push notification system with expo, push notifications integration, and associated ui components to expand features and improve usability.",
        "rawCommit": "9d794b8 feat: implement push notification system with Expo, FCM integration, and associated UI components"
      },
      {
        "type": "feature",
        "title": "Initialize 3D interactive hero stage and global CSS theme styling",
        "description": "Added initialize 3d interactive hero stage and global css theme styling to expand features and improve usability.",
        "rawCommit": "80a2556 feat: initialize 3D interactive hero stage and global CSS theme styling"
      },
      {
        "type": "feature",
        "title": "Add admin actions API route with payment tracking and synchronization logic",
        "description": "Added add admin actions api route with payment tracking and synchronization logic to expand features and improve usability.",
        "rawCommit": "ddd16ba feat: add admin actions API route with payment tracking and synchronization logic"
      },
      {
        "type": "feature",
        "title": "Implement administrative expense management service and dashboard screens",
        "description": "Added implement administrative expense management service and dashboard screens to expand features and improve usability.",
        "rawCommit": "ccd3386 feat: implement administrative expense management service and dashboard screens"
      },
      {
        "type": "improvement",
        "title": "Add AdminMore screen, configure Android build stability, and patch CMake paths for React Native 0.85 compatibility",
        "description": "Enhanced add adminmore screen, configure android build stability, and patch cmake paths for react native 0.85 compatibility for better stability and clean performance.",
        "rawCommit": "c5f0bbc chore: add AdminMore screen, configure Android build stability, and patch CMake paths for React Native 0.85 compatibility"
      },
      {
        "type": "feature",
        "title": "Add admin navigation types, screens, and centralized control panel",
        "description": "Added add admin navigation types, screens, and centralized control panel to expand features and improve usability.",
        "rawCommit": "0bb9989 feat: add admin navigation types, screens, and centralized control panel"
      },
      {
        "type": "feature",
        "title": "TOKEN-OPT: Upgrade ultimate-AI multitasking engine workflow with high-speed memory and smart command processing",
        "description": "Added upgrade ultimate-ai multitasking engine workflow with high-speed memory and smart command processing to expand features and improve usability.",
        "rawCommit": "67ccd1c feat: upgrade ultimate-multi-agent-invoker workflow with zero-drift KV cache and semantic atom codecs"
      },
      {
        "type": "feature",
        "title": "WORKFLOW: Add ultimate-AI multitasking engine master workflow",
        "description": "Added add ultimate-ai multitasking engine master workflow to expand features and improve usability.",
        "rawCommit": "8e88995 feat: add ultimate-multi-agent-invoker master workflow"
      },
      {
        "type": "fix",
        "title": "Instant push notification delivery payloads to eliminate phantom notification duplication",
        "description": "Resolved an issue with instant push notification delivery payloads to eliminate phantom notification duplication to ensure smooth, error-free operation.",
        "rawCommit": "85494fe fix: data-only FCM payloads to eliminate phantom notification duplication"
      },
      {
        "type": "feature",
        "title": "Implement root layout with PostHog analytics integration and update posthog-js dependency",
        "description": "Added implement root layout with posthog analytics integration and update posthog-js dependency to expand features and improve usability.",
        "rawCommit": "6960622 feat: implement root layout with PostHog analytics integration and update posthog-js dependency"
      },
      {
        "type": "improvement",
        "title": "Add reliability checks for DynamicIslandContext name extraction and database schema validation",
        "description": "Enhanced add reliability checks for dynamicislandcontext name extraction and database schema validation for better stability and clean performance.",
        "rawCommit": "248af1b test: add unit tests for DynamicIslandContext name extraction and database schema validation"
      },
      {
        "type": "feature",
        "title": "Implement DynamicIslandContext for notification management and add diagnostic scripts for database verification",
        "description": "Added implement dynamicislandcontext for notification management and add diagnostic scripts for database verification to expand features and improve usability.",
        "rawCommit": "48d43ff feat: implement DynamicIslandContext for notification management and add diagnostic scripts for database verification"
      },
      {
        "type": "feature",
        "title": "Add push notification device registration API server connection and diagnostic database scripts",
        "description": "Added add push notification device registration api server connection and diagnostic database scripts to expand features and improve usability.",
        "rawCommit": "6dc6e84 feat: add push notification device registration API endpoint and diagnostic database scripts"
      },
      {
        "type": "feature",
        "title": "Add notification device registration API and utility scripts for system debugging and manual event triggering",
        "description": "Added add notification device registration api and utility scripts for system debugging and manual event triggering to expand features and improve usability.",
        "rawCommit": "4276609 feat: add notification device registration API and utility scripts for system debugging and manual event triggering"
      },
      {
        "type": "feature",
        "title": "Implement push notifications notification utilities and notification processing logic",
        "description": "Added implement push notifications notification utilities and notification processing logic to expand features and improve usability.",
        "rawCommit": "80c4d9f feat: implement FCM notification utilities and notification processing logic"
      },
      {
        "type": "feature",
        "title": "Implement admin expenses dashboard services, screens, and testing infrastructure",
        "description": "Added implement admin expenses dashboard services, screens, and testing infrastructure to expand features and improve usability.",
        "rawCommit": "24015f4 feat: implement admin expenses dashboard services, screens, and testing infrastructure"
      },
      {
        "type": "fix",
        "title": "Remove dead notification guard in displayFcmRemoteMessage",
        "description": "Resolved an issue with remove dead notification guard in displayfcmremotemessage to ensure smooth, error-free operation.",
        "rawCommit": "45555e7 fix: remove dead notification guard in displayFcmRemoteMessage"
      },
      {
        "type": "feature",
        "title": "Integrate PostHog analytics for mobile app event tracking",
        "description": "Added integrate posthog analytics for mobile app event tracking to expand features and improve usability.",
        "rawCommit": "c024673 feat: integrate PostHog analytics for mobile app event tracking"
      },
      {
        "type": "feature",
        "title": "Implement AnimatedSplashScreen and integrate into AppNavigator for improved launch experience",
        "description": "Added implement animatedsplashscreen and integrate into appnavigator for improved launch experience to expand features and improve usability.",
        "rawCommit": "e3cf827 feat: implement AnimatedSplashScreen and integrate into AppNavigator for improved launch experience"
      },
      {
        "type": "feature",
        "title": "Implement user profile management, biometric authentication, and secure settings infrastructure",
        "description": "Added implement user profile management, biometric authentication, and secure settings infrastructure to expand features and improve usability.",
        "rawCommit": "f11e7e1 feat: implement user profile management, biometric authentication, and secure settings infrastructure"
      },
      {
        "type": "improvement",
        "title": "Update web and mobile core engine integration (instant push notification delivery)",
        "description": "Enhanced update web and mobile core engine integration (instant push notification delivery) for better stability and clean performance.",
        "rawCommit": "cb80f94 chore: update web and mobile submodule refs (data-only FCM fix)"
      },
      {
        "type": "feature",
        "title": "Implement DynamicIsland component and context for interactive UI notifications",
        "description": "Added implement dynamicisland component and context for interactive ui notifications to expand features and improve usability.",
        "rawCommit": "bd9b630 feat: implement DynamicIsland component and context for interactive UI notifications"
      },
      {
        "type": "feature",
        "title": "Implement DynamicIsland and DynamicIslandHost components for interactive notifications",
        "description": "Added implement dynamicisland and dynamicislandhost components for interactive notifications to expand features and improve usability.",
        "rawCommit": "924b8e5 feat: implement DynamicIsland and DynamicIslandHost components for interactive notifications"
      },
      {
        "type": "feature",
        "title": "Implement Dynamic Island notification system with global context and supporting components",
        "description": "Added implement dynamic island notification system with global context and supporting components to expand features and improve usability.",
        "rawCommit": "d10c65f feat: implement Dynamic Island notification system with global context and supporting components"
      },
      {
        "type": "feature",
        "title": "Implement Dynamic Island notification system with biometric authentication and custom management modals",
        "description": "Added implement dynamic island notification system with biometric authentication and custom management modals to expand features and improve usability.",
        "rawCommit": "1518dcf feat: implement Dynamic Island notification system with biometric authentication and custom management modals"
      },
      {
        "type": "feature",
        "title": "Implement biometric authentication and PIN lock security layer with application state monitoring",
        "description": "Added implement biometric authentication and pin lock security layer with application state monitoring to expand features and improve usability.",
        "rawCommit": "4423fc8 feat: implement biometric authentication and PIN lock security layer with application state monitoring"
      },
      {
        "type": "feature",
        "title": "Implement app security layer with biometric locking, app lock gates, and dynamic island notifications",
        "description": "Added implement app security layer with biometric locking, app lock gates, and dynamic island notifications to expand features and improve usability.",
        "rawCommit": "5b1238a feat: implement app security layer with biometric locking, app lock gates, and dynamic island notifications"
      }
    ],
    "isCritical": false
  },
  {
    "version": "0.9.6",
    "versionCode": 33,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-12T10:00:00.000Z",
    "title": "Interactive Dynamic Island & Biometric App Lock",
    "summary": "Introduces heads-up Dynamic Island notification capsule, fingerprint & Face ID screen lock, and privacy blur curtains.",
    "highlights": [
      {
        "type": "improvement",
        "title": "Restrict admin background security layer logic to /admin routes and remove API-specific admin handling",
        "description": "Enhanced restrict admin background security layer logic to /admin routes and remove api-specific admin handling for better stability and clean performance.",
        "rawCommit": "a9687f3 refactor: restrict admin middleware logic to /admin routes and remove API-specific admin handling"
      },
      {
        "type": "fix",
        "title": "SECURITY: Harden auth, api routes, and mobile storage",
        "description": "Resolved an issue with harden auth, api routes, and mobile storage to ensure smooth, error-free operation.",
        "rawCommit": "616d930 fix: harden auth, api routes, and mobile storage"
      },
      {
        "type": "feature",
        "title": "Add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration",
        "description": "Added add nootai finance assistant screen with safety filters and persistent dynamic island integration to expand features and improve usability.",
        "rawCommit": "c9dc425 feat: add NootAi finance assistant screen with safety filters and persistent Dynamic Island integration"
      },
      {
        "type": "feature",
        "title": "Implement client and admin layout shells with collapsible sidebars and navigation components",
        "description": "Added implement client and admin layout shells with collapsible sidebars and navigation components to expand features and improve usability.",
        "rawCommit": "72f0cd8 feat: implement client and admin layout shells with collapsible sidebars and navigation components"
      },
      {
        "type": "feature",
        "title": "Initialize global CSS themes and setup landing page component structure",
        "description": "Added initialize global css themes and setup landing page component structure to expand features and improve usability.",
        "rawCommit": "136b29b feat: initialize global CSS themes and setup landing page component structure"
      },
      {
        "type": "fix",
        "title": "WEB: Modernization RSC metadata, 404 UI & theme sync - Split 6 marketing routes to RSC for SEO metadata export - Add edge OpenGraph image generator & route error boundary - Redesign 404 page with premium spring animations - Fix theme initialization flicker & shell event sync",
        "description": "Resolved an issue with modernization rsc metadata, 404 ui & theme sync - split 6 marketing routes to rsc for seo metadata export - add edge opengraph image generator & route error boundary - redesign 404 page with premium spring animations - fix theme initialization flicker & shell event sync to ensure smooth, error-free operation.",
        "rawCommit": "0f03bff fix: refactor RSC metadata, 404 UI & theme sync - Split 6 marketing routes to RSC for SEO metadata export - Add edge OpenGraph image generator & route error boundary - Redesign 404 page with premium spring animations - Fix theme initialization flicker & shell event sync"
      },
      {
        "type": "feature",
        "title": "Implement system health monitoring dashboard with D3 visualizations and server-side tracking",
        "description": "Added implement system health monitoring dashboard with d3 visualizations and server-side tracking to expand features and improve usability.",
        "rawCommit": "59666e4 feat: implement system health monitoring dashboard with D3 visualizations and server-side tracking"
      },
      {
        "type": "improvement",
        "title": "Fixes",
        "description": "Enhanced fixes for better stability and clean performance.",
        "rawCommit": "5311e91 chore: Fixes"
      },
      {
        "type": "improvement",
        "title": "SEO Enhancements",
        "description": "Enhanced seo enhancements for better stability and clean performance.",
        "rawCommit": "8b93bea chore: SEO Enhancements"
      },
      {
        "type": "feature",
        "title": "WEB: Sync theme switch across role-select and shell navbars",
        "description": "Added sync theme switch across role-select and shell navbars to expand features and improve usability.",
        "rawCommit": "68b2214 feat: sync theme switch across role-select and shell navbars"
      },
      {
        "type": "feature",
        "title": "WEB: Sync theme, fix nav freeze and clean sub-pages",
        "description": "Added sync theme, fix nav freeze and clean sub-pages to expand features and improve usability.",
        "rawCommit": "51b9ccd feat: sync theme, fix nav freeze and clean sub-pages"
      },
      {
        "type": "feature",
        "title": "NOOTAI: Expand tools, remove limits & add chart engine",
        "description": "Added expand tools, remove limits & add chart engine to expand features and improve usability.",
        "rawCommit": "6f69ac2 feat: expand tools, remove limits & add chart engine"
      },
      {
        "type": "improvement",
        "title": "ReadmeV2",
        "description": "Enhanced readmev2 for better stability and clean performance.",
        "rawCommit": "2d548b3 chore: ReadmeV2"
      },
      {
        "type": "improvement",
        "title": "Readme",
        "description": "Enhanced readme for better stability and clean performance.",
        "rawCommit": "b182cd4 chore: Readme"
      },
      {
        "type": "feature",
        "title": "Implement advanced Redis caching patterns, optimize Next.js configuration, and initialize global layout with monitoring tools",
        "description": "Added implement advanced redis caching patterns, optimize next.js configuration, and initialize global layout with monitoring tools to expand features and improve usability.",
        "rawCommit": "f42af00 feat: implement advanced Redis caching patterns, optimize Next.js configuration, and initialize global layout with monitoring tools"
      },
      {
        "type": "feature",
        "title": "Implement advanced Redis caching strategies including adaptive timeouts, XFetch, and null-sentinels to optimize stats service and instant background update updates.",
        "description": "Added implement advanced redis caching strategies including adaptive timeouts, xfetch, and null-sentinels to optimize stats service and instant background update updates. to expand features and improve usability.",
        "rawCommit": "3b4f326 feat: implement advanced Redis caching strategies including adaptive timeouts, XFetch, and null-sentinels to optimize stats service and OTA updates."
      },
      {
        "type": "feature",
        "title": "Initialize root layout with global providers and configure PWA manifest",
        "description": "Added initialize root layout with global providers and configure pwa manifest to expand features and improve usability.",
        "rawCommit": "7e78d3e feat: initialize root layout with global providers and configure PWA manifest"
      },
      {
        "type": "feature",
        "title": "Implement MFA challenge UI and server-side device trust verification using signed cookies",
        "description": "Added implement mfa challenge ui and server-side device trust verification using signed cookies to expand features and improve usability.",
        "rawCommit": "1005e4c feat: implement MFA challenge UI and server-side device trust verification using signed cookies"
      },
      {
        "type": "feature",
        "title": "Implement core Next.js app layout, admin shell wrapper, and site sitemap generation",
        "description": "Added implement core next.js app layout, admin shell wrapper, and site sitemap generation to expand features and improve usability.",
        "rawCommit": "e27546c feat: implement core Next.js app layout, admin shell wrapper, and site sitemap generation"
      },
      {
        "type": "feature",
        "title": "Add Google site verification HTML file for domain ownership validation",
        "description": "Added add google site verification html file for domain ownership validation to expand features and improve usability.",
        "rawCommit": "d4fae8b feat: add Google site verification HTML file for domain ownership validation"
      },
      {
        "type": "feature",
        "title": "Implement root layout with fonts, metadata, and core application providers",
        "description": "Added implement root layout with fonts, metadata, and core application providers to expand features and improve usability.",
        "rawCommit": "3dfb8ac feat: implement root layout with fonts, metadata, and core application providers"
      },
      {
        "type": "feature",
        "title": "Add SEO and discovery files including security.txt, llms.txt, robots.ts, and sitemap.ts",
        "description": "Added add seo and discovery files including security.txt, llms.txt, robots.ts, and sitemap.ts to expand features and improve usability.",
        "rawCommit": "6c36a6b feat: add SEO and discovery files including security.txt, llms.txt, robots.ts, and sitemap.ts"
      },
      {
        "type": "feature",
        "title": "Implement comprehensive security infrastructure including trusted device authentication, open redirect validation, and audit logging.",
        "description": "Added implement comprehensive security infrastructure including trusted device authentication, open redirect validation, and audit logging. to expand features and improve usability.",
        "rawCommit": "c7c5f6b feat: implement comprehensive security infrastructure including MFA device trust, open redirect validation, and audit logging."
      }
    ],
    "isCritical": false
  },
  {
    "version": "0.9.5",
    "versionCode": 32,
    "releaseType": "hybrid",
    "releaseDate": "2026-08-05T10:00:00.000Z",
    "title": "Offline Mutation Queue & Inactivity Protection",
    "summary": "Enables automatic offline action retries, duplicate payment protection, and automatic session logout timers for account safety.",
    "highlights": [
      {
        "type": "feature",
        "title": "WEB: Integrate 20 npm packages across client/admin pages",
        "description": "Added integrate 20 npm packages across client/admin pages to expand features and improve usability.",
        "rawCommit": "74d40d0 feat: integrate 20 npm packages across client/admin pages"
      },
      {
        "type": "feature",
        "title": "Implement mobile client and admin dashboard screens with core navigation and utility modules",
        "description": "Added implement mobile client and admin dashboard screens with core navigation and utility modules to expand features and improve usability.",
        "rawCommit": "aa06e4a feat: implement mobile client and admin dashboard screens with core navigation and utility modules"
      },
      {
        "type": "feature",
        "title": "Implement comprehensive user settings, admin dashboards, and Redis cache management system",
        "description": "Added implement comprehensive user settings, admin dashboards, and redis cache management system to expand features and improve usability.",
        "rawCommit": "7ba24e9 feat: implement comprehensive user settings, admin dashboards, and Redis cache management system"
      },
      {
        "type": "feature",
        "title": "Implement admin MFA challenge page with cookie-based verification and session management",
        "description": "Added implement admin mfa challenge page with cookie-based verification and session management to expand features and improve usability.",
        "rawCommit": "e187f00 feat: implement admin MFA challenge page with cookie-based verification and session management"
      },
      {
        "type": "feature",
        "title": "Add admin reports dashboard and client analytics view",
        "description": "Added add admin reports dashboard and client analytics view to expand features and improve usability.",
        "rawCommit": "961dbbc feat: add admin reports dashboard and client analytics view"
      },
      {
        "type": "feature",
        "title": "Implement client and admin settings screens with profile management, data export, and biometric security features",
        "description": "Added implement client and admin settings screens with profile management, data export, and biometric security features to expand features and improve usability.",
        "rawCommit": "e564f84 feat: implement client and admin settings screens with profile management, data export, and biometric security features"
      },
      {
        "type": "feature",
        "title": "Implement global progress bar with request and navigation tracking hooks",
        "description": "Added implement global progress bar with request and navigation tracking hooks to expand features and improve usability.",
        "rawCommit": "c4b36ac feat: implement global progress bar with request and navigation tracking hooks"
      },
      {
        "type": "feature",
        "title": "CORE: Add security, offline queue & QoL modules",
        "description": "Added add security, offline queue & qol modules to expand features and improve usability.",
        "rawCommit": "177bb27 feat: add security, offline queue & QoL modules"
      },
      {
        "type": "feature",
        "title": "Implement offline mutation queue with duplicate payment protection, inactivity guard, and associated utilities",
        "description": "Added implement offline mutation queue with duplicate payment protection, inactivity guard, and associated utilities to expand features and improve usability.",
        "rawCommit": "5ba7b84 feat: implement offline mutation queue with idempotency, inactivity guard, and associated utilities"
      },
      {
        "type": "feature",
        "title": "Implement biometric and PIN-based app lock authentication flow with overlay, re-auth modal, and service integration",
        "description": "Added implement biometric and pin-based app lock authentication flow with overlay, re-auth modal, and service integration to expand features and improve usability.",
        "rawCommit": "3332e76 feat: implement biometric and PIN-based app lock authentication flow with overlay, re-auth modal, and service integration"
      },
      {
        "type": "feature",
        "title": "Implement comprehensive weather widget, admin dashboard modules, and core application navigation/service infrastructure",
        "description": "Added implement comprehensive weather widget, admin dashboard modules, and core application navigation/service infrastructure to expand features and improve usability.",
        "rawCommit": "f2cdfa7 feat: implement comprehensive weather widget, admin dashboard modules, and core application navigation/service infrastructure"
      },
      {
        "type": "fix",
        "title": "INSTANT BACKGROUND UPDATE: Unify update flow, fix non-blocking UX and currency decimals",
        "description": "Resolved an issue with unify update flow, fix non-blocking ux and currency decimals to ensure smooth, error-free operation.",
        "rawCommit": "1ed647e fix: unify update flow, fix non-blocking UX and currency decimals"
      },
      {
        "type": "fix",
        "title": "MOBILE: Update mobile core engine integration to",
        "description": "Resolved an issue with update mobile core engine integration to to ensure smooth, error-free operation.",
        "rawCommit": "535c8cc fix: update mobile submodule pointer to 1ed647e"
      },
      {
        "type": "fix",
        "title": "DEPS: Add missing @trpc/server dependency",
        "description": "Resolved an issue with add missing @trpc/server dependency to ensure smooth, error-free operation.",
        "rawCommit": "1518778 fix: add missing @trpc/server dependency"
      },
      {
        "type": "feature",
        "title": "Consolidate user settings and add biometric re-authentication, data export, and admin management screens",
        "description": "Added consolidate user settings and add biometric re-authentication, data export, and admin management screens to expand features and improve usability.",
        "rawCommit": "d36e51d feat: consolidate user settings and add biometric re-authentication, data export, and admin management screens"
      },
      {
        "type": "feature",
        "title": "Implement core mobile application screens, navigation, and security components",
        "description": "Added implement core mobile application screens, navigation, and security components to expand features and improve usability.",
        "rawCommit": "bdf9d73 feat: implement core mobile application screens, navigation, and security components"
      }
    ],
    "isCritical": false
  },
  {
    "version": "0.9.0",
    "versionCode": 31,
    "releaseType": "hybrid",
    "releaseDate": "2026-07-31T10:00:00.000Z",
    "title": "Smart Savings Wishlist & Financial Dashboard",
    "summary": "Introduces Ipon savings goal tracker, activity heatmap visualizations, and initial salary paycheck tracking.",
    "highlights": [
      {
        "type": "feature",
        "title": "Implement mobile inactivity timeout and integrate into app navigator",
        "description": "Added implement mobile inactivity timeout and integrate into app navigator to expand features and improve usability.",
        "rawCommit": "588ce69 feat: implement mobile inactivity timeout and integrate into app navigator"
      },
      {
        "type": "improvement",
        "title": "Optimize query loading, batching and mobile virtualization",
        "description": "Boosted speed and responsiveness for optimize query loading, batching and mobile virtualization.",
        "rawCommit": "99cb1ce perf: optimize query loading, batching and mobile virtualization"
      },
      {
        "type": "feature",
        "title": "Implement BudgetScreen, WishlistScreen, and salary/tax utilities to support financial tracking and planning.",
        "description": "Added implement budgetscreen, wishlistscreen, and salary/tax utilities to support financial tracking and planning. to expand features and improve usability.",
        "rawCommit": "482bd71 feat: implement BudgetScreen, WishlistScreen, and salary/tax utilities to support financial tracking and planning."
      },
      {
        "type": "improvement",
        "title": "Update submodules and cleanup stale docs",
        "description": "Enhanced update submodules and cleanup stale docs for better stability and clean performance.",
        "rawCommit": "ac0930a chore: update submodules and cleanup stale docs"
      },
      {
        "type": "feature",
        "title": "Implement AdminSalaryScreen with animated flip card countdown and paycheck management modals",
        "description": "Added implement adminsalaryscreen with animated flip card countdown and paycheck management modals to expand features and improve usability.",
        "rawCommit": "261266a feat: implement AdminSalaryScreen with animated flip card countdown and paycheck management modals"
      },
      {
        "type": "feature",
        "title": "Implement admin dashboard, payment, order, and salary management screens with supporting utilities and services",
        "description": "Added implement admin dashboard, payment, order, and salary management screens with supporting utilities and services to expand features and improve usability.",
        "rawCommit": "4316f21 feat: implement admin dashboard, payment, order, and salary management screens with supporting utilities and services"
      },
      {
        "type": "feature",
        "title": "Implement core mobile architecture with client and admin screens, navigation, and service utilities",
        "description": "Added implement core mobile architecture with client and admin screens, navigation, and service utilities to expand features and improve usability.",
        "rawCommit": "7d0cb67 feat: implement core mobile architecture with client and admin screens, navigation, and service utilities"
      },
      {
        "type": "feature",
        "title": "Implement client query hooks, background idle prefetch, and navigation structure for mobile app",
        "description": "Added implement client query hooks, background idle prefetch, and navigation structure for mobile app to expand features and improve usability.",
        "rawCommit": "7b09bb2 feat: implement client query hooks, background idle prefetch, and navigation structure for mobile app"
      },
      {
        "type": "improvement",
        "title": "MOBILE,WEB: Optimize app boot, queries & indexes",
        "description": "Boosted speed and responsiveness for optimize app boot, queries & indexes.",
        "rawCommit": "b22636b perf: optimize app boot, queries & indexes"
      },
      {
        "type": "feature",
        "title": "Implement admin payments screen, client dashboard, and app navigation structure",
        "description": "Added implement admin payments screen, client dashboard, and app navigation structure to expand features and improve usability.",
        "rawCommit": "9e6bcf3 feat: implement admin payments screen, client dashboard, and app navigation structure"
      },
      {
        "type": "feature",
        "title": "Implement comprehensive administrative dashboard, client milestone tracking, and notification services with impersonation capabilities.",
        "description": "Added implement comprehensive administrative dashboard, client milestone tracking, and notification services with impersonation capabilities. to expand features and improve usability.",
        "rawCommit": "abc904d feat: implement comprehensive administrative dashboard, client milestone tracking, and notification services with impersonation capabilities."
      },
      {
        "type": "feature",
        "title": "Implement AppNavigator with gesture-wrapped tab navigation and custom floating tab bar",
        "description": "Added implement appnavigator with gesture-wrapped tab navigation and custom floating tab bar to expand features and improve usability.",
        "rawCommit": "004dc75 feat: implement AppNavigator with gesture-wrapped tab navigation and custom floating tab bar"
      },
      {
        "type": "feature",
        "title": "Implement WishlistScreen for goal tracking and savings management",
        "description": "Added implement wishlistscreen for goal tracking and savings management to expand features and improve usability.",
        "rawCommit": "de182ec feat: implement WishlistScreen for goal tracking and savings management"
      },
      {
        "type": "feature",
        "title": "WISHLIST: Add mobile Savings Goal & Ipon Tracker and offset push/email notifications",
        "description": "Added add mobile savings goal & ipon tracker and offset push/email notifications to expand features and improve usability.",
        "rawCommit": "6054c98 feat: add mobile ipon tracker and offset push/email notifications"
      },
      {
        "type": "feature",
        "title": "Implement dashboard activity visualization with heatmap component and real-time synchronization hooks",
        "description": "Added implement dashboard activity visualization with heatmap component and real-time synchronization hooks to expand features and improve usability.",
        "rawCommit": "c2584c3 feat: implement dashboard activity visualization with heatmap component and real-time synchronization hooks"
      },
      {
        "type": "feature",
        "title": "Implement AdminClientsScreen and AdminDashboardScreen for management and monitoring",
        "description": "Added implement adminclientsscreen and admindashboardscreen for management and monitoring to expand features and improve usability.",
        "rawCommit": "3445c20 feat: implement AdminClientsScreen and AdminDashboardScreen for management and monitoring"
      },
      {
        "type": "fix",
        "title": "MOBILE: Resolve light mode theme issues and search loader flashes",
        "description": "Resolved an issue with resolve light mode theme issues and search loader flashes to ensure smooth, error-free operation.",
        "rawCommit": "2f092cd fix: resolve light mode theme issues and search loader flashes"
      },
      {
        "type": "feature",
        "title": "Implement role selection screen and global header actions with integrated weather widget",
        "description": "Added implement role selection screen and global header actions with integrated weather widget to expand features and improve usability.",
        "rawCommit": "1feb0d2 feat: implement role selection screen and global header actions with integrated weather widget"
      },
      {
        "type": "improvement",
        "title": "MOBILE: Centralize and unify safe area padding for modals and sheets",
        "description": "Enhanced centralize and unify safe area padding for modals and sheets for better stability and clean performance.",
        "rawCommit": "4b9f8e2 style: centralize and unify safe area padding for modals and sheets"
      },
      {
        "type": "feature",
        "title": "MILESTONES: Add 1:1 mobile achievements system parity",
        "description": "Added add 1:1 mobile achievements system parity to expand features and improve usability.",
        "rawCommit": "af6747e feat: add 1:1 mobile achievements system parity"
      },
      {
        "type": "feature",
        "title": "Implement comprehensive admin and client dashboard screens with modular navigation and responsive utility support",
        "description": "Added implement comprehensive admin and client dashboard screens with modular navigation and responsive utility support to expand features and improve usability.",
        "rawCommit": "59d338a feat: implement comprehensive admin and client dashboard screens with modular navigation and responsive utility support"
      },
      {
        "type": "feature",
        "title": "Add HeaderWeatherTime component with automated location detection and weather forecasting",
        "description": "Added add headerweathertime component with automated location detection and weather forecasting to expand features and improve usability.",
        "rawCommit": "34c65b4 feat: add HeaderWeatherTime component with automated geolocation and weather forecasting"
      },
      {
        "type": "feature",
        "title": "CLIENT: Integrate tRPC client with fallbacks",
        "description": "Added integrate trpc client with fallbacks to expand features and improve usability.",
        "rawCommit": "cd34047 feat: integrate tRPC client with fallbacks"
      },
      {
        "type": "feature",
        "title": "Add AdminPaymentsScreen for managing financial ledger, imports, and reporting",
        "description": "Added add adminpaymentsscreen for managing financial ledger, imports, and reporting to expand features and improve usability.",
        "rawCommit": "b8723f5 feat: add AdminPaymentsScreen for managing financial ledger, imports, and reporting"
      },
      {
        "type": "feature",
        "title": "Implement client payments dashboard with flip-card countdown and administrative management screens",
        "description": "Added implement client payments dashboard with flip-card countdown and administrative management screens to expand features and improve usability.",
        "rawCommit": "4e9fde1 feat: implement client payments dashboard with flip-card countdown and administrative management screens"
      },
      {
        "type": "feature",
        "title": "Implement admin dashboard and management screens for payments, orders, reports, and notifications",
        "description": "Added implement admin dashboard and management screens for payments, orders, reports, and notifications to expand features and improve usability.",
        "rawCommit": "b5670a8 feat: implement admin dashboard and management screens for payments, orders, reports, and notifications"
      },
      {
        "type": "feature",
        "title": "Implement shared order logic, custom hooks for client queries, and admin/client dashboard screens",
        "description": "Added implement shared order logic, custom hooks for client queries, and admin/client dashboard screens to expand features and improve usability.",
        "rawCommit": "9cba735 feat: implement shared order logic, custom hooks for client queries, and admin/client dashboard screens"
      },
      {
        "type": "improvement",
        "title": "CACHE: Sync web submodule with throttled Redis version checks",
        "description": "Boosted speed and responsiveness for sync web submodule with throttled redis version checks.",
        "rawCommit": "8539a33 perf: sync web submodule with throttled Redis version checks"
      },
      {
        "type": "improvement",
        "title": "ROOT: Add architectural README and sync system files submodules",
        "description": "Enhanced add architectural readme and sync system files submodules for better stability and clean performance.",
        "rawCommit": "84c50c4 docs: add architectural README and sync web/mobile submodules"
      },
      {
        "type": "feature",
        "title": "Update web and mobile submodule pointers",
        "description": "Added update web and mobile submodule pointers to expand features and improve usability.",
        "rawCommit": "de2a53b feat: update web and mobile submodule pointers"
      }
    ],
    "isCritical": false
  }
];
