
/**
 * Gemini AI Helper for Shared Usage
 */
export async function tryGemini(prompt: string, apiKey: string) {
    if (!apiKey) return null;

    const endpoints = [
        { v: 'v1beta', m: 'gemini-2.0-flash' },
        { v: 'v1beta', m: 'gemini-flash-latest' },
        { v: 'v1', m: 'gemini-1.5-flash-latest' }
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/${endpoint.v}/models/${endpoint.m}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            } else {
                const errData = await response.json();
                lastError = errData.error?.message;
            }
        } catch (e: any) {
            lastError = e.message;
        }
    }
    console.error('[AI] All Gemini endpoints failed:', lastError);
    return null;
}
