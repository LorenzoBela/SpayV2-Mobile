# Android Development Build Script for S-Pay V2 App
# This script syncs files, patches native CMake and Android components, and builds a local debug APK.
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
    
    # Restore APKs from backup dir
    $BACKUP_DIR = Join-Path $ProjectPath "apk_backup"
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
    $combined = $parts -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $hasher.ComputeHash($bytes)
    return (-join ($hashBytes | ForEach-Object { "{0:x2}" -f $_ }))
}

# Free port 8081 if occupied
try {
    $portConnections = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
    if ($portConnections) {
        $pids = $portConnections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pidToKill in $pids) {
            if ($pidToKill -gt 0 -and $pidToKill -ne $PID) {
                Write-Host "Freeing port 8081: Terminating process $pidToKill..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    # Ignore if NetTCPConnection is unavailable
}

# --- STEP 1: PRE-FLIGHT CHECKS ---
Write-Host "`nStep 1: Running pre-flight system checks..." -ForegroundColor Yellow
$PROJECT_ROOT = $DEST_DIR
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"
$BUILD_CACHE_DIR = Join-Path $PROJECT_ROOT ".build-cache"
if (-not (Test-Path $BUILD_CACHE_DIR)) { New-Item -ItemType Directory -Path $BUILD_CACHE_DIR -Force | Out-Null }

# Locate Android SDK
$sdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "$env:USERPROFILE\AppData\Local\Android\Sdk",
    "C:\Android\Sdk"
)
$resolvedSdk = $null
foreach ($cand in $sdkCandidates) {
    if ($cand -and (Test-Path $cand)) {
        $resolvedSdk = $cand
        break
    }
}

if (-not $resolvedSdk) {
    Write-Host "[ERROR] Android SDK not found in any standard location" -ForegroundColor Red
    exit 1
}

$env:ANDROID_HOME = $resolvedSdk
$env:ANDROID_SDK_ROOT = $resolvedSdk
Write-Host "[OK] ANDROID_HOME resolved to: $env:ANDROID_HOME" -ForegroundColor Green

# Locate Android NDK
$preferredNdkVersion = "26.1.10909125"
$ndkCandidates = @(
    $env:ANDROID_NDK_HOME,
    $env:NDK_HOME,
    (Join-Path $resolvedSdk "ndk\$preferredNdkVersion"),
    (Join-Path $resolvedSdk "ndk-bundle")
)

$resolvedNdk = $null
foreach ($n in $ndkCandidates) {
    if ($n -and (Test-Path $n)) {
        $resolvedNdk = $n
        break
    }
}

if (-not $resolvedNdk) {
    $ndkRoot = Join-Path $resolvedSdk "ndk"
    if (Test-Path $ndkRoot) {
        $installedNdks = Get-ChildItem -Path $ndkRoot -Directory | Sort-Object Name -Descending
        if ($installedNdks.Count -gt 0) {
            $resolvedNdk = $installedNdks[0].FullName
        }
    }
}

if ($resolvedNdk) {
    $env:ANDROID_NDK_HOME = $resolvedNdk
    $env:NDK_HOME = $resolvedNdk
    Write-Host "[OK] ANDROID_NDK_HOME resolved to: $env:ANDROID_NDK_HOME" -ForegroundColor Green
} else {
    Write-Host "[WARN] Android NDK directory not found. CMake builds may fail." -ForegroundColor DarkYellow
}

# Locate Node Binary
$nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $env:NODE_BINARY = $nodeCmd.Source
    Write-Host "[OK] NODE_BINARY set to: $env:NODE_BINARY" -ForegroundColor Green
}

# --- STEP 2: HARDWARE/MEMORY OPTIMIZATION ---
Write-Host "`nStep 2: Optimizing Gradle memory for host hardware..." -ForegroundColor Yellow

