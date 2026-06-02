# Android Development Build Script for S-Pay V2 App
# This script syncs files from editing location to build location, then cleans and builds the Android app in debug mode.
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
Write-Host "S-Pay V2 Android Development Build Script" -ForegroundColor Cyan
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
        # Stop all Gradle daemons
        Push-Location (Join-Path $ProjectPath "android")
        .\gradlew --stop 2>&1 | Out-Null
        Pop-Location
        Write-Host "[OK] Gradle daemons stopped" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not stop Gradle daemons: $_" -ForegroundColor DarkYellow
    }
    
    # Clean old Gradle cache files (keep recent ones)
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
    
    # Check critical SDK components
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
    
    # Restore APKs from the backup dir
    $BACKUP_DIR = "C:\Users\Lorenzo Bela\Downloads\SpayV2\mobile\apk_backup"
    if (Test-Path $BACKUP_DIR) {
        Write-Host "  Restoring previous APK outputs from backup..." -ForegroundColor Gray
        $restoredFiles = Get-ChildItem -Path $BACKUP_DIR -Filter "*.apk"
        foreach ($file in $restoredFiles) {
            if ($file.Name.Contains("release") -or $file.Name -eq "production.apk") {
                $targetFileDir = Join-Path $ProjectPath "android\app\build\outputs\apk\release\"
            } else {
                $targetFileDir = Join-Path $ProjectPath "android\app\build\outputs\apk\debug\"
            }
            if (-not (Test-Path $targetFileDir)) {
                New-Item -ItemType Directory -Path $targetFileDir -Force | Out-Null
            }
            Copy-Item -Path $file.FullName -Destination $targetFileDir -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "[OK] Cleaned $cleaned build artifact folders" -ForegroundColor Green
}
#endregion

# Define source and destination paths
$SOURCE_DIR = $PSScriptRoot
$DEST_DIR = $SOURCE_DIR
$FAST_MODE = $true
$FORCE_CLEAN_PREBUILD = $false
$script:GradleMaxWorkers = 2
$script:GradleHeapMb = 8192

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

# Step 0: Sync files from editing location to build location
Write-Host "`nStep 0: Backing up previously built APKs..." -ForegroundColor Yellow

$BACKUP_DIR = Join-Path $SOURCE_DIR "apk_backup"
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
}
Write-Host "  Backing up previously built APKs to $BACKUP_DIR..." -ForegroundColor Gray
$apkOutputs = @(
    "$DEST_DIR\android\app\build\outputs\apk\debug\*.apk",
    "$DEST_DIR\android\app\build\outputs\apk\release\*.apk"
)

foreach ($pattern in $apkOutputs) {
    if (Test-Path $pattern) {
        Copy-Item -Path $pattern -Destination $BACKUP_DIR -Force -ErrorAction SilentlyContinue 
    }
}

Write-Host "[OK] Robocopy skipped. Building directly in local directory." -ForegroundColor Green

# Change to build directory for all subsequent operations
Set-Location $DEST_DIR
Write-Host "[OK] Switched to build directory: $DEST_DIR" -ForegroundColor Green
Write-Host ""

