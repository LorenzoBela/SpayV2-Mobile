# Android PRODUCTION Build Script for S-Pay V2 App
# This script syncs files, generates a release keystore, and creates production APKs.
#
# ================================================================================================
# CONFIGURATION snap (Expo SDK 56 + React Native 0.85.3)
# ================================================================================================
# Critical versions:
#   - react-native:      0.85.3
#   - Expo SDK:          56
#   - JDK:               17 or 21 (Android Studio JBR)
#   - NDK:               26.1.10909125 (Verified installed on system)
# ================================================================================================

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "S-Pay V2 Android PRODUCTION Build Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

#region Pre-Flight Check Functions
function Test-ToolVersion {
    param(
        [string]$ToolName,
        [scriptblock]$VersionCommand,
        [string]$RequiredPattern,
        [string]$Description
    )
    try {
        $version = & $VersionCommand 2>&1 | Out-String
        if ($version -match $RequiredPattern) {
            Write-Host "[OK] $ToolName validated: $($matches[0])" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[WARN] $ToolName version mismatch. Found: $version" -ForegroundColor DarkYellow
            Write-Host "      Expected: $Description" -ForegroundColor Gray
            return $false
        }
    } catch {
        Write-Host "[WARN] $ToolName not found or failed to check version" -ForegroundColor DarkYellow
        return $false
    }
}

function Test-FileContains {
    param(
        [string]$Path,
        [string]$Pattern
    )
    if (-not (Test-Path $Path)) { return $false }
    try {
        $content = Get-Content -Path $Path -Raw
        return $content -match $Pattern
    } catch {
        return $false
    }
}

function Invoke-GradleDaemonCleanup {
    param([string]$ProjectPath)
    Write-Host "[INFO] Stopping Gradle daemons and cleaning old caches..." -ForegroundColor Yellow
    
    try {
        Push-Location (Join-Path $ProjectPath "android")
        .\gradlew --stop 2>&1 | Out-Null
        Pop-Location
        Write-Host "[OK] Gradle daemons stopped" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not stop Gradle daemons: $_" -ForegroundColor DarkYellow
    }
    
    try {
        $gradleCache = Join-Path $env:USERPROFILE ".gradle\caches"
        if (Test-Path $gradleCache) {
            $oldCaches = Get-ChildItem $gradleCache -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) }
            if ($oldCaches) {
                $oldCaches | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "[OK] Cleaned $($oldCaches.Count) old Gradle cache folders (>14 days)" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "[WARN] Could not clean old Gradle caches: $_" -ForegroundColor DarkYellow
    }
}

function Test-AndroidEnvironment {
    param([string]$SdkPath)
    
    $issues = @()
    
    $requiredComponents = @(
        @{Path="platform-tools"; Name="Android Platform Tools"},
        @{Path="build-tools"; Name="Android Build Tools"},
        @{Path="platforms"; Name="Android Platforms"}
    )
    
    foreach ($component in $requiredComponents) {
        $componentPath = Join-Path $SdkPath $component.Path
        if (-not (Test-Path $componentPath)) {
            $issues += "$($component.Name) not found at: $componentPath"
        }
    }
    
    if ($issues.Count -gt 0) {
        Write-Host "[WARN] Android SDK issues detected:" -ForegroundColor DarkYellow
        $issues | ForEach-Object { Write-Host "      - $_" -ForegroundColor Gray }
        return $false
    } else {
        Write-Host "[OK] Android SDK components verified" -ForegroundColor Green
        return $true
    }
}

function Invoke-SmartCleanup {
    param(
        [string]$ProjectPath,
        [switch]$DeepClean
    )
    
    Write-Host "[INFO] Cleaning build artifacts..." -ForegroundColor Yellow
    
    $cleanPaths = @(
        "android\.gradle",
        "android\app\build",
        "android\app\.cxx",
        "android\build"
    )
    
    if ($DeepClean) {
        $cleanPaths += @(
            "node_modules\.cache",
            ".expo"
        )
    }
    
    $cleaned = 0
    foreach ($relativePath in $cleanPaths) {
        $fullPath = Join-Path $ProjectPath $relativePath
        if (Test-Path $fullPath) {
            try {
                Remove-Item -Recurse -Force $fullPath -ErrorAction Stop
                $cleaned++
            } catch {
                Write-Host "[WARN] Could not remove $relativePath" -ForegroundColor DarkYellow
            }
        }
    }
    
    Write-Host "[OK] Cleaned $cleaned build artifact folders" -ForegroundColor Green
}
#endregion

# Define source and destination paths
$SOURCE_DIR = $PSScriptRoot
$DEST_DIR = $SOURCE_DIR
$OTA_CHANNEL = "production"
$EAS_PROFILE = "production"
$FAST_MODE = $true
$FORCE_CLEAN_PREBUILD = $false
$script:GradleMaxWorkers = 2
$script:GradleHeapMb = 8192
$script:ProductionVersionCode = $null
$script:ProductionVersionName = $null
$script:GitHubRepo = "LorenzoBela/SpayV2-Mobile"
$script:GitHubApkFileName = "SPay.V2.apk"
$script:GitHubManifestFileName = "spay-latest.json"

function Set-ProductionBuildMetadata {
    param([string]$AppJsonPath)

    if (-not (Test-Path $AppJsonPath)) {
        Write-Host "[ERROR] app.json not found at $AppJsonPath" -ForegroundColor Red
        exit 1
    }

    try {
        $config = Get-Content -Path $AppJsonPath -Raw | ConvertFrom-Json
        if (-not $config.expo) {
            Write-Host "[ERROR] Invalid app.json: missing top-level 'expo' object" -ForegroundColor Red
            exit 1
        }

        if (-not $config.expo.android) {
            $config.expo | Add-Member -NotePropertyName android -NotePropertyValue ([pscustomobject]@{})
        }

        if (-not $config.expo.extra) {
            $config.expo | Add-Member -NotePropertyName extra -NotePropertyValue ([pscustomobject]@{})
        }

        $currentVersionCode = 0
        if ($null -ne $config.expo.android.versionCode) {
            $currentVersionCode = [int]$config.expo.android.versionCode
        }
        $nextVersionCode = [Math]::Max(1, $currentVersionCode + 1)
        $versionName = if ($config.expo.version) { [string]$config.expo.version } else { "1.0.0" }
        $apkUrl = "https://github.com/$($script:GitHubRepo)/releases/latest/download/$([uri]::EscapeDataString($script:GitHubApkFileName))"
        $manifestUrl = "https://github.com/$($script:GitHubRepo)/releases/latest/download/$($script:GitHubManifestFileName)"

        if ($null -eq $config.expo.android.versionCode) {
            $config.expo.android | Add-Member -NotePropertyName versionCode -NotePropertyValue $nextVersionCode
        } else {
            $config.expo.android.versionCode = $nextVersionCode
        }

        if ($null -eq $config.expo.extra.androidApkUrl) {
            $config.expo.extra | Add-Member -NotePropertyName androidApkUrl -NotePropertyValue $apkUrl
        } else {
            $config.expo.extra.androidApkUrl = $apkUrl
        }

        if ($null -eq $config.expo.extra.androidApkManifestUrl) {
            $config.expo.extra | Add-Member -NotePropertyName androidApkManifestUrl -NotePropertyValue $manifestUrl
        } else {
            $config.expo.extra.androidApkManifestUrl = $manifestUrl
        }

        $config | ConvertTo-Json -Depth 100 | Set-Content -Path $AppJsonPath -Encoding UTF8
        $script:ProductionVersionCode = $nextVersionCode
        $script:ProductionVersionName = $versionName

        Write-Host "[OK] Production build metadata: versionName=$versionName versionCode=$nextVersionCode" -ForegroundColor Green
        Write-Host "[OK] Android APK URL: $apkUrl" -ForegroundColor Green
        Write-Host "[OK] Android APK manifest URL: $manifestUrl" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to set production build metadata: $_" -ForegroundColor Red
        exit 1
    }
}

