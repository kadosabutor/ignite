import type { HabitEntry, Badge, StreakData } from '../types';

// --- XP RENDSZER ---
// Exponenciális görbe: Level 1 = 0 XP, Level 2 = 1000 XP, Level 50 = ~150k XP
export const XP_TABLE = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1;
  return Math.floor(1000 * Math.pow(level - 1, 1.5));
});

export const getLevelFromXP = (xp: number) => {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  const currentLevelBase = XP_TABLE[level - 1];
  const nextLevelXP = XP_TABLE[level] || XP_TABLE[level - 1] * 1.5;
  const progress = Math.min(100, ((xp - currentLevelBase) / (nextLevelXP - currentLevelBase)) * 100);
  
  return { level, progress, nextLevelXP, currentLevelBase };
};

export const calculateDailyXP = (entry: HabitEntry): number => {
  let xp = 0;
  
  // Alap logolás
  xp += 50; 
  
  // Sikeres szokások (+20 XP / db)
  if (entry.exercise) xp += 20;
  if (entry.cleanEating) xp += 20;
  if (entry.paradigm) xp += 20;
  
  // Tiszta nap bónusz (ha minden negatív szokás elkerülve)
  if (!entry.satisfaction && !entry.dopamineContent && !entry.gaming) xp += 50; 
  
  // Magas pontszám bónusz
  if (entry.score >= 90) xp += 100;
  
  return xp;
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

// --- BADGE RENDSZER ---
export const BADGES: Omit<Badge, 'unlockedAt'>[] = [
  {
    id: 'early_bird',
    name: 'The Early Bird',
    description: 'Rögzíts adatot reggel 8 előtt 5x egymás után.',
    icon: '🌅',
    category: 'focus',
    requirement: '5 napos korai logolás sorozat'
  },
  {
    id: 'iron_lung',
    name: 'Iron Lung',
    description: 'Eddz 30 napot összesen.',
    icon: '🫁',
    category: 'vitality',
    requirement: '30 edzés nap'
  },
  {
    id: 'deep_work_god',
    name: 'Deep Work God',
    description: 'Dolgozz 10+ órát egy nap alatt.',
    icon: '⚡',
    category: 'focus',
    requirement: '600+ perc business egy napon'
  },
  {
    id: 'monk_mode',
    name: 'Monk Mode',
    description: '14 napos tiszta étkezés + teljes tisztaság streak.',
    icon: '🧘‍♂️',
    category: 'will',
    requirement: '14 napos tiszta sorozat'
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    description: 'Térj vissza (logolj újra) 7 nap kihagyás után.',
    icon: '🔥',
    category: 'special',
    requirement: 'Visszatérés 7+ nap után'
  },
  {
    id: 'streak_30',
    name: 'The Survivor',
    description: 'Érd el a 30 napos sorozatot.',
    icon: '🛡️',
    category: 'streak',
    requirement: '30 napos streak'
  }
];

export const checkNewBadges = (
  currentEntry: HabitEntry, 
  allEntries: HabitEntry[], 
  streakData: StreakData,
  existingBadgeIds: string[]
): string[] => {
  const newBadges: string[] = [];
  const addBadge = (id: string) => {
    if (!existingBadgeIds.includes(id)) newBadges.push(id);
  };

  // 1. Deep Work God (Napi ellenőrzés)
  if (currentEntry.businessMinutes >= 600) {
    addBadge('deep_work_god');
  }

  // 2. Streak 30 (Streak adatokból)
  if (streakData.currentStreak >= 30) {
    addBadge('streak_30');
  }

  // 3. Iron Lung (Összesítés)
  const totalExercise = allEntries.filter(e => e.exercise).length;
  if (totalExercise >= 30) {
    addBadge('iron_lung');
  }

  // 4. Early Bird (Sorozat ellenőrzés)
  // Megnézzük az utolsó 5 napot (beleértve a mait), hogy 8 előtt történt-e a létrehozás/frissítés
  // Megjegyzés: Ez a "created_at" alapján a legpontosabb, de most a logolás idejét vesszük alapul
  const last5Entries = [currentEntry, ...allEntries.slice(0, 4)];
  if (last5Entries.length >= 5) {
    const allEarly = last5Entries.every(e => {
      const date = new Date(e.createdAt);
      return date.getHours() < 8; 
    });
    if (allEarly) addBadge('early_bird');
  }

  // 5. Monk Mode (14 nap tisztaság)
  // Keressük a leghosszabb tiszta sorozatot az elmúlt időszakban
  let cleanStreak = 0;
  let maxCleanStreak = 0;
  
  // Összefűzzük a mait a többivel időrendben (maitól visszafelé)
  const entriesToCheck = [currentEntry, ...allEntries];
  
  for (const entry of entriesToCheck) {
    const isClean = !entry.satisfaction && !entry.dopamineContent && !entry.gaming && entry.cleanEating;
    if (isClean) {
      cleanStreak++;
    } else {
      maxCleanStreak = Math.max(maxCleanStreak, cleanStreak);
      cleanStreak = 0;
    }
  }
  maxCleanStreak = Math.max(maxCleanStreak, cleanStreak);
  
  if (maxCleanStreak >= 14) {
    addBadge('monk_mode');
  }

  // 6. Phoenix (Visszatérés)
  if (allEntries.length > 0) {
    const lastEntryDate = new Date(allEntries[0].date);
    const todayDate = new Date(currentEntry.date);
    const diffTime = Math.abs(todayDate.getTime() - lastEntryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays >= 7) {
      addBadge('phoenix');
    }
  }

  return newBadges;
};

// --- NAPI RANG (Wizard végére) ---
export const getDailyRank = (score: number) => {
  if (score >= 95) return { title: "LEGENDARY", color: "#FFD700", msg: "Történelmet írtál ma." };
  if (score >= 85) return { title: "EPIC", color: "#B833FF", msg: "Brutális teljesítmény." };
  if (score >= 70) return { title: "RARE", color: "#33CCFF", msg: "Szép munka, katona." };
  if (score >= 50) return { title: "COMMON", color: "#4ADE80", msg: "Az alapok megvannak." };
  return { title: "POOR", color: "#6B7280", msg: "Holnap ennél többre vagy képes." };
};