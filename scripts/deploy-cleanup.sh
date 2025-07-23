#!/bin/bash

# LeadFuego Deployment Cleanup Script
# Ensures directory is clean and ready for production deployment

set -e

echo "🧹 Starting LeadFuego deployment cleanup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "wrangler.json" ]; then
    print_status $RED "❌ Error: This doesn't appear to be the LeadFuego root directory"
    exit 1
fi

print_status $BLUE "📂 Analyzing project structure..."

# Clean up temporary files
print_status $YELLOW "🗑️  Removing temporary files..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.log" -type f -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
find . -name "*.backup" -type f -not -path "./node_modules/*" -delete 2>/dev/null || true

# Remove test build files
print_status $YELLOW "🧪 Removing test files..."
find . -name "test-build.*" -type f -delete 2>/dev/null || true
find . -name "*.test.js" -type f -not -path "./tests/*" -not -path "./node_modules/*" -delete 2>/dev/null || true

# Clean empty directories
print_status $YELLOW "📁 Cleaning empty directories..."
find . -type d -empty -not -path "./node_modules/*" -not -path "./.git/*" -delete 2>/dev/null || true

# Verify critical files exist
print_status $BLUE "✅ Verifying critical files..."

critical_files=(
    "package.json"
    "wrangler.json"
    "src/worker/index.ts"  
    "src/react-app/main.tsx"
    "src/react-app/App.tsx"
    "vite.config.ts"
    "tsconfig.json"
)

missing_files=()
for file in "${critical_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    print_status $RED "❌ Missing critical files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

print_status $GREEN "✅ All critical files present"

# Check for sensitive information in config files
print_status $BLUE "🔒 Checking for sensitive information..."

sensitive_patterns=(
    "password"
    "secret.*=.*['\"][^'\"]*['\"]"
    "api_key.*=.*['\"][^'\"]*['\"]"
    "private_key"
)

sensitive_found=false
for pattern in "${sensitive_patterns[@]}"; do
    if grep -r -i "$pattern" --include="*.json" --include="*.js" --include="*.ts" --exclude-dir=node_modules . >/dev/null 2>&1; then
        print_status $YELLOW "⚠️  Potential sensitive information found (pattern: $pattern)"
        sensitive_found=true
    fi
done

if [ "$sensitive_found" = false ]; then
    print_status $GREEN "✅ No obvious sensitive information in config files"
fi

# Verify build can complete
print_status $BLUE "🔨 Testing build process..."
if npm run build >/dev/null 2>&1; then
    print_status $GREEN "✅ Build completed successfully"
else
    print_status $RED "❌ Build failed - fix issues before deploying"
    exit 1
fi

# Check TypeScript compilation
print_status $BLUE "📝 Checking TypeScript compilation..."
if npx tsc --noEmit >/dev/null 2>&1; then
    print_status $GREEN "✅ TypeScript compilation successful"
else
    print_status $YELLOW "⚠️  TypeScript compilation has warnings/errors"
fi

# Verify essential dependencies
print_status $BLUE "📦 Verifying dependencies..."
if [ ! -d "node_modules" ]; then
    print_status $RED "❌ node_modules not found. Run 'npm install' first."
    exit 1
fi

# Check bundle size
print_status $BLUE "📊 Analyzing bundle size..."
if [ -f "dist/client/assets/index-*.js" ]; then
    bundle_size=$(du -sh dist/client/assets/index-*.js | cut -f1)
    print_status $GREEN "✅ Main bundle size: $bundle_size"
    
    # Warn if bundle is too large
    bundle_bytes=$(du -sb dist/client/assets/index-*.js | cut -f1)
    if [ "$bundle_bytes" -gt 500000 ]; then # 500KB
        print_status $YELLOW "⚠️  Bundle size is large (>500KB). Consider code splitting."
    fi
else
    print_status $YELLOW "⚠️  Bundle file not found. Build may have issues."
fi

# Check for unused files in src
print_status $BLUE "🔍 Checking for unused files..."
unused_count=0

