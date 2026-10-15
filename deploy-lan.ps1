<#
.SYNOPSIS
    Deploys the IT Ticketing Portal to a local LAN environment
    
.DESCRIPTION
    This script builds and deploys the complete ticketing portal stack using Docker Compose.
    It includes PostgreSQL, Redis, Backend API, Frontend, and Nginx reverse proxy.
    
.PARAMETER LanIp
    The LAN IP address where the application will be accessible (default: auto-detect)
    
.PARAMETER Domain
    Optional domain name for the deployment
    
.PARAMETER Ssl
    Whether to enable SSL/HTTPS (requires certificates)
    
.EXAMPLE
    .\deploy-lan.ps1 -LanIp "192.168.1.100"
    
.EXAMPLE
    .\deploy-lan.ps1 -LanIp "192.168.1.100" -Domain "tickets.company.local" -Ssl
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$LanIp = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Domain = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Ssl,
    
    [Parameter(Mandatory=$false)]
    [switch]$BuildOnly,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoCache
)

# Colors for output
$green = [ConsoleColor]::Green
$yellow = [ConsoleColor]::Yellow
$red = [ConsoleColor]::Red
$cyan = [ConsoleColor]::Cyan

function Write-Status($message, $color = $green) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor $color
}

function Write-ErrorAndExit($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $message" -ForegroundColor $red
    exit 1
}

# Auto-detect LAN IP if not provided
if (-not $LanIp) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi", "Ethernet", "*Wi-Fi*", "*Ethernet*" | 
           Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | 
           Select-Object -First 1).IPAddress
    
    if ($ip) {
        $LanIp = $ip
        Write-Status "Auto-detected LAN IP: $LanIp" $cyan
    } else {
        Write-ErrorAndExit "Could not auto-detect LAN IP. Please specify with -LanIp parameter."
    }
}

# Validate IP format
if ($LanIp -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
    Write-ErrorAndExit "Invalid IP address format: $LanIp"
}

$frontendUrl = "http://$LanIp:5173"
if ($Domain) {
    $protocol = if ($Ssl) { "https" } else { "http" }
    $frontendUrl = "${protocol}://$Domain"
}

Write-Status "==========================================" $cyan
Write-Status "IT Ticketing Portal - LAN Deployment" $cyan
Write-Status "==========================================" $cyan
Write-Status "LAN IP: $LanIp" $cyan
Write-Status "Frontend URL: $frontendUrl" $cyan
if ($Domain) { Write-Status "Domain: $Domain" $cyan }
if ($Ssl) { Write-Status "SSL: Enabled" $cyan }
Write-Status "==========================================" $cyan

# Check prerequisites
Write-Status "Checking prerequisites..." $yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ErrorAndExit "Docker is not installed. Please install Docker first."
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue) -and -not (docker compose version -ErrorAction SilentlyContinue)) {
    Write-ErrorAndExit "Docker Compose is not installed. Please install Docker Compose first."
}

# Check if .env.production exists
$envFile = ".env.production"
if (-not (Test-Path $envFile)) {
    Write-Status "Creating .env.production from template..." $yellow
    if (Test-Path ".env.production.example") {
        Copy-Item ".env.production.example" $envFile
        Write-Status "Please edit .env.production with your configuration!" $yellow
        Write-Status "Required: DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY" $yellow
        Read-Host "Press Enter after editing .env.production..."
    } else {
        Write-ErrorAndExit ".env.production.example not found!"
    }
}

# Generate secrets if not set
$envContent = Get-Content $envFile -Raw
$secretsGenerated = $false

if ($envContent -match 'your_secure_database_password_here') {
    $dbPass = [System.Web.Security.Membership]::GeneratePassword(24, 4)
    $envContent = $envContent -replace 'your_secure_database_password_here', $dbPass
    $secretsGenerated = $true
}

if ($envContent -match 'your_jwt_secret_min_32_characters_here') {
    $jwtSecret = [System.Web.Security.Membership]::GeneratePassword(48, 6)
    $envContent = $envContent -replace 'your_jwt_secret_min_32_characters_here', $jwtSecret
    $secretsGenerated = $true
}

