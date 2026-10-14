#if DEBUG
import Foundation

/// Csak debug: `-demo` indítási argumentummal mintaadatokkal indul az app, hálózat nélkül.
/// Képernyő-ellenőrzéshez és SwiftUI preview-khoz.
enum DemoData {
    static var isEnabled: Bool { ProcessInfo.processInfo.arguments.contains("-demo") }

    static let me = UserProfile(
        id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
        username: "kadosa", displayName: "Kadosa", avatar: "lion",
        bio: "Építem a napot, téglánként.", rank: .highperformer, monthlyAverage: 82.4, totalXp: 6400
    )

    static func entries(days: Int = 75, seed: Int = 1, skipToday: Bool = true) -> [HabitEntry] {
        var rng = SeededRandom(seed: UInt64(seed))
        let today = DateUtil.effectiveToday
        return ((skipToday ? 1 : 0)..<days).compactMap { offset -> HabitEntry? in
            if offset > 20 && rng.next() % 9 == 0 { return nil } // néhány kimaradt nap
            let date = DateUtil.addDays(today, -offset)
            var e = HabitEntry.new(date: date)
            e.bedTime = String(format: "%02d:%02d", [22, 23, 23, 0][Int(rng.next() % 4)], [0, 15, 30, 45][Int(rng.next() % 4)])
            e.wakeUpTime = String(format: "%02d:%02d", [6, 6, 7][Int(rng.next() % 3)], [0, 30][Int(rng.next() % 2)])
            e.sleepMinutes = Scoring.sleepMinutes(bedTime: e.bedTime, wakeUpTime: e.wakeUpTime)
            e.businessMinutes = 240 + Int(rng.next() % 420)
            e.exercise = rng.next() % 3 != 0
            e.cleanEating = rng.next() % 4 != 0
            e.paradigm = rng.next() % 2 == 0
            e.satisfaction = rng.next() % 6 == 0
            e.dopamineContent = rng.next() % 4 == 0
            e.gaming = rng.next() % 7 == 0
            e.approachedGoal = offset == 1 ? "Lezártam a negyedéves tervet, és edzettem is." : nil
            e.score = Scoring.totalScore(e)
            e.createdAt = Date()
            return e
        }
        .sorted { $0.date > $1.date }
    }

    static var friends: [Friend] {
        let people: [(String, String, String, Rank, Int, Int)] = [
            ("bence", "Bence", "wolf", .operator_, 12, 2),
            ("anna", "Anna", "bull", .monkmode, 41, 3),
            ("mate", "Máté", "lion", .grinder, 0, 4),
        ]
        return people.enumerated().map { i, p in
            let e = entries(days: 2, seed: p.5, skipToday: false)
            return Friend(
                id: UUID(uuidString: "00000000-0000-0000-0000-00000000001\(i)")!,
                username: p.0, displayName: p.1, avatar: p.2, rank: p.3, status: .connected,
                monthlyAverage: p.3.minScore + 3, totalXp: 3000 + i * 1500,
                streak: StreakData(currentStreak: p.4, longestStreak: p.4 + 5, level: Scoring.streakLevel(days: p.4)),
                todayEntry: i == 2 ? nil : e.first { $0.date == DateUtil.effectiveToday }
            )
        }
    }
}

/// Determinisztikus véletlen (mindig ugyanazok a demó adatok)
struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed &* 6364136223846793005 &+ 1442695040888963407 }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state >> 33
    }
}

extension AppStore {
    func loadDemo() {
        isDemo = true
        userId = DemoData.me.id
        profile = DemoData.me
        entries = DemoData.entries()
        let dates = Set(entries.map(\.date))
        var d = DateUtil.addDays(DateUtil.effectiveToday, -1), n = 0
        while dates.contains(d) { n += 1; d = DateUtil.addDays(d, -1) }
        streak = StreakData(currentStreak: n, longestStreak: max(n, 24), level: Scoring.streakLevel(days: n), cryoFreezeCount: min(3, n / 7))
        friends = DemoData.friends
        incoming = [Friend(id: UUID(), username: "zsofi", displayName: "Zsófi", avatar: "wolf", rank: .grinder, status: .pending,
                           monthlyAverage: 55, totalXp: 900, streak: StreakData(), todayEntry: nil)]
        unlockedBadges = ["deep_work_god": Date(), "iron_lung": Date()]
        phase = .signedIn
    }
}
#endif
