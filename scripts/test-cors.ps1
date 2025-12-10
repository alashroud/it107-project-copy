# PowerShell script to smoke-test CORS and rate limiting behavior for the local dev server
# Usage: Open PowerShell and run: .\scripts\test-cors.ps1

$base = 'http://localhost:3000'
$failed = 0

Write-Host "=== CORS Smoke Tests ===" -ForegroundColor Cyan

Write-Host "`n1. Testing allowed origin (should include Access-Control-Allow-Origin)..."
try {
    $allowed = Invoke-WebRequest -Uri "$base/api/health" -Headers @{ Origin = 'http://localhost:3000' } -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($allowed.StatusCode)" -ForegroundColor Green
    if ($allowed.Headers.ContainsKey('Access-Control-Allow-Origin')) {
        Write-Host "✓ ACAO header present: $($allowed.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "✗ ACAO header missing!" -ForegroundColor Red
        $failed += 1
    }
} catch {
    Write-Host "✗ Request failed: $_" -ForegroundColor Red
    $failed += 1
}

Write-Host "`n2. Testing blocked origin (should NOT include Access-Control-Allow-Origin)..."
try {
    $blocked = Invoke-WebRequest -Uri "$base/api/health" -Headers @{ Origin = 'http://evil.example' } -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($blocked.StatusCode)" -ForegroundColor Green
    if ($blocked.Headers.ContainsKey('Access-Control-Allow-Origin')) {
        Write-Host "✗ ACAO header should NOT be present for blocked origin!" -ForegroundColor Red
        $failed += 1
    } else {
        Write-Host "✓ ACAO header correctly absent" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Request failed: $_" -ForegroundColor Red
    $failed += 1
}

Write-Host "`n3. Testing preflight (OPTIONS)..."
try {
    $pre = Invoke-WebRequest -Uri "$base/api/convert" `
        -Headers @{ Origin = 'http://localhost:3000'; 'Access-Control-Request-Method' = 'GET'; 'Access-Control-Request-Headers' = 'Content-Type' } `
        -Method OPTIONS -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($pre.StatusCode)" -ForegroundColor Green
    if ($pre.Headers.ContainsKey('Access-Control-Allow-Methods')) {
        Write-Host "✓ AC-Methods: $($pre.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Green
    } else {
        Write-Host "✗ AC-Methods header missing!" -ForegroundColor Red
        $failed += 1
    }
    if ($pre.Headers.ContainsKey('Access-Control-Max-Age')) {
        Write-Host "✓ AC-Max-Age: $($pre.Headers['Access-Control-Max-Age'])" -ForegroundColor Green
    } else {
        Write-Host "✗ AC-Max-Age header missing!" -ForegroundColor Red
        $failed += 1
    }
} catch {
    Write-Host "✗ Request failed: $_" -ForegroundColor Red
    $failed += 1
}

Write-Host "`n=== Rate Limiting Tests ===" -ForegroundColor Cyan

Write-Host "`n4. Testing rate limit headers..."
try {
    $rl = Invoke-WebRequest -Uri "$base/api/health" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($rl.Headers.ContainsKey('RateLimit-Limit')) {
        Write-Host "✓ RateLimit-Limit: $($rl.Headers['RateLimit-Limit'])" -ForegroundColor Green
    } else {
        Write-Host "✗ RateLimit-Limit header missing!" -ForegroundColor Red
        $failed += 1
    }
    if ($rl.Headers.ContainsKey('RateLimit-Remaining')) {
        Write-Host "✓ RateLimit-Remaining: $($rl.Headers['RateLimit-Remaining'])" -ForegroundColor Green
    } else {
        Write-Host "✗ RateLimit-Remaining header missing!" -ForegroundColor Red
        $failed += 1
    }
} catch {
    Write-Host "✗ Request failed: $_" -ForegroundColor Red
    $failed += 1
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "✓ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "✗ $failed test(s) failed" -ForegroundColor Red
    exit 1
}
