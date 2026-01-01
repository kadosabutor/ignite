# IGNITE PWA - Project TODO

## Alap infrastruktúra
- [x] PWA projekt inicializálása (Vite + React + TypeScript)
- [x] PWA manifest és service worker beállítása
- [x] Routing beállítása (react-router-dom)
- [x] Globális stílusok és téma (sötét téma, #ff7033 primary)
- [x] Montserrat betűtípus

## Branding és UI komponensek
- [x] IGNITE branding (név, logó)
- [x] SVG streak ikonok integrálása
- [x] Avatar ikonok integrálása
- [x] Alap UI komponensek (Button, Card, Input, Toggle)

## Adatkezelés
- [x] Adatmodell és típusok (HabitEntry, User, Friend, Streak)
- [x] Pontszámítási logika (változatlan az eredetihez képest)
- [x] LocalForage alapú tárolás
- [x] Streak számítási logika

## Wizard folyamat
- [x] Alvás oldal (auto-focus a következő mezőre)
- [x] Munka oldal (percre pontos bevitel lehetőség)
- [x] Egészség oldal (átnevezés Test-ről, középre igazítás)
- [x] Szellem oldal (Paradigma)
- [x] Tisztaság oldal
- [x] Összegzés oldal (alvás adatok, reflexiós kérdések)

## Képernyők
- [x] Dashboard (mai pontszám, streak, akció gomb)
- [x] Előzmények (kattintásra összegzés nézet)
- [x] Statisztika (naptár, havi összesítés)
- [x] Beállítások (értesítések)

## Streak rendszer
- [x] Láng szintek (Spark, Blaze, Inferno, Plasma)
- [x] Cryo-Freeze védelem (7 naponta 1, max 3)
- [x] Phoenix Protocol (3 napos próbatétel)
- [x] Streak értesítések (20:00, 23:00)
- [x] 04:00 cutoff logika

## Multiplayer funkciók
- [x] Profil oldal (publikus/privát nézet)
- [x] Barátkeresés (username alapján)
- [x] My Circle (barátlista)
- [x] Aréna (napi feed, kártyák)
- [x] Ping rendszer (18:00 után)
- [x] Tűz elismerés (dupla koppintás)
- [ ] VS Mode (radar diagram, összehasonlítás)
- [x] Leaderboard (Ma, Hét, Hónap)
- [x] Rangrendszer (Sleepwalker -> Titan)

## Push értesítések
- [x] Reggeli motiváció (07:00)
- [x] Délutáni emlékeztető (15:00)
- [x] Esti felszólítás (21:00)
- [x] Streak értesítések (20:00, 23:00)
- [x] Ping értesítések
- [x] Rang változás értesítések

## Véglegesítés
- [x] PWA telepíthetőség tesztelése
- [x] Offline működés tesztelése
- [ ] Build és zip készítés

## Supabase integráció
- [x] Supabase kliens telepítése és konfigurálása
- [x] Adatbázis séma SQL létrehozása
- [x] Environment variables beállítása
- [x] Authentikáció (regisztráció, bejelentkezés, kijelentkezés)
- [x] Login/Register oldal létrehozása
- [x] Storage átírása LocalForage-ról Supabase-re
- [x] HabitContext módosítása Supabase szinkronizációval
- [x] Barátok kezelése Supabase-ből
- [x] Leaderboard valós adatokkal
- [x] Real-time szinkronizáció
