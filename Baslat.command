#!/bin/bash

# WhatIstaspp - Mac Başlatma Scripti
# Çift tıklayarak uygulamayı başlatın

cd "$(dirname "$0")"

echo "🚀 WhatIstaspp başlatılıyor..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Paketler yükleniyor..."
    npm install
fi

# Start the app
echo "✅ Uygulama başlatıldı!"
echo ""
echo "🌐 Tarayıcınızda açın: http://localhost:3000"
echo ""
echo "Durdurmak için: Ctrl+C"
echo ""

npm run dev
