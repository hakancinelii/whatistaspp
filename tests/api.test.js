/**
 * WhatIstaspp API Test Suite
 * Kullanım: node tests/api.test.js
 */

const BASE_URL = 'http://localhost:3001';

// Test sonuçlarını sakla
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Renk kodları
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Test fonksiyonu
async function test(name, testFn) {
    try {
        await testFn();
        results.passed++;
        results.tests.push({ name, status: 'PASSED' });
        console.log(`${colors.green}✓${colors.reset} ${name}`);
    } catch (error) {
        results.failed++;
        results.tests.push({ name, status: 'FAILED', error: error.message });
        console.log(`${colors.red}✗${colors.reset} ${name}`);
        console.log(`  ${colors.red}→ ${error.message}${colors.reset}`);
    }
}

// Assertion helper
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// HTTP request helper
async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    let data = null;
    try {
        data = await response.json();
    } catch (e) {
        // Response might not be JSON
    }

    return { status: response.status, data, ok: response.ok };
}

// Token sakla
let authToken = null;

// ========== TESTLER ==========

async function runTests() {
    console.log('\n' + colors.blue + '═══════════════════════════════════════════' + colors.reset);
    console.log(colors.blue + '       WhatIstaspp API Test Suite' + colors.reset);
    console.log(colors.blue + '═══════════════════════════════════════════' + colors.reset + '\n');

    // 1. Sunucu Bağlantı Testi
    console.log(colors.yellow + '\n📡 Sunucu Bağlantı Testleri' + colors.reset);
    console.log('─────────────────────────────────');

    await test('Sunucu çalışıyor mu?', async () => {
        const res = await fetch(BASE_URL);
        assert(res.status === 200 || res.status === 304, `Sunucu yanıt vermedi (Status: ${res.status})`);
    });

    // 2. Auth Testleri
    console.log(colors.yellow + '\n🔐 Kimlik Doğrulama Testleri' + colors.reset);
    console.log('─────────────────────────────────');

    await test('Geçersiz giriş reddedilmeli', async () => {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'yanlis@email.com',
                password: 'yanlis123'
            })
        });
        assert(res.status === 401 || res.status === 400 || res.status === 404, 'Geçersiz giriş reddedilmedi');
    });

    await test('Geçerli giriş başarılı olmalı', async () => {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'admin@admin.com',
                password: 'admin123'
            })
        });
        assert(res.ok, `Giriş başarısız: ${res.data?.error || 'Bilinmeyen hata'}`);
        assert(res.data?.token, 'Token dönmedi');
        authToken = res.data.token;
    });

    // 3. API Endpoint Testleri (Auth gerekli)
    console.log(colors.yellow + '\n📊 API Endpoint Testleri' + colors.reset);
    console.log('─────────────────────────────────');

    await test('Token olmadan müşteri listesi reddedilmeli', async () => {
        const res = await request('/api/customers');
        assert(res.status === 401, 'Yetkisiz istek reddedilmedi');
    });

    await test('Token ile müşteri listesi alınabilmeli', async () => {
        const res = await request('/api/customers', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Müşteri listesi alınamadı: ${res.data?.error}`);
        assert(Array.isArray(res.data?.customers), 'Müşteri listesi dizi olmalı');
    });

    await test('Dashboard istatistikleri alınabilmeli', async () => {
        const res = await request('/api/dashboard/stats', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Dashboard stats alınamadı: ${res.data?.error}`);
    });

    await test('Şablon listesi alınabilmeli', async () => {
        const res = await request('/api/templates', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Şablon listesi alınamadı: ${res.data?.error}`);
        assert(Array.isArray(res.data?.templates), 'Şablon listesi dizi olmalı');
    });

    await test('Mesaj geçmişi alınabilmeli', async () => {
        const res = await request('/api/messages/history', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Mesaj geçmişi alınamadı: ${res.data?.error}`);
        assert(Array.isArray(res.data?.messages), 'Mesaj listesi dizi olmalı');
    });

    await test('Gelen kutusu alınabilmeli', async () => {
        const res = await request('/api/inbox', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Gelen kutusu alınamadı: ${res.data?.error}`);
        assert(Array.isArray(res.data?.messages), 'Mesaj listesi dizi olmalı');
    });

    // 4. WhatsApp Testleri
    console.log(colors.yellow + '\n📱 WhatsApp API Testleri' + colors.reset);
    console.log('─────────────────────────────────');

    await test('WhatsApp durumu alınabilmeli', async () => {
        const res = await request('/api/whatsapp/status', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `WhatsApp durumu alınamadı: ${res.data?.error}`);
        assert('isConnected' in res.data, 'isConnected alanı eksik');
    });

    // 5. CRUD İşlem Testleri
    console.log(colors.yellow + '\n✏️ CRUD İşlem Testleri' + colors.reset);
    console.log('─────────────────────────────────');

    let testTemplateId = null;

    await test('Yeni şablon oluşturulabilmeli', async () => {
        const res = await request('/api/templates', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                name: 'Test Şablonu',
                content: 'Bu bir test mesajıdır.'
            })
        });
        assert(res.ok, `Şablon oluşturulamadı: ${res.data?.error}`);
        assert(res.data?.id, 'Şablon ID dönmedi');
        testTemplateId = res.data.id;
    });

    await test('Şablon silinebilmeli', async () => {
        if (!testTemplateId) {
            throw new Error('Silinecek şablon ID yok');
        }
        const res = await request(`/api/templates/${testTemplateId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Şablon silinemedi: ${res.data?.error}`);
    });

    let testCustomerId = null;

    await test('Yeni müşteri eklenebilmeli', async () => {
        const res = await request('/api/customers', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                phone_number: '905551234567',
                name: 'Test Müşteri'
            })
        });
        assert(res.ok, `Müşteri eklenemedi: ${res.data?.error}`);
        assert(res.data?.id, 'Müşteri ID dönmedi');
        testCustomerId = res.data.id;
    });

    await test('Müşteri silinebilmeli', async () => {
        if (!testCustomerId) {
            throw new Error('Silinecek müşteri ID yok');
        }
        const res = await request(`/api/customers/${testCustomerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(res.ok, `Müşteri silinemedi: ${res.data?.error}`);
    });

    // ========== SONUÇLAR ==========
    console.log('\n' + colors.blue + '═══════════════════════════════════════════' + colors.reset);
    console.log(colors.blue + '                  SONUÇLAR' + colors.reset);
    console.log(colors.blue + '═══════════════════════════════════════════' + colors.reset);

    console.log(`\n${colors.green}Başarılı: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Başarısız: ${results.failed}${colors.reset}`);
    console.log(`Toplam: ${results.passed + results.failed}\n`);

    if (results.failed > 0) {
        console.log(colors.red + '❌ Bazı testler başarısız oldu!\n' + colors.reset);
        process.exit(1);
    } else {
        console.log(colors.green + '✅ Tüm testler başarılı!\n' + colors.reset);
        process.exit(0);
    }
}

// Testleri çalıştır
runTests().catch(err => {
    console.error(colors.red + 'Test hatası:', err.message + colors.reset);
    process.exit(1);
});