function Set-AndroidGradleVersionMetadata {
    param(
        [string]$GradlePath,
        [int]$VersionCode,
        [string]$VersionName
    )

    if (-not (Test-Path $GradlePath)) { return }
    $raw = Get-Content -Path $GradlePath -Raw
    $raw = $raw -replace 'versionCode\s+\d+', "versionCode $VersionCode"
    $raw = $raw -replace 'versionName\s+"[^"]*"', "versionName `"$VersionName`""
    Set-Content -Path $GradlePath -Value $raw
    Write-Host "[OK] Applied Android version metadata to app/build.gradle" -ForegroundColor Green
}

function Assert-AndroidFcmConfig {
    param([string]$ProjectRoot)

    $googleServicesPath = Join-Path $ProjectRoot "google-services.json"
    if (-not (Test-Path $googleServicesPath)) {
        Write-Host "`n[ERROR] Missing Android FCM config: $googleServicesPath" -ForegroundColor Red
        Write-Host "Killed-app push notifications require Firebase Cloud Messaging credentials in the native APK." -ForegroundColor Yellow
        Write-Host "Create/download google-services.json for Android package com.cerberuzz91141.mobile, place it in mobile\, then rerun this script." -ForegroundColor Yellow
        Write-Host "Expo docs: https://docs.expo.dev/push-notifications/push-notifications-setup/" -ForegroundColor Gray
        exit 1
    }

    try {
        $raw = Get-Content -Path $googleServicesPath -Raw
        $json = $raw | ConvertFrom-Json
        $packageNames = @()
        foreach ($client in @($json.client)) {
            $packageName = $client.client_info.android_client_info.package_name
            if ($packageName) { $packageNames += $packageName }
        }

        if ($packageNames -notcontains "com.cerberuzz91141.mobile") {
            Write-Host "`n[ERROR] google-services.json does not contain package com.cerberuzz91141.mobile" -ForegroundColor Red
            Write-Host "Found package(s): $($packageNames -join ', ')" -ForegroundColor Yellow
            exit 1
        }

        Write-Host "[OK] Android FCM config found for com.cerberuzz91141.mobile" -ForegroundColor Green
    } catch {
        Write-Host "`n[ERROR] Failed to validate google-services.json: $_" -ForegroundColor Red
        exit 1
    }
}

function Ensure-OtaChannelInAppJson {
    param(
        [string]$AppJsonPath,
        [string]$ChannelName
    )

    if (-not (Test-Path $AppJsonPath)) {
        Write-Host "[ERROR] app.json not found at $AppJsonPath" -ForegroundColor Red
        exit 1
    }

    try {
        $config = Get-Content -Path $AppJsonPath -Raw | ConvertFrom-Json

        if (-not $config.expo) {
            Write-Host "[ERROR] Invalid app.json: missing top-level 'expo' object" -ForegroundColor Red
            exit 1
        }

        if (-not $config.expo.updates) {
            $config.expo | Add-Member -NotePropertyName updates -NotePropertyValue ([pscustomobject]@{})
        }

        if (-not $config.expo.updates.requestHeaders) {
            $config.expo.updates | Add-Member -NotePropertyName requestHeaders -NotePropertyValue ([pscustomobject]@{})
        }

        $currentChannel = $config.expo.updates.requestHeaders."expo-channel-name"
        if ($null -eq $currentChannel) {
            $config.expo.updates.requestHeaders | Add-Member -NotePropertyName "expo-channel-name" -NotePropertyValue $ChannelName
            $config | ConvertTo-Json -Depth 100 | Set-Content -Path $AppJsonPath -Encoding UTF8
            Write-Host "[OK] Added updates.requestHeaders.expo-channel-name='$ChannelName' to app.json" -ForegroundColor Green
        } elseif ($currentChannel -ne $ChannelName) {
            $config.expo.updates.requestHeaders."expo-channel-name" = $ChannelName
            $config | ConvertTo-Json -Depth 100 | Set-Content -Path $AppJsonPath -Encoding UTF8
            Write-Host "[OK] Updated updates.requestHeaders.expo-channel-name to '$ChannelName' in app.json" -ForegroundColor Green
        } else {
            Write-Host "[OK] app.json already targets OTA channel '$ChannelName'" -ForegroundColor Green
        }
    } catch {
        Write-Host "[ERROR] Failed to enforce OTA channel in app.json: $_" -ForegroundColor Red
        exit 1
    }
}

function Get-FileSha256 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    } catch {
        return $null
    }
}

function Get-CombinedHash {
    param([string[]]$Paths)
    $parts = @()
    foreach ($p in $Paths) {
        if (Test-Path $p) {
            $hash = Get-FileSha256 -Path $p
            if ($hash) { $parts += "$p|$hash" }
        }
    }
    if ($parts.Count -eq 0) { return $null }
    $joined = ($parts | Sort-Object) -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($joined)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash($bytes)
        return ([BitConverter]::ToString($hashBytes)).Replace("-", "")
    } finally {
        $sha.Dispose()
    }
}

function Get-PropertiesFromFile {
    param([string]$Path)

    $props = @{}
    if (-not (Test-Path $Path)) { return $props }

    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line) { return }
        if ($line.StartsWith("#") -or $line.StartsWith("!")) { return }

        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }

        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        if ($key) { $props[$key] = $value }
    }

    return $props
}

function Configure-SentryBuildUpload {
    param(
        [string]$AndroidDir
    )

    $sentryPropsPath = Join-Path $AndroidDir "sentry.properties"
    $sentryProps = Get-PropertiesFromFile -Path $sentryPropsPath

    $authToken = $env:SENTRY_AUTH_TOKEN
    if ([string]::IsNullOrWhiteSpace($authToken) -and $sentryProps.ContainsKey("auth.token")) {
        $authToken = $sentryProps["auth.token"]
    }

    $org = $env:SENTRY_ORG
    if ([string]::IsNullOrWhiteSpace($org) -and $sentryProps.ContainsKey("defaults.org")) {
        $org = $sentryProps["defaults.org"]
    }

    $project = $env:SENTRY_PROJECT
    if ([string]::IsNullOrWhiteSpace($project) -and $sentryProps.ContainsKey("defaults.project")) {
        $project = $sentryProps["defaults.project"]
    }

    if (
        [string]::IsNullOrWhiteSpace($authToken) -or
        [string]::IsNullOrWhiteSpace($org) -or
        [string]::IsNullOrWhiteSpace($project)
    ) {
        $env:SENTRY_DISABLE_AUTO_UPLOAD = "true"
        Write-Host "[WARN] Sentry upload disabled: missing auth/org/project configuration." -ForegroundColor DarkYellow
        return
    }

    $env:SENTRY_AUTH_TOKEN = $authToken
    $env:SENTRY_ORG = $org
    $env:SENTRY_PROJECT = $project
    $env:SENTRY_DISABLE_AUTO_UPLOAD = "false"

    Write-Host "[OK] Sentry upload enabled for org '$org' / project '$project'" -ForegroundColor Green
}

# Step 0: Ensure signing secrets are loaded
Write-Host "`nStep 0: Loading signing configuration..." -ForegroundColor Yellow
$KEYSTORE_PATH = Join-Path $SOURCE_DIR "release.keystore"

