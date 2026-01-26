import { supabase } from './api';
import type { HabitEntry } from '../types';

// ÚJ: Bővített kimeneti típus a strukturált válaszhoz
export interface InsightResult {
  title: string;
  winnerId: 'user' | 'friend' | 'draw';
  verdict_short: string;
  daily_mission: string; // A napi konkrét feladat
  
  // Tematikus szekciók (pl. Produktivitás, Egészség)
  sections: {
    type: 'productivity' | 'health' | 'discipline';
    title: string;
    text: string;
    scoreUser: number;   // 0-100 skálán (grafikonhoz)
    scoreFriend: number; // 0-100 skálán
  }[];

  // Kiemelt statisztikák (pl. "+40% Munka")
  key_stats: {
    label: string;
    diff: string;
    advantage: 'user' | 'friend' | 'draw';
  }[];
}

// Bemeneti típus
interface InsightInput {
  userEntries: HabitEntry[];
  friendEntries: HabitEntry[];
  userName: string;
  friendName: string;
  userAvatar?: string;
  friendAvatar?: string;
}

// Segédfüggvény: Anomáliák és Rekordok keresése
const findHighlights = (entries: HabitEntry[], name: string) => {
  if (!entries.length) return [];
  
  const highlights: string[] = [];
  
  // 1. Alvás extremitások
  const minSleep = entries.reduce((min, e) => (e.sleepMinutes > 0 && e.sleepMinutes < min.sleepMinutes ? e : min), entries[0]);
  if (minSleep.sleepMinutes > 0 && minSleep.sleepMinutes < 300) { // 5 óra alatt
    highlights.push(`${name} egyik nap csak ${Math.round(minSleep.sleepMinutes/60)} órát aludt.`);
  }

  // 2. Munka rekord
  const maxWork = entries.reduce((max, e) => (e.businessMinutes > max.businessMinutes ? e : max), entries[0]);
  if (maxWork.businessMinutes > 480) { // 8 óra felett
    highlights.push(`${name} rekordja: ${Math.round(maxWork.businessMinutes/60)} óra munka egy nap alatt.`);
  }

  // 3. Gaming binge
  const gamingDays = entries.filter(e => e.gaming).length;
  if (gamingDays > entries.length * 0.5) {
    highlights.push(`${name} a napok több mint felében játszott.`);
  }

  // 4. Edzés hiánya
  const exerciseDays = entries.filter(e => e.exercise).length;
  if (exerciseDays === 0 && entries.length > 3) {
    highlights.push(`${name} egyszer sem edzett az elmúlt időszakban.`);
  }

  return highlights;
};

// Segédfüggvény: Átlagok
const aggregateStats = (entries: HabitEntry[]) => {
  const count = entries.length || 1;
  if (count === 0) return {};

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
    throw new Error("Nincs elég adat az elemzéshez.");
  }

  // 2. Adatok előkészítése
  const userStats = aggregateStats(userEntries);
  const friendStats = aggregateStats(friendEntries);
  
  // 3. Különlegességek keresése
  const userHighlights = findHighlights(userEntries, "User");
  const friendHighlights = findHighlights(friendEntries, "Friend");

  try {
    console.log("📡 Elemzés kérése a szervertől...");
    
    // 4. Edge Function hívása (bővített adatokkal)
    const { data, error } = await supabase.functions.invoke('generate-insight', {
      body: {
        userStats,
        friendStats,
        userHighlights, 
        friendHighlights, 
        userName,
        friendName,
        date: new Date().toISOString() // Dátum a "Napi téma" kiválasztásához
      }
    });

    if (error) {
      console.error('Supabase Invoke Error:', error);
      throw new Error(error.message || 'Szerver hiba');
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data as InsightResult;

  } catch (err: any) {
    console.error('Insight generation failed details:', err);
    // Fallback válasz hiba esetén
    return {
      title: 'Hiba történt ⚠️',
      winnerId: 'draw',
      verdict_short: 'Az adatok túl forróak voltak.',
      daily_mission: 'Próbáld újra később!',
      sections: [],
      key_stats: []
    };
  }
}
