import SwiftUI

/// Pontozás – a webapp src/lib/scoring.ts hű portja (max 100 pont)
enum Scoring {
    static let businessMax = 37.0
    static let businessTargetMinutes = 600.0 // 10 óra
    static let cleanEating = 6.0
    static let exercise = 7.0
    static let paradigm = 5.0
    static let noSatisfaction = 4.0
    static let noDopamine = 3.0
    static let noGaming = 5.0
    static let sleepMax = 33.0
    static let sleepTargetMinutes = 480.0 // 8 óra

    static func sleepMinutes(bedTime: String?, wakeUpTime: String?) -> Int {
        guard let bed = minutesOfDay(bedTime), let wake = minutesOfDay(wakeUpTime) else { return 0 }
        // Ha a lefekvés későbbi, mint az ébredés, az előző este feküdt le
        return bed > wake ? (24 * 60 - bed) + wake : wake - bed
    }

    private static func minutesOfDay(_ hhmm: String?) -> Int? {
        guard let hhmm else { return nil }
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return nil }
        return parts[0] * 60 + parts[1]
    }

    static func businessPoints(_ minutes: Int) -> Double {
        guard minutes > 0 else { return 0 }
        return min(Double(minutes) / businessTargetMinutes, 1) * businessMax
    }

    static func sleepPoints(_ minutes: Int) -> Double {
        guard minutes > 0 else { return 0 }
        return min(Double(minutes) / sleepTargetMinutes, 1) * sleepMax
    }

    static func totalScore(_ e: HabitEntry) -> Double {
        var score = businessPoints(e.businessMinutes) + sleepPoints(e.sleepMinutes)
        if e.cleanEating { score += cleanEating }
        if e.exercise { score += exercise }
        if e.paradigm { score += paradigm }
        if !e.satisfaction { score += noSatisfaction }
        if !e.dopamineContent { score += noDopamine }
        if !e.gaming { score += noGaming }
        return min(100, (score * 100).rounded() / 100)
    }

    static func scoreColor(_ score: Double) -> Color {
        if score >= 90 { return Theme.success }
        if score >= 50 { return Theme.warning }
        return Theme.error
    }

    static func scoreLabel(_ score: Double) -> String {
        switch score {
        case 95...: "Kiváló"
        case 90...: "Nagyszerű"
        case 80...: "Jó"
        case 70...: "Megfelelő"
        case 50...: "Fejleszthető"
        default: "Gyenge"
        }
    }

    static func rank(fromAverage avg: Double) -> Rank {
        switch avg {
        case 99...: .titan
        case 90...: .monkmode
        case 80...: .highperformer
        case 70...: .operator_
        case 50...: .grinder
        default: .sleepwalker
        }
    }

    static func streakLevel(days: Int, phoenix: Bool = false) -> StreakLevel {
        if phoenix { return .phoenix }
        switch days {
        case 0: return .frozen
        case 91...: return .plasma
        case 31...: return .inferno
        case 8...: return .blaze
        default: return .spark
        }
    }

    static func radarStats(_ entries: [HabitEntry]) -> RadarStats {
        guard !entries.isEmpty else { return .zero }
        let n = Double(entries.count)
        let avgBusiness = Double(entries.reduce(0) { $0 + $1.businessMinutes }) / n
        let avgSleep = Double(entries.reduce(0) { $0 + $1.sleepMinutes }) / n
        let clean = Double(entries.filter(\.isPure).count)
        let exercise = Double(entries.filter(\.exercise).count)
        let eating = Double(entries.filter(\.cleanEating).count)
        let paradigm = Double(entries.filter(\.paradigm).count)
        return RadarStats(
            business: min(100, avgBusiness / businessTargetMinutes * 100),
            discipline: clean / n * 100,
            body: (exercise + eating) / (n * 2) * 100,
            mind: paradigm / n * 100,
            sleep: min(100, avgSleep / sleepTargetMinutes * 100)
        )
    }

    static func formatMinutes(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "\(m)p" }
        if m == 0 { return "\(h)ó" }
        return "\(h)ó \(m)p"
    }
}
