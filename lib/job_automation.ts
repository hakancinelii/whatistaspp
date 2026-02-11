
import { getDatabase } from './db';
import { processJobTaking } from './job_service';

export const ISTANBUL_REGIONS = [
    // Avrupa Yakası
    { id: "İHL", label: "İstanbul Havalimanı (İHL)", side: "Avrupa", keywords: ["İHL", "IHL", "IST", "İST", "ISL", "İSL", "İGA", "IGA", "İSTANBUL HAVALİMANI", "YENİ HAVALİMANI"] },
    { id: "ARNAVUTKÖY", label: "Arnavutköy", side: "Avrupa", keywords: ["ARNAVUTKÖY"] },
    { id: "AVCILAR", label: "Avcılar", side: "Avrupa", keywords: ["AVCILAR"] },
    { id: "BAĞCILAR", label: "Bağcılar", side: "Avrupa", keywords: ["BAĞCILAR", "GÜNEŞLİ"] },
    { id: "BAHÇELİEVLER", label: "Bahçelievler", side: "Avrupa", keywords: ["BAHÇELİEVLER", "YENİBOSNA", "ŞİRİNEVLER"] },
    { id: "BAKIRKÖY", label: "Bakırköy", side: "Avrupa", keywords: ["BAKIRKÖY", "YEŞİLKÖY", "ATAKÖY", "FLORYA"] },
    { id: "BAŞAKŞEHİR", label: "Başakşehir", side: "Avrupa", keywords: ["BAŞAKŞEHİR", "KAYAŞEHİR"] },
    { id: "BAYRAMPAŞA", label: "Bayrampaşa", side: "Avrupa", keywords: ["BAYRAMPAŞA"] },
    { id: "BEŞİKTAŞ", label: "Beşiktaş", side: "Avrupa", keywords: ["BEŞİKTAŞ", "ORTAKÖY", "LEVENT", "ETİLER", "BEBEK"] },
    { id: "BEYLİKDÜZÜ", label: "Beylikdüzü", side: "Avrupa", keywords: ["BEYLİKDÜZÜ"] },
    { id: "BEYOĞLU", label: "Beyoğlu / Taksim", side: "Avrupa", keywords: ["BEYOĞLU", "TAKSİM", "GALATA", "KARAKÖY"] },
    { id: "BÜYÜKÇEKMECE", label: "Büyükçekmece", side: "Avrupa", keywords: ["BÜYÜKÇEKMECE"] },
    { id: "ESENLER", label: "Esenler", side: "Avrupa", keywords: ["ESENLER"] },
    { id: "ESENYURT", label: "Esanyurt", side: "Avrupa", keywords: ["ESENYURT"] },
    { id: "EYÜPSULTAN", label: "Eyüpsultan", side: "Avrupa", keywords: ["EYÜP", "GÖKTÜRK", "KEMERBURGAZ"] },
    { id: "FATİH", label: "Fatih / Aksaray", side: "Avrupa", keywords: ["FATİH", "AKSARAY", "KUMKAPI", "SULTANAHMET"] },
    { id: "GAZİOSMANPAŞA", label: "Gaziosmanpaşa", side: "Avrupa", keywords: ["GAZİOSMANPAŞA"] },
    { id: "GÜNGÖREN", label: "Güngören", side: "Avrupa", keywords: ["GÜNGÖREN"] },
    { id: "KAĞITHANE", label: "Kağıthane", side: "Avrupa", keywords: ["KAĞITHANE"] },
    { id: "KÜÇÜKÇEKMECE", label: "Küçükçekmece", side: "Avrupa", keywords: ["KÜÇÜKÇEKMECE", "HALKALI", "SEFAKÖY"] },
    { id: "SARIYER", label: "Sarıyer", side: "Avrupa", keywords: ["SARIYER", "MASLAK", "TARABYA", "İSTİNYE"] },
    { id: "SULTANGAZİ", label: "Sultangazi", side: "Avrupa", keywords: ["SULTANGAZİ"] },
    { id: "ŞİŞLİ", label: "Şişli", side: "Avrupa", keywords: ["ŞİŞLİ", "NİŞANTAŞI", "MECİDİYEKÖY"] },
    { id: "ZEYTİNBURNU", label: "Zeytinburnu", side: "Avrupa", keywords: ["ZEYTİNBURNU"] },

    // Anadolu Yakası
    { id: "SAW", label: "Sabiha Gökçen (SAW)", side: "Anadolu", keywords: ["SAW", "SABİHA"] },
    { id: "ATAŞEHİR", label: "Ataşehir", side: "Anadolu", keywords: ["ATAŞEHİR"] },
    { id: "BEYKOZ", label: "Beykoz", side: "Anadolu", keywords: ["BEYKOZ", "KAVACIK"] },
    { id: "ÇEKMEKÖY", label: "Çekmeköy", side: "Anadolu", keywords: ["ÇEKMEKÖY"] },
    { id: "KADIKÖY", label: "Kadıköy", side: "Anadolu", keywords: ["KADIKÖY", "GÖZTEPE", "BOSTANCI", "MODA"] },
    { id: "KARTAL", label: "Kartal", side: "Anadolu", keywords: ["KARTAL"] },
    { id: "MALTEPE", label: "Maltepe", side: "Anadolu", keywords: ["MALTEPE"] },
    { id: "PENDİK", label: "Pendik", side: "Anadolu", keywords: ["PENDİK"] },
    { id: "SANCAKTEPE", label: "Sancaktepe", side: "Anadolu", keywords: ["SANCAKTEPE"] },
    { id: "SULTANBEYLİ", label: "Sultanbeyli", side: "Anadolu", keywords: ["SULTANBEYLİ"] },
    { id: "TUZLA", label: "Tuzla", side: "Anadolu", keywords: ["TUZLA"] },
    { id: "ÜMRANİYE", label: "Ümraniye", side: "Anadolu", keywords: ["ÜMRANİYE"] },
    { id: "ÜSKÜDAR", label: "Üsküdar", side: "Anadolu", keywords: ["ÜSKÜDAR", "ÇENGELKÖY", "BEYLERBEYİ"] },
];

