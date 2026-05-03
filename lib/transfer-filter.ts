type TransferJobLike = {
    from_loc?: string | null;
    to_loc?: string | null;
    raw_message?: string | null;
    is_swap?: number | boolean | null;
};

const normalize = (value: string) => value
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .toUpperCase();

const unknownValues = new Set([
    '',
    '?',
    'BILINMIYOR',
    'BILINMEYEN KONUM',
    'BELIRTILMEDI',
    'BOLGE',
]);

const airportKeywords = [
    'SAW',
    'SABIHA',
    'SABIHA GOKCEN',
    'IHL',
    'IST',
    'ISL',
    'IGA',
    'ISTANBUL HAVALIMANI',
    'YENI HAVALIMANI',
    'HAVALIMANI',
    'AIRPORT',
];

const employmentKeywords = [
    'CALISACAK',
    'CALISMAK',
    'ELEMAN',
    'PERSONEL',
    'SOFOR ARANIYOR',
    'SOFOR ALINACAK',
    'ARANIYOR',
    'ISE ALIM',
    'IS ILANI',
    'MAAS',
    'SGK',
    'SRC',
    'PSIKOTEKNIK',
    'CV',
];

const isUnknownLocation = (value?: string | null) => unknownValues.has(normalize((value || '').trim()));
const includesAny = (value: string, keywords: string[]) => keywords.some(keyword => value.includes(keyword));
const isAirportLocation = (value?: string | null) => includesAny(normalize(value || ''), airportKeywords);
const hasTransferIntent = (value: string) =>
    includesAny(value, ['TRANSFER', 'YOLCU', 'MISAFIR', 'PAX', 'UCUS', 'FLIGHT', 'KARSILAMA', 'ALINACAK', 'BIRAKILACAK', 'HAZIR']);

export function isTransferJob(job: TransferJobLike) {
    const from = normalize((job.from_loc || '').trim());
    const to = normalize((job.to_loc || '').trim());
    const raw = normalize(job.raw_message || '');

    if (includesAny(raw, employmentKeywords)) return false;
    if (from === to) return false;
    if (from === 'COKLU / TAKAS' || Boolean(job.is_swap)) return false;

    const fromIsUnknown = isUnknownLocation(from);
    const toIsUnknown = isUnknownLocation(to);
    const hasAirport = isAirportLocation(from) || isAirportLocation(to) || includesAny(raw, airportKeywords);
    if (!hasAirport) return false;

    if (isAirportLocation(from) && isAirportLocation(to)) return false;
    if (fromIsUnknown && toIsUnknown) return false;
    if ((fromIsUnknown || toIsUnknown) && !hasTransferIntent(raw)) return false;

    return true;
}
