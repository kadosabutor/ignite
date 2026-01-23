import { supabase } from './supabase';
import type { HabitEntry } from '../types';

// Bemeneti típusok
interface InsightInput {
  userEntries: HabitEntry[];
  friendEntries: HabitEntry[];
  userName: string;
  friendName: string;
}

// Kimeneti típus
export interface InsightResult {
  title: string;
  analysis: string;
  verdict: string;
  winner: 'user' | 'friend' | 'draw';
}

// Segédfüggvény: Adatok összegzése
const aggregateStats = (entries: HabitEntry[]) => {
  const count = entries.length || 1;
  
  if (count === 0) {
    return {
      daysCount: 0,
      scoreAvg: 0,
      businessTotal: 0,
      sleepAvg: 0,
      exerciseRate: 0,
      cleanEatingRate: 0,
      paradigmRate: 0,
      satisfactionRate: 0,
      dopamineRate: 0,
      gamingRate: 0,
    };
  }

  return {
    daysCount: count,
    scoreAvg: Math.round(entries.reduce((sum, e) => sum + (e.score || 0), 0) / count),
    businessTotal: entries.reduce((sum, e) => sum + (e.businessMinutes || 0), 0),
    sleepAvg: Math.round(entries.reduce((sum, e) => sum + (e.sleepMinutes || 0), 0) / count),
    exerciseRate: Math.round((entries.filter(e => e.exercise).length / count) * 100),
    cleanEatingRate: Math.round((entries.filter(e => e.cleanEating).length / count) * 100),
    paradigmRate: Math.round((entries.filter(e => e.paradigm).length / count) * 100),
    satisfactionRate: Math.round((entries.filter(e => e.satisfaction).length / count) * 100),
    dopamineRate: Math.round((entries.filter(e => e.dopamineContent).length / count) * 100),
    gamingRate: Math.round((entries.filter(e => e.gaming).length / count) * 100),
  };
};

export async function generateInsight({ userEntries, friendEntries, userName, friendName }: InsightInput): Promise<InsightResult> {
  // 1. Ellenőrzés
  if (!userEntries?.length || !friendEntries?.length) {
    return {
      title: 'Nincs elég adat',
      analysis: 'Még nincs elég közös adatotok egy komoly elemzéshez.',
      verdict: 'Rögzítsetek több napot!',
      winner: 'draw'
    };
  }

  const userStats = aggregateStats(userEntries);
  const friendStats = aggregateStats(friendEntries);

  try {
    console.log("📡 Elemzés kérése a szervertől...");
    
    // 2. Edge Function hívása
    const { data, error } = await supabase.functions.invoke('generate-insight', {
      body: {
        userStats,
        friendStats,
        userName,
        friendName
      }
    });

    // Ha a Supabase kliens dob hibát (pl. hálózati hiba, vagy non-2xx válasz)
    if (error) {
      // Megpróbáljuk kinyerni a részletes üzenetet, ha a szerver JSON-t küldött vissza 500-as kód mellett is
      let detailedMessage = error.message;
      try {
        // Néha a hiba body-ja tartalmazza a mi szerver oldali hibaüzenetünket
        if (error.context && error.context.json) {
            const body = await error.context.json();
            if (body.error) detailedMessage = body.error;
        }
      } catch (e) { /* ignore */ }

      console.error('Supabase Invoke Error:', detailedMessage);
      throw new Error(detailedMessage);
    }

    // Ha a válaszban van 'error' mező (a mi szerver kódunk küldte)
    if (data && data.error) {
      throw new Error(data.error);
    }

    // 3. Siker
    return {
      title: data.title || 'Elemzés',
      analysis: data.analysis || 'Nem sikerült elemezni az adatokat.',
      verdict: data.verdict || 'Nincs konklúzió.',
      winner: data.winner || 'draw'
    };

  } catch (err: any) {
    console.error('Insight generation failed details:', err);
    
    // Itt állítjuk össze a felhasználónak megjelenő hibaüzenetet
    return {
      title: 'Hiba történt ⚠️',
      analysis: `Technikai részletek: ${err.message || 'Ismeretlen hiba'}. Ellenőrizd az API kulcsot és a logokat.`,
      verdict: 'Kérlek próbáld újra később.',
      winner: 'draw'
    };
  }
}
