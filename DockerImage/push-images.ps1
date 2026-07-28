# Internal private registry address
$REGISTRY="10.10.11.194:1000"

# List of all images to be pushed
$imageList = @(
    "busybox:latest",
    "dcloud-market-backend:latest",
    "dcloud-market-frontend:latest",
    "docker.1ms.run/library/node:18-alpine",
    "langgenius/dify-api:1.14.2",
    "langgenius/dify-plugin-daemon:0.6.1-local",
    "langgenius/dify-sandbox:0.2.15",
    "langgenius/dify-web:1.14.2",
    "nginx:alpine",
    "nginx:latest",
    "node:18-alpine",
    "node:20-alpine",
    "postgres:15-alpine",
    "redis:6-alpine",
    "semitechnologies/weaviate:1.27.0",
    "skillmarket-backend:latest",
    "skillmarket-frontend:latest",
    "tfstool-web:latest",
    "tfstoolblazorserver-angular-frontend:latest",
    "tfstoolblazorserver-api-service:latest",
    "tfstoolblazorserver-mcp-service:latest",
    "tfstoolblazorserver-web-frontend:latest",
    "ubuntu/squid:latest"
)

foreach ($img in $imageList) {
    if ($img -match "^docker\.1ms\.run/(.*)") {
        # Handle special images with external domain
        $newName = $matches[1]
    } else {
        $newName = $img
    }
    $targetImg="${REGISTRY}/${newName}"
    Write-Host "====================================="
    Write-Host "Tagging: $img -> $targetImg"
    docker tag $img $targetImg
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to tag: $img"
        continue
    }
    Write-Host "Pushing: $targetImg"
    docker push $targetImg
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Push succeeded: $targetImg"
    } else {
        Write-Warning "❌ Push failed: $targetImg"
    }
}

Write-Host "`nAll images processed. Visit the repository list at: http://10.10.9.65:5000/v2/_catalog"
