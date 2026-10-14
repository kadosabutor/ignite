import SwiftUI

/// XP, badge-ek, napi rang – a webapp src/lib/gamification.ts portja
enum Gamification {
    // MARK: XP

    /// Exponenciális görbe: Level 1 = 0 XP, Level 2 = 1000 XP, ...
    static let xpTable: [Int] = (0..<100).map { Int(1000 * pow(Double($0), 1.5)) }

    static func level(fromXP xp: Int) -> (level: Int, progress: Double, nextLevelXP: Int) {
        var level = 1
        for (i, threshold) in xpTable.enumerated() where xp >= threshold { level = i + 1 }
        let base = xpTable[level - 1]
        let next = level < xpTable.count ? xpTable[level] : Int(Double(base) * 1.5)
        let progress = min(100, Double(xp - base) / Double(max(1, next - base)) * 100)
        return (level, progress, next)
    }

    static func dailyXP(_ e: HabitEntry) -> Int {
        var xp = 50
        if e.exercise { xp += 20 }
        if e.cleanEating { xp += 20 }
        if e.paradigm { xp += 20 }
        if e.isPure { xp += 50 }
        if e.score >= 90 { xp += 100 }
        return xp
    }

    // MARK: Napi rang (Wizard vége)

    struct DailyRank {
        let title: String
        let color: Color
        let message: String
    }

    static func dailyRank(_ score: Double) -> DailyRank {
        switch score {
        case 95...: DailyRank(title: "LEGENDARY", color: Color(hex: 0xFFD700), message: "Történelmet írtál ma.")
        case 85...: DailyRank(title: "EPIC", color: Color(hex: 0xB833FF), message: "Brutális teljesítmény.")
        case 70...: DailyRank(title: "RARE", color: Color(hex: 0x33CCFF), message: "Szép munka, katona.")
        case 50...: DailyRank(title: "COMMON", color: Color(hex: 0x4ADE80), message: "Az alapok megvannak.")
        default: DailyRank(title: "POOR", color: Color(hex: 0x6B7280), message: "Holnap ennél többre vagy képes.")
        }
    }

    // MARK: Badge-ek

    static let badges: [Badge] = [
        Badge(id: "early_bird", name: "The Early Bird", description: "Rögzíts adatot reggel 8 előtt 5x egymás után.", icon: "🌅", category: .focus, requirement: "5 napos korai logolás sorozat"),
        Badge(id: "iron_lung", name: "Iron Lung", description: "Eddz 30 napot összesen.", icon: "🫁", category: .vitality, requirement: "30 edzés nap"),
        Badge(id: "deep_work_god", name: "Deep Work God", description: "Dolgozz 10+ órát egy nap alatt.", icon: "⚡", category: .focus, requirement: "600+ perc business egy napon"),
        Badge(id: "monk_mode", name: "Monk Mode", description: "14 napos tiszta étkezés + teljes tisztaság streak.", icon: "🧘‍♂️", category: .will, requirement: "14 napos tiszta sorozat"),
        Badge(id: "phoenix", name: "Phoenix", description: "Térj vissza (logolj újra) 7 nap kihagyás után.", icon: "🔥", category: .special, requirement: "Visszatérés 7+ nap után"),
        Badge(id: "streak_30", name: "The Survivor", description: "Érd el a 30 napos sorozatot.", icon: "🛡️", category: .streak, requirement: "30 napos streak"),
    ]

    /// - Parameters:
    ///   - entries: az összes bejegyzés a mentés után, dátum szerint csökkenő sorrendben
    static func newBadges(current: HabitEntry, entries: [HabitEntry], streak: StreakData, unlocked: Set<String>) -> [String] {
        var result: [String] = []
        func add(_ id: String) { if !unlocked.contains(id) { result.append(id) } }

        if current.businessMinutes >= 600 { add("deep_work_god") }
        if streak.currentStreak >= 30 { add("streak_30") }
        if entries.filter(\.exercise).count >= 30 { add("iron_lung") }

        // Early Bird: az utolsó 5 bejegyzés mind reggel 8 előtt készült
        let last5 = Array(entries.prefix(5))
        if last5.count == 5, last5.allSatisfy({ e in
            guard let created = e.createdAt else { return false }
            return DateUtil.calendar.component(.hour, from: created) < 8
        }) {
            add("early_bird")
        }

        // Monk Mode: 14 egymást követő tiszta bejegyzés
        var run = 0, best = 0
        for e in entries {
            if e.isPure && e.cleanEating { run += 1; best = max(best, run) } else { run = 0 }
        }
        if best >= 14 { add("monk_mode") }

        // Phoenix: az előző bejegyzés legalább 7 nappal korábbi
        if let previous = entries.first(where: { $0.date < current.date }),
           DateUtil.daysBetween(previous.date, current.date) >= 7 {
            add("phoenix")
        }

        return result
    }
}
