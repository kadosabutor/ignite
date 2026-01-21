import type { HabitEntry } from '../types';

// Bemeneti típusok
interface InsightInput {
  userEntries: HabitEntry[];
  friendEntries: HabitEntry[];
  friendName: string;
}

// Kimeneti típus
export interface InsightResult {
  title: string; // Pl. "A Gooner" vagy "Business Győzelem"
  factualText: string; // A tényszerű összehasonlítás
  tldrText: string; // A csipkelődő összefoglaló
  mood: 'roast' | 'praise' | 'neutral'; // Hangulat (színkódoláshoz jó lehet)
  winner: 'user' | 'friend' | 'draw';
}

// Segédfüggvény: Adatok összegzése egy adott időszakra
const aggregateStats = (entries: HabitEntry[]) => {
  const count = entries.length || 1;
  return {
    scoreAvg: entries.reduce((sum, e) => sum + e.score, 0) / count,
    businessTotal: entries.reduce((sum, e) => sum + e.businessMinutes, 0),
    sleepAvg: entries.reduce((sum, e) => sum + e.sleepMinutes, 0) / count,
    exerciseCount: entries.filter(e => e.exercise).length,
    cleanEatingCount: entries.filter(e => e.cleanEating).length,
    paradigmCount: entries.filter(e => e.paradigm).length,
    // Negatív szokások (True = Rossz)
    satisfactionCount: entries.filter(e => e.satisfaction).length,
    dopamineCount: entries.filter(e => e.dopamineContent).length,
    gamingCount: entries.filter(e => e.gaming).length,
    // Purity (Tiszta napok)
    purityCount: entries.filter(e => !e.satisfaction && !e.dopamineContent && !e.gaming).length,
  };
};

