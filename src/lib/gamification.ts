import type { HabitEntry } from '../types';

// --- XP RENDSZER ---
export const XP_TABLE = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1;
  // Exponenciális görbe
  return Math.floor(100 * Math.pow(level, 1.8));
});

export const calculateXP = (entries: HabitEntry[]): { totalXP: number; level: number; progress: number; nextLevelXP: number } => {
  let xp = 0;
  
  entries.forEach(entry => {
    // Alap logolás
    xp += 50; 
    
    // Sikeres szokások
    if (entry.exercise) xp += 20;
    if (entry.cleanEating) xp += 20;
    if (entry.paradigm) xp += 20;
    if (!entry.satisfaction && !entry.dopamineContent && !entry.gaming) xp += 50; // Tiszta bónusz
    
    // Magas pontszám bónusz
    if (entry.score >= 90) xp += 100;
  });

  // Szint számítás
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) {
      level = i + 2; 
    } else {
      break;
    }
  }

  const currentLevelBase = level === 1 ? 0 : XP_TABLE[level - 2];
  const nextLevelXP = XP_TABLE[level - 1];
  const levelXP = xp - currentLevelBase;
  const levelRequirement = nextLevelXP - currentLevelBase;
  const progress = Math.min(100, (levelXP / levelRequirement) * 100);

  return { totalXP: xp, level, progress, nextLevelXP };
};

// --- ATTRIBÚTUM RENDSZER ---
export interface Attributes {
  focus: { level: number; value: number; max: number };    // Munka
  vitality: { level: number; value: number; max: number }; // Egészség
  will: { level: number; value: number; max: number };     // Tisztaság
  mind: { level: number; value: number; max: number };     // Paradigma
}

export const calculateAttributes = (entries: HabitEntry[]): Attributes => {
  // FOCUS: Munkaórák (1 szint = 10 óra munka)
  const totalBusinessMinutes = entries.reduce((sum, e) => sum + e.businessMinutes, 0);
  const focusLevel = Math.floor(totalBusinessMinutes / 600) + 1; 

  // VITALITY: Edzés + Kaja (1 szint = 5 "egészség pont")
  const healthPoints = entries.reduce((sum, e) => sum + (e.exercise ? 1 : 0) + (e.cleanEating ? 1 : 0), 0);
  const vitalityLevel = Math.floor(healthPoints / 5) + 1;

  // WILL: Tiszta napok (1 szint = 3 tiszta nap)
  const cleanDays = entries.filter(e => !e.satisfaction && !e.dopamineContent && !e.gaming).length;
  const willLevel = Math.floor(cleanDays / 3) + 1;

  // MIND: Paradigma (1 szint = 3 paradigma váltás)
  const mindPoints = entries.filter(e => e.paradigm).length;
  const mindLevel = Math.floor(mindPoints / 3) + 1;

  return {
    focus: { level: focusLevel, value: totalBusinessMinutes / 60, max: focusLevel * 10 },
    vitality: { level: vitalityLevel, value: healthPoints, max: vitalityLevel * 5 },
    will: { level: willLevel, value: cleanDays, max: willLevel * 3 },
    mind: { level: mindLevel, value: mindPoints, max: mindLevel * 3 }
  };
};

export const ATTRIBUTE_DESCRIPTIONS = {
  focus: {
    title: "FOCUS (Fókusz)",
    desc: "A produktivitás és a karrier építése. Minden 10 óra mélymunka növeli a szintet.",
    sources: ["Business percek"]
  },
  vitality: {
    title: "VITALITY (Vitalitás)",
    desc: "A test karbantartása és energia. Minden 5 edzés vagy tiszta étkezés növeli a szintet.",
    sources: ["Edzés", "Tiszta étkezés"]
  },
  will: {
    title: "WILL (Akaraterő)",
    desc: "Az önuralom mértéke. Minden 3 teljesen tiszta nap (dopamin, gaming és kielégülés nélkül) növeli a szintet.",
    sources: ["Tisztaság (NoFap, NoGame, NoScroll)"]
  },
  mind: {
    title: "MIND (Elme)",
    desc: "Szellemi fejlődés és tudatosság. Minden 3 paradigma váltás növeli a szintet.",
    sources: ["Paradigma"]
  }
};

// --- NAPI RANG (Wizard végére) ---
export const getDailyRank = (score: number) => {
  if (score >= 95) return { title: "LEGENDARY", color: "#FFD700", msg: "Történelmet írtál ma." };
  if (score >= 85) return { title: "EPIC", color: "#B833FF", msg: "Brutális teljesítmény." };
  if (score >= 70) return { title: "RARE", color: "#33CCFF", msg: "Szép munka, katona." };
  if (score >= 50) return { title: "COMMON", color: "#4ADE80", msg: "Az alapok megvannak." };
  return { title: "POOR", color: "#6B7280", msg: "Holnap ennél többre vagy képes." };
};
