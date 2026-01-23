import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS kezelés (hogy a React app tudjon hívni minket)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userStats, friendStats, userName, friendName } = await req.json()

    // Itt olvassuk ki a Dashboardon beállított titkos kulcsot
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!apiKey) {
      throw new Error('Hiányzik az OpenAI API kulcs a Secrets beállításokból!')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: [
          {
            role: 'system',
            content: `
              Te vagy az IGNITE app mesterséges intelligenciája.
              Feladat: Két felhasználó szokásainak összehasonlítása és elemzése.
              Stílus: Tömör, lényegretörő, motiváló, de néha enyhén csipkelődő ("roast"), ha valaki lusta.
              Nyelv: Magyar (modern, fiatalos szlenggel).
              
              Bemenő adatok értelmezése:
              - score: Összpontszám (max 100)
              - businessMinutes: Produktív munka percekben
              - sleepMinutes: Alvás percekben
              - exercise/cleanEating/paradigm: Jó szokások (true = megcsinálta)
              - satisfaction/dopamine/gaming: Rossz szokások (true = bűnbeesés)

              A válaszod JSON formátumú legyen, a következő szerkezettel:
              {
                "title": "Egy rövid, ütős cím az elemzésnek (pl. 'A Szorgos és a Henyélő')",
                "analysis": "Egy összefüggő, kb. 3-4 mondatos elemzés. Hasonlítsd össze a teljesítményüket, emeld ki a legnagyobb különbséget (pl. 'Míg Dani 8 órát dolgozott, te csak görgettél'). Használj százalékos becsléseket is a különbségekre.",
                "verdict": "Egy végső, egymondatos konklúzió vagy tanács.",
                "winner": "user" vagy "friend" vagy "draw" (döntetlen)
              }
            `
          },
          {
            role: 'user',
            content: `
              Felhasználó (User): ${userName}, Adatok: ${JSON.stringify(userStats)}
              Barát (Friend): ${friendName}, Adatok: ${JSON.stringify(friendStats)}
            `
          }
        ],
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    
    if (data.error) {
        throw new Error(data.error.message)
    }

    // Az AI válasza szöveges JSON, ezt vissza kell alakítanunk objektummá
    const aiContent = data.choices[0].message.content
    
    // Megpróbáljuk kinyerni a JSON-t (néha az AI tesz köré markdown-t)
    const jsonString = aiContent.replace(/```json\n|\n```/g, '').trim()
    const parsedContent = JSON.parse(jsonString)

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('AI Error:', error)
    return new Response(JSON.stringify({ 
      title: "Hiba történt", 
      analysis: "Sajnos nem sikerült elérni az agytrösztöt. Próbáld újra később!",
      verdict: error.message,
      winner: "draw"
    }), {
      status: 200, // Nem dobunk 500-at, hogy a frontend kezelni tudja
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
