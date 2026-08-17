# Android PRODUCTION LOCAL Build Script for S-Pay V2 App
# Full local build with all toolchains, CMake C++ STL patches, and 12 native Android widgets.
# Builds the unstripped, stable release APK locally without uploading to GitHub.
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

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "S-Pay V2 Android PRODUCTION LOCAL Build (Offline/Direct)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
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
    
    # Clean stale CMake .cxx caches in node_modules only when not in FAST_MODE
    if (-not $FAST_MODE) {
        $nodeModulesDir = Join-Path $ProjectPath "node_modules"
        if (Test-Path $nodeModulesDir) {
            Get-ChildItem -Path $nodeModulesDir -Directory -Filter ".cxx" -Recurse -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                    $cleaned++
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
$script:GradleMaxWorkers = 4
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

        # Check existing gradle versionCode to prevent downgrade
        $gradlePath = Join-Path $PSScriptRoot "android\app\build.gradle"
        if (Test-Path $gradlePath) {
            $gradleContent = Get-Content $gradlePath -Raw
            if ($gradleContent -match 'versionCode\s+(\d+)') {
                $gradleVersionCode = [int]$matches[1]
                if ($gradleVersionCode -gt $currentVersionCode) {
                    $currentVersionCode = $gradleVersionCode
                }
            }
        }

        # Check latest published manifest
        $manifestPath = Join-Path $PSScriptRoot "APK\spay-latest.json"
        if (Test-Path $manifestPath) {
            try {
                $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
                if ($manifest.versionCode -and [int]$manifest.versionCode -gt $currentVersionCode) {
                    $currentVersionCode = [int]$manifest.versionCode
                }
            } catch {}
        }

        $nextVersionCode = [Math]::Max(32, $currentVersionCode)
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
        if (-not $config.expo) { return }
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
        } elseif ($currentChannel -ne $ChannelName) {
            $config.expo.updates.requestHeaders."expo-channel-name" = $ChannelName
            $config | ConvertTo-Json -Depth 100 | Set-Content -Path $AppJsonPath -Encoding UTF8
        }
        Write-Host "[OK] app.json targeting OTA channel '$ChannelName'" -ForegroundColor Green
    } catch {}
}

function Get-FileSha256 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    } catch { return $null }
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

# Step 0: Ensure signing secrets are loaded
Write-Host "`nStep 0: Loading signing configuration..." -ForegroundColor Yellow
$KEYSTORE_PATH = Join-Path $SOURCE_DIR "release.keystore"

$envFile = Join-Path $SOURCE_DIR ".env.build"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match "^[^#]*=" } | ForEach-Object {
        $parts = $_.Split('=', 2)
        Set-Item -Path "env:\$($parts[0].Trim())" -Value $parts[1].Trim()
    }
}

$KEYSTORE_PASS = $env:RELEASE_KEYSTORE_PASSWORD
$KEY_ALIAS = $env:RELEASE_KEYSTORE_ALIAS

if ([string]::IsNullOrWhiteSpace($KEYSTORE_PASS) -or [string]::IsNullOrWhiteSpace($KEY_ALIAS)) {
    $KEYSTORE_PASS = "spayv2keystorepass"
    $KEY_ALIAS = "spayv2keyalias"
}

if (-not (Test-Path $KEYSTORE_PATH)) {
    Write-Host "[INFO] Generating release.keystore..." -ForegroundColor Yellow
    & keytool -genkeypair -v -storetype PKCS12 -keystore $KEYSTORE_PATH -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 -storepass $KEYSTORE_PASS -keypass $KEYSTORE_PASS -dname "CN=SPay, OU=Mobile, O=LorenzoBela, L=Manila, ST=NCR, C=PH"
} else {
    Write-Host "[OK] release.keystore verified" -ForegroundColor Green
}

