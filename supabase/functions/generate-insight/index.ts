/**
 * IGNITE AI összehasonlító elemzés (VS mód)
 *
 * Csak bejelentkezett felhasználó hívhatja (verify_jwt + getUser).
 * Szükséges secret: OPENAI_API_KEY
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Személyiségek (A "Hangulat")
const PERSONALITIES = [
  {
    id: 'drill_sergeant',
    role: 'Kiképzőőrmester',
    instruction: 'Légy kíméletlen, hangos (használj néha CAPS LOCK-ot), használj katonai szlenget. Ne tűrd a kifogásokat. A gyengeség undorít. A dicséret ritka, de megérdemelt.',
  },
  {
    id: 'stoic',
    role: 'Sztoikus Filozófus',
    instruction: 'Légy mély, megfontolt, nyugodt. Idézz (vagy találj ki) Marcus Aurelius / Seneca stílusú bölcsességeket a fegyelemről és a kísértésről. Az érzelemmentes fejlődés a cél.',
  },
  {
    id: 'hype_man',
    role: 'Modern Hype Man (Gen Z)',
    instruction: 'Használj modern szlenget (no cap, fr, based, L, W, diff). Légy nagyon energikus, emojikkal teli. Ha valaki nyer, emeld az egekbe, ha veszít, "roast"-old meg viccesen.',
  },
  {
    id: 'analyst',
    role: 'Hideg Adatelemző',
    instruction: 'Légy sebészi pontosságú, érzelemmentes, távolságtartó. Csak a számok számítanak. A hatékonyság a mérce. Használj tudományos kifejezéseket.',
  },
  {
    id: 'savage',
    role: 'Brutálisan Őszinte Barát',
    instruction: 'Ne finomkodj. Mondd ki azt, amit mindenki gondol, de nem mer mondani. Használj szarkazmust és iróniát.',
  },
];

// Napi Témák (vasárnap = 0)
const THEMES = [
  'Sunday Reset (Reflexió és Tervezés)',
  'The Grind (Produktivitás Fókusz)',
  'Tactical Tuesday (Stratégia)',
  'Discipline Check (Tisztaság/Fegyelem)',
  'Thunder Thursday (Energia)',
  'Iron Body (Edzés & Egészség)',
  'Wildcard (Bármi)',
];

const clean = (s: unknown, max = 40) => String(s ?? '').replace(/[\r\n`$]/g, ' ').slice(0, max);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return json({ error: 'Az AI elemzés jelenleg nem elérhető.' });
    }

    const { userStats, friendStats, userHighlights, friendHighlights, userName, friendName, date } = await req.json();

    const dayIndex = new Date(date || Date.now()).getDay();
    const theme = THEMES[Number.isNaN(dayIndex) ? 6 : dayIndex];
    const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
    const uName = clean(userName);
    const fName = clean(friendName);
    const uHighlights = Array.isArray(userHighlights) ? userHighlights.slice(0, 6).map((h) => clean(h, 160)) : [];
    const fHighlights = Array.isArray(friendHighlights) ? friendHighlights.slice(0, 6).map((h) => clean(h, 160)) : [];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
              Te vagy az IGNITE app mesterséges intelligenciája.

              SZEREPLŐK:
              1. ${uName} (User) - Hozzá beszélsz.
              2. ${fName} (Friend) - Vele hasonlítod össze.

              JELENLEGI PERSONA: ${personality.role}
              UTASÍTÁS: ${personality.instruction}

              MAI FÓKUSZ TÉMA: ${theme}
              (Ez azt jelenti, hogy az elemzésed fő hangsúlya ezen a területen legyen, de azért érintsd a többit is.)

              ADATOK JELENTÉSE:
              - satisfactionRate: Kielégülés (NoFap megszegése). Minél kisebb, annál jobb (Tiszta).
              - dopamineRate: TikTok/Social média pörgetés. Minél kisebb, annál jobb.
              - gamingRate: Videojáték. Minél kisebb, annál jobb.
              - businessTotal: Munka percek. Minél több, annál jobb.
              - exerciseRate: Edzés gyakorisága. Minél több, annál jobb.
              - sleepAvg: Alvás átlag. 420-540 perc az ideális.

              ANOMÁLIÁK (Ezeket említsd meg!):
              User: ${JSON.stringify(uHighlights)}
              Friend: ${JSON.stringify(fHighlights)}

              KÖTELEZŐ KIMENETI FORMÁTUM (JSON):
              {
                "title": "Kreatív cím a persona stílusában",
                "winnerId": "user" | "friend" | "draw",
                "verdict_short": "Egyetlen, ütős mondat, ami összefoglalja a helyzetet.",
                "daily_mission": "Egy konkrét, cselekvésre ösztönző feladat mára a User számára, ami a hibáiból következik.",
                "sections": [
                  { "type": "productivity", "title": "Munka Frontja", "text": "Szöveges elemzés a persona stílusában. Hasonlítsd össze a business perceket.", "scoreUser": 0-100, "scoreFriend": 0-100 },
                  { "type": "discipline", "title": "Fegyelem & Akaraterő", "text": "Szöveges elemzés a persona stílusában. Fókusz: satisfaction, dopamine, gaming.", "scoreUser": 0-100, "scoreFriend": 0-100 },
                  { "type": "health", "title": "Test & Vitalitás", "text": "Szöveges elemzés a persona stílusában. Fókusz: sleep, exercise, clean eating.", "scoreUser": 0-100, "scoreFriend": 0-100 }
                ],
                "key_stats": [
                  { "label": "Pl. Munkaidő", "diff": "Pl. +2 óra", "advantage": "user" | "friend" | "draw" },
                  { "label": "Pl. Tisztaság", "diff": "Pl. Döntetlen", "advantage": "draw" }
                ]
              }
            `,
          },
          {
            role: 'user',
            content: `User Stats: ${JSON.stringify(userStats ?? {})}\nFriend Stats: ${JSON.stringify(friendStats ?? {})}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI Error:', data.error);
      return json({ error: 'Az AI szolgáltatás hibát adott.' });
    }

    return json(JSON.parse(data.choices[0].message.content));
  } catch (error) {
    console.error('generate-insight error:', (error as Error).message);
    // 200-zal tér vissza, a frontend az `error` mezőt kezeli
    return json({ error: 'Szerver hiba' });
  }
});