$BUILD_CACHE_DIR = Join-Path $DEST_DIR ".build-cache"
if (-not (Test-Path $BUILD_CACHE_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_CACHE_DIR -Force | Out-Null
}

# Check and enable Windows long path support if needed
Write-Host "`nStep 1: Checking Windows long path support..." -ForegroundColor Yellow
try {
    $longPathsEnabled = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -ErrorAction SilentlyContinue
    if ($longPathsEnabled.LongPathsEnabled -ne 1) {
        Write-Host "[INFO] Attempting to enable long path support (requires admin)..." -ForegroundColor Yellow
        try {
            Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -ErrorAction Stop
            Write-Host "[OK] Long path support enabled." -ForegroundColor Green
        } catch {
            Write-Host "[WARN] Could not enable long path support (requires admin privileges)" -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "[OK] Long path support is already enabled" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not check long path support status" -ForegroundColor DarkYellow
}

# Set project root to build directory
$PROJECT_ROOT = $DEST_DIR
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"

# Restore last known good config (best-effort)
function Restore-LastGoodConfig {
    param([string]$ProjectRoot)
    $lastGoodPath = Join-Path $ProjectRoot "build-last-good.json"
    if (-not (Test-Path $lastGoodPath)) { return }
    try {
        $lastGood = Get-Content -Path $lastGoodPath -Raw | ConvertFrom-Json
        if (-not $env:ANDROID_HOME -and $lastGood.androidHome) { $env:ANDROID_HOME = $lastGood.androidHome }
        if (-not $env:ANDROID_SDK_ROOT -and $lastGood.androidSdkRoot) { $env:ANDROID_SDK_ROOT = $lastGood.androidSdkRoot }
        if (-not $env:ANDROID_NDK_HOME -and $lastGood.androidNdkHome) { $env:ANDROID_NDK_HOME = $lastGood.androidNdkHome }
        if (-not $env:NDK_HOME -and $lastGood.ndkHome) { $env:NDK_HOME = $lastGood.ndkHome }
        if (-not $env:JAVA_HOME -and $lastGood.javaHome) { $env:JAVA_HOME = $lastGood.javaHome }
        if (-not $env:NODE_BINARY -and $lastGood.nodeBinary) { $env:NODE_BINARY = $lastGood.nodeBinary }
        if (-not $env:ANDROID_STL -and $lastGood.androidStl) { $env:ANDROID_STL = $lastGood.androidStl }
        if (-not $env:CMAKE_ANDROID_STL_TYPE -and $lastGood.cmakeAndroidStlType) { $env:CMAKE_ANDROID_STL_TYPE = $lastGood.cmakeAndroidStlType }
        Write-Host "[OK] Loaded last known good build config: $lastGoodPath" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Failed to load last known good build config" -ForegroundColor DarkYellow
    }
}

Restore-LastGoodConfig -ProjectRoot $PROJECT_ROOT

# Set Node binary path
$env:NODE_BINARY = "C:\Program Files\nodejs\node.exe"
Write-Host "[OK] Node binary set to: $env:NODE_BINARY" -ForegroundColor Green

# Step 2: Pre-Flight Environment Validation
Write-Host "`nStep 2: Pre-Flight Environment Validation..." -ForegroundColor Yellow

# Check Node.js version
Test-ToolVersion -ToolName "Node.js" `
    -VersionCommand { node --version } `
    -RequiredPattern "v(1[6-9]|2\d)\." `
    -Description "Node.js 16.x or higher"

# Check Java/JDK version
$javaCheck = Test-ToolVersion -ToolName "Java JDK" `
    -VersionCommand { javac -version } `
    -RequiredPattern "javac (11|17|21)\." `
    -Description "JDK 11, 17, or 21"

if (-not $javaCheck) {
    Write-Host "[WARN] JDK version might cause build issues. Recommended: JDK 17" -ForegroundColor DarkYellow
}

# Clean Gradle daemons and old caches
Invoke-GradleDaemonCleanup -ProjectPath $PROJECT_ROOT

# Step 2.1: Toolchain sanity (JDK + Android SDK)
Write-Host "`nStep 2.1: Toolchain sanity (JDK + Android SDK)..." -ForegroundColor Yellow

# Force CMake/NDK to use shared libc++ to avoid missing stdlib symbols at link time
$env:ANDROID_STL = "c++_shared"
$env:CMAKE_ANDROID_STL_TYPE = "c++_shared"
Write-Host "[OK] Android STL set to: $env:ANDROID_STL" -ForegroundColor Green

# Try to infer ANDROID_HOME/ANDROID_SDK_ROOT from local.properties if missing
$localPropsPathEarly = "$ANDROID_DIR\local.properties"
$sdkDirEarly = $null
if (Test-Path $localPropsPathEarly) {
    $sdkLineEarly = Get-Content $localPropsPathEarly | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
    if ($sdkLineEarly) {
        $sdkLineEarly = $sdkLineEarly -replace 'ndk\.dir=.*', ''
        $sdkDirEarly = $sdkLineEarly -replace '^sdk\.dir=', '' -replace '\\:', ':' -replace '\\ ', ' ' -replace '\\\\', '\'
    }
}

function Update-LocalPropertiesPaths {
    param(
        [string]$Path,
        [string]$SdkDir
    )
    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content $Path
    }
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
    param(
        [string]$LocalPropertiesPath,
        [string]$SdkFromLocalProperties
    )

    $candidates = @(
        $env:ANDROID_SDK_ROOT,
        $env:ANDROID_HOME,
        $SdkFromLocalProperties,
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
    ) | Where-Object { $_ -and $_.Trim().Length -gt 0 }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    return $null
}

if ((!$env:ANDROID_HOME -or !$env:ANDROID_SDK_ROOT) -and $sdkDirEarly) {
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = $sdkDirEarly }
    if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $sdkDirEarly }
    Write-Host "[OK] Android SDK inferred from local.properties: $sdkDirEarly" -ForegroundColor Green

    # Validate Android SDK components
    Test-AndroidEnvironment -SdkPath $sdkDirEarly

    # Normalize sdk.dir in local.properties for the build directory
    Update-LocalPropertiesPaths -Path $localPropsPathEarly -SdkDir $sdkDirEarly
    Remove-NdkDirFromLocalProperties -Path $localPropsPathEarly
    
    # Add platform-tools to PATH if not already there
    $platformTools = Join-Path $sdkDirEarly "platform-tools"
    if ((Test-Path $platformTools) -and ($env:Path -notlike "*$platformTools*")) {
        $env:Path = "$platformTools;$env:Path"
        Write-Host "[OK] Added Android platform-tools to PATH" -ForegroundColor Green
    }

    # --- CRITICAL NDK 26 LOCK ---
    $preferredNdkVersion = "26.1.10909125"
    $ndkRoot = Join-Path $sdkDirEarly "ndk"
    $ndkDir = $null
    
    if (-not (Test-Path (Join-Path $ndkRoot $preferredNdkVersion))) {
        Write-Host "`n[ERROR] CRITICAL: Android NDK $preferredNdkVersion is recommended." -ForegroundColor Red
    }

    function Get-SdkManagerPath {
        param([string]$SdkRoot)
        $candidates = @(
            Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat",
            Join-Path $SdkRoot "cmdline-tools\bin\sdkmanager.bat",
            Join-Path $SdkRoot "tools\bin\sdkmanager.bat"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { return $c }
        }
        return $null
    }

    function Test-NdkValid {
        param([string]$Path)
        return (Test-Path (Join-Path $Path "source.properties"))
    }

    if (Test-Path $ndkRoot) {
        $preferredCandidate = Join-Path $ndkRoot $preferredNdkVersion

        if ((Test-Path $preferredCandidate) -and -not (Test-NdkValid $preferredCandidate)) {
            Write-Host "[WARN] NDK $preferredNdkVersion exists but is missing source.properties. Removing broken folder..." -ForegroundColor DarkYellow
            try {
                Remove-Item -Recurse -Force $preferredCandidate -ErrorAction Stop
            } catch {
                Write-Host "[WARN] Failed to remove broken NDK folder: $preferredCandidate" -ForegroundColor DarkYellow
            }
        }

        if ((Test-Path $preferredCandidate) -and (Test-NdkValid $preferredCandidate)) {
            $ndkDir = $preferredCandidate
        } else {
            $sdkManager = Get-SdkManagerPath -SdkRoot $sdkDirEarly
            if ($sdkManager) {
                Write-Host "[INFO] Installing NDK $preferredNdkVersion via sdkmanager..." -ForegroundColor Yellow
                try {
                    $env:ANDROID_SDK_ROOT = $sdkDirEarly
                    $env:ANDROID_HOME = $sdkDirEarly
                    "y" | & $sdkManager "ndk;$preferredNdkVersion" | Out-Host
                } catch {
                    Write-Host "[WARN] Failed to install NDK $preferredNdkVersion via sdkmanager." -ForegroundColor DarkYellow
                }
            } else {
                Write-Host "[WARN] sdkmanager not found. Please install NDK $preferredNdkVersion in Android SDK Manager." -ForegroundColor DarkYellow
            }

            if ((Test-Path $preferredCandidate) -and (Test-NdkValid $preferredCandidate)) {
                $ndkDir = $preferredCandidate
            } else {
                Write-Host "`n[ERROR] CRITICAL: NDK $preferredNdkVersion is required but could not be resolved." -ForegroundColor Red
                exit 1
            }
        }
    }

    if ($ndkDir) {
        $env:ANDROID_NDK_HOME = $ndkDir
        $env:NDK_HOME = $ndkDir
        
        $ndkSourceProps = Join-Path $ndkDir "source.properties"
        if (Test-Path $ndkSourceProps) {
            $ndkVersion = (Get-Content $ndkSourceProps | Where-Object { $_ -match "^Pkg.Revision" } | Select-Object -First 1) -replace "^Pkg.Revision\s*=\s*", ""
            Write-Host "[OK] NDK verified: $ndkVersion (supports c++_shared STL)" -ForegroundColor Green
        }

        Remove-NdkDirFromLocalProperties -Path $localPropsPathEarly
        Write-Host "[OK] Using NDK: $ndkDir" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] No valid NDK installation found under $ndkRoot" -ForegroundColor Red
        exit 1
    }
}

