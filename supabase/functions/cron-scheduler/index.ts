/**
 * IGNITE Cron Scheduler
 *
 * Óránként fut (pg_cron → pg_net, lásd supabase/migrations). Megnézi, kinek
 * esedékes reggeli/délutáni/esti értesítés Budapest idő szerint, és meghívja
 * a send-push-t. A délutáni és esti emlékeztető csak annak megy, aki a mai
 * (04:00-s határral számolt) napot még nem rögzítette.
 *
 * Hitelesítés: `x-cron-secret` fejléc, amit a `verify_cron_secret` RPC
 * ellenőriz a Vaultban tárolt értékkel szemben.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TIME_ZONE = 'Europe/Budapest';
const CUTOFF_HOUR = 4;

type Slot = 'morning' | 'afternoon' | 'evening';

// Szöveges sablonok
const TEMPLATES: Record<Slot, { title: string; body: string }[]> = {
  morning: [
    { title: 'Ave, Imperator! 🌅', body: 'Róma sem egy nap alatt épült. Ideje lerakni a mai téglát.' },
    { title: 'Wakey wakey! ⚡', body: 'Main character energy only today. Mutasd meg, mit tudsz!' },
    { title: 'Rise and Grind 💪', body: "Ne hagyd, hogy az ágyad nyerjen. Let's get this bread!" },
    { title: 'Napindító 🔥', body: 'A céljaid várnak. Kezdjük a napot egy győzelemmel!' },
  ],
  evening: [
    { title: 'A nap lenyugodott 🌙', body: 'A csata véget ért. Itt az ideje az elszámolásnak.' },
    { title: 'Marcus Aurelius üzeni... 📜', body: '...hogy vizsgáld meg a napodat. Rögzíts mindent őszintén!' },
    { title: 'Last call! ⏳', body: 'Zárjuk a napot, no cap. Ne vidd át a holnapi to-do listára.' },
    { title: 'Esti emlékeztető 📝', body: 'Ne feküdj le anélkül, hogy értékelted volna a mai teljesítményedet.' },
  ],
  afternoon: [
    { title: 'Tarts ki! 🛡️', body: 'Hannibál sem állt meg az Alpok felénél. Te se tedd!' },
    { title: 'Délutáni slump? 😴', body: 'Nah fam. Igyál egy vizet és told tovább! No cap.' },
    { title: 'Fókusz! 🎯', body: 'Ne hagyd, hogy a figyelemelterelés győzzön. Maradj a pályán!' },
  ],
};

const pick = (slot: Slot) => TEMPLATES[slot][Math.floor(Math.random() * TEMPLATES[slot].length)];

/** Budapesti dátum- és időrészek egy adott pillanatra */
function budapestParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

Deno.serve(async (req) => {
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const secret = req.headers.get('x-cron-secret') || '';
  const { data: ok } = await admin.rpc('verify_cron_secret', { secret });
  if (!ok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const now = new Date();
    const { hour } = budapestParts(now);
    const timeString = `${String(hour).padStart(2, '0')}:00`;
    // Napló-nap a 04:00-s határral
    const effectiveDate = budapestParts(new Date(now.getTime() - CUTOFF_HOUR * 3600_000)).date;

    const usersFor = async (slot: Slot) => {
      const { data } = await admin
        .from('settings')
        .select('user_id')
        .eq('notifications->>enabled', true)
        .eq(`notifications->>${slot}Time`, timeString)
        .eq(`notifications->>${slot}Enabled`, true);
      return (data ?? []).map((r) => r.user_id as string);
    };

    const [morning, afternoon, evening] = await Promise.all([
      usersFor('morning'),
      usersFor('afternoon'),
      usersFor('evening'),
    ]);

    // Akik ma már rögzítettek, azoknak nem kell emlékeztető
    const reminderCandidates = [...afternoon, ...evening];
    let alreadyLogged = new Set<string>();
    if (reminderCandidates.length > 0) {
      const { data } = await admin
        .from('entries')
        .select('user_id')
        .eq('date', effectiveDate)
        .in('user_id', reminderCandidates);
      alreadyLogged = new Set((data ?? []).map((r) => r.user_id as string));
    }

    const jobs: { userId: string; slot: Slot }[] = [
      ...morning.map((userId) => ({ userId, slot: 'morning' as const })),
      ...afternoon.filter((u) => !alreadyLogged.has(u)).map((userId) => ({ userId, slot: 'afternoon' as const })),
      ...evening.filter((u) => !alreadyLogged.has(u)).map((userId) => ({ userId, slot: 'evening' as const })),
    ];

    const results = await Promise.allSettled(
      jobs.map(({ userId, slot }) => {
        const msg = pick(slot);
        return fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ recipientUserId: userId, title: msg.title, body: msg.body, data: { type: slot } }),
        });
      })
    );

    const failed = results.filter((r) => r.status === 'rejected' || !r.value.ok).length;
    console.log(`Cron ${timeString} (${effectiveDate}): ${jobs.length} queued, ${failed} failed`);

    return new Response(JSON.stringify({ success: true, processed: jobs.length, failed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cron error:', (error as Error).message);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
