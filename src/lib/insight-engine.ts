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
  analysis: string; // "factualText" helyett "analysis" az AI válaszához
  verdict: string;  // "tldrText" helyett "verdict"
  winner: 'user' | 'friend' | 'draw';
}

// Segédfüggvény: Adatok összegzése (hogy ne küldjünk túl sok adatot az AI-nak)
const aggregateStats = (entries: HabitEntry[]) => {
  const count = entries.length || 1;
  return {
    daysCount: count,
    scoreAvg: Math.round(entries.reduce((sum, e) => sum + e.score, 0) / count),
    businessTotal: entries.reduce((sum, e) => sum + e.businessMinutes, 0),
    sleepAvg: Math.round(entries.reduce((sum, e) => sum + e.sleepMinutes, 0) / count),
    // Százalékos arányok (hányszor csinálta meg az összes naphoz képest)
    exerciseRate: Math.round((entries.filter(e => e.exercise).length / count) * 100),
    cleanEatingRate: Math.round((entries.filter(e => e.cleanEating).length / count) * 100),
    paradigmRate: Math.round((entries.filter(e => e.paradigm).length / count) * 100),
    // Negatív szokások (True = Rossz)
    satisfactionRate: Math.round((entries.filter(e => e.satisfaction).length / count) * 100),
    dopamineRate: Math.round((entries.filter(e => e.dopamineContent).length / count) * 100),
    gamingRate: Math.round((entries.filter(e => e.gaming).length / count) * 100),
  };
};

/**
 * Ez a függvény hívja meg a Supabase Edge Function-t (OpenAI)
 */
export async function generateInsight({ userEntries, friendEntries, userName, friendName }: InsightInput): Promise<InsightResult> {
  // 1. Ha nincs elég adat, ne hívjuk az AI-t feleslegesen
  if (userEntries.length === 0 || friendEntries.length === 0) {
    return {
      title: 'Nincs elég adat',
      analysis: 'Még nincs elég közös adatotok egy komoly elemzéshez. Rögzítsetek több napot!',
      verdict: 'Térjetek vissza később!',
      winner: 'draw'
    };
  }

  // 2. Adatok tömörítése
  const userStats = aggregateStats(userEntries);
  const friendStats = aggregateStats(friendEntries);

  try {
    // 3. Edge Function hívása
    const { data, error } = await supabase.functions.invoke('generate-insight', {
      body: {
        userStats,
        friendStats,
        userName,
        friendName
      }
    });

    if (error) throw error;

    // 4. Visszatérés az AI eredményével
    return {
      title: data.title || 'Elemzés',
      analysis: data.analysis || 'Nem sikerült elemezni az adatokat.',
      verdict: data.verdict || 'Nincs konklúzió.',
      winner: data.winner || 'draw'
    };

  } catch (err) {
    console.error('Insight generation failed:', err);
    // Fallback hiba esetén
    return {
      title: 'Hiba az elemzésben',
      analysis: 'Az AI agya jelenleg túlterhelt vagy hálózati hiba történt.',
      verdict: 'Próbáld újra később.',
      winner: 'draw'
    };
  }
}