# Load build secrets from .env.build if it exists
$envFile = Join-Path $SOURCE_DIR ".env.build"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match "^[^#]*=" } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        Set-Item -Path "env:\$name" -Value $value.Trim()
    }
}

$KEYSTORE_PASS = $env:RELEASE_KEYSTORE_PASSWORD
$KEY_ALIAS = $env:RELEASE_KEYSTORE_ALIAS

if ([string]::IsNullOrWhiteSpace($KEYSTORE_PASS) -or [string]::IsNullOrWhiteSpace($KEY_ALIAS)) {
    Write-Host "[WARN] RELEASE_KEYSTORE_PASSWORD or RELEASE_KEYSTORE_ALIAS missing in .env.build" -ForegroundColor DarkYellow
    Write-Host "Defaulting to temporary developer production keystore passwords..." -ForegroundColor Gray
    $KEYSTORE_PASS = "spayv2keystorepass"
    $KEY_ALIAS = "spayv2keyalias"
}

if (-not (Test-Path $KEYSTORE_PATH)) {
    Write-Host "[INFO] Generating new release.keystore..." -ForegroundColor Yellow
    & keytool -genkeypair -v -storetype PKCS12 -keystore $KEYSTORE_PATH -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 -storepass $KEYSTORE_PASS -keypass $KEYSTORE_PASS -dname "CN=SPay, OU=Mobile, O=LorenzoBela, L=Manila, ST=NCR, C=PH"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] release.keystore generated successfully" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to generate release.keystore" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] release.keystore already exists" -ForegroundColor Green
}

# Step 0.1: Sync files from editing location to build location (Robocopy Skipped)
Write-Host "`nStep 0.1: Robocopy skipped. Building directly in local directory." -ForegroundColor Green

Set-Location $DEST_DIR
Write-Host "[OK] Switched to build directory: $DEST_DIR" -ForegroundColor Green
Write-Host ""

$BUILD_CACHE_DIR = Join-Path $DEST_DIR ".build-cache"
if (-not (Test-Path $BUILD_CACHE_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_CACHE_DIR -Force | Out-Null
}

Write-Host "`nStep 0.2: Enforcing OTA channel configuration..." -ForegroundColor Yellow
$appJsonPath = Join-Path $DEST_DIR "app.json"
Ensure-OtaChannelInAppJson -AppJsonPath $appJsonPath -ChannelName $OTA_CHANNEL
Set-ProductionBuildMetadata -AppJsonPath $appJsonPath
Assert-AndroidFcmConfig -ProjectRoot $DEST_DIR
$env:EAS_BUILD_PROFILE = $EAS_PROFILE
Write-Host "[OK] EAS build profile set to: $env:EAS_BUILD_PROFILE" -ForegroundColor Green
Write-Host "[OK] OTA channel locked to: $OTA_CHANNEL" -ForegroundColor Green

Write-Host "`nStep 1: Checking Windows long path support..." -ForegroundColor Yellow
try {
    $longPathsEnabled = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -ErrorAction SilentlyContinue
    if ($longPathsEnabled.LongPathsEnabled -ne 1) {
        Write-Host "[WARN] Long path support not enabled. This might cause build failures." -ForegroundColor DarkYellow
    } else {
        Write-Host "[OK] Long path support is already enabled" -ForegroundColor Green
    }
} catch {}

$PROJECT_ROOT = $DEST_DIR
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"

$env:NODE_BINARY = "C:\Program Files\nodejs\node.exe"
Write-Host "[OK] Node binary set to: $env:NODE_BINARY" -ForegroundColor Green

Write-Host "`nStep 2: Pre-Flight Environment Validation..." -ForegroundColor Yellow
Test-ToolVersion -ToolName "Node.js" -VersionCommand { node --version } -RequiredPattern "v(1[6-9]|2\d)\." -Description "Node.js 16.x or higher"
$javaCheck = Test-ToolVersion -ToolName "Java JDK" -VersionCommand { javac -version } -RequiredPattern "javac (11|17|21)\." -Description "JDK 11, 17, or 21"

Invoke-GradleDaemonCleanup -ProjectPath $PROJECT_ROOT

Write-Host "`nStep 2.1: Toolchain sanity (JDK + Android SDK)..." -ForegroundColor Yellow
$env:ANDROID_STL = "c++_shared"
$env:CMAKE_ANDROID_STL_TYPE = "c++_shared"

$localPropsPathEarly = "$ANDROID_DIR\local.properties"
$sdkDirEarly = $null
if (Test-Path $localPropsPathEarly) {
    $sdkLineEarly = Get-Content $localPropsPathEarly | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
    if ($sdkLineEarly) {
        $sdkDirEarly = $sdkLineEarly -replace 'ndk\.dir=.*', '' -replace '^sdk\.dir=', '' -replace '\\:', ':' -replace '\\ ', ' ' -replace '\\\\', '\'
    }
}

function Update-LocalPropertiesPaths {
    param([string]$Path, [string]$SdkDir)
    $lines = @()
    if (Test-Path $Path) { $lines = Get-Content $Path }
    $lines = $lines | Where-Object { $_ -notmatch '^sdk\.dir=' -and $_ -notmatch '^ndk\.dir=' }
    if ($SdkDir) { $lines += ("sdk.dir=" + ($SdkDir -replace '\\', '/')) }
    Set-Content -Path $Path -Value $lines
}

function Remove-NdkDirFromLocalProperties {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $lines = Get-Content $Path | Where-Object { $_ -notmatch '^ndk\.dir=' }
    Set-Content -Path $Path -Value $lines
}

function Get-ResolvedAndroidSdkDir {
    param([string]$LocalPropertiesPath, [string]$SdkFromLocalProperties)
    $candidates = @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, $SdkFromLocalProperties, "$env:LOCALAPPDATA\Android\Sdk", "$env:USERPROFILE\AppData\Local\Android\Sdk") | Where-Object { $_ -and $_.Trim().Length -gt 0 }
    foreach ($cand in $candidates) { if (Test-Path $cand) { return $cand } }
    return $null
}

if ((!$env:ANDROID_HOME -or !$env:ANDROID_SDK_ROOT) -and $sdkDirEarly) {
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = $sdkDirEarly }
    if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $sdkDirEarly }
    
    Test-AndroidEnvironment -SdkPath $sdkDirEarly
    Update-LocalPropertiesPaths -Path $localPropsPathEarly -SdkDir $sdkDirEarly
    Remove-NdkDirFromLocalProperties -Path $localPropsPathEarly
}

# --- CRITICAL NDK 26 LOCK ---
$preferredNdkVersion = "26.1.10909125"
$resolvedSdkDir = Get-ResolvedAndroidSdkDir -LocalPropertiesPath $localPropsPathEarly -SdkFromLocalProperties $sdkDirEarly

if ($resolvedSdkDir) {
    $ndkRoot = Join-Path $resolvedSdkDir "ndk"
    $ndkDir = Join-Path $ndkRoot $preferredNdkVersion

    if (-not (Test-Path $ndkDir)) {
        Write-Host "`n[ERROR] CRITICAL: React Native 0.85 requires Android NDK $preferredNdkVersion" -ForegroundColor Red
        exit 1
    }

    $env:ANDROID_NDK_HOME = $ndkDir
    $env:NDK_HOME = $ndkDir
    Write-Host "[OK] Enforcing NDK version: $preferredNdkVersion" -ForegroundColor Green
    
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = $resolvedSdkDir }
    if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $resolvedSdkDir }
    Update-LocalPropertiesPaths -Path $localPropsPathEarly -SdkDir $resolvedSdkDir
    Remove-NdkDirFromLocalProperties -Path $localPropsPathEarly
}