function Ensure-LineInFile {
    param([string]$Path, [string]$MatchRegex, [string]$LineToSet)
    if (-not (Test-Path $Path)) { return }
    $content = Get-Content -Path $Path -Raw
    if ($content -match $MatchRegex) {
        $content = [regex]::Replace($content, "(?m)$MatchRegex.*", $LineToSet)
    } else {
        $content = $content.TrimEnd() + "`r`n" + $LineToSet + "`r`n"
    }
    Set-Content -Path $Path -Value $content
}

function Ensure-GradleMemorySettings {
    param([string]$GradlePropsPath)
    if (-not (Test-Path $GradlePropsPath)) { return }

    $totalRamGb = 8
    $logicalCores = [Environment]::ProcessorCount
    try {
        $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($cs -and $cs.TotalPhysicalMemory) {
            $totalRamGb = [math]::Round($cs.TotalPhysicalMemory / 1GB)
        }
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
    $raw = $raw -replace '`n', "`n"
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

    if ($raw -notmatch '# BEGIN cmake-utils-prefix') {
        $prefixInject = "`n# BEGIN cmake-utils-prefix`nset(ReactAndroid_DIR `"`${CMAKE_CURRENT_SOURCE_DIR}/../../react-native/ReactAndroid/cmake-utils`")`nset(fbjni_DIR `"`${CMAKE_CURRENT_SOURCE_DIR}/../../react-native/ReactAndroid/cmake-utils`")`nset(hermes-engine_DIR `"`${CMAKE_CURRENT_SOURCE_DIR}/../../react-native/ReactAndroid/cmake-utils`")`nlist(APPEND CMAKE_PREFIX_PATH `"`${CMAKE_CURRENT_SOURCE_DIR}/../../react-native/ReactAndroid/cmake-utils`")`nlist(APPEND CMAKE_MODULE_PATH `"`${CMAKE_CURRENT_SOURCE_DIR}/../../react-native/ReactAndroid/cmake-utils`")`nadd_compile_definitions(RN_SERIALIZABLE_STATE=1 RN_FABRIC_ENABLED=1 IS_NEW_ARCHITECTURE_ENABLED=1 FOLLY_NO_CONFIG=1 HERMES_V1_ENABLED=1 REACT_NATIVE_PRODUCTION=1 RN_DEBUG_STRING_CONVERTIBLE=0)`n# END cmake-utils-prefix`n"
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
    $propsContent = Get-Content $gradleProps -Raw
    if ($propsContent -match '(?m)^reactNativeArchitectures=.*') {
        $propsContent = $propsContent -replace '(?m)^reactNativeArchitectures=.*', ''
    }
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

# Re-apply CMake/libcxx-shared fixes to android/ files
$rootBuildGradle = Join-Path $ANDROID_DIR "build.gradle"
$appBuildGradle = Join-Path $ANDROID_DIR "app\build.gradle"
Ensure-LineInFile -Path $gradleProps -MatchRegex '^android\.cmake\.arguments=' -LineToSet 'android.cmake.arguments=-DANDROID_STL=c++_shared -DCMAKE_ANDROID_STL_TYPE=c++_shared -DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared -DCMAKE_EXE_LINKER_FLAGS=-lc++_shared'

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

# Patch native modules CMakeLists.txt files
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

$cmakePatchStampPath = Join-Path $BUILD_CACHE_DIR "cmake-patch.sha256"
$cmakePatchKey = Get-FileSha256 -Path $lockFilePath
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

    $autolinkingFiles = Get-ChildItem -Path (Join-Path $PROJECT_ROOT "node_modules") -Filter "*.cmake" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\.cxx' -and $_.FullName -notmatch 'build\\' -and $_.FullName -notmatch 'ReactAndroid[\\/]cmake-utils' }

    $rnCmakeUtils = (Join-Path $PROJECT_ROOT "node_modules/react-native/ReactAndroid/cmake-utils").Replace('\', '/')

    foreach ($autolinkingFile in $autolinkingFiles) {
        $raw = Get-Content -Path $autolinkingFile.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $raw) { continue }
        if (($raw -match 'find_package\s*\(\s*(ReactAndroid|fbjni|hermes-engine)') -and ($raw -notmatch '# BEGIN cmake-utils-prefix')) {
            $prefixInject = "`n# BEGIN cmake-utils-prefix`nset(ReactAndroid_DIR `"$rnCmakeUtils`")`nset(fbjni_DIR `"$rnCmakeUtils`")`nset(hermes-engine_DIR `"$rnCmakeUtils`")`nlist(APPEND CMAKE_PREFIX_PATH `"$rnCmakeUtils`")`nlist(APPEND CMAKE_MODULE_PATH `"$rnCmakeUtils`")`n# END cmake-utils-prefix`n"
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
            $rawApp = $rawApp -replace 'set\(ReactAndroid_DIR "[^"]*"\)', "set(ReactAndroid_DIR `"$rnCmakeUtils`")`nset(fbjni_DIR `"$rnCmakeUtils`")`nset(hermes-engine_DIR `"$rnCmakeUtils`")`nlist(APPEND CMAKE_PREFIX_PATH `"$rnCmakeUtils`")`nlist(APPEND CMAKE_MODULE_PATH `"$rnCmakeUtils`")"
            $rawApp = $rawApp -replace 'find_package\(ReactAndroid\s+REQUIRED\s+CONFIG\)', 'find_package(ReactAndroid REQUIRED)'
            $rawApp = $rawApp -replace 'find_package\(fbjni\s+REQUIRED\s+CONFIG\)', 'find_package(fbjni REQUIRED)'
            Set-Content -Path $rnAppCmake -Value $rawApp
        }
    }

    if ($cmakePatchKey) {
        Set-Content -Path $cmakePatchStampPath -Value $cmakePatchKey
    }
    Write-Host "[OK] Patched $cmakePatchCount CMakeLists.txt/cmake files with absolute cmake-utils" -ForegroundColor Green
}

# --- FIREBASE MESSAGING MANIFEST OVERRIDE ---
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

# --- ANDROID HOME SCREEN WIDGETS INTEGRATION ---
function Invoke-CopyWidgetFiles {
    param([string]$ProjectRoot)
    $widgetsDir = Join-Path $ProjectRoot "widgets"
    $androidAppDir = Join-Path $ProjectRoot "android\app"
    
    if (-not (Test-Path $widgetsDir)) {
        Write-Host "[WARN] Widgets source directory not found at $widgetsDir" -ForegroundColor Yellow
        return
    }
    
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
        Write-Host "[OK] Copied widget drawable resources to native Android directory" -ForegroundColor Green
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
    } else {
        Write-Host "[OK] SpayWidgetPackage already registered in MainApplication.kt" -ForegroundColor Green
    }
}

function Invoke-WidgetManifestInjection {
    param([string]$ProjectRoot)

    $manifestPath = Join-Path $ProjectRoot "android\app\src\main\AndroidManifest.xml"
    if (-not (Test-Path $manifestPath)) { return }

    $raw = Get-Content -Path $manifestPath -Raw

    if ($raw -match 'ClientCountdownWidgetProvider') {
        Write-Host "[OK] Widget receivers already present in AndroidManifest.xml" -ForegroundColor Green
        return
    }

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
$androidManifestPath = Join-Path $ANDROID_DIR "app\src\main\AndroidManifest.xml"
$allChecksPass = (Test-FileContains -Path $androidManifestPath -Pattern 'com\.google\.firebase\.messaging\.default_notification_channel_id.*tools:replace="android:value"') -and $allChecksPass

$screensCmakeCheck = Join-Path $PROJECT_ROOT "node_modules\react-native-screens\android\CMakeLists.txt"
$allChecksPass = (Test-FileContains -Path $screensCmakeCheck -Pattern 'c\+\+_shared') -and $allChecksPass

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

    # Display and copy APKs
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
