#!/bin/bash
set -e

# Midnight DID (Ledger v7) - Incremental Build & Test Script
# Usage: ./run.sh [target]
# Targets: setup, compile, build, test, test-api, all

TARGET=${1:-all}

echo "🚀 Midnight DID (Ledger v7) - Target: $TARGET"

cd "$(dirname "$0")"

# Ensure Node 22
if ! node --version | grep -q "v22"; then
    echo "⚠️  Switching to Node v22..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm use 22
fi

case $TARGET in
    setup)
        echo "📦 Installing dependencies..."
        rm -rf node_modules */node_modules
        npm install
        ;;

    compile)
        echo "🔨 Compiling Compact contract..."
        npm run compact -w contract
        ;;

    build)
        echo "🏗️  Building packages..."
        npm run build -w contract
        npm run build -w did-cli
        ;;

    test)
        echo "🧪 Running unit tests..."
        npm run test -w contract
        ;;

    test-api)
        echo "🌐 Running API integration tests..."
        npm run test-api -w did-cli
        ;;

    all)
        echo "▶️  Running full pipeline..."
        echo ""
        echo "[1/5] Setup..."
        $0 setup
        echo ""
        echo "[2/5] Compile..."
        $0 compile
        echo ""
        echo "[3/5] Build..."
        $0 build
        echo ""
        echo "[4/5] Test..."
        $0 test
        echo ""
        echo "[5/5] API Tests..."
        $0 test-api
        echo ""
        echo "✅ All steps completed successfully!"
        ;;

    *)
        echo "❌ Unknown target: $TARGET"
        echo "Available targets: setup, compile, build, test, test-api, all"
        exit 1
        ;;
esac
