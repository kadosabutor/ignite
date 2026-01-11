/**
 * IGNITE Cron Scheduler
 * * Ez a funkció időzítve fut (pl. óránként).
 * Ellenőrzi, hogy kinek esedékes (reggeli/esti) értesítés, és meghívja a send-push-t.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase config
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Szöveges sablonok (Szerver oldali másolat a változatosságért)
const TEMPLATES = {
  morning: [
    { title: "Ave, Imperator! 🌅", body: "Róma sem egy nap alatt épült. Ideje lerakni a mai téglát." },
    { title: "Wakey wakey! ⚡", body: "Main character energy only today. Mutasd meg, mit tudsz!" },
    { title: "Rise and Grind 💪", body: "Ne hagyd, hogy az ágyad nyerjen. Let's get this bread!" },
    { title: "Napindító 🔥", body: "A céljaid várnak. Kezdjük a napot egy győzelemmel!" },
  ],
  evening: [
    { title: "A nap lenyugodott 🌙", body: "A csata véget ért. Itt az ideje az elszámolásnak." },
    { title: "Marcus Aurelius üzeni... 📜", body: "...hogy vizsgáld meg a napodat. Rögzíts mindent őszintén!" },
    { title: "Last call! ⏳", body: "Zárjuk a napot, no cap. Ne vidd át a holnapi to-do listára." },
    { title: "Esti emlékeztető 📝", body: "Ne feküdj le anélkül, hogy értékelted volna a mai teljesítményedet." },
  ],
  afternoon: [
    { title: "Tarts ki! 🛡️", body: "Hannibál sem állt meg az Alpok felénél. Te se tedd!" },
    { title: "Délutáni slump? 😴", body: "Nah fam. Igyál egy vizet és told tovább! No cap." },
    { title: "Fókusz! 🎯", body: "Ne hagyd, hogy a figyelemelterelés győzzön. Maradj a pályán!" },
  ]
};

function getRandomMessage(type: 'morning' | 'evening' | 'afternoon') {
  const list = TEMPLATES[type] || TEMPLATES.morning;
  return list[Math.floor(Math.random() * list.length)];
}

serve(async (req) => {
  try {
    // 1. Idő meghatározása (Budapest időzóna: UTC+1 télen, UTC+2 nyáron)
    // Egyszerűsítés: Most feltételezzük, hogy a szerver UTC-ben van, és +1 órát adunk hozzá
    const now = new Date();
    const currentHour = now.getUTCHours(); 
    const localHour = (currentHour + 1) % 24;
    
    // Formátum: "07:00" (mindig két számjegy)
    const timeString = `${String(localHour).padStart(2, '0')}:00`;
    
    console.log(`🕒 Cron running. UTC: ${currentHour}:00, Target Local Time: ${timeString}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Kinek kell most küldeni?
    // Megkeressük azokat a felhasználókat, akiknek a beállított ideje egyezik a mostanival
    // ÉS engedélyezve van az adott típus.
    
    const { data: morningUsers } = await supabase
      .from('settings')
      .select('user_id')
      .eq('notifications->>morningTime', timeString)
      .eq('notifications->>morningEnabled', true);

    const { data: eveningUsers } = await supabase
      .from('settings')
      .select('user_id')
      .eq('notifications->>eveningTime', timeString)
      .eq('notifications->>eveningEnabled', true);

    const { data: afternoonUsers } = await supabase
      .from('settings')
      .select('user_id')
      .eq('notifications->>afternoonTime', timeString)
      .eq('notifications->>afternoonEnabled', true);

    const tasks = [];

    // Segédfüggvény a küldéshez
    const schedulePush = async (userId: string, type: 'morning' | 'evening' | 'afternoon') => {
      const msg = getRandomMessage(type);
      
      console.log(`📤 Scheduling ${type} push for user ${userId}`);
      
      return fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          recipientUserId: userId,
          title: msg.title,
          body: msg.body,
          data: { type: type }
        }),
      });
    };

    // 3. Feladatok összegyűjtése
    if (morningUsers) morningUsers.forEach(u => tasks.push(schedulePush(u.user_id, 'morning')));
    if (eveningUsers) eveningUsers.forEach(u => tasks.push(schedulePush(u.user_id, 'evening')));
    if (afternoonUsers) afternoonUsers.forEach(u => tasks.push(schedulePush(u.user_id, 'afternoon')));

    // 4. Minden kiküldése egyszerre
    if (tasks.length > 0) {
      await Promise.all(tasks);
      console.log(`✅ Sent ${tasks.length} scheduled notifications.`);
    } else {
      console.log('zzZ No notifications scheduled for this hour.');
    }

    return new Response(JSON.stringify({ success: true, processed: tasks.length }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🔥 Cron error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