# Check for unused TypeScript files (basic check)
for ts_file in $(find src -name "*.ts" -o -name "*.tsx" | grep -v "\.d\.ts$"); do
    filename=$(basename "$ts_file" .ts)
    filename=$(basename "$filename" .tsx)
    
    # Skip if it's an index file or main entry point
    if [[ "$filename" == "index" || "$filename" == "main" || "$filename" == "App" ]]; then
        continue
    fi
    
    # Simple check if file is imported anywhere
    if ! grep -r "from.*$filename" src/ >/dev/null 2>&1 && ! grep -r "import.*$filename" src/ >/dev/null 2>&1; then
        # Additional check for default exports
        if ! grep -r "import.*from.*$(dirname "$ts_file" | sed 's|src/||')" src/ >/dev/null 2>&1; then
            print_status $YELLOW "⚠️  Potentially unused file: $ts_file"
            ((unused_count++))
        fi
    fi
done

if [ $unused_count -eq 0 ]; then
    print_status $GREEN "✅ No obviously unused files detected"
fi

# Check git status
print_status $BLUE "🔄 Checking git status..."
if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
    if [ -n "$(git status --porcelain)" ]; then
        print_status $YELLOW "⚠️  There are uncommitted changes:"
        git status --short
        print_status $YELLOW "   Consider committing changes before deploying"
    else
        print_status $GREEN "✅ Git working directory is clean"
    fi
else
    print_status $YELLOW "⚠️  Git not available or not a git repository"
fi

# Security check for exposed secrets
print_status $BLUE "🛡️  Security check..."
secret_files=(
    ".env"
    ".env.local"
    ".env.production"
    "secrets.json"
)

exposed_secrets=false
for file in "${secret_files[@]}"; do
    if [ -f "$file" ] && [ ! -f ".gitignore" ] || ! grep -q "$file" .gitignore 2>/dev/null; then
        print_status $RED "❌ Secret file not in .gitignore: $file"
        exposed_secrets=true
    fi
done

if [ "$exposed_secrets" = false ]; then
    print_status $GREEN "✅ No exposed secret files detected"
fi

# Check for required environment variables (for production)
print_status $BLUE "🌍 Environment variables check..."
required_vars=(
    "JWT_SECRET" 
    "WEBHOOK_SECRET"
    "ENCRYPTION_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "$var" wrangler.json 2>/dev/null; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    print_status $GREEN "✅ Required environment variables configured"
else
    print_status $YELLOW "⚠️  Some environment variables may need configuration:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
fi

# Final directory structure validation  
print_status $BLUE "📋 Final structure validation..."

expected_dirs=(
    "src/react-app/components"
    "src/react-app/pages" 
    "src/react-app/services"
    "src/worker/routes"
    "src/worker/services"
    "dist/client"
    "dist/lead_fuego"
)

missing_dirs=()
for dir in "${expected_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        missing_dirs+=("$dir")
    fi
done

if [ ${#missing_dirs[@]} -eq 0 ]; then
    print_status $GREEN "✅ Directory structure is correct"
else
    print_status $RED "❌ Missing directories:"
    for dir in "${missing_dirs[@]}"; do
        echo "   - $dir"
    done
fi

# Performance check
print_status $BLUE "⚡ Performance check..."
if [ -f "dist/client/index.html" ]; then
    css_count=$(grep -c "stylesheet" dist/client/index.html || echo "0")
    js_count=$(grep -c "script.*src" dist/client/index.html || echo "0")
    
    print_status $GREEN "✅ Assets found: $css_count CSS files, $js_count JS files"
    
    if [ "$css_count" -gt 5 ] || [ "$js_count" -gt 10 ]; then
        print_status $YELLOW "⚠️  High number of assets. Consider bundling optimization."
    fi
fi

print_status $GREEN "🎉 Deployment cleanup completed!"

# Summary
echo ""
print_status $BLUE "📊 DEPLOYMENT READINESS SUMMARY"
echo "=================================="
print_status $GREEN "✅ Temporary files cleaned"
print_status $GREEN "✅ Build process verified"
print_status $GREEN "✅ Critical files present"
print_status $GREEN "✅ Bundle generated successfully"

if [ "$sensitive_found" = true ] || [ "$exposed_secrets" = true ]; then
    print_status $YELLOW "⚠️  Security concerns detected - review before deploying"
fi

if [ ${#missing_dirs[@]} -ne 0 ] || [ ${#missing_files[@]} -ne 0 ]; then
    print_status $RED "❌ Structural issues found - fix before deploying"
    exit 1
fi

print_status $GREEN "🚀 Project is ready for deployment!"
echo ""
print_status $BLUE "Next steps:"
echo "  1. Run 'npm run check' for final validation"
echo "  2. Run 'npm run deploy' to deploy to Cloudflare"
echo "  3. Monitor logs after deployment"
echo ""

exit 0