$candidateJdks = @("$env:ProgramFiles\Android\Android Studio\jbr", "$env:ProgramFiles\Android\Android Studio\jre", "$env:ProgramFiles\Android\Android Studio\jre\jre")
$chosenJavaHome = $null
foreach ($j in $candidateJdks) { if ($j -and (Test-Path "$j\bin\java.exe")) { $chosenJavaHome = $j; break } }
if (-not $env:JAVA_HOME) { if ($chosenJavaHome) { $env:JAVA_HOME = $chosenJavaHome } }
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin")) { if ($env:Path -notlike "*$env:JAVA_HOME\bin*") { $env:Path = "$env:JAVA_HOME\bin;$env:Path" } }


Write-Host "`nStep 3: Cleaning build directories..." -ForegroundColor Yellow
Invoke-SmartCleanup -ProjectPath $PROJECT_ROOT
Write-Host "`nStep 4: Cleaning Gradle cache..." -ForegroundColor Yellow
Set-Location $ANDROID_DIR
if (Test-Path ".\gradlew.bat") {
    if ($FAST_MODE) {
        Write-Host "[INFO] FAST_MODE enabled: skipping gradlew clean for faster iteration" -ForegroundColor Gray
    } else {
        .\gradlew.bat clean
    }
}
Set-Location $PROJECT_ROOT

Write-Host "`nStep 5: Ensuring node_modules are up to date..." -ForegroundColor Yellow
$nodeModulesDir = Join-Path $PROJECT_ROOT "node_modules"
$lockFile = Join-Path $PROJECT_ROOT "package-lock.json"
$depsStampPath = Join-Path $BUILD_CACHE_DIR "deps.lock.sha256"
$didRunNpmInstall = $false

if (-not (Test-Path $nodeModulesDir)) {
    Write-Host "[INFO] node_modules not found, running full install..." -ForegroundColor Gray
    npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps
    $didRunNpmInstall = $true
} elseif ($FAST_MODE) {
    $currentLockHash = Get-FileSha256 -Path $lockFile
    $previousLockHash = $null
    if (Test-Path $depsStampPath) {
        $previousLockHash = (Get-Content -Path $depsStampPath -Raw).Trim()
    }

    if ($currentLockHash -and $previousLockHash -and $currentLockHash -eq $previousLockHash) {
        Write-Host "[INFO] FAST_MODE: lockfile unchanged, skipping npm install" -ForegroundColor Gray
    } else {
        Write-Host "[INFO] FAST_MODE: lockfile changed or stamp missing, running npm install" -ForegroundColor Gray
        npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps
        $didRunNpmInstall = $true
    }
} else {
    npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps
    $didRunNpmInstall = $true
}

if ($didRunNpmInstall -and $LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed" -ForegroundColor Red
    exit $LASTEXITCODE
}

if ($didRunNpmInstall) {
    $installedLockHash = Get-FileSha256 -Path $lockFile
    if ($installedLockHash) { Set-Content -Path $depsStampPath -Value $installedLockHash }
}

Write-Host "`nStep 6: Regenerating native Android project (Prebuild)..." -ForegroundColor Yellow
$env:CI = "1"
$prebuildStampPath = Join-Path $BUILD_CACHE_DIR "expo-prebuild.sha256"
$prebuildInputs = @(
    (Join-Path $PROJECT_ROOT "app.json"),
    (Join-Path $PROJECT_ROOT "package.json"),
    (Join-Path $PROJECT_ROOT "package-lock.json"),
    (Join-Path $PROJECT_ROOT "eas.json"),
    (Join-Path $PROJECT_ROOT "babel.config.js"),
    (Join-Path $PROJECT_ROOT "metro.config.js")
)
$currentPrebuildHash = Get-CombinedHash -Paths $prebuildInputs
$previousPrebuildHash = $null
if (Test-Path $prebuildStampPath) {
    $previousPrebuildHash = (Get-Content -Path $prebuildStampPath -Raw).Trim()
}

$shouldRunPrebuild = $true
if ($FAST_MODE -and -not $FORCE_CLEAN_PREBUILD -and (Test-Path $ANDROID_DIR) -and $currentPrebuildHash -and $previousPrebuildHash -and $currentPrebuildHash -eq $previousPrebuildHash) {
    $shouldRunPrebuild = $false
    Write-Host "[INFO] FAST_MODE: native inputs unchanged, skipping expo prebuild" -ForegroundColor Gray
}

if ($shouldRunPrebuild) {
    $prebuildArgs = @("expo", "prebuild", "--platform", "android")
    if ($FORCE_CLEAN_PREBUILD) { $prebuildArgs += "--clean" }

    npx @prebuildArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npx expo prebuild failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    if ($currentPrebuildHash) {
        Set-Content -Path $prebuildStampPath -Value $currentPrebuildHash
    }
}

# ============================================
# Step 6.1: Post-Prebuild Gradle / Signing / CMake STL fixes
# ============================================
Write-Host "`nStep 6.1: Applying post-prebuild Gradle / Signing / CMake STL fixes..." -ForegroundColor Yellow

# --- Re-apply local.properties after prebuild wiped android/ ---
$localPropsPost = Join-Path $ANDROID_DIR "local.properties"
if ($resolvedSdkDir) {
    Update-LocalPropertiesPaths -Path $localPropsPost -SdkDir $resolvedSdkDir
    Remove-NdkDirFromLocalProperties -Path $localPropsPost
}

# --- Fix kotlinVersion in gradle.properties ---
$gradleProps = Join-Path $ANDROID_DIR "gradle.properties"
if (Test-Path $gradleProps) {
    $propsContent = Get-Content $gradleProps -Raw
    $targetKotlinVersion = "2.1.20"
    if ($propsContent -match 'android\.kotlinVersion=([^\r\n]+)') {
        $extractedVersion = $matches[1].Trim()
        if ([System.Version]$extractedVersion -gt [System.Version]$targetKotlinVersion) {
            $targetKotlinVersion = $extractedVersion
        }
    }
    if ($propsContent -match '(?m)^kotlinVersion=.*') {
        $propsContent = $propsContent -replace '(?m)^kotlinVersion=.*', "kotlinVersion=$targetKotlinVersion"
        Set-Content -Path $gradleProps -Value $propsContent
        Write-Host "[OK] Enforced kotlinVersion=$targetKotlinVersion in gradle.properties" -ForegroundColor Green
    } else {
        Add-Content -Path $gradleProps -Value "`nkotlinVersion=$targetKotlinVersion"
        Write-Host "[OK] Added kotlinVersion=$targetKotlinVersion to gradle.properties" -ForegroundColor Green
    }
}

# --- Re-enforce NDK env vars post-prebuild ---
if ($resolvedSdkDir) {
    $ndkDirPost = Join-Path (Join-Path $resolvedSdkDir "ndk") $preferredNdkVersion
    if (Test-Path $ndkDirPost) {
        $env:ANDROID_NDK_HOME = $ndkDirPost
        $env:NDK_HOME = $ndkDirPost
        $env:ANDROID_NDK = $ndkDirPost
    }
}

$rootBuildGradle = Join-Path $ANDROID_DIR "build.gradle"
$appBuildGradle = Join-Path $ANDROID_DIR "app\build.gradle"
if ($script:ProductionVersionCode -and $script:ProductionVersionName) {
    Set-AndroidGradleVersionMetadata -GradlePath $appBuildGradle -VersionCode $script:ProductionVersionCode -VersionName $script:ProductionVersionName
}