# Ensure Android SDK env + local.properties are always available before any Gradle invocation
$resolvedSdkDir = Get-ResolvedAndroidSdkDir -LocalPropertiesPath $localPropsPathEarly -SdkFromLocalProperties $sdkDirEarly
if ($resolvedSdkDir) {
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = $resolvedSdkDir }
    if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = $resolvedSdkDir }
    Update-LocalPropertiesPaths -Path $localPropsPathEarly -SdkDir $resolvedSdkDir
    Remove-NdkDirFromLocalProperties -Path $localPropsPathEarly
    Write-Host "[OK] Android SDK resolved to: $resolvedSdkDir" -ForegroundColor Green
} else {
    Write-Host "[WARN] Could not resolve Android SDK path from env/local.properties/common locations" -ForegroundColor DarkYellow
}

# Save working config snapshot for future builds
Write-Host "`nStep 2.5: Saving working build config..." -ForegroundColor Yellow
$configPath = Join-Path $PROJECT_ROOT "build-config.json"
$configData = [ordered]@{
    timestamp           = (Get-Date).ToString("o")
    projectRoot         = $PROJECT_ROOT
    androidDir          = $ANDROID_DIR
    androidSdkRoot      = $env:ANDROID_SDK_ROOT
    androidHome         = $env:ANDROID_HOME
    androidNdkHome       = $env:ANDROID_NDK_HOME
    ndkHome             = $env:NDK_HOME
    javaHome            = $env:JAVA_HOME
    nodeBinary          = $env:NODE_BINARY
    androidStl          = $env:ANDROID_STL
    cmakeAndroidStlType = $env:CMAKE_ANDROID_STL_TYPE
}
try {
    $configData | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "[OK] Saved build config to: $configPath" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Failed to save build config snapshot" -ForegroundColor DarkYellow
}

