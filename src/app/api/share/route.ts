import { NextResponse } from 'next/server';

export async function POST(req: Request) {
   try {
      const { message, webhookUrl } = await req.json();
      
      // MOCK BEHAVIOR: Webhook URLがなくても成功扱いとする（コンソールに出力）
      if (!webhookUrl || webhookUrl.trim() === '') {
         console.log("Team Share (Mock Triggered):", message);
         return NextResponse.json({ success: true, mock: true, note: 'Webhook URLが未設定のためモックとして成功しました' });
      }

      const res = await fetch(webhookUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: message })
      });

      if (!res.ok) {
         throw new Error(`External webhook failed with status ${res.status}`);
      }

      return NextResponse.json({ success: true });
   } catch(e: any) {
      console.error("Share Error:", e);
      return NextResponse.json({ error: e.message }, { status: 500 });
   }
}
