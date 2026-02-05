const API_KEY = 'AIzaSyBqtqDovMlI_IQY4gcPIQxUUK3Vbd4UYdY';

async function checkModels() {
    console.log('--- Gemini API Yetki Kontrolü Başladı ---');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.error) {
            console.error('API Hatası:', data.error.message);
            return;
        }

        console.log('Erişilebilir Modeller:');
        data.models.forEach(m => {
            console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
        });

        console.log('--- Kontrol Bitti ---');
    } catch (error) {
        console.error('Bağlantı Hatası:', error.message);
    }
}

checkModels();