export function generateInsight({ userEntries, friendEntries, friendName }: InsightInput): InsightResult {
  // Alapértelmezett visszatérés, ha nincs elég adat
  if (userEntries.length === 0 || friendEntries.length === 0) {
    return {
      title: 'Nincs adat',
      factualText: 'Még nincs elég közös adatotok az összehasonlításhoz.',
      tldrText: 'Rögzítsetek több napot!',
      mood: 'neutral',
      winner: 'draw'
    };
  }

  // 1. Dátum szerinti szűrés
  const days = userEntries.length; 
  const uStats = aggregateStats(userEntries);
  const fStats = aggregateStats(friendEntries);

  // 2. ARCHETÍPUSOK ÉS SZÖVEGEK
  // A factualText mindenhol tartalmazza a 'days' változót az időtáv jelölésére.

  // --- 1. THE GOONER (Kielégülés Rabja) ---
  if (uStats.satisfactionCount > 2 || fStats.satisfactionCount > 2) {
    if (uStats.satisfactionCount < fStats.satisfactionCount && uStats.businessTotal > fStats.businessTotal) {
      return {
        title: 'A Gooner',
        winner: 'user',
        mood: 'roast',
        factualText: `${friendName} az elmúlt ${days} napban ${fStats.satisfactionCount} alkalommal esett bűnbe, míg te csak ${uStats.satisfactionCount}-szor. Ráadásul te ${Math.round((uStats.businessTotal - fStats.businessTotal) / 60)} órával többet is dolgoztál ebben az időszakban.`,
        tldrText: ''
      };
    }
    if (uStats.satisfactionCount > fStats.satisfactionCount) {
      return {
        title: 'A Gooner (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Az elmúlt ${days} nap során te ${uStats.satisfactionCount} alkalommal vesztettél csatát a vágyaiddal szemben, míg ${friendName} csak ${fStats.satisfactionCount}-szor.`,
        tldrText: ''
      };
    }
  }

  // --- 2. THE DOPAMINE ZOMBIE ---
  if (uStats.dopamineCount > 3 || fStats.dopamineCount > 3) {
    if (uStats.dopamineCount < fStats.dopamineCount && uStats.paradigmCount > fStats.paradigmCount) {
      return {
        title: 'A Dopamin Zombi',
        winner: 'user',
        mood: 'roast',
        factualText: `Te az elmúlt ${days} napban ${uStats.paradigmCount} alkalommal tágítottad a tudatodat (Paradigma), míg ${friendName} ${fStats.dopamineCount} napon át égette az agyát olcsó dopaminnal ugyanezen időszak alatt.`,
        tldrText: ''
      };
    }
    if (uStats.dopamineCount > fStats.dopamineCount) {
      return {
        title: 'A Dopamin Zombi (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Az elmúlt ${days} napban túl sok időt töltöttél görgetéssel (${uStats.dopamineCount} alkalom), miközben ${friendName} ${fStats.paradigmCount}-szor lépett szintet fejben.`,
        tldrText: ''
      };
    }
  }

  // --- 3. THE PIXEL HERO (Gamer) ---
  if (uStats.gamingCount > 2 || fStats.gamingCount > 2) {
    if (uStats.gamingCount < fStats.gamingCount && uStats.exerciseCount > fStats.exerciseCount) {
      return {
        title: 'A Pixel Hős',
        winner: 'user',
        mood: 'roast',
        factualText: `Az elmúlt ${days} napban ${friendName} ${fStats.gamingCount} alkalommal menekült a virtuális világba, te viszont ${uStats.exerciseCount}-szer edzettél a valóságban.`,
        tldrText: ''
      };
    }
    if (uStats.gamingCount > fStats.gamingCount) {
      return {
        title: 'A Pixel Hős (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Miközben te játszottál (${uStats.gamingCount} alkalom az elmúlt ${days} napban), ${friendName} ${fStats.exerciseCount}-szer edzett.`,
        tldrText: ''
      };
    }
  }

  // --- 4. A FEGYELMEZETT (The Disciplined) ---
  const uDiscScore = uStats.cleanEatingCount + uStats.exerciseCount + uStats.paradigmCount;
  const fDiscScore = fStats.cleanEatingCount + fStats.exerciseCount + fStats.paradigmCount;
  
  if (Math.abs(uDiscScore - fDiscScore) > 3) { 
    if (uDiscScore > fDiscScore) {
      return {
        title: 'A Fegyelmezett',
        winner: 'user',
        mood: 'praise',
        factualText: `Kajálás, edzés, tanulás: az elmúlt ${days} napban te mindháromban hoztad a szintet (${uDiscScore} pont), ${friendName} viszont lemaradt (${fDiscScore} pont) ebben az időszakban.`,
        tldrText: ''
      };
    } else {
      return {
        title: 'A Fegyelmezett (Ő)',
        winner: 'friend',
        mood: 'roast',
        factualText: `${friendName} sokkal fegyelmezettebb volt az elmúlt ${days} napban (tiszta kaja, edzés, tanulás: ${fDiscScore} alkalom), mint te (${uDiscScore}).`,
        tldrText: ''
      };
    }
  }

  // --- 5. A HEDONISTA (The Hedonist) ---
  const uHedonism = uStats.dopamineCount + uStats.satisfactionCount;
  const fHedonism = fStats.dopamineCount + fStats.satisfactionCount;
  
  if (uHedonism > 4 || fHedonism > 4) {
    if (uHedonism < fHedonism && uStats.businessTotal > fStats.businessTotal) {
      return {
        title: 'A Hedonista',
        winner: 'user',
        mood: 'roast',
        factualText: `${friendName} az elmúlt ${days} napban ${fHedonism} alkalommal választotta az olcsó élvezeteket, miközben te a munkára koncentráltál (${Math.round(uStats.businessTotal/60)} óra).`,
        tldrText: ''
      };
    }
    if (uHedonism > fHedonism) {
      return {
        title: 'A Hedonista (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Az elmúlt ${days} napban túl sokat hajszoltad az élvezeteket (${uHedonism} alkalom), miközben ${friendName} dolgozott.`,
        tldrText: ''
      };
    }
  }

  // --- 6. AZ ALVÓ ÜGYNÖK ---
  if (fStats.sleepAvg > 540 && fStats.scoreAvg < uStats.scoreAvg) { 
    return {
      title: 'Az Alvó Ügynök',
      winner: 'user',
      mood: 'roast',
      factualText: `${friendName} átlagosan ${Math.round(fStats.sleepAvg/60)} órát aludt az elmúlt ${days} napban, mégis ${Math.round(uStats.scoreAvg - fStats.scoreAvg)} ponttal lemaradt mögötted.`,
      tldrText: ''
    };
  }

  // --- 7. A FAKE HUSTLER ---
  if (fStats.businessTotal > uStats.businessTotal && fStats.scoreAvg < uStats.scoreAvg - 10) {
    return {
      title: 'A Fake Hustler',
      winner: 'user',
      mood: 'roast',
      factualText: `${friendName} többet "dolgozott" (${Math.round(fStats.businessTotal/60)} óra az elmúlt ${days} napban), de az életmód pontszáma ${Math.round(uStats.scoreAvg - fStats.scoreAvg)} ponttal a tied alatt van.`,
      tldrText: ''
    };
  }

  // --- FALLBACK (Általános összehasonlítás) ---
  const scoreDiff = Math.round(uStats.scoreAvg - fStats.scoreAvg);
  
  if (scoreDiff > 0) {
    return {
      title: 'Pontelőny',
      winner: 'user',
      mood: 'praise',
      factualText: `Összességében stabilabb vagy az elmúlt ${days} nap alapján: az átlagpontszámod ${Math.round(uStats.scoreAvg)}, ami ${scoreDiff} ponttal veri ${friendName}-ét.`,
      tldrText: ''
    };
  } else {
    return {
      title: 'Hátrány',
      winner: 'friend',
      mood: 'neutral',
      factualText: `${friendName} jelenleg ${Math.abs(scoreDiff)} ponttal vezet előtted az elmúlt ${days} nap átlagai alapján.`,
      tldrText: ''
    };
  }
}
