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

  // 1. Dátum szerinti szűrés (Dinamikus időablak keresés helyett most az utolsó 30 napot vesszük alapul a stabilitásért, de a szövegbe beírjuk)
  // A bemenet már szűrve érkezik (pl. 30 vagy 90 nap), így dolgozhatunk az egésszel.
  const days = userEntries.length; 
  const uStats = aggregateStats(userEntries);
  const fStats = aggregateStats(friendEntries);

  // 2. ARCHETÍPUSOK ÉS SZÖVEGEK
  // Itt definiáljuk a feltételeket és a szövegvariációkat

  // --- 1. THE GOONER (Kielégülés Rabja) ---
  // Trigger: Magas satisfaction + Alacsony business
  if (uStats.satisfactionCount > 2 || fStats.satisfactionCount > 2) {
    // Ha TE vagy a jobb (Te kevesebbet "elégültél ki" ÉS többet dolgoztál)
    if (uStats.satisfactionCount < fStats.satisfactionCount && uStats.businessTotal > fStats.businessTotal) {
      return {
        title: 'A Gooner',
        winner: 'user',
        mood: 'roast', // Roastoljuk a barátot
        factualText: `${friendName} az elmúlt ${days} napban ${fStats.satisfactionCount} alkalommal esett bűnbe, míg te csak ${uStats.satisfactionCount}-szor. Ráadásul te ${Math.round((uStats.businessTotal - fStats.businessTotal) / 60)} órával többet is dolgoztál.`,
        tldrText: getRandom([
          `Gyula a faszát verte, te meg a rekordokat. Prioritások, ugye.`, // (Az eredeti, ha a friendName Gyula lenne, itt dinamikusan cseréljük)
          `${friendName} a faszát verte, te meg a rekordokat. Prioritások, ugye.`,
          `Amíg te a birodalmadat építetted, ${friendName} csak a zsebhokiban jeleskedett. Szánalmas.`,
          `${friendName} keze ragad, a te kezed meg világokat teremt. Nem ugyanazt a filmet nézitek.`,
          `Neki csak pár perc öröm jutott, neked meg a dicsőség. Hagyd meg neki a zsebkendőket.`,
          `${friendName} a pornhubot pörgette, te a GDP-det. Egyikőtök hasznos tagja a társadalomnak.`
        ])
      };
    }
    // Ha Ő nyert (Te voltál a rossz)
    if (uStats.satisfactionCount > fStats.satisfactionCount) {
      return {
        title: 'A Gooner (Te)',
        winner: 'friend',
        mood: 'roast', // Roastolunk téged
        factualText: `Te ${uStats.satisfactionCount} alkalommal vesztettél csatát a vágyaiddal szemben, míg ${friendName} csak ${fStats.satisfactionCount}-szor.`,
        tldrText: getRandom([
          `Szedd ki a kezed a gatyádból és kezdj el dolgozni, mert ${friendName} épp most hagy le.`,
          `Kiverted, gratulálok. ${friendName} közben megkereste a jövő havi lakbérét. Megérte?`,
          `A maszturbálás nem olimpiai sportág, haver. ${friendName} legalább csinált valami értelmeset.`
        ])
      };
    }
  }

  // --- 2. THE DOPAMINE ZOMBIE ---
  // Trigger: Magas dopamine + Alacsony paradigm
  if (uStats.dopamineCount > 3 || fStats.dopamineCount > 3) {
    if (uStats.dopamineCount < fStats.dopamineCount && uStats.paradigmCount > fStats.paradigmCount) {
      return {
        title: 'A Dopamin Zombi',
        winner: 'user',
        mood: 'roast',
        factualText: `Te ${uStats.paradigmCount} alkalommal tágítottad a tudatodat (Paradigma), míg ${friendName} ${fStats.dopamineCount} napon át égette az agyát olcsó dopaminnal.`,
        tldrText: getRandom([
          `${friendName} agya épp most rohadt szét a TikToktól, amíg te szintet léptél fejben.`,
          `Ő dopamin-túladagolást kapott a kanapén, te meg tudást szívtál magadba. NPC vs. Main Character.`,
          `${friendName}: 4 óra görgetés. Te: 4 óra fókusz. Ne csodálkozz, ha jövőre ő fog neked kávét hozni.`,
          `A te agyad élesedik, az övé meg lassan kocsonyává válik a sok short videótól.`
        ])
      };
    }
    if (uStats.dopamineCount > fStats.dopamineCount) {
      return {
        title: 'A Dopamin Zombi (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Túl sok időt töltöttél görgetéssel (${uStats.dopamineCount} alkalom), miközben ${friendName} ${fStats.paradigmCount}-szor lépett szintet fejben.`,
        tldrText: getRandom([
          `Ne legyél már ennyire NPC. ${friendName} tanul, te meg nyáladzol a telefonodra.`,
          `A telefonod okosabb nálad. ${friendName} legalább próbálja utolérni.`
        ])
      };
    }
  }

  // --- 3. THE PIXEL HERO (Gamer) ---
  // Trigger: Magas gaming + Alacsony exercise
  if (uStats.gamingCount > 2 || fStats.gamingCount > 2) {
    if (uStats.gamingCount < fStats.gamingCount && uStats.exerciseCount > fStats.exerciseCount) {
      return {
        title: 'A Pixel Hős',
        winner: 'user',
        mood: 'roast',
        factualText: `${friendName} ${fStats.gamingCount} alkalommal menekült a virtuális világba, te viszont ${uStats.exerciseCount}-szer edzettél a valóságban.`,
        tldrText: getRandom([
          `${friendName} egy 80-as szintű varázsló, te meg 80 kilót nyomsz fekve. A valóságban te nyernél.`,
          `Neki a hüvelykujja izmos a kontrollertől, neked meg a bicepszed 46-os. Hagyjad játszani a gyereket.`,
          `${friendName} virtuális nőket ment meg, te meg a valódi életedet rakod rendbe.`,
          `Pixel-hős vs. Valódi Gép. ${friendName} max a billentyűzetet tudja emelgetni.`
        ])
      };
    }
    if (uStats.gamingCount > fStats.gamingCount) {
      return {
        title: 'A Pixel Hős (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Miközben te játszottál (${uStats.gamingCount} alkalom), ${friendName} ${fStats.exerciseCount}-szer edzett.`,
        tldrText: getRandom([
          `${friendName} az életben már Challenger, te meg az életben csak Bronz 4. Menj el edzeni végre.`
        ])
      };
    }
  }

  // --- 4. A FEGYELMEZETT (The Disciplined) ---
  // Trigger: CleanEating + Exercise + Paradigm
  const uDiscScore = uStats.cleanEatingCount + uStats.exerciseCount + uStats.paradigmCount;
  const fDiscScore = fStats.cleanEatingCount + fStats.exerciseCount + fStats.paradigmCount;
  
  if (Math.abs(uDiscScore - fDiscScore) > 3) { // Csak ha jelentős a különbség
    if (uDiscScore > fDiscScore) {
      return {
        title: 'A Fegyelmezett',
        winner: 'user',
        mood: 'praise',
        factualText: `Kajálás, edzés, tanulás. Te mindháromban hoztad a szintet (${uDiscScore} pont), ${friendName} viszont lemaradt (${fDiscScore} pont).`,
        tldrText: getRandom([
          `Te egy gép vagy. ${friendName} még az összeszerelési útmutatót keresi az élethez.`,
          `Amíg ő kifogásokat keresett, te eredményeket gyártottál. Ez a fegyelem, haver.`,
          `Három fronton is megverted. Ez nem szerencse, ez dominancia.`,
          `${friendName} csak sodródik, te irányítasz. Így néz ki egy vezető.`
        ])
      };
    } else {
      return {
        title: 'A Fegyelmezett (Ő)',
        winner: 'friend',
        mood: 'roast',
        factualText: `${friendName} sokkal fegyelmezettebb volt (tiszta kaja, edzés, tanulás: ${fDiscScore} alkalom), mint te (${uDiscScore}).`,
        tldrText: getRandom([
          `${friendName} egy szerzetes fegyelmével él, te meg... nos, te is élsz valahogy.`,
          `Nézz rá ${friendName}-re. Na, ilyen az, amikor valaki nem csak a száját jártatja.`,
          `Össze kell szedned magad. ${friendName} köröket ver rád életmódban.`
        ])
      };
    }
  }

  // --- 5. A HEDONISTA (The Hedonist) ---
  // Trigger: Dopamine + Satisfaction + Low Business
  const uHedonism = uStats.dopamineCount + uStats.satisfactionCount;
  const fHedonism = fStats.dopamineCount + fStats.satisfactionCount;
  
  if (uHedonism > 4 || fHedonism > 4) {
    if (uHedonism < fHedonism && uStats.businessTotal > fStats.businessTotal) {
      return {
        title: 'A Hedonista',
        winner: 'user',
        mood: 'roast',
        factualText: `${friendName} ${fHedonism} alkalommal választotta az olcsó élvezeteket, miközben te a munkára koncentráltál (${Math.round(uStats.businessTotal/60)} óra).`,
        tldrText: getRandom([
          `${friendName} a dopamin rabja lett, míg te építetted a jövődet.`,
          `Ő a mának él (és a kezének), te a holnapnak. Hosszú távon te nyersz.`,
          `Szórakozni mindenki tud. Dolgozni kevesen. ${friendName} az előbbit választotta.`
        ])
      };
    }
    if (uHedonism > fHedonism) {
      return {
        title: 'A Hedonista (Te)',
        winner: 'friend',
        mood: 'roast',
        factualText: `Túl sokat hajszoltad az élvezeteket (${uHedonism} alkalom), miközben ${friendName} dolgozott.`,
        tldrText: getRandom([
          `Kicsit visszavehetnél az élvezetekből. ${friendName} már mérföldekkel előtted jár.`,
          `Dopamin detoxra lenne szükséged. Ez így nem mehet tovább.`,
          `Amíg te a "jó érzést" kergeted, ${friendName} a sikert. Érzed a különbséget?`
        ])
      };
    }
  }

  // --- 6. AZ ALVÓ ÜGYNÖK ---
  // Trigger: Sok alvás, kevés pont
  if (fStats.sleepAvg > 540 && fStats.scoreAvg < uStats.scoreAvg) { // 9 óra alvás
    return {
      title: 'Az Alvó Ügynök',
      winner: 'user',
      mood: 'roast',
      factualText: `${friendName} átlagosan ${Math.round(fStats.sleepAvg/60)} órát alszik, mégis ${Math.round(uStats.scoreAvg - fStats.scoreAvg)} ponttal lemaradt mögötted.`,
      tldrText: getRandom([
        `${friendName} átaludta a hónap felét. Talán ideje lenne felkelteni Csipkerózsikát. 😴`,
        `Ennyi alvással Einsteinnek kéne lennie, de valahogy mégse az. Te jobban pörögsz.`,
        `Ő álmodik a sikerről, te megcsinálod. Ébredj fel, ${friendName}!`
      ])
    };
  }

  // --- 7. A FAKE HUSTLER ---
  // Trigger: Sok munka, alacsony score
  if (fStats.businessTotal > uStats.businessTotal && fStats.scoreAvg < uStats.scoreAvg - 10) {
    return {
      title: 'A Fake Hustler',
      winner: 'user',
      mood: 'roast',
      factualText: `${friendName} többet "dolgozott" (${Math.round(fStats.businessTotal/60)} óra), de az életmód pontszáma ${Math.round(uStats.scoreAvg - fStats.scoreAvg)} ponttal a tied alatt van.`,
      tldrText: getRandom([
        `${friendName} azt hiszi, ha a gép előtt rohad egész nap, az produktivitás. Te legalább egyben vagy. 🤡`,
        `Csak égeti az áramot a gép előtt. Te kevesebbet dolgoztál, de több eredménnyel.`,
        `${friendName} 10 órát ült, te 6-ot dolgoztál. Mégis te vagy előrébb. Bohóc.`
      ])
    };
  }

  // --- FALLBACK (Általános összehasonlítás) ---
  // Ha egyik speciális archetípus sem illik, jön a matek alapú összehasonlítás
  const scoreDiff = Math.round(uStats.scoreAvg - fStats.scoreAvg);
  
  if (scoreDiff > 0) {
    return {
      title: 'Pontelőny',
      winner: 'user',
      mood: 'praise',
      factualText: `Összességében stabilabb vagy: az átlagpontszámod ${Math.round(uStats.scoreAvg)}, ami ${scoreDiff} ponttal veri ${friendName}-ét.`,
      tldrText: getRandom([
        `Szoros a verseny, de te vezetsz. Ne engedd el a gázt!`,
        `${friendName} látja a rendszámtábládat. Tartsd az előnyt!`,
        `Ez a te meccsed. ${friendName} csak asszisztál.`
      ])
    };
  } else {
    return {
      title: 'Hátrány',
      winner: 'friend',
      mood: 'neutral',
      factualText: `${friendName} jelenleg ${Math.abs(scoreDiff)} ponttal vezet előtted az átlagok alapján.`,
      tldrText: getRandom([
        `Kapd össze magad, mert ${friendName} kezd elhúzni!`,
        `Ez most az övé, de a holnap a tiéd lehet.`,
        `Ne hagyd, hogy nyerjen! Holnap mutasd meg neki!`
      ])
    };
  }
}

// Segédfüggvény véletlenszerű választáshoz
function getRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}