# C++ STL / CMake linking fix functions
function Ensure-LineInFile {
    param([string]$Path, [string]$MatchRegex, [string]$LineToSet)
    if (-not (Test-Path $Path)) { return }
    $content = Get-Content -Path $Path
    $matched = $false
    $newContent = @()
    foreach ($line in $content) {
        if ($line -match $MatchRegex) { $newContent += $LineToSet; $matched = $true }
        else { $newContent += $line }
    }
    if (-not $matched) { $newContent += $LineToSet }
    Set-Content -Path $Path -Value $newContent
}

function Ensure-GradleMemorySettings {
    param([string]$GradlePropsPath)
    if (-not (Test-Path $GradlePropsPath)) { return }

    $logicalCores = [Environment]::ProcessorCount
    $totalRamGb = 16
    try {
        $totalRamGb = [math]::Round(((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB), 1)
    } catch {}

    $heapMb = [int][math]::Floor([math]::Min(12288, [math]::Max(6144, $totalRamGb * 1024 * 0.5)))
    $metaMb = [int][math]::Floor([math]::Min(1536, [math]::Max(768, $heapMb * 0.125)))
    $kotlinMb = [int][math]::Floor([math]::Min(4096, [math]::Max(2048, $heapMb * 0.3)))

    $workersByCore = [math]::Max(2, $logicalCores - 2)
    $workersByRam = [math]::Max(2, [int][math]::Floor($totalRamGb / 4))
    $maxWorkers = [math]::Min(8, [math]::Min($workersByCore, $workersByRam))

    $parallelEnabled = if ($maxWorkers -ge 4) { "true" } else { "false" }
    $script:GradleMaxWorkers = $maxWorkers
    $script:GradleHeapMb = $heapMb

    Ensure-LineInFile -Path $GradlePropsPath -MatchRegex '^org\.gradle\.jvmargs=' -LineToSet "org.gradle.jvmargs=-Xmx${heapMb}m -XX:MaxMetaspaceSize=${metaMb}m -Dfile.encoding=UTF-8 -XX:+HeapDumpOnOutOfMemoryError"
    Ensure-LineInFile -Path $GradlePropsPath -MatchRegex '^kotlin\.daemon\.jvm\.options=' -LineToSet "kotlin.daemon.jvm.options=-Xmx${kotlinMb}m"
    Ensure-LineInFile -Path $GradlePropsPath -MatchRegex '^org\.gradle\.workers\.max=' -LineToSet "org.gradle.workers.max=$maxWorkers"
    Ensure-LineInFile -Path $GradlePropsPath -MatchRegex '^org\.gradle\.parallel=' -LineToSet "org.gradle.parallel=$parallelEnabled"
}

function Ensure-BlockAfterLine {
    param([string]$Path, [string]$AnchorRegex, [string]$BlockText, [string]$BlockMarker)
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Path $Path -Raw
    if ($raw -match [regex]::Escape($BlockMarker)) { return }
    $lines = Get-Content -Path $Path
    $output = @()
    foreach ($line in $lines) {
        $output += $line
        if ($line -match $AnchorRegex) { $output += $BlockText }
    }
    Set-Content -Path $Path -Value $output
}

function Ensure-AppCmakeArguments {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Path $Path -Raw
    if ($raw -match 'BEGIN app-cmake-libcxx-fix') { return }
    $block = @(
        '        // BEGIN app-cmake-libcxx-fix',
        '        externalNativeBuild {',
        '            cmake {',
        '                arguments "-DANDROID_STL=c++_shared",',
        '                          "-DCMAKE_ANDROID_STL_TYPE=c++_shared",',
        '                          "-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared",',
        '                          "-DCMAKE_EXE_LINKER_FLAGS=-lc++_shared",',
        '                          "-DANDROID_LD=lld"',
        '            }',
        '        }',
        '        // END app-cmake-libcxx-fix'
    )
    $lines = Get-Content -Path $Path
    $output = @()
    foreach ($line in $lines) {
        $output += $line
        if ($line -match 'buildConfigField\s+"String"\s*,\s*"REACT_NATIVE_RELEASE_LEVEL"') {
            $output += $block
        }
    }
    Set-Content -Path $Path -Value $output
}

function Ensure-CMakeLibCppShared {
    param([string]$Path, [string]$TargetName)
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Path $Path -Raw

    $raw = $raw -replace '`cmake_minimum_required', 'cmake_minimum_required'
    $raw = $raw -replace '`n', "`n"
    $escapedTargetName = [regex]::Escape($TargetName)

    if ($raw -notmatch "add_library\s*\(\s*$escapedTargetName\b") {
        return
    }

    if ($raw -match "add_library\s*\(\s*$escapedTargetName\b[^\)]*\bIMPORTED\b") {
        return
    }

    if ($raw -notmatch 'find_library\(CPP_SHARED_LIB c\+\+_shared\)') {
        if ($raw -match 'find_library\([^\n]*log[^\n]*\)') {
             $raw = $raw -replace '(find_library\([^\n]*log[^\n]*\)\s*)', "`$1`nfind_library(CPP_SHARED_LIB c++_shared)`n`nif(NOT CPP_SHARED_LIB)`n  set(CPP_SHARED_LIB c++_shared)`nendif()`n"
        } else {
             $raw = [regex]::Replace($raw, '(cmake_minimum_required\([^\)]*\)\s*)', { $args[0].Groups[1].Value + "`nfind_library(CPP_SHARED_LIB c++_shared)`n`nif(NOT CPP_SHARED_LIB)`n  set(CPP_SHARED_LIB c++_shared)`nendif()`n" })
        }
        if ($raw -notmatch 'find_library\(CPP_SHARED_LIB c\+\+_shared\)') {
            $raw = "find_library(CPP_SHARED_LIB c++_shared)`n`nif(NOT CPP_SHARED_LIB)`n  set(CPP_SHARED_LIB c++_shared)`nendif()`n`n$raw"
        }
    }

    $targetLinkMatches = [regex]::Matches($raw, "target_link_libraries\s*\(\s*$escapedTargetName\b(?<body>[\s\S]*?)\)")
    $usesKeywordSignature = $false
    foreach ($targetLinkMatch in $targetLinkMatches) {
        if ($targetLinkMatch.Groups['body'].Value -match '\b(PRIVATE|PUBLIC|INTERFACE)\b') {
            $usesKeywordSignature = $true
            break
        }
    }

    if ($usesKeywordSignature) {
        $plainCppSharedLinkPattern = "target_link_libraries\s*\(\s*$escapedTargetName\s+(\$\{CPP_SHARED_LIB\}|c\+\+_shared)\s*\)"
        $raw = [regex]::Replace($raw, $plainCppSharedLinkPattern, { "target_link_libraries($TargetName PRIVATE `${CPP_SHARED_LIB})" })
    }

    $definesLink = $raw -match "target_link_libraries\s*\(\s*[^\)]*$escapedTargetName[^\)]*(\$\{CPP_SHARED_LIB\}|c\+\+_shared)"
    if (-not $definesLink) {
        if ($usesKeywordSignature) {
            $raw += "`n`ntarget_link_libraries(${TargetName} PRIVATE `$`{CPP_SHARED_LIB})`n"
        } else {
            $raw += "`n`ntarget_link_libraries(${TargetName} `$`{CPP_SHARED_LIB})`n"
        }
    }

    Set-Content -Path $Path -Value $raw
}

# --- Apply CMake c++_shared STL flags ---
Ensure-LineInFile -Path $gradleProps -MatchRegex '^android\.cmake\.arguments=' -LineToSet 'android.cmake.arguments=-DANDROID_STL=c++_shared -DCMAKE_ANDROID_STL_TYPE=c++_shared -DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared -DCMAKE_EXE_LINKER_FLAGS=-lc++_shared'
Ensure-GradleMemorySettings -GradlePropsPath $gradleProps

$env:GRADLE_OPTS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"
$env:JAVA_TOOL_OPTIONS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"

$cmakeBlock = @(
    '// BEGIN libcxx-shared-fix',
    'def configureAndroidCmake = { Project project ->',
    '  project.android.defaultConfig {',
    '    externalNativeBuild {',
    '      cmake {',
    '        arguments "-DANDROID_STL=c++_shared",',
    '                  "-DCMAKE_ANDROID_STL_TYPE=c++_shared",',
    '                  "-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared",',
    '                  "-DCMAKE_EXE_LINKER_FLAGS=-lc++_shared"',
    '      }',
    '    }',
    '  }',
    '}',
    'subprojects { project ->',
    '  project.plugins.withId("com.android.application") {',
    '    configureAndroidCmake(project)',
    '  }',
    '  project.plugins.withId("com.android.library") {',
    '    configureAndroidCmake(project)',
    '  }',
    '}',
    '// END libcxx-shared-fix'
)
Ensure-BlockAfterLine -Path $rootBuildGradle -AnchorRegex 'apply plugin: "com.facebook.react.rootproject"' -BlockText $cmakeBlock -BlockMarker '// BEGIN libcxx-shared-fix'
Ensure-AppCmakeArguments -Path $appBuildGradle

# Patch native modules
$knownTargets = @{
    'expo-modules-core'           = '${PACKAGE_NAME}'
    'react-native-screens'        = 'rnscreens'
    'react-native-worklets'       = 'worklets'
    'react-native-reanimated'     = 'reanimated'
    'react-native-nitro-modules'  = 'NitroModules'
}
$cmakePatchCount = 0

$cmakePatchStampPath = Join-Path $BUILD_CACHE_DIR "cmake-patch.sha256"
$cmakePatchKey = Get-FileSha256 -Path $lockFile
$skipCmakeScan = $false
if ($FAST_MODE -and $cmakePatchKey -and (Test-Path $cmakePatchStampPath)) {
    $previousCmakePatchKey = (Get-Content -Path $cmakePatchStampPath -Raw).Trim()
    if ($previousCmakePatchKey -eq $cmakePatchKey) { $skipCmakeScan = $true }
}

if ($skipCmakeScan) {
    Write-Host "[INFO] FAST_MODE: node_modules unchanged, skipping CMake scan" -ForegroundColor Gray
} else {
    $cmakeFiles = Get-ChildItem -Path (Join-Path $PROJECT_ROOT "node_modules") -Filter "CMakeLists.txt" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'android' -and $_.FullName -notmatch '\.cxx' -and $_.FullName -notmatch 'build\\' }

    foreach ($cmakeFile in $cmakeFiles) {
        $raw = Get-Content -Path $cmakeFile.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $raw) { continue }
        if ($raw -notmatch 'target_link_libraries') { continue }

        $moduleName = ($cmakeFile.FullName -replace '.*node_modules\\', '' -replace '\\android.*', '')
        $targetName = $null
        if ($knownTargets.ContainsKey($moduleName)) {
            $targetName = $knownTargets[$moduleName]
        } elseif ($raw -match 'add_library\(\s*([\w${}]+)') {
            $targetName = $matches[1]
        }
        if (-not $targetName) { continue }

        Ensure-CMakeLibCppShared -Path $cmakeFile.FullName -TargetName $targetName
        $cmakePatchCount++
    }

    if ($cmakePatchKey) { Set-Content -Path $cmakePatchStampPath -Value $cmakePatchKey }
}