Set-Location $DEST_DIR
$BUILD_CACHE_DIR = Join-Path $DEST_DIR ".build-cache"
if (-not (Test-Path $BUILD_CACHE_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_CACHE_DIR -Force | Out-Null
}

Write-Host "`nStep 0.2: Enforcing build metadata..." -ForegroundColor Yellow
$appJsonPath = Join-Path $DEST_DIR "app.json"
Ensure-OtaChannelInAppJson -AppJsonPath $appJsonPath -ChannelName $OTA_CHANNEL
Set-ProductionBuildMetadata -AppJsonPath $appJsonPath
Assert-AndroidFcmConfig -ProjectRoot $DEST_DIR

$PROJECT_ROOT = $DEST_DIR
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$resolvedNode = if ($nodeCmd) { $nodeCmd.Source } else { "C:\Program Files\nodejs\node.exe" }
$env:NODE_BINARY = $resolvedNode
Write-Host "[OK] Node binary set to: $env:NODE_BINARY" -ForegroundColor Green

Write-Host "`nStep 2: Pre-Flight Environment Validation..." -ForegroundColor Yellow
Test-ToolVersion -ToolName "Node.js" -VersionCommand { node --version } -RequiredPattern "v(1[6-9]|2\d)\." -Description "Node.js 16.x or higher"
Test-ToolVersion -ToolName "Java JDK" -VersionCommand { javac -version } -RequiredPattern "javac (11|17|21)\." -Description "JDK 11, 17, or 21"

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

$candidateJdks = @("$env:ProgramFiles\Android\Android Studio\jbr", "$env:ProgramFiles\Android\Android Studio\jre")
$chosenJavaHome = $null
foreach ($j in $candidateJdks) { if ($j -and (Test-Path "$j\bin\java.exe")) { $chosenJavaHome = $j; break } }
if (-not $env:JAVA_HOME) { if ($chosenJavaHome) { $env:JAVA_HOME = $chosenJavaHome } }
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin")) { if ($env:Path -notlike "*$env:JAVA_HOME\bin*") { $env:Path = "$env:JAVA_HOME\bin;$env:Path" } }

Write-Host "`nStep 3: Cleaning build directories..." -ForegroundColor Yellow
Invoke-SmartCleanup -ProjectPath $PROJECT_ROOT

Write-Host "`nStep 5: Ensuring node_modules are up to date..." -ForegroundColor Yellow
$nodeModulesDir = Join-Path $PROJECT_ROOT "node_modules"
$lockFile = Join-Path $PROJECT_ROOT "package-lock.json"
$depsStampPath = Join-Path $BUILD_CACHE_DIR "deps.lock.sha256"
$didRunNpmInstall = $false

if (-not (Test-Path $nodeModulesDir)) {
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
        npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps
        $didRunNpmInstall = $true
    }
}

if ($didRunNpmInstall) {
    $installedLockHash = Get-FileSha256 -Path $lockFile
    if ($installedLockHash) { Set-Content -Path $depsStampPath -Value $installedLockHash }
}

Write-Host "`nStep 6: Native Android Prebuild..." -ForegroundColor Yellow
$env:CI = "1"
$prebuildStampPath = Join-Path $BUILD_CACHE_DIR "expo-prebuild.sha256"
$prebuildInputs = @(
    (Join-Path $PROJECT_ROOT "app.json"),
    (Join-Path $PROJECT_ROOT "package.json"),
    (Join-Path $PROJECT_ROOT "package-lock.json"),
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
    npx expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npx expo prebuild failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    if ($currentPrebuildHash) {
        Set-Content -Path $prebuildStampPath -Value $currentPrebuildHash
    }
}

Write-Host "`nStep 6.1: Applying Post-Prebuild Gradle / Signing / CMake STL fixes..." -ForegroundColor Yellow

# Re-apply local.properties after prebuild
$localPropsPost = Join-Path $ANDROID_DIR "local.properties"
if ($resolvedSdkDir) {
    Update-LocalPropertiesPaths -Path $localPropsPost -SdkDir $resolvedSdkDir
    Remove-NdkDirFromLocalProperties -Path $localPropsPost
}