# Step 2.6: Apply known working build fixes (Gradle + CMake patches)
Write-Host "`nStep 2.6: Applying working build fixes..." -ForegroundColor Yellow

function Ensure-LineInFile {
    param(
        [string]$Path,
        [string]$MatchRegex,
        [string]$LineToSet
    )
    if (-not (Test-Path $Path)) { return }
    $content = Get-Content -Path $Path
    $matched = $false
    $newContent = @()
    foreach ($line in $content) {
        if ($line -match $MatchRegex) {
            $newContent += $LineToSet
            $matched = $true
        } else {
            $newContent += $line
        }
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
    } catch {
        Write-Host "[WARN] Could not read total RAM. Falling back to safe defaults." -ForegroundColor DarkYellow
    }

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

    Write-Host "[OK] Auto-tuned build profile: RAM=${totalRamGb}GB, heap=${heapMb}MB, workers=${maxWorkers}" -ForegroundColor Green
}

function Ensure-BlockAfterLine {
    param(
        [string]$Path,
        [string]$AnchorRegex,
        [string]$BlockText,
        [string]$BlockMarker
    )
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Path $Path -Raw
    if ($raw -match [regex]::Escape($BlockMarker)) { return }
    $lines = Get-Content -Path $Path
    $output = @()
    foreach ($line in $lines) {
        $output += $line
        if ($line -match $AnchorRegex) {
            $output += $BlockText
        }
    }
    Set-Content -Path $Path -Value $output
}

