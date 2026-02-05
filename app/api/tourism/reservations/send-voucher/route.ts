import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { sendMessage } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { reservationId, target } = await request.json(); // target: 'driver' or 'customer'
        const db = await getDatabase();

        const res = await db.get(`
            SELECT r.*, c.name as customer_name, c.phone_number as customer_phone 
            FROM reservations r
            LEFT JOIN customers c ON r.customer_id = c.id
            WHERE r.id = ? AND r.user_id = ?
        `, [reservationId, user.userId]);

        if (!res) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

        const passengerNames = JSON.parse(res.passenger_names || '[]');
        const phone = target === 'driver' ? res.driver_phone : res.customer_phone;

        if (!phone) return NextResponse.json({ error: 'Phone number missing' }, { status: 400 });

        // Map Links
        const googleBase = 'https://www.google.com/maps/search/?api=1&query=';
        const yandexBase = 'https://yandex.com/maps/?text=';

        const pickupUrlG = googleBase + encodeURIComponent(res.pickup_location);
        const dropoffUrlG = googleBase + encodeURIComponent(res.dropoff_location);
        const pickupUrlY = yandexBase + encodeURIComponent(res.pickup_location);
        const dropoffUrlY = yandexBase + encodeURIComponent(res.dropoff_location);

        const message = `*${target === 'driver' ? 'Sürücü Voucherı' : 'Müşteri Voucherı'}*
*Voucher No:* ${res.voucher_number}

*Transfer Bilgileri*
📅 Tarih: ${res.date.split('-').reverse().join('/')}
🕒 Saat: ${res.time}

📍 *Nereden:*
${res.pickup_location}
🚘 Git: ${pickupUrlG}
🧭 Yandex: ${pickupUrlY}

🏁 *Nereye:*
${res.dropoff_location}
🚘 Git: ${dropoffUrlG}
🧭 Yandex: ${dropoffUrlY}

*Uçuş Bilgileri*
✈️ Uçuş Kodu: ${res.flight_code || '---'}

*Yolcu Bilgileri*
👥 Yolcu Sayısı: ${res.passenger_count} Kişi
🎒 Bagaj: ${res.notes?.includes('bagaj') ? res.notes : 'Standart'}
👤 Yolcular: ${passengerNames.join(', ') || res.customer_name}

*İletişim:*
📞 ${res.customer_phone}

${target === 'driver' ? `*Hakediş Bilgisi:* ${res.price / 2} ${res.currency}` : `*Ödenecek Tutar:* ${res.price} ${res.currency}`}

Hayırlı işler dileriz.`;

        const success = await sendMessage(user.userId, phone, message);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'WhatsApp message failed' }, { status: 500 });
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