# Fix gradle.properties for stability & unstripped release
$gradleProps = Join-Path $ANDROID_DIR "gradle.properties"
if (Test-Path $gradleProps) {
    $propsContent = Get-Content $gradleProps -Raw
    $targetKotlinVersion = "2.1.20"
    if ($propsContent -match '(?m)^kotlinVersion=.*') {
        $propsContent = $propsContent -replace '(?m)^kotlinVersion=.*', "kotlinVersion=$targetKotlinVersion"
    } else {
        $propsContent += "`nkotlinVersion=$targetKotlinVersion"
    }

    # Disable ProGuard/R8 stripping to prevent runtime crashes
    $propsContent = $propsContent -replace '(?m)^android\.enableMinifyInReleaseBuilds=.*', 'android.enableMinifyInReleaseBuilds=false'
    $propsContent = $propsContent -replace '(?m)^android\.enableShrinkResourcesInReleaseBuilds=.*', 'android.enableShrinkResourcesInReleaseBuilds=false'
    if ($propsContent -notmatch 'android\.enableMinifyInReleaseBuilds=') { $propsContent += "`nandroid.enableMinifyInReleaseBuilds=false" }
    if ($propsContent -notmatch 'android\.enableShrinkResourcesInReleaseBuilds=') { $propsContent += "`nandroid.enableShrinkResourcesInReleaseBuilds=false" }

    # Enforce transitive R classes for React Native 0.85 compatibility
    $propsContent = $propsContent -replace '(?m)^android\.nonTransitiveRClass=.*', 'android.nonTransitiveRClass=false'
    if ($propsContent -notmatch 'android\.nonTransitiveRClass=') { $propsContent += "`nandroid.nonTransitiveRClass=false" }
    $propsContent = $propsContent -replace '(?m)^android\.nonFinalResIds=.*', 'android.nonFinalResIds=false'
    if ($propsContent -notmatch 'android\.nonFinalResIds=') { $propsContent += "`nandroid.nonFinalResIds=false" }

    # Uncompressed .so libraries in APK for zero-copy memory mapping
    $propsContent = $propsContent -replace '(?m)^expo\.useLegacyPackaging=.*', 'expo.useLegacyPackaging=false'
    if ($propsContent -notmatch 'expo\.useLegacyPackaging=') { $propsContent += "`nexpo.useLegacyPackaging=false" }

    Set-Content -Path $gradleProps -Value $propsContent
    Write-Host "[OK] Enforced kotlinVersion=$targetKotlinVersion, nonTransitiveRClass=false, and unstripped ProGuard settings in gradle.properties" -ForegroundColor Green
}