function Ensure-AppCmakeArguments {
    param(
        [string]$Path
    )
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
    param(
        [string]$Path,
        [string]$TargetName
    )
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

# Enforce Gradle STL flags
$gradleProps = Join-Path $ANDROID_DIR "gradle.properties"
Ensure-LineInFile -Path $gradleProps -MatchRegex '^reactNativeArchitectures=' -LineToSet 'reactNativeArchitectures=arm64-v8a'
Ensure-LineInFile -Path $gradleProps -MatchRegex '^android\.cmake\.arguments=' -LineToSet 'android.cmake.arguments=-DANDROID_STL=c++_shared -DCMAKE_ANDROID_STL_TYPE=c++_shared -DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared -DCMAKE_EXE_LINKER_FLAGS=-lc++_shared'
Ensure-GradleMemorySettings -GradlePropsPath $gradleProps
$env:GRADLE_OPTS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"
$env:JAVA_TOOL_OPTIONS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"
Write-Host "[OK] Gradle/JVM memory limits applied for current shell" -ForegroundColor Green

# Enforce root build.gradle subproject CMake args
$rootBuildGradle = Join-Path $ANDROID_DIR "build.gradle"
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

# Enforce app build.gradle defaultConfig CMake args
$appBuildGradle = Join-Path $ANDROID_DIR "app\build.gradle"
Ensure-AppCmakeArguments -Path $appBuildGradle

# Prefer Android Studio JBR
$candidateJdks = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "$env:ProgramFiles\Android\Android Studio\jre",
    "$env:ProgramFiles\Android\Android Studio\jre\jre"
)
$chosenJavaHome = $null
foreach ($j in $candidateJdks) {
    if ($j -and (Test-Path "$j\bin\java.exe")) { $chosenJavaHome = $j; break }
}
if (-not $env:JAVA_HOME) {
    if ($chosenJavaHome) {
        $env:JAVA_HOME = $chosenJavaHome
        Write-Host "[OK] JAVA_HOME set to Android Studio JBR: $env:JAVA_HOME" -ForegroundColor Green
    }
}
if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin")) {
    if ($env:Path -notlike "*$env:JAVA_HOME\bin*") {
        $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    }
}

# Step 3: Clean build directories
Write-Host "`nStep 3: Cleaning build directories..." -ForegroundColor Yellow
Invoke-SmartCleanup -ProjectPath $PROJECT_ROOT
Write-Host "[OK] Build directories cleaned" -ForegroundColor Green

# Step 4: Clean Gradle cache
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

# Step 5: Ensure node_modules are fresh
Write-Host "`nStep 5: Ensuring node_modules are up to date..." -ForegroundColor Yellow

$nodeModulesPath = Join-Path $PROJECT_ROOT "node_modules"
$lockFilePath = Join-Path $PROJECT_ROOT "package-lock.json"
$depsStampPath = Join-Path $BUILD_CACHE_DIR "deps.lock.sha256"
$nodeModulesExists = Test-Path $nodeModulesPath
$didRunNpmInstall = $false

if (-not $nodeModulesExists) {
    npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps
    $didRunNpmInstall = $true
} elseif ($FAST_MODE) {
    $currentLockHash = Get-FileSha256 -Path $lockFilePath
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

$npmInstallExit = $LASTEXITCODE
if ($didRunNpmInstall -and $npmInstallExit -ne 0) {
    Write-Host "[ERROR] npm install failed with exit code $npmInstallExit" -ForegroundColor Red
    exit $npmInstallExit
}

if ($didRunNpmInstall) {
    $installedLockHash = Get-FileSha256 -Path $lockFilePath
    if ($installedLockHash) { Set-Content -Path $depsStampPath -Value $installedLockHash }
}
Write-Host "[OK] Dependencies verified" -ForegroundColor Green

# Step 6: Regenerate Native Android Project (Prebuild)
Write-Host "`nStep 6: Regenerating native Android project (Prebuild)..." -ForegroundColor Yellow
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
    $prebuildArgs = @("expo", "prebuild", "--platform", "android")
    if ($FORCE_CLEAN_PREBUILD) { $prebuildArgs += "--clean" }

    npx @prebuildArgs
    $prebuildExit = $LASTEXITCODE
    if ($prebuildExit -ne 0) {
        Write-Host "[ERROR] npx expo prebuild failed with exit code $prebuildExit" -ForegroundColor Red
        exit $prebuildExit
    }

    if ($currentPrebuildHash) {
        Set-Content -Path $prebuildStampPath -Value $currentPrebuildHash
    }
}
Write-Host "[OK] Native project regenerated" -ForegroundColor Green

# Step 6.1: Post-Prebuild Gradle Fixes
Write-Host "`nStep 6.1: Applying post-prebuild Gradle fixes..." -ForegroundColor Yellow