function normalize(str: string): string {
    if (!str) return "";
    return str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/g/g, 'g')
        .replace(/u/g, 'u')
        .replace(/s/g, 's')
        .replace(/o/g, 'o')
        .replace(/c/g, 'c');
}

export async function runJobAutomation(jobId: number) {
    const db = await getDatabase();

    // 1. Get Job
    const job = await db.get('SELECT * FROM captured_jobs WHERE id = ?', [jobId]);
    if (!job) return;

    // 2. Get All Users with Auto Mode
    const autoDrivers = await db.all(`
        SELECT df.*, u.id as user_id 
        FROM driver_filters df
        JOIN users u ON df.user_id = u.id
        WHERE df.action_mode = 'auto'
    `);

    if (autoDrivers.length === 0) return;

    const jobPrice = parseInt(job.price?.toString().replace(/\D/g, '')) || 0;
    const jobContent = normalize((job.from_loc || '') + (job.to_loc || '') + (job.raw_message || '') + (job.time || ''));

    for (const driver of autoDrivers) {
        try {
            // -- FILTER CHECK --

            // 1. Min Price
            if (driver.min_price > 0 && jobPrice < driver.min_price) continue;

            // 2. Job Mode (Ready/Scheduled)
            if (driver.job_mode === 'ready' && !job.time?.includes('HAZIR')) continue;
            if (driver.job_mode === 'scheduled' && (job.time?.includes('HAZIR') || job.time === 'Belirtilmedi')) continue;

            // 3. Sprinter Filter
            if (driver.filter_sprinter) {
                const sprinterKeywords = ['SPRINTER', '10+', '13+', '16+', '10LUK', '13LUK', '16LIK', '10 LUK', '13 LUK', '16 LIK', '10 VE UZERI', '13 VE UZERI', '16 VE UZERI', 'BUYUK ARAC', 'MINIBUS'];
                if (!sprinterKeywords.some(kw => jobContent.includes(normalize(kw)))) continue;
            }

            // 4. Swap Filter
            if (driver.filter_swap && job.is_swap !== 1) continue;

            // 5. From Region Match
            const selectedRegions = driver.regions ? JSON.parse(driver.regions) : [];
            if (selectedRegions.length > 0) {
                const normalizedFrom = normalize(job.from_loc || '');
                const normalizedRaw = normalize(job.raw_message || '');
                const hasFromMatch = selectedRegions.some((regId: string) => {
                    const reg = ISTANBUL_REGIONS.find(r => r.id === regId);
                    if (!reg) return false;
                    return reg.keywords.some(key => {
                        const normalizedKey = normalize(key);
                        if (job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS') return normalizedRaw.includes(normalizedKey);
                        return normalizedFrom.includes(normalizedKey);
                    });
                });
                if (!hasFromMatch) continue;
            }

            // 6. To Region Match
            const selectedToRegions = driver.to_regions ? JSON.parse(driver.to_regions) : [];
            if (selectedToRegions.length > 0) {
                const normalizedTo = normalize(job.to_loc || '');
                const normalizedRaw = normalize(job.raw_message || '');
                const hasToMatch = selectedToRegions.some((regId: string) => {
                    const reg = ISTANBUL_REGIONS.find(r => r.id === regId);
                    if (!reg) return false;
                    return reg.keywords.some(key => {
                        const normalizedKey = normalize(key);
                        if (job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS') return normalizedRaw.includes(normalizedKey);
                        return normalizedTo.includes(normalizedKey);
                    });
                });
                if (!hasToMatch) continue;
            }

            // -- ALL FILTERS PASSED! --
            console.log(`[Automation] Job ${jobId} matches driver ${driver.user_id}. Automatically taking...`);

            // Check if already taken (by this user or others)
            const alreadyInteracted = await db.get('SELECT id FROM job_interactions WHERE job_id = ?', [jobId]);
            if (alreadyInteracted) {
                console.log(`[Automation] Job ${jobId} already taken by someone else. Skipping user ${driver.user_id}.`);
                continue;
            }

            await processJobTaking(driver.user_id, jobId);
            console.log(`[Automation] ✅ Successfully took job ${jobId} for user ${driver.user_id}`);

            // If one driver took it, we should probably stop for this job to avoid spamming the same customer
            break;

        } catch (err: any) {
            console.error(`[Automation] Error for driver ${driver.user_id}:`, err.message);
        }
    }
}