# --- INJECT RELEASE SIGNING FIX ---
function Invoke-ReleaseSigningFix {
    param([string]$ProjectRoot)
    $gradlePath = Join-Path $ProjectRoot "android\app\build.gradle"
    if (-not (Test-Path $gradlePath)) { return }
    
    $raw = Get-Content -Path $gradlePath -Raw

    if ($raw -notmatch 'signingConfigs\s*\{\s*(debug\s*\{[^}]+\}\s*)release\s*\{') {
        $replacement = "signingConfigs {`n        debug {`n            storeFile file('debug.keystore')`n            storePassword 'android'`n            keyAlias 'androiddebugkey'`n            keyPassword 'android'`n        }`n        release {`n            storeFile file('../../release.keystore')`n            storePassword '$KEYSTORE_PASS'`n            keyAlias '$KEY_ALIAS'`n            keyPassword '$KEYSTORE_PASS'`n        }"
        $raw = $raw -replace 'signingConfigs\s*\{\s*debug\s*\{([^{}]|\{[^{}]*\})*\}\s*', $replacement
    }

    $raw = $raw -replace 'signingConfig signingConfigs\.debug', 'signingConfig signingConfigs.release'

    Set-Content -Path $gradlePath -Value $raw
    Write-Host "[OK] Applied release signing config to app/build.gradle" -ForegroundColor Green
}
Invoke-ReleaseSigningFix -ProjectRoot $PROJECT_ROOT

function Invoke-FirebaseMessagingManifestFix {
    param([string]$ProjectRoot)

    $manifestPath = Join-Path $ProjectRoot "android\app\src\main\AndroidManifest.xml"
    if (-not (Test-Path $manifestPath)) { return }

    $raw = Get-Content -Path $manifestPath -Raw
    if ($raw -notmatch 'xmlns:tools=') {
        $raw = $raw -replace '<manifest xmlns:android="http://schemas.android.com/apk/res/android"', '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"'
    }

    $raw = [regex]::Replace(
        $raw,
        '(<meta-data\s+android:name="com\.google\.firebase\.messaging\.default_notification_channel_id"\s+android:value="spay-system-v2")(?![^>]*tools:replace=)(\s*/?>)',
        '$1 tools:replace="android:value"$2'
    )

    Set-Content -Path $manifestPath -Value $raw
    Write-Host "[OK] Applied Firebase Messaging manifest override for default channel" -ForegroundColor Green
}
Invoke-FirebaseMessagingManifestFix -ProjectRoot $PROJECT_ROOT

function Invoke-WidgetManifestInjection {
    param([string]$ProjectRoot)

    $manifestPath = Join-Path $ProjectRoot "android\app\src\main\AndroidManifest.xml"
    if (-not (Test-Path $manifestPath)) { return }

    $raw = Get-Content -Path $manifestPath -Raw

    # Skip if widget receivers are already present
    if ($raw -match 'ClientCountdownWidgetProvider') {
        Write-Host "[OK] Widget receivers already present in AndroidManifest.xml" -ForegroundColor Green
        return
    }

    $widgetReceivers = @'
    <receiver android:name=".ClientCountdownWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_NEXT_MONTH"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_PREV_MONTH"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_countdown"/>
    </receiver>
    <receiver android:name=".CreditLimitWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_credit_limit"/>
    </receiver>
    <receiver android:name=".NootAiWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_noot_ai"/>
    </receiver>
    <receiver android:name=".ClientTransactionsWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_transactions"/>
    </receiver>
    <receiver android:name=".ClientHealthWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_health"/>
    </receiver>
    <receiver android:name=".ClientUpcomingWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_upcoming"/>
    </receiver>
    <receiver android:name=".ClientInboxWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_inbox"/>
    </receiver>
    <receiver android:name=".AdminCountdownWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_ADMIN_NEXT_MONTH"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_ADMIN_PREV_MONTH"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_countdown"/>
    </receiver>
    <receiver android:name=".AdminExposureWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_exposure"/>
    </receiver>
    <receiver android:name=".AdminRemindersWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_reminders"/>
    </receiver>
    <receiver android:name=".AdminStatsWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_stats"/>
    </receiver>
    <receiver android:name=".AdminAuditWidgetProvider" android:exported="true">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_audit"/>
    </receiver>
'@

    # Inject before </application>
    $raw = $raw -replace '</application>', "$widgetReceivers`n  </application>"
    Set-Content -Path $manifestPath -Value $raw
    Write-Host "[OK] Injected 12 widget receivers into AndroidManifest.xml" -ForegroundColor Green
}
Invoke-WidgetManifestInjection -ProjectRoot $PROJECT_ROOT

