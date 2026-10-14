import SwiftUI

// MARK: - Napi bejegyzés

struct HabitEntry: Identifiable, Equatable, Hashable {
    var id: UUID
    var date: String // YYYY-MM-DD (budapesti nap)
    var wakeUpTime: String? // HH:mm
    var bedTime: String? // HH:mm
    var businessMinutes: Int = 0
    var sleepMinutes: Int = 0
    var cleanEating = false
    var exercise = false
    var paradigm = false
    var satisfaction = false
    var dopamineContent = false
    var gaming = false
    var score: Double = 0
    var approachedGoal: String?
    var businessObstacle: String?
    var personalObstacle: String?
    var createdAt: Date?
    var updatedAt: Date?

    static func new(date: String) -> HabitEntry {
        HabitEntry(id: UUID(), date: date)
    }

    var isPure: Bool { !satisfaction && !dopamineContent && !gaming }
}

// MARK: - Streak

enum StreakLevel: String, Codable, CaseIterable {
    case spark, blaze, inferno, plasma, frozen, phoenix

    var name: String {
        switch self {
        case .spark: "Spark"
        case .blaze: "Blaze"
        case .inferno: "Inferno"
        case .plasma: "Plasma"
        case .frozen: "Frozen"
        case .phoenix: "Phoenix"
        }
    }

    var color: Color {
        switch self {
        case .spark: Color(hex: 0xFFCC00)
        case .blaze: Color(hex: 0xFF7033)
        case .inferno: Color(hex: 0x33CCFF)
        case .plasma: Color(hex: 0xB833FF)
        case .frozen: Color(hex: 0x87CEEB)
        case .phoenix: Color(hex: 0xFF6B6B)
        }
    }

    var imageName: String { "streak_\(rawValue)" }
}

struct StreakData: Equatable {
    var currentStreak = 0
    var longestStreak = 0
    var level: StreakLevel = .frozen
    var cryoFreezeCount = 0
    var lastEntryDate: String?
    var phoenixActive = false
    var phoenixDaysRemaining = 0
    var phoenixStartStreak = 0
}

// MARK: - Rang

enum Rank: String, Codable, CaseIterable {
    case sleepwalker, grinder, operator_ = "operator", highperformer, monkmode, titan

    var name: String {
        switch self {
        case .sleepwalker: "Sleepwalker"
        case .grinder: "Grinder"
        case .operator_: "Operator"
        case .highperformer: "High Performer"
        case .monkmode: "Monk Mode Master"
        case .titan: "TITAN"
        }
    }

    var emoji: String {
        switch self {
        case .sleepwalker: "😴"
        case .grinder: "🔨"
        case .operator_: "⚙️"
        case .highperformer: "🚀"
        case .monkmode: "🧘‍♂️"
        case .titan: "⚡"
        }
    }

    var minScore: Double {
        switch self {
        case .sleepwalker: 0
        case .grinder: 50
        case .operator_: 70
        case .highperformer: 80
        case .monkmode: 90
        case .titan: 99
        }
    }

    var color: Color {
        switch self {
        case .sleepwalker: Color(hex: 0x6B7280)
        case .grinder: Color(hex: 0x9CA3AF)
        case .operator_: Color(hex: 0xF59E0B)
        case .highperformer: Color(hex: 0xEF4444)
        case .monkmode: Color(hex: 0x8B5CF6)
        case .titan: Color(hex: 0xFFD700)
        }
    }
}

// MARK: - Felhasználó

struct UserProfile: Identifiable, Equatable {
    var id: UUID
    var username: String
    var displayName: String
    var avatar: String // 'lion' | 'wolf' | 'bull' vagy kép URL
    var bio: String
    var rank: Rank
    var monthlyAverage: Double
    var totalXp: Int
    var createdAt: Date?
}

enum FriendStatus: String, Codable {
    case pending, connected
}

struct Friend: Identifiable, Equatable, Hashable {
    var id: UUID
    var username: String
    var displayName: String
    var avatar: String
    var rank: Rank
    var status: FriendStatus
    var monthlyAverage: Double
    var totalXp: Int
    var streak: StreakData
    var todayEntry: HabitEntry?

    var todayCompleted: Bool { todayEntry != nil }

    static func == (lhs: Friend, rhs: Friend) -> Bool {
        lhs.id == rhs.id && lhs.status == rhs.status && lhs.todayEntry == rhs.todayEntry && lhs.streak == rhs.streak
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Badge

struct Badge: Identifiable, Equatable {
    enum Category: String { case streak, focus, vitality, will, mind, special }

    let id: String
    let name: String
    let description: String
    let icon: String
    let category: Category
    let requirement: String
    var unlockedAt: Date?

    var isUnlocked: Bool { unlockedAt != nil }
}

// MARK: - Beállítások

struct NotificationSettings: Codable, Equatable {
    var enabled = true
    var morningEnabled = true
    var afternoonEnabled = true
    var eveningEnabled = true
    var streakEnabled = true
    var socialEnabled = true
    var morningTime = "07:00"
    var afternoonTime = "15:00"
    var eveningTime = "21:00"
    var inputMode: String?
}

// MARK: - Ranglista

enum LeaderboardPeriod: String, CaseIterable, Identifiable {
    case today, week, month
    var id: String { rawValue }
    var title: String {
        switch self {
        case .today: "Ma"
        case .week: "Hét"
        case .month: "Hónap"
        }
    }
}

struct LeaderboardRow: Identifiable, Equatable {
    var id: UUID { userId }
    let userId: UUID
    let position: Int
    let username: String
    let displayName: String
    let avatar: String
    let rank: Rank
    let score: Int
    let isCurrentUser: Bool
}

// MARK: - Radar

struct RadarStats: Equatable {
    var business: Double
    var discipline: Double
    var body: Double
    var mind: Double
    var sleep: Double

    static let zero = RadarStats(business: 0, discipline: 0, body: 0, mind: 0, sleep: 0)

    var values: [Double] { [business, discipline, body, mind, sleep] }
    static let labels = ["Business", "Fegyelem", "Test", "Elme", "Alvás"]
}

// MARK: - AI elemzés (generate-insight)

struct InsightResult: Codable, Equatable {
    struct Section: Codable, Equatable, Identifiable {
        var id: String { type }
        let type: String
        let title: String
        let text: String
        let scoreUser: Double
        let scoreFriend: Double
    }

    struct KeyStat: Codable, Equatable, Identifiable {
        var id: String { label }
        let label: String
        let diff: String
        let advantage: String
    }

    let title: String
    let winnerId: String
    let verdict_short: String
    let daily_mission: String
    let sections: [Section]
    let key_stats: [KeyStat]
}