# Re-enforce NDK env vars
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
        '                          "-DANDROID_LD=lld",',
        '                          "-DCMAKE_PREFIX_PATH=${rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
        '                          "-DReactAndroid_DIR=${rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
        '                          "-Dfbjni_DIR=${rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
        '                          "-Dhermes-engine_DIR=${rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
        '                          "-DREACT_NATIVE_PRODUCTION=1",',
        '                          "-DRN_DEBUG_STRING_CONVERTIBLE=0"',
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
    $escapedTargetName = [regex]::Escape($TargetName)
    if ($raw -notmatch 'add_library\s*\(') { return }
    if ($raw -match 'add_library\s*\(\s*([^\s\)]+)\s+IMPORTED') { return }

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

    $rnCmakeUtils = (Join-Path $PROJECT_ROOT "node_modules/react-native/ReactAndroid/cmake-utils").Replace('\', '/')

    if ($raw -notmatch '# BEGIN cmake-utils-prefix') {
        $prefixInject = "`n# BEGIN cmake-utils-prefix`nset(ReactAndroid_DIR `"$rnCmakeUtils`")`nset(fbjni_DIR `"$rnCmakeUtils`")`nset(hermes-engine_DIR `"$rnCmakeUtils`")`nlist(APPEND CMAKE_PREFIX_PATH `"$rnCmakeUtils`")`nlist(APPEND CMAKE_MODULE_PATH `"$rnCmakeUtils`")`nadd_compile_definitions(RN_SERIALIZABLE_STATE=1 RN_FABRIC_ENABLED=1 IS_NEW_ARCHITECTURE_ENABLED=1 FOLLY_NO_CONFIG=1 HERMES_V1_ENABLED=1 REACT_NATIVE_PRODUCTION=1 RN_DEBUG_STRING_CONVERTIBLE=0)`n# END cmake-utils-prefix`n"
        if ($raw -match 'cmake_minimum_required\([^\)]*\)\s*') {
            $raw = [regex]::Replace($raw, '(cmake_minimum_required\([^\)]*\)\s*)', { $args[0].Groups[1].Value + $prefixInject })
        } else {
            $raw = $prefixInject + $raw
        }
    }

    $raw = $raw -replace 'find_package\(fbjni\s+REQUIRED\s+NitroConfig\)', 'find_package(fbjni REQUIRED)'
    $raw = $raw -replace 'find_package\(ReactAndroid\s+REQUIRED\s+NitroConfig\)', 'find_package(ReactAndroid REQUIRED)'
    $raw = $raw -replace 'find_package\(hermes-engine\s+REQUIRED\s+CONFIG\)', 'find_package(hermes-engine REQUIRED)'
    $raw = $raw -replace 'find_package\(ReactAndroid\s+REQUIRED\s+CONFIG\)', 'find_package(ReactAndroid REQUIRED)'
    $raw = $raw -replace 'find_package\(fbjni\s+REQUIRED\s+CONFIG\)', 'find_package(fbjni REQUIRED)'
    $raw = $raw -replace 'target_link_libraries\(worklets ReactAndroid::hermestooling\)', '# target_link_libraries(worklets ReactAndroid::hermestooling)'
    $raw = $raw -replace '(?s)if\(REACT_NATIVE_MINOR_VERSION LESS 84\)\s*string\(APPEND CMAKE_CXX_FLAGS " -DHERMES_V1_ENABLED=\$\{HERMES_V1_ENABLED\}"\)\s*endif\(\)', 'string(APPEND CMAKE_CXX_FLAGS " -DHERMES_V1_ENABLED=1")'
    $raw = $raw -replace '(?s)target_link_libraries\(\s*expo-modules-core\s+PRIVATE\s+\$\{LOG_LIB\}\s+android\s+\$\{JSEXECUTOR_LIB\}\s+\$\{NEW_ARCHITECTURE_DEPENDENCIES\}\s+expo-modules-jsi\s*\)', "target_link_libraries(`n  expo-modules-core`n  PRIVATE`n  `${LOG_LIB}`n  android`n  `${JSEXECUTOR_LIB}`n  `${NEW_ARCHITECTURE_DEPENDENCIES}`n  expo-modules-jsi`n  ReactAndroid::reactnative`n  `${CPP_SHARED_LIB}`n)"

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

Ensure-LineInFile -Path $gradleProps -MatchRegex '^android\.cmake\.arguments=' -LineToSet 'android.cmake.arguments=-DANDROID_STL=c++_shared -DCMAKE_ANDROID_STL_TYPE=c++_shared -DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared -DCMAKE_EXE_LINKER_FLAGS=-lc++_shared'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^sentry\.uploadNativeSymbols=' -LineToSet 'sentry.uploadNativeSymbols=false'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^sentry\.uploadProguardMapping=' -LineToSet 'sentry.uploadProguardMapping=false'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^sentry\.uploadSourceMaps=' -LineToSet 'sentry.uploadSourceMaps=false'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^sentry\.disableAutoUpload=' -LineToSet 'sentry.disableAutoUpload=true'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^sentry\.skipUpload=' -LineToSet 'sentry.skipUpload=true'
Ensure-GradleMemorySettings -GradlePropsPath $gradleProps

$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"
$env:SENTRY_SKIP_UPLOAD = "true"
$env:SENTRY_AUTO_UPLOAD = "false"
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
    '                  "-DCMAKE_EXE_LINKER_FLAGS=-lc++_shared",',
    '                  "-DCMAKE_PREFIX_PATH=${project.rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
    '                  "-DReactAndroid_DIR=${project.rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
    '                  "-Dfbjni_DIR=${project.rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
    '                  "-Dhermes-engine_DIR=${project.rootDir}/../node_modules/react-native/ReactAndroid/cmake-utils",',
    '                  "-DREACT_NATIVE_PRODUCTION=1",',
    '                  "-DRN_DEBUG_STRING_CONVERTIBLE=0"',
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

$knownTargets = @{
    'expo-modules-core'           = '${PACKAGE_NAME}'
    'react-native-screens'        = 'rnscreens'
    'react-native-worklets'       = 'worklets'
    'react-native-reanimated'     = 'reanimated'
    'react-native-nitro-modules'  = 'NitroModules'
    'react-native-mmkv'           = 'NitroMmkv'
    'react-native-gesture-handler'= '${PACKAGE_NAME}'
}
$cmakePatchCount = 0

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

$autolinkingFiles = Get-ChildItem -Path (Join-Path $PROJECT_ROOT "node_modules") -Filter "*.cmake" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\.cxx' -and $_.FullName -notmatch 'build\\' -and $_.FullName -notmatch 'ReactAndroid[\\/]cmake-utils' }

$rnCmakeUtils = (Join-Path $PROJECT_ROOT "node_modules/react-native/ReactAndroid/cmake-utils").Replace('\', '/')

foreach ($autolinkingFile in $autolinkingFiles) {
    $raw = Get-Content -Path $autolinkingFile.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { continue }
    if (($raw -match 'find_package\s*\(\s*(ReactAndroid|fbjni|hermes-engine)') -and ($raw -notmatch '# BEGIN cmake-utils-prefix')) {
        $prefixInject = "`n# BEGIN cmake-utils-prefix`nset(ReactAndroid_DIR `"$rnCmakeUtils`")`nset(fbjni_DIR `"$rnCmakeUtils`")`nset(hermes-engine_DIR `"$rnCmakeUtils`")`nlist(APPEND CMAKE_PREFIX_PATH `"$rnCmakeUtils`")`nlist(APPEND CMAKE_MODULE_PATH `"$rnCmakeUtils`")`nadd_compile_definitions(RN_SERIALIZABLE_STATE=1 RN_FABRIC_ENABLED=1 IS_NEW_ARCHITECTURE_ENABLED=1 FOLLY_NO_CONFIG=1)`n# END cmake-utils-prefix`n"
        $raw = $prefixInject + $raw
        $raw = $raw -replace 'find_package\(fbjni\s+REQUIRED\s+NitroConfig\)', 'find_package(fbjni REQUIRED)'
        $raw = $raw -replace 'find_package\(ReactAndroid\s+REQUIRED\s+NitroConfig\)', 'find_package(ReactAndroid REQUIRED)'
        $raw = $raw -replace 'find_package\(hermes-engine\s+REQUIRED\s+CONFIG\)', 'find_package(hermes-engine REQUIRED)'
        $raw = $raw -replace 'find_package\(ReactAndroid\s+REQUIRED\s+CONFIG\)', 'find_package(ReactAndroid REQUIRED)'
        $raw = $raw -replace 'find_package\(fbjni\s+REQUIRED\s+CONFIG\)', 'find_package(fbjni REQUIRED)'
        Set-Content -Path $autolinkingFile.FullName -Value $raw
        $cmakePatchCount++
    }
}
$rnAppCmake = Join-Path $PROJECT_ROOT "node_modules/react-native/ReactAndroid/cmake-utils/ReactNative-application.cmake"
if (Test-Path $rnAppCmake) {
    $rawApp = Get-Content -Path $rnAppCmake -Raw -ErrorAction SilentlyContinue
    if ($rawApp -and ($rawApp -notmatch 'set\(fbjni_DIR')) {
        $rawApp = $rawApp -replace 'set\(CMAKE_VERBOSE_MAKEFILE on\)', "set(CMAKE_VERBOSE_MAKEFILE on)`n`nstring(REPLACE `"\\\\`" `"//`" REACT_ANDROID_DIR `"`${REACT_ANDROID_DIR}`")`nstring(REPLACE `"\\\\`" `"//`" PROJECT_BUILD_DIR `"`${PROJECT_BUILD_DIR}`")"
        $rawApp = $rawApp -replace 'set\(ReactAndroid_DIR "[^"]*"\)', "set(ReactAndroid_DIR `"$rnCmakeUtils`")`nset(fbjni_DIR `"$rnCmakeUtils`")`nset(hermes-engine_DIR `"$rnCmakeUtils`")`nlist(APPEND CMAKE_PREFIX_PATH `"$rnCmakeUtils`")`nlist(APPEND CMAKE_MODULE_PATH `"$rnCmakeUtils`")"
        $rawApp = $rawApp -replace 'find_package\(ReactAndroid\s+REQUIRED\s+CONFIG\)', 'find_package(ReactAndroid REQUIRED)'
        $rawApp = $rawApp -replace 'find_package\(fbjni\s+REQUIRED\s+CONFIG\)', 'find_package(fbjni REQUIRED)'
        Set-Content -Path $rnAppCmake -Value $rawApp
    }
}
Write-Host "[OK] Patched $cmakePatchCount CMakeLists.txt/cmake files with absolute cmake-utils" -ForegroundColor Green

# --- RELEASE SIGNING CONFIG ---
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
    $raw = $raw -replace 'shrinkResources\s+enableShrinkResources\.toBoolean\(\)', 'shrinkResources false'
    $raw = $raw -replace 'minifyEnabled\s+enableMinifyInReleaseBuilds', 'minifyEnabled false'

    Set-Content -Path $gradlePath -Value $raw
    Write-Host "[OK] Applied release signing config and disabled ProGuard in app/build.gradle" -ForegroundColor Green
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

function Invoke-CopyWidgetFiles {
    param([string]$ProjectRoot)
    $widgetsDir = Join-Path $ProjectRoot "widgets"
    $androidAppDir = Join-Path $ProjectRoot "android\app"
    
    if (-not (Test-Path $widgetsDir)) { return }
    
    $destJavaDir = Join-Path $androidAppDir "src\main\java\com\cerberuzz91141\mobile"
    $destLayoutDir = Join-Path $androidAppDir "src\main\res\layout"
    $destXmlDir = Join-Path $androidAppDir "src\main\res\xml"
    $destDrawableDir = Join-Path $androidAppDir "src\main\res\drawable"
    
    if (-not (Test-Path $destJavaDir)) { New-Item -ItemType Directory -Path $destJavaDir -Force | Out-Null }
    if (-not (Test-Path $destLayoutDir)) { New-Item -ItemType Directory -Path $destLayoutDir -Force | Out-Null }
    if (-not (Test-Path $destXmlDir)) { New-Item -ItemType Directory -Path $destXmlDir -Force | Out-Null }
    if (-not (Test-Path $destDrawableDir)) { New-Item -ItemType Directory -Path $destDrawableDir -Force | Out-Null }
    
    Copy-Item -Path (Join-Path $widgetsDir "kotlin\*") -Destination $destJavaDir -Force
    Copy-Item -Path (Join-Path $widgetsDir "layout\*") -Destination $destLayoutDir -Force
    Get-ChildItem -Path (Join-Path $widgetsDir "xml\*.xml") | ForEach-Object {
        $cleanXml = (Get-Content $_.FullName) | Where-Object { $_ -notmatch 'android:previewImage=' -and $_ -notmatch 'android:description=' }
        Set-Content -Path (Join-Path $destXmlDir $_.Name) -Value $cleanXml
    }
    $srcDrawableDir = Join-Path $widgetsDir "drawable"
    if (Test-Path $srcDrawableDir) {
        Copy-Item -Path (Join-Path $srcDrawableDir "*") -Destination $destDrawableDir -Force
    }
    Write-Host "[OK] Copied widget source files to native Android directory" -ForegroundColor Green
}

function Invoke-StringsXmlFix {
    param([string]$ProjectRoot)
    $stringsPath = Join-Path $ProjectRoot "android\app\src\main\res\values\strings.xml"
    if (-not (Test-Path $stringsPath)) { return }
    $content = Get-Content $stringsPath -Raw
    
    $widgetStrings = @'
  <string name="widget_client_countdown_label">Billing Cycle Countdown</string>
  <string name="widget_credit_limit_label">Credit Limit Info</string>
  <string name="widget_noot_ai_label">Noot AI Assistant</string>
  <string name="widget_client_transactions_label">Recent Transactions</string>
  <string name="widget_client_health_label">Credit Health Score</string>
  <string name="widget_client_upcoming_label">Upcoming Payments</string>
  <string name="widget_client_inbox_label">Inbox Messages</string>
  <string name="widget_admin_countdown_label">Admin Billing Countdown</string>
  <string name="widget_admin_exposure_label">Admin Exposure Stats</string>
  <string name="widget_admin_reminders_label">Admin Payment Reminders</string>
  <string name="widget_admin_stats_label">Admin Overview Stats</string>
  <string name="widget_admin_audit_label">Admin Audit Logs</string>
'@
    
    if ($content -notlike "*widget_client_countdown_label*") {
        $content = $content -replace '</resources>', "$widgetStrings`r`n</resources>"
        Set-Content -Path $stringsPath -Value $content
        Write-Host "[OK] Added widget string labels to strings.xml" -ForegroundColor Green
    }
}

function Invoke-MainApplicationWidgetFix {
    param([string]$ProjectRoot)
    $appPath = Join-Path $ProjectRoot "android\app\src\main\java\com\cerberuzz91141\mobile\MainApplication.kt"
    if (-not (Test-Path $appPath)) { return }
    $raw = Get-Content -Path $appPath -Raw
    if ($raw -notmatch 'SpayWidgetPackage\(\)') {
        if ($raw -match '// add\(MyReactNativePackage\(\)\)\r\n') {
            $raw = $raw -replace '// add\(MyReactNativePackage\(\)\)\r\n', "// add(MyReactNativePackage())`r`n          add(SpayWidgetPackage())`r`n"
        } else {
            $raw = $raw -replace '// add\(MyReactNativePackage\(\)\)\n', "// add(MyReactNativePackage())\n          add(SpayWidgetPackage())\n"
        }
        Set-Content -Path $appPath -Value $raw
        Write-Host "[OK] Registered SpayWidgetPackage in MainApplication.kt" -ForegroundColor Green
    }
}

function Invoke-WidgetManifestInjection {
    param([string]$ProjectRoot)
    $manifestPath = Join-Path $ProjectRoot "android\app\src\main\AndroidManifest.xml"
    if (-not (Test-Path $manifestPath)) { return }
    $raw = Get-Content -Path $manifestPath -Raw
    if ($raw -match 'ClientCountdownWidgetProvider') { return }

    $widgetReceivers = @'
    <receiver android:name=".ClientCountdownWidgetProvider" android:exported="true" android:label="@string/widget_client_countdown_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_NEXT_MONTH"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_PREV_MONTH"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_countdown"/>
    </receiver>
    <receiver android:name=".CreditLimitWidgetProvider" android:exported="true" android:label="@string/widget_credit_limit_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_credit_limit"/>
    </receiver>
    <receiver android:name=".NootAiWidgetProvider" android:exported="true" android:label="@string/widget_noot_ai_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_noot_ai"/>
    </receiver>
    <receiver android:name=".ClientTransactionsWidgetProvider" android:exported="true" android:label="@string/widget_client_transactions_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_transactions"/>
    </receiver>
    <receiver android:name=".ClientHealthWidgetProvider" android:exported="true" android:label="@string/widget_client_health_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_health"/>
    </receiver>
    <receiver android:name=".ClientUpcomingWidgetProvider" android:exported="true" android:label="@string/widget_client_upcoming_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_upcoming"/>
    </receiver>
    <receiver android:name=".ClientInboxWidgetProvider" android:exported="true" android:label="@string/widget_client_inbox_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_client_inbox"/>
    </receiver>
    <receiver android:name=".AdminCountdownWidgetProvider" android:exported="true" android:label="@string/widget_admin_countdown_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_ADMIN_NEXT_MONTH"/>
        <action android:name="com.cerberuzz91141.mobile.ACTION_ADMIN_PREV_MONTH"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_countdown"/>
    </receiver>
    <receiver android:name=".AdminExposureWidgetProvider" android:exported="true" android:label="@string/widget_admin_exposure_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_exposure"/>
    </receiver>
    <receiver android:name=".AdminRemindersWidgetProvider" android:exported="true" android:label="@string/widget_admin_reminders_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_reminders"/>
    </receiver>
    <receiver android:name=".AdminStatsWidgetProvider" android:exported="true" android:label="@string/widget_admin_stats_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_stats"/>
    </receiver>
    <receiver android:name=".AdminAuditWidgetProvider" android:exported="true" android:label="@string/widget_admin_audit_label">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
        <action android:name="android.intent.action.USER_PRESENT"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info_admin_audit"/>
    </receiver>
'@
    $raw = $raw -replace '</application>', "$widgetReceivers`n  </application>"
    Set-Content -Path $manifestPath -Value $raw
    Write-Host "[OK] Injected 12 widget receivers into AndroidManifest.xml" -ForegroundColor Green
}

Invoke-WidgetManifestInjection -ProjectRoot $PROJECT_ROOT
Invoke-CopyWidgetFiles -ProjectRoot $PROJECT_ROOT
Invoke-StringsXmlFix -ProjectRoot $PROJECT_ROOT
function Invoke-ReactNativeRClassFix {
    param([string]$ProjectRoot)
    $appMainDir = Join-Path $ProjectRoot "android\app\src\main"
    
    $resValuesDir = Join-Path $appMainDir "res\values"
    if (-not (Test-Path $resValuesDir)) { New-Item -ItemType Directory -Path $resValuesDir -Force | Out-Null }
    $idsXml = Join-Path $resValuesDir "ids.xml"
    $idsContent = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <item type="id" name="important_for_accessibility_subview" />
    <item type="id" name="important_for_interaction" />
    <item type="id" name="important_for_interaction_subview" />
    <item type="id" name="catalyst_react_js_error_view" />
    <item type="id" name="react_test_id" />
    <item type="id" name="view_tag_native_id" />
    <item type="id" name="view_tag_instance_handle" />
</resources>
"@
    [System.IO.File]::WriteAllText($idsXml, $idsContent, [System.Text.Encoding]::ASCII)

    # Ensure no manual R.java exists so D8 does not error on duplicate definitions with transitive R classes
    $rJava = Join-Path $appMainDir "java\com\facebook\react\R.java"
    if (Test-Path $rJava) { Remove-Item -Path $rJava -Force -ErrorAction SilentlyContinue }
    Write-Host "[OK] Injected ids.xml resource definitions for React Native view tags" -ForegroundColor Green
}

Invoke-ReactNativeRClassFix -ProjectRoot $PROJECT_ROOT
function Invoke-ProGuardRulesFix {
    param([string]$ProjectRoot)
    $pgFile = Join-Path $ProjectRoot "android\app\proguard-rules.pro"
    if (Test-Path $pgFile) {
        $content = Get-Content -Path $pgFile -Raw
        $rulesToAdd = @"
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.R$* { *; }
-keep class com.facebook.react.R { *; }
-keepclassmembers class **.R$* {
    public static <fields>;
}
"@
        if ($content -notmatch 'com\.facebook\.react\.R') {
            $content = $content + "`n" + $rulesToAdd
            Set-Content -Path $pgFile -Value $content
            Write-Host "[OK] Injected ProGuard R-class keep rules into proguard-rules.pro" -ForegroundColor Green
        }
    }
}
Invoke-ProGuardRulesFix -ProjectRoot $PROJECT_ROOT
Invoke-MainApplicationWidgetFix -ProjectRoot $PROJECT_ROOT

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

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "Starting Android PRODUCTION LOCAL Build..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ANDROID_DIR

$gradleBuildArgs = @(
    "assembleRelease",
    "--stacktrace",
    "--max-workers=$($script:GradleMaxWorkers)",
    "--build-cache",
    "-x", "lintVitalReportRelease",
    "-x", "lintVitalRelease"
)

Write-Host "[INFO] Gradle args: $($gradleBuildArgs -join ' ')" -ForegroundColor Gray
.\gradlew.bat @gradleBuildArgs
$overallExit = $LASTEXITCODE

Set-Location $PROJECT_ROOT

if ($overallExit -eq 0) {
    Write-Host "`n[OK] Release Build succeeded!" -ForegroundColor Green

    $CENTRAL_APK_DIR = Join-Path $SOURCE_DIR "APK"
    if (-not (Test-Path $CENTRAL_APK_DIR)) {
        New-Item -ItemType Directory -Path $CENTRAL_APK_DIR -Force | Out-Null
    }

    $rawApk = Join-Path $ANDROID_DIR "app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path $rawApk)) {
        $found = Get-ChildItem -Path "$ANDROID_DIR\app\build\outputs\apk\release\*.apk" | Select-Object -First 1
        if ($found) { $rawApk = $found.FullName }
    }

    if ($rawApk -and (Test-Path $rawApk)) {
        $targetProd = Join-Path $CENTRAL_APK_DIR "spayv2-production.apk"
        $targetSpay = Join-Path $CENTRAL_APK_DIR "SPay.V2.apk"
        $targetLocal = Join-Path $CENTRAL_APK_DIR "SPay_Local.apk"

        Copy-Item -Path $rawApk -Destination $targetProd -Force
        Copy-Item -Path $rawApk -Destination $targetSpay -Force
        Copy-Item -Path $rawApk -Destination $targetLocal -Force

        $sizeInMB = [math]::Round((Get-Item $targetProd).Length / 1MB, 2)
        Write-Host "`nGenerated Release Artifacts (Saved to $CENTRAL_APK_DIR):" -ForegroundColor Green
        Write-Host "  - SPay_Local.apk ($sizeInMB MB)" -ForegroundColor Cyan
        Write-Host "  - spayv2-production.apk ($sizeInMB MB)" -ForegroundColor Cyan
        Write-Host "`n[SUCCESS] Local build finished! Transfer SPay_Local.apk directly to your phone." -ForegroundColor Green
    }
} else {
    Write-Host "[ERROR] Production build failed with exit code $overallExit" -ForegroundColor Red
    exit $overallExit
}