# Apply existing patches for RN background actions 
$bgActionsTask = Join-Path $PROJECT_ROOT "node_modules\react-native-background-actions\android\src\main\java\com\asterinet\react\bgactions\RNBackgroundActionsTask.java"
if (Test-Path $bgActionsTask) {
    $rawBg = Get-Content -Path $bgActionsTask -Raw
    $modified = $false

    if ($rawBg -match 'FOREGROUND_SERVICE_TYPE_DATA_SYNC') {
        $rawBg = $rawBg -replace 'ServiceInfo\.FOREGROUND_SERVICE_TYPE_DATA_SYNC \| ServiceInfo\.FOREGROUND_SERVICE_TYPE_LOCATION', 'ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION'
        $modified = $true
        Write-Host "[OK] Removed FOREGROUND_SERVICE_TYPE_DATA_SYNC from RNBackgroundActionsTask" -ForegroundColor Green
    }

    if ($rawBg -match 'return super\.onStartCommand\(intent, flags, startId\);') {
        $rawBg = $rawBg -replace 'return super\.onStartCommand\(intent, flags, startId\);', 'return START_STICKY;'
        $modified = $true
        Write-Host "[OK] Applied START_STICKY patch to RNBackgroundActionsTask" -ForegroundColor Green
    }

    if ($modified) { Set-Content -Path $bgActionsTask -Value $rawBg }
}

# Apply patch for react-native-screens CMake target_link_libraries error
$screensCMake = Join-Path $PROJECT_ROOT "node_modules\react-native-screens\android\src\main\jni\CMakeLists.txt"
if (Test-Path $screensCMake) {
    $rawScreens = Get-Content -Path $screensCMake -Raw
    if ($rawScreens -match 'target_link_libraries\(rnscreens') {
        $rawScreens = $rawScreens -replace 'target_link_libraries\(rnscreens', 'target_link_libraries(${LIB_TARGET_NAME}'
        Set-Content -Path $screensCMake -Value $rawScreens
        Write-Host "[OK] Patched react-native-screens CMake: rnscreens -> LIB_TARGET_NAME" -ForegroundColor Green
    }
}

# Step 6.2: Verify patches
Write-Host "`nStep 6.2: Verifying critical build patches..." -ForegroundColor Yellow

$allChecksPass = $true
$allChecksPass = (Test-FileContains -Path $gradleProps -Pattern 'android\.cmake\.arguments=.*ANDROID_STL=c\+\+_shared') -and $allChecksPass
$allChecksPass = (Test-FileContains -Path $rootBuildGradle -Pattern 'BEGIN libcxx-shared-fix') -and $allChecksPass
$allChecksPass = (Test-FileContains -Path $appBuildGradle -Pattern 'signingConfig signingConfigs\.release') -and $allChecksPass
$androidManifestPath = Join-Path $ANDROID_DIR "app\src\main\AndroidManifest.xml"
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern 'com\.google\.firebase\.messaging\.default_notification_channel_id.*tools:replace="android:value"') -and $allChecksPass

$screensCmakeCheck = Join-Path $PROJECT_ROOT "node_modules\react-native-screens\android\CMakeLists.txt"
$allChecksPass = (Test-FileContains -Path $screensCmakeCheck -Pattern 'c\+\+_shared') -and $allChecksPass

$androidManifestPath = Join-Path $ANDROID_DIR "app\src\main\AndroidManifest.xml"
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern 'expo\.modules\.updates\.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY') -and $allChecksPass
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern "expo-channel-name.*$([regex]::Escape($OTA_CHANNEL))") -and $allChecksPass
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern 'ClientCountdownWidgetProvider') -and $allChecksPass
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern 'CreditLimitWidgetProvider') -and $allChecksPass

if (-not $allChecksPass) {
    Write-Host "`n[ERROR] Critical build patches are missing. Build will likely fail." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] All critical patches verified" -ForegroundColor Green

