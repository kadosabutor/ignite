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
  
  // Biztonsági ellenőrzés: ha nincs adat, nullákat adunk vissza
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
    // Százalékos arányok
    exerciseRate: Math.round((entries.filter(e => e.exercise).length / count) * 100),
    cleanEatingRate: Math.round((entries.filter(e => e.cleanEating).length / count) * 100),
    paradigmRate: Math.round((entries.filter(e => e.paradigm).length / count) * 100),
    // Negatív szokások
    satisfactionRate: Math.round((entries.filter(e => e.satisfaction).length / count) * 100),
    dopamineRate: Math.round((entries.filter(e => e.dopamineContent).length / count) * 100),
    gamingRate: Math.round((entries.filter(e => e.gaming).length / count) * 100),
  };
};

/**
 * Ez a függvény hívja meg a Supabase Edge Function-t
 */
export async function generateInsight({ userEntries, friendEntries, userName, friendName }: InsightInput): Promise<InsightResult> {
  // 1. Ha nincs elég adat
  if (!userEntries?.length || !friendEntries?.length) {
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
    console.log("Generating insight for:", userName, "vs", friendName);
    
    // 3. Edge Function hívása
    const { data, error } = await supabase.functions.invoke('generate-insight', {
      body: {
        userStats,
        friendStats,
        userName,
        friendName
      }
    });

    if (error) {
      console.error('Supabase Function Error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data received from function');
    }

    // 4. Visszatérés az AI eredményével
    return {
      title: data.title || 'Elemzés',
      analysis: data.analysis || 'Nem sikerült elemezni az adatokat.',
      verdict: data.verdict || 'Nincs konklúzió.',
      winner: data.winner || 'draw'
    };

  } catch (err: any) {
    console.error('Insight generation failed details:', err);
    // Fallback hiba esetén
    return {
      title: 'Hiba az elemzésben',
      analysis: 'Az AI agya jelenleg túlterhelt vagy hálózati hiba történt. (' + (err.message || 'Ismeretlen hiba') + ')',
      verdict: 'Próbáld újra később.',
      winner: 'draw'
    };
  }
}