$gradleProps = Join-Path $ANDROID_DIR "gradle.properties"
if (Test-Path $gradleProps) {
    Ensure-LineInFile -Path $gradleProps -MatchRegex '^reactNativeArchitectures=' -LineToSet 'reactNativeArchitectures=arm64-v8a'
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
Ensure-GradleMemorySettings -GradlePropsPath $gradleProps
$env:GRADLE_OPTS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"
$env:JAVA_TOOL_OPTIONS = "-Xmx$($script:GradleHeapMb)m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8"

# Re-apply CMake/libcxx-shared fixes to android/ files (wiped by prebuild --clean)
$rootBuildGradle = Join-Path $ANDROID_DIR "build.gradle"
$appBuildGradle = Join-Path $ANDROID_DIR "app\build.gradle"
Ensure-LineInFile -Path $gradleProps -MatchRegex '^android\.cmake\.arguments=' -LineToSet 'android.cmake.arguments=-DANDROID_STL=c++_shared -DCMAKE_ANDROID_STL_TYPE=c++_shared -DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared -DCMAKE_EXE_LINKER_FLAGS=-lc++_shared'
Ensure-BlockAfterLine -Path $rootBuildGradle -AnchorRegex 'apply plugin: "com.facebook.react.rootproject"' -BlockText $cmakeBlock -BlockMarker '// BEGIN libcxx-shared-fix'
Ensure-AppCmakeArguments -Path $appBuildGradle

# Patch native modules CMakeLists.txt files to link c++_shared
$knownTargets = @{
    'expo-modules-core'           = 'expo-modules-core'
    'react-native-screens'        = 'rnscreens'
    'react-native-worklets'       = 'worklets'
    'react-native-reanimated'     = 'reanimated'
    'react-native-nitro-modules'  = 'NitroModules'
    '@shopify\react-native-skia'  = '${PACKAGE_NAME}'
}
$cmakePatchCount = 0

$cmakePatchStampPath = Join-Path $BUILD_CACHE_DIR "cmake-patch.sha256"
$cmakePatchKey = Get-FileSha256 -Path (Join-Path $PROJECT_ROOT "package-lock.json")
$skipCmakeScan = $false
if ($FAST_MODE -and $cmakePatchKey -and (Test-Path $cmakePatchStampPath)) {
    $previousCmakePatchKey = (Get-Content -Path $cmakePatchStampPath -Raw).Trim()
    if ($previousCmakePatchKey -eq $cmakePatchKey) {
        $skipCmakeScan = $true
    }
}

if ($skipCmakeScan) {
    Write-Host "[INFO] FAST_MODE: node_modules unchanged, skipping CMake scan" -ForegroundColor Gray
} else {
    $cmakeFiles = Get-ChildItem -Path (Join-Path $PROJECT_ROOT "node_modules") -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            ($_.Name -eq 'CMakeLists.txt' -or $_.Extension -eq '.cmake') -and
            $_.FullName -match 'android' -and
            $_.FullName -notmatch '\.cxx' -and
            $_.FullName -notmatch 'build\\'
        }

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

    if ($cmakePatchKey) {
        Set-Content -Path $cmakePatchStampPath -Value $cmakePatchKey
    }
}
Write-Host "[OK] Patched $cmakePatchCount CMakeLists.txt files with c++_shared linking" -ForegroundColor Green

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

$screensCmakeCheck = Join-Path $PROJECT_ROOT "node_modules\react-native-screens\android\CMakeLists.txt"
$allChecksPass = (Test-FileContains -Path $screensCmakeCheck -Pattern 'c\+\+_shared') -and $allChecksPass

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

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Starting Android DEVELOPMENT Build..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ANDROID_DIR

Write-Host "`nBuilding Debug APK..." -ForegroundColor Yellow
$gradleBuildArgs = @(
    "assembleDebug",
    "--stacktrace",
    "--max-workers=$($script:GradleMaxWorkers)",
    "--build-cache"
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
    Write-Host "`n[OK] Debug Build succeeded!" -ForegroundColor Green

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
    $apkSearchPaths = @("$ANDROID_DIR\app\build\outputs\apk\debug\*.apk")
    $foundApks = @()
    foreach ($pattern in $apkSearchPaths) {
        $apks = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
        if ($apks) {
            foreach ($apk in $apks) {
                if ($apk.Name -eq "spayv2-debug.apk") {
                    $foundApks += $apk
                    continue
                }
                
                $newName = "spayv2-debug.apk"
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
        Write-Host "`nGenerated Debug Artifacts (Saved to $CENTRAL_APK_DIR):" -ForegroundColor Green
        foreach ($apk in $foundApks) {
            $centralPath = Join-Path $CENTRAL_APK_DIR $apk.Name
            Copy-Item -Path $apk.FullName -Destination $centralPath -Force -ErrorAction SilentlyContinue
            
            $sizeInMB = [math]::Round($apk.Length / 1MB, 2)
            Write-Host "  - $($apk.Name) ($sizeInMB MB)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "`n[ERROR] Debug build failed with exit code $overallExit" -ForegroundColor Red
    exit $overallExit
}