Write-Host "`nStep 7: Running pre-build checks..." -ForegroundColor Yellow
if ($env:ANDROID_HOME) { Write-Host "[OK] ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green }
if ($env:ANDROID_NDK_HOME) { Write-Host "[OK] ANDROID_NDK_HOME: $env:ANDROID_NDK_HOME" -ForegroundColor Green }
Write-Host "`nJava version:" -ForegroundColor Gray
& java -version 2>&1 | ForEach-Object { Write-Host $_ }

Write-Host "`nStep 7.1: Validating Sentry upload settings..." -ForegroundColor Yellow
Configure-SentryBuildUpload -AndroidDir $ANDROID_DIR

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Starting Android PRODUCTION Build..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ANDROID_DIR

Write-Host "`nBuilding APK..." -ForegroundColor Yellow
$gradleBuildArgs = @(
    "assembleRelease",
    "--stacktrace",
    "--max-workers=$($script:GradleMaxWorkers)",
    "--build-cache",
    "-x", "lintVitalReportRelease",
    "-x", "lintVitalRelease"
)
if (-not $FAST_MODE) {
    $gradleBuildArgs += "--no-daemon"
}
Write-Host "[INFO] Gradle args: $($gradleBuildArgs -join ' ')" -ForegroundColor Gray
.\gradlew.bat @gradleBuildArgs
$overallExit = $LASTEXITCODE

Set-Location $PROJECT_ROOT

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Build process completed!" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

if ($overallExit -eq 0) {
    Write-Host "`n[OK] Release Build succeeded!" -ForegroundColor Green

    # Save last-good build config for future debugging
    $lastGoodPath = Join-Path $PROJECT_ROOT "build-last-good.json"
    try {
        [ordered]@{
            timestamp      = (Get-Date).ToString("o")
            ndkVersion     = $preferredNdkVersion
            androidHome    = $env:ANDROID_HOME
            ndkHome        = $env:ANDROID_NDK_HOME
            javaHome       = $env:JAVA_HOME
            nodeBinary     = $env:NODE_BINARY
            androidStl     = $env:ANDROID_STL
        } | ConvertTo-Json -Depth 3 | Set-Content -Path $lastGoodPath -Encoding UTF8
    } catch {}

    # Display APKs
    $apkSearchPaths = @("$ANDROID_DIR\app\build\outputs\apk\release\*.apk")
    $foundApks = @()
    foreach ($pattern in $apkSearchPaths) {
        $apks = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
        if ($apks) {
            foreach ($apk in $apks) {
                if ($apk.Name -eq "spayv2-production.apk") {
                    $foundApks += $apk
                    continue
                }
                
                $newName = "spayv2-production.apk"
                try {
                    $renamedApk = Rename-Item -Path $apk.FullName -NewName $newName -PassThru -Force
                    $foundApks += $renamedApk
                } catch {
                    $foundApks += $apk
                }
            }
        }
    }

    if ($foundApks.Count -gt 0) {
        $CENTRAL_APK_DIR = Join-Path $SOURCE_DIR "APK"
        if (-not (Test-Path $CENTRAL_APK_DIR)) {
            New-Item -ItemType Directory -Path $CENTRAL_APK_DIR -Force | Out-Null
        }
        Write-Host "`nGenerated Release Artifacts (Saved to $CENTRAL_APK_DIR):" -ForegroundColor Green
        foreach ($apk in $foundApks) {
            $centralPath = Join-Path $CENTRAL_APK_DIR $apk.Name
            Copy-Item -Path $apk.FullName -Destination $centralPath -Force -ErrorAction SilentlyContinue
            
            $sizeInMB = [math]::Round($apk.Length / 1MB, 2)
            Write-Host "  - $($apk.Name) ($sizeInMB MB)" -ForegroundColor Gray
        }
    }

    Write-Host "`n=================================================" -ForegroundColor Magenta
    Write-Host " Uploading APK to GitHub releases... [START]" -ForegroundColor Magenta
    try {
        $repo = $script:GitHubRepo
        
        $token = $env:GITHUB_TOKEN
        if ([string]::IsNullOrWhiteSpace($token)) {
            Write-Host "`n[WARN] GitHub Token (GITHUB_TOKEN) is not provided. Skipping GitHub upload." -ForegroundColor Yellow
            Write-Host "Please create a '.env.build' file in the mobile directory with GITHUB_TOKEN=your_token" -ForegroundColor Gray
        } else {
            $apkFileName = $script:GitHubApkFileName
            $manifestFileName = $script:GitHubManifestFileName
            $productionApk = Join-Path $CENTRAL_APK_DIR "spayv2-production.apk"
            $apkToUpload = Join-Path $CENTRAL_APK_DIR $apkFileName
            $manifestToUpload = Join-Path $CENTRAL_APK_DIR $manifestFileName

            if (Test-Path $productionApk) {
                Copy-Item -Path $productionApk -Destination $apkToUpload -Force
            }

            if (Test-Path $apkToUpload) {
                Write-Host "Fetching repository metadata..." -ForegroundColor Gray
                $repoInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo" -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/vnd.github.v3+json" }
                $defaultBranch = $repoInfo.default_branch
                if ([string]::IsNullOrWhiteSpace($defaultBranch)) { $defaultBranch = "main" }
                Write-Host "Default branch detected: $defaultBranch" -ForegroundColor Gray

                Write-Host "Fetching latest commit..." -ForegroundColor Gray
                $commitResponse = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/commits/$defaultBranch" -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/vnd.github.v3+json" }
                $sha = $commitResponse.sha

                Write-Host "Updating 'latest' tag..." -ForegroundColor Gray
                $tagBody = @{ ref = "refs/tags/latest"; sha = $sha } | ConvertTo-Json
                try {
                    Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/git/refs" -Method Post -Headers @{ "Authorization" = "Bearer $token" } -Body $tagBody | Out-Null
                } catch {
                    Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/git/refs/tags/latest" -Method Patch -Headers @{ "Authorization" = "Bearer $token" } -Body (@{ sha = $sha; force = $true } | ConvertTo-Json) | Out-Null
                }

                Write-Host "Configuring GitHub Release..." -ForegroundColor Gray
                $releaseBody = @{
                    tag_name = "latest"
                    target_commitish = $defaultBranch
                    name = "Latest App Release"
                    body = "Automated upload of the latest Android production build."
                    draft = $false
                    prerelease = $false
                } | ConvertTo-Json

                try {
                    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Method Post -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/vnd.github.v3+json" } -Body $releaseBody
                    $releaseId = $response.id
                } catch {
                    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/latest" -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/vnd.github.v3+json" }
                    $releaseId = $releases.id
                }

                if ($releaseId) {
                    $assets = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/$releaseId/assets" -Headers @{ "Authorization" = "Bearer $token" }
                    $expectedAssetName = $apkFileName -replace ' ', '.'
                    $existingAsset = $assets | Where-Object { $_.name -eq $apkFileName -or $_.name -eq $expectedAssetName }
                    if ($existingAsset) {
                        Write-Host "Removing previous APK..." -ForegroundColor Gray
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($existingAsset.id)" -Method Delete -Headers @{ "Authorization" = "Bearer $token" }
                    }

                    Write-Host "Uploading new APK..." -ForegroundColor Gray
                    $fileNameUrl = [uri]::EscapeDataString($apkFileName)
                    Invoke-RestMethod -Uri "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=$fileNameUrl" -Method Post -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/vnd.android.package-archive" } -InFile $apkToUpload

                    $downloadUrl = "https://github.com/$repo/releases/latest/download/$fileNameUrl"
                    $manifestJson = [ordered]@{
                        versionCode = $script:ProductionVersionCode
                        versionName = $script:ProductionVersionName
                        apkUrl      = $downloadUrl
                        fileName    = $apkFileName
                        channel     = $OTA_CHANNEL
                        publishedAt = (Get-Date).ToUniversalTime().ToString("o")
                    } | ConvertTo-Json -Depth 4
                    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                    [System.IO.File]::WriteAllText($manifestToUpload, $manifestJson, $utf8NoBom)

                    $existingManifest = $assets | Where-Object { $_.name -eq $manifestFileName }
                    if ($existingManifest) {
                        Write-Host "Removing previous APK manifest..." -ForegroundColor Gray
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($existingManifest.id)" -Method Delete -Headers @{ "Authorization" = "Bearer $token" }
                    }

                    Write-Host "Uploading APK manifest..." -ForegroundColor Gray
                    $manifestNameUrl = [uri]::EscapeDataString($manifestFileName)
                    Invoke-RestMethod -Uri "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=$manifestNameUrl" -Method Post -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -InFile $manifestToUpload
                    Write-Host "`n[OK] Successfully uploaded APK to GitHub Releases!" -ForegroundColor Green
                }
            }
        }
    } catch {
        Write-Host "[WARN] Failed to upload APK to GitHub. You can upload it manually." -ForegroundColor DarkYellow
    }

    Write-Host "`n=================================================" -ForegroundColor Magenta
    Write-Host " *** IMPORTANT: Firebase and Google Sign-In Setup ***" -ForegroundColor Magenta
    Write-Host "=================================================" -ForegroundColor Magenta
    Write-Host "To ensure Google Sign-In works in your production app, you MUST add these" -ForegroundColor White
    Write-Host "SHA-1 and SHA-256 fingerprints to both:" -ForegroundColor White
    Write-Host "  1. Firebase Console -> Project Settings -> Your Android App" -ForegroundColor White
    Write-Host "  2. Google Cloud Console -> Credentials -> Android OAuth Client" -ForegroundColor White
    Write-Host ""
    
    $keytoolOutput = & keytool -list -v -keystore (Join-Path $SOURCE_DIR "release.keystore") -alias $KEY_ALIAS -storepass $KEYSTORE_PASS 
    $keytoolOutput | Select-String -Pattern "SHA1:|SHA256:" | ForEach-Object { Write-Host "  $($_)" -ForegroundColor Yellow }
    
    Write-Host "`n(If you update these in Firebase, do not forget to re-download google-services.json)" -ForegroundColor DarkGray
    Write-Host "=================================================" -ForegroundColor Magenta

} else {
    Write-Host "[ERROR] Production build failed with exit code $overallExit" -ForegroundColor Red
    exit $overallExit
}