if ($envContent -match 'your_jwt_refresh_secret_min_32_characters_here') {
    $jwtRefreshSecret = [System.Web.Security.Membership]::GeneratePassword(48, 6)
    $envContent = $envContent -replace 'your_jwt_refresh_secret_min_32_characters_here', $jwtRefreshSecret
    $secretsGenerated = $true
}

if ($envContent -match 'your_32_character_encryption_key_here') {
    $encKey = [System.Web.Security.Membership]::GeneratePassword(32, 0)
    $envContent = $envContent -replace 'your_32_character_encryption_key_here', $encKey
    $secretsGenerated = $true
}

if ($secretsGenerated) {
    $envContent | Set-Content $envFile
    Write-Status "Generated secure secrets in .env.production" $green
}

# Update FRONTEND_URL in .env.production
$envContent = $envContent -replace 'FRONTEND_URL=.*', "FRONTEND_URL=$frontendUrl"
$envContent | Set-Content $envFile

# Build and deploy
$composeFile = "docker-compose.yml"
$composeCmd = if (docker compose version -ErrorAction SilentlyContinue) { "docker compose" } else { "docker-compose" }

$buildArgs = @()
if ($NoCache) { $buildArgs += "--no-cache" }

try {
    if (-not $BuildOnly) {
        Write-Status "Stopping existing containers..." $yellow
        & $composeCmd down --remove-orphans
    }
    
    Write-Status "Building images..." $yellow
    & $composeCmd build $buildArgs
    
    if ($BuildOnly) {
        Write-Status "Build completed successfully!" $green
        exit 0
    }
    
    Write-Status "Starting services..." $yellow
    & $composeCmd up -d
    
    Write-Status "Waiting for services to be healthy..." $yellow
    $services = @("postgres", "redis", "backend", "frontend")
    $maxWait = 120
    $elapsed = 0
    
    while ($elapsed -lt $maxWait) {
        $allHealthy = $true
        foreach ($service in $services) {
            $health = docker inspect --format='{{.State.Health.Status}}' "ticket-portal-$service" 2>$null
            if ($health -ne "healthy") {
                $allHealthy = $false
                break
            }
        }
        
        if ($allHealthy) {
            Write-Status "All services are healthy!" $green
            break
        }
        
        Start-Sleep -Seconds 5
        $elapsed += 5
        Write-Host "." -NoNewline -ForegroundColor $yellow
    }
    
    if (-not $allHealthy) {
        Write-Status "" $yellow
        Write-Status "Services taking longer to start. Check logs with: docker-compose logs -f" $yellow
    }
    
    # Run database migrations
    Write-Status "Running database migrations..." $yellow
    docker exec ticket-portal-backend npx prisma migrate deploy
    
    # Seed initial data
    Write-Status "Seeding initial data..." $yellow
    try {
        docker exec ticket-portal-backend npx prisma db seed
    } catch {
        Write-Status "Seed script not found, skipping..." $yellow
    }
    
    Write-Status "" $green
    Write-Status "==========================================" $green
    Write-Status "DEPLOYMENT SUCCESSFUL!" $green
    Write-Status "==========================================" $green
    Write-Status "Frontend: $frontendUrl" $green
    Write-Status "API: http://$LanIp:3000/api/v1" $green
    Write-Status "WebSocket: http://$LanIp:3001" $green
    Write-Status "" $green
    Write-Status "Default Admin Credentials:" $cyan
    Write-Status "  Email: admin@ticketportal.local" $cyan
    Write-Status "  Password: (check logs: docker logs ticket-portal-backend | grep 'Temporary Password')" $cyan
    Write-Status "" $green
    Write-Status "Useful Commands:" $cyan
    Write-Status "  View logs: docker-compose logs -f [service]" $cyan
    Write-Status "  Stop: docker-compose down" $cyan
    Write-Status "  Restart: docker-compose restart" $cyan
    Write-Status "  Update: .\deploy-lan.ps1 -LanIp $LanIp" $cyan
    Write-Status "==========================================" $green
    
} catch {
    Write-ErrorAndExit "Deployment failed: $_"
}