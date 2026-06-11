import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { saveSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

// Tarayıcı push aboneliğini kaydet
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { subscription, userAgent } = await request.json();
        if (!subscription) {
            return NextResponse.json({ error: "subscription gerekli" }, { status: 400 });
        }

        await saveSubscription(user.userId, subscription, userAgent);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
