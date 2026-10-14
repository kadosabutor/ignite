import Foundation
import Supabase

let supabase = SupabaseClient(supabaseURL: Config.supabaseURL, supabaseKey: Config.supabaseKey)

/// Adatbázis-hozzáférés – a webapp src/lib/supabase.ts megfelelője.
/// A users.email oszlop nem olvasható a kliensről, ezért mindig explicit oszloplistát kérünk,
/// és a users táblán az update-eknél `returning: .minimal` kell (különben RETURNING * → permission denied).
enum API {
    static let userColumns = "id, username, display_name, avatar, bio, rank, monthly_average, total_xp, created_at"

    // MARK: - Sorok (DB formátum)

    struct UserRow: Codable {
        let id: UUID
        let username: String
        let display_name: String?
        let avatar: String?
        let bio: String?
        let rank: String?
        let monthly_average: Double?
        let total_xp: Int?
        let created_at: String?

        var profile: UserProfile {
            UserProfile(
                id: id,
                username: username,
                displayName: display_name ?? username,
                avatar: avatar ?? "lion",
                bio: bio ?? "",
                rank: Rank(rawValue: rank ?? "") ?? .sleepwalker,
                monthlyAverage: monthly_average ?? 0,
                totalXp: total_xp ?? 0,
                createdAt: parseTimestamp(created_at)
            )
        }
    }

    struct EntryRow: Codable {
        let id: UUID
        let user_id: UUID
        let date: String
        let wake_up_time: String?
        let bed_time: String?
        let business_minutes: Int?
        let sleep_minutes: Int?
        let clean_eating: Bool?
        let exercise: Bool?
        let paradigm: Int?
        let satisfaction: Bool?
        let dopamine_content: Bool?
        let gaming: Bool?
        let score: Double?
        let reflection_goal: String?
        let reflection_obstacle: String?
        let reflection_personal: String?
        let created_at: String?
        let updated_at: String?

        var entry: HabitEntry {
            HabitEntry(
                id: id,
                date: date,
                wakeUpTime: wake_up_time,
                bedTime: bed_time,
                businessMinutes: business_minutes ?? 0,
                sleepMinutes: sleep_minutes ?? 0,
                cleanEating: clean_eating ?? false,
                exercise: exercise ?? false,
                paradigm: (paradigm ?? 0) >= 1,
                satisfaction: satisfaction ?? false,
                dopamineContent: dopamine_content ?? false,
                gaming: gaming ?? false,
                score: score ?? 0,
                approachedGoal: reflection_goal,
                businessObstacle: reflection_obstacle,
                personalObstacle: reflection_personal,
                createdAt: parseTimestamp(created_at),
                updatedAt: parseTimestamp(updated_at)
            )
        }
    }

    struct EntryUpsert: Encodable {
        let id: UUID
        let user_id: UUID
        let date: String
        let wake_up_time: String?
        let bed_time: String?
        let business_minutes: Int
        let sleep_minutes: Int
        let clean_eating: Bool
        let exercise: Bool
        let paradigm: Int
        let satisfaction: Bool
        let dopamine_content: Bool
        let gaming: Bool
        let score: Double
        let reflection_goal: String?
        let reflection_obstacle: String?
        let reflection_personal: String?
        let updated_at: String
    }

    struct StreakRow: Codable {
        let user_id: UUID
        let current_streak: Int?
        let longest_streak: Int?
        let level: String?
        let cryo_freeze_count: Int?
        let last_entry_date: String?
        let phoenix_active: Bool?
        let phoenix_days_remaining: Int?
        let phoenix_start_streak: Int?

        var streak: StreakData {
            StreakData(
                currentStreak: current_streak ?? 0,
                longestStreak: longest_streak ?? 0,
                level: StreakLevel(rawValue: level ?? "") ?? .frozen,
                cryoFreezeCount: cryo_freeze_count ?? 0,
                lastEntryDate: last_entry_date,
                phoenixActive: phoenix_active ?? false,
                phoenixDaysRemaining: phoenix_days_remaining ?? 0,
                phoenixStartStreak: phoenix_start_streak ?? 0
            )
        }

        init(userId: UUID, _ s: StreakData) {
            user_id = userId
            current_streak = s.currentStreak
            longest_streak = s.longestStreak
            level = s.level.rawValue
            cryo_freeze_count = s.cryoFreezeCount
            last_entry_date = s.lastEntryDate
            phoenix_active = s.phoenixActive
            phoenix_days_remaining = s.phoenixDaysRemaining
            phoenix_start_streak = s.phoenixStartStreak
        }
    }

    // MARK: - Időbélyegek

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso = ISO8601DateFormatter()

    static func parseTimestamp(_ s: String?) -> Date? {
        guard let s else { return nil }
        return isoFractional.date(from: s) ?? iso.date(from: s)
    }

    static func nowTimestamp() -> String { isoFractional.string(from: Date()) }

    // MARK: - Auth

    static func isUsernameAvailable(_ username: String) async throws -> Bool {
        try await supabase.rpc("is_username_available", params: ["p_username": username]).execute().value
    }

    static func signUp(email: String, password: String, username: String, displayName: String, avatar: String) async throws {
        guard try await isUsernameAvailable(username) else {
            throw AppError.message("Ez a felhasználónév már foglalt")
        }
        // A users / streaks / settings sorokat az on_auth_user_created trigger hozza létre
        try await supabase.auth.signUp(
            email: email,
            password: password,
            data: [
                "username": .string(username),
                "display_name": .string(displayName),
                "avatar": .string(avatar),
            ]
        )
    }

    // MARK: - Profil

    static func profile(_ userId: UUID) async throws -> UserProfile? {
        let rows: [UserRow] = try await supabase.from("users")
            .select(userColumns)
            .eq("id", value: userId.uuidString)
            .limit(1)
            .execute().value
        return rows.first?.profile
    }

    static func saveProfile(_ userId: UUID, displayName: String, bio: String, avatar: String) async throws {
        struct Update: Encodable { let display_name: String; let bio: String; let avatar: String; let updated_at: String }
        try await supabase.from("users")
            .update(Update(display_name: displayName, bio: bio, avatar: avatar, updated_at: nowTimestamp()), returning: .minimal)
            .eq("id", value: userId.uuidString)
            .execute()
    }

    static func uploadAvatar(_ userId: UUID, jpeg: Data) async throws -> String {
        let bucket = supabase.storage.from("avatars")
        let folder = userId.uuidString.lowercased()
        if let old = try? await bucket.list(path: folder), !old.isEmpty {
            _ = try? await bucket.remove(paths: old.map { "\(folder)/\($0.name)" })
        }
        let path = "\(folder)/\(Int(Date().timeIntervalSince1970)).jpg"
        try await bucket.upload(path, data: jpeg, options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: true))
        return try bucket.getPublicURL(path: path).absoluteString
    }

    static func searchUsers(_ query: String) async throws -> [UserProfile] {
        let q = query.filter { !",()*%\\".contains($0) }.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return [] }
        let rows: [UserRow] = try await supabase.from("users")
            .select(userColumns)
            .or("username.ilike.%\(q)%,display_name.ilike.%\(q)%")
            .limit(20)
            .execute().value
        return rows.map(\.profile)
    }

    static func addXP(_ userId: UUID, amount: Int) async throws {
        struct XPRow: Decodable { let total_xp: Int? }
        let rows: [XPRow] = try await supabase.from("users").select("total_xp").eq("id", value: userId.uuidString).execute().value
        let current = rows.first?.total_xp ?? 0
        try await supabase.from("users")
            .update(["total_xp": current + amount], returning: .minimal)
            .eq("id", value: userId.uuidString)
            .execute()
    }

    static func updateRank(_ userId: UUID, monthlyAverage: Double, rank: Rank) async throws {
        struct Update: Encodable { let monthly_average: Double; let rank: String; let updated_at: String }
        try await supabase.from("users")
            .update(Update(monthly_average: (monthlyAverage * 10).rounded() / 10, rank: rank.rawValue, updated_at: nowTimestamp()), returning: .minimal)
            .eq("id", value: userId.uuidString)
            .execute()
    }

    // MARK: - Bejegyzések

    /// Dátum szerint csökkenő sorrendben
    static func entries(_ userId: UUID, since: String? = nil) async throws -> [HabitEntry] {
        var query = supabase.from("entries").select().eq("user_id", value: userId.uuidString)
        if let since { query = query.gte("date", value: since) }
        let rows: [EntryRow] = try await query.order("date", ascending: false).execute().value
        return rows.map(\.entry)
    }

    static func upsertEntry(_ userId: UUID, _ e: HabitEntry) async throws {
        let row = EntryUpsert(
            id: e.id, user_id: userId, date: e.date,
            wake_up_time: e.wakeUpTime, bed_time: e.bedTime,
            business_minutes: e.businessMinutes, sleep_minutes: e.sleepMinutes,
            clean_eating: e.cleanEating, exercise: e.exercise, paradigm: e.paradigm ? 1 : 0,
            satisfaction: e.satisfaction, dopamine_content: e.dopamineContent, gaming: e.gaming,
            score: Scoring.totalScore(e),
            reflection_goal: e.approachedGoal, reflection_obstacle: e.businessObstacle, reflection_personal: e.personalObstacle,
            updated_at: nowTimestamp()
        )
        try await supabase.from("entries").upsert(row, onConflict: "user_id,date").execute()
    }

    static func deleteEntry(_ userId: UUID, date: String) async throws {
        try await supabase.from("entries").delete().eq("user_id", value: userId.uuidString).eq("date", value: date).execute()
    }

    // MARK: - Streak

    static func streak(_ userId: UUID) async throws -> StreakData {
        let rows: [StreakRow] = try await supabase.from("streaks").select().eq("user_id", value: userId.uuidString).execute().value
        return rows.first?.streak ?? StreakData()
    }

    static func saveStreak(_ userId: UUID, _ s: StreakData) async throws {
        try await supabase.from("streaks").upsert(StreakRow(userId: userId, s), onConflict: "user_id").execute()
    }

    static func streaks(_ userIds: [UUID]) async throws -> [UUID: StreakData] {
        guard !userIds.isEmpty else { return [:] }
        let rows: [StreakRow] = try await supabase.from("streaks").select()
            .in("user_id", values: userIds.map(\.uuidString))
            .execute().value
        return Dictionary(rows.map { ($0.user_id, $0.streak) }, uniquingKeysWith: { a, _ in a })
    }

    // MARK: - Badge-ek

    static func unlockedBadges(_ userId: UUID) async throws -> [String: Date] {
        struct Row: Decodable { let badge_id: String; let unlocked_at: String? }
        let rows: [Row] = try await supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", value: userId.uuidString).execute().value
        var result: [String: Date] = [:]
        for r in rows { result[r.badge_id] = parseTimestamp(r.unlocked_at) ?? Date() }
        return result
    }

    static func insertBadges(_ userId: UUID, ids: [String]) async throws {
        struct Row: Encodable { let user_id: UUID; let badge_id: String; let unlocked_at: String }
        guard !ids.isEmpty else { return }
        let now = nowTimestamp()
        try await supabase.from("user_badges").insert(ids.map { Row(user_id: userId, badge_id: $0, unlocked_at: now) }).execute()
    }

    // MARK: - Barátok

    private struct FriendshipRow: Decodable {
        let id: UUID
        let status: String
        let friend: UserRow?
        let user: UserRow?
    }

    private static let embeddedUser = "id, username, display_name, avatar, rank, monthly_average, total_xp"

    static func friends(_ userId: UUID) async throws -> [Friend] {
        let rows: [FriendshipRow] = try await supabase.from("friendships")
            .select("id, status, friend:friend_id(\(embeddedUser))")
            .eq("user_id", value: userId.uuidString)
            .eq("status", value: "connected")
            .execute().value
        let users = rows.compactMap(\.friend)
        let ids = users.map(\.id)

        async let streaksTask = streaks(ids)
        async let todayTask = todayEntries(ids)
        let (streaks, today) = try await (streaksTask, todayTask)

        return users.map { u in
            let p = u.profile
            return Friend(id: p.id, username: p.username, displayName: p.displayName, avatar: p.avatar, rank: p.rank,
                          status: .connected, monthlyAverage: p.monthlyAverage, totalXp: p.totalXp,
                          streak: streaks[p.id] ?? StreakData(), todayEntry: today[p.id])
        }
    }

    private static func todayEntries(_ userIds: [UUID]) async throws -> [UUID: HabitEntry] {
        guard !userIds.isEmpty else { return [:] }
        let rows: [EntryRow] = try await supabase.from("entries").select()
            .in("user_id", values: userIds.map(\.uuidString))
            .eq("date", value: DateUtil.effectiveToday)
            .execute().value
        return Dictionary(rows.map { ($0.user_id, $0.entry) }, uniquingKeysWith: { a, _ in a })
    }

    static func pendingRequests(_ userId: UUID) async throws -> (incoming: [Friend], outgoing: [Friend]) {
        async let incomingTask: [FriendshipRow] = supabase.from("friendships")
            .select("id, status, user:user_id(\(embeddedUser))")
            .eq("friend_id", value: userId.uuidString)
            .eq("status", value: "pending")
            .execute().value
        async let outgoingTask: [FriendshipRow] = supabase.from("friendships")
            .select("id, status, friend:friend_id(\(embeddedUser))")
            .eq("user_id", value: userId.uuidString)
            .eq("status", value: "pending")
            .execute().value
        let (incomingRows, outgoingRows) = try await (incomingTask, outgoingTask)

        func pending(_ u: UserRow) -> Friend {
            let p = u.profile
            return Friend(id: p.id, username: p.username, displayName: p.displayName, avatar: p.avatar, rank: p.rank,
                          status: .pending, monthlyAverage: p.monthlyAverage, totalXp: p.totalXp, streak: StreakData(), todayEntry: nil)
        }
        return (incomingRows.compactMap(\.user).map(pending), outgoingRows.compactMap(\.friend).map(pending))
    }

    static func addFriend(_ userId: UUID, target: UUID) async throws {
        guard target != userId else { throw AppError.message("Nem adhatod hozzá magadat") }
        struct Row: Decodable { let status: String }
        let existing: [Row] = try await supabase.from("friendships")
            .select("status")
            .or("and(user_id.eq.\(userId.uuidString),friend_id.eq.\(target.uuidString)),and(user_id.eq.\(target.uuidString),friend_id.eq.\(userId.uuidString))")
            .execute().value
        if let e = existing.first {
            throw AppError.message(e.status == "connected" ? "Már barátok vagytok" : "Barátkérelem már küldve")
        }
        try await supabase.from("friendships")
            .insert(["user_id": userId.uuidString, "friend_id": target.uuidString, "status": "pending"])
            .execute()
    }

    static func acceptRequest(_ userId: UUID, from requester: UUID) async throws {
        try await supabase.from("friendships")
            .update(["status": "connected"])
            .eq("user_id", value: requester.uuidString)
            .eq("friend_id", value: userId.uuidString)
            .eq("status", value: "pending")
            .execute()
        try await supabase.from("friendships")
            .insert(["user_id": userId.uuidString, "friend_id": requester.uuidString, "status": "connected"])
            .execute()
    }

    static func deletePending(from sender: UUID, to receiver: UUID) async throws {
        try await supabase.from("friendships").delete()
            .eq("user_id", value: sender.uuidString)
            .eq("friend_id", value: receiver.uuidString)
            .eq("status", value: "pending")
            .execute()
    }

    static func removeFriend(_ userId: UUID, friend: UUID) async throws {
        try await supabase.from("friendships").delete()
            .or("and(user_id.eq.\(userId.uuidString),friend_id.eq.\(friend.uuidString)),and(user_id.eq.\(friend.uuidString),friend_id.eq.\(userId.uuidString))")
            .execute()
    }

    static func friendEntries(_ friendId: UUID, days: Int = 30) async throws -> [HabitEntry] {
        try await entries(friendId, since: DateUtil.addDays(DateUtil.effectiveToday, -days))
    }

    // MARK: - Ranglista

    static func leaderboard(_ me: UserProfile, friends: [Friend], period: LeaderboardPeriod) async throws -> [LeaderboardRow] {
        let today = DateUtil.effectiveToday
        let start: String = switch period {
        case .today: today
        case .week: DateUtil.addDays(today, -7)
        case .month: String(today.prefix(7)) + "-01"
        }
        let ids = friends.map(\.id) + [me.id]

        struct Row: Decodable { let user_id: UUID; let score: Double? }
        let rows: [Row] = try await supabase.from("entries").select("user_id, score")
            .in("user_id", values: ids.map(\.uuidString))
            .gte("date", value: start)
            .lte("date", value: today)
            .execute().value

        var totals: [UUID: (Double, Int)] = [:]
        for r in rows {
            let t = totals[r.user_id] ?? (0, 0)
            totals[r.user_id] = (t.0 + (r.score ?? 0), t.1 + 1)
        }
        func avg(_ id: UUID) -> Int {
            guard let t = totals[id], t.1 > 0 else { return 0 }
            return Int((t.0 / Double(t.1)).rounded())
        }

        var people: [(UUID, String, String, String, Rank, Bool)] = friends.map { ($0.id, $0.username, $0.displayName, $0.avatar, $0.rank, false) }
        people.append((me.id, me.username, me.displayName, me.avatar, me.rank, true))
        let sorted = people.sorted { avg($0.0) > avg($1.0) }
        return sorted.enumerated().map { i, p in
            LeaderboardRow(userId: p.0, position: i + 1, username: p.1, displayName: p.2, avatar: p.3, rank: p.4, score: avg(p.0), isCurrentUser: p.5)
        }
    }

    // MARK: - Beállítások

    static func settings(_ userId: UUID) async throws -> NotificationSettings {
        struct Row: Decodable { let notifications: NotificationSettings? }
        let rows: [Row] = try await supabase.from("settings").select("notifications").eq("user_id", value: userId.uuidString).execute().value
        return rows.first?.notifications ?? NotificationSettings()
    }

    static func saveSettings(_ userId: UUID, _ s: NotificationSettings) async throws {
        struct Row: Encodable { let user_id: UUID; let notifications: NotificationSettings; let updated_at: String }
        try await supabase.from("settings")
            .upsert(Row(user_id: userId, notifications: s, updated_at: nowTimestamp()), onConflict: "user_id")
            .execute()
    }

    // MARK: - Edge Functions

    static func sendPush(to recipient: UUID, title: String, body: String, type: String) async throws {
        struct Payload: Encodable {
            struct DataField: Encodable { let type: String }
            let recipientUserId: String
            let title: String
            let body: String
            let data: DataField
        }
        try await supabase.functions.invoke(
            "send-push",
            options: FunctionInvokeOptions(body: Payload(recipientUserId: recipient.uuidString.lowercased(), title: title, body: body, data: .init(type: type)))
        )
    }

    static func generateInsight(userEntries: [HabitEntry], friendEntries: [HabitEntry], userName: String, friendName: String) async throws -> InsightResult {
        struct Payload: Encodable {
            let userStats: [String: Int]
            let friendStats: [String: Int]
            let userHighlights: [String]
            let friendHighlights: [String]
            let userName: String
            let friendName: String
            let date: String
        }
        struct ErrorBody: Decodable { let error: String? }

        let payload = Payload(
            userStats: Insights.aggregate(userEntries),
            friendStats: Insights.aggregate(friendEntries),
            userHighlights: Insights.highlights(userEntries, name: "User"),
            friendHighlights: Insights.highlights(friendEntries, name: "Friend"),
            userName: userName,
            friendName: friendName,
            date: nowTimestamp()
        )

        let data: Data = try await supabase.functions.invoke("generate-insight", options: FunctionInvokeOptions(body: payload)) { data, _ in data }
        if let result = try? JSONDecoder().decode(InsightResult.self, from: data) { return result }
        let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error ?? "Ismeretlen hiba"
        throw AppError.message(message)
    }
}

enum AppError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let m): m }
    }
}

/// Az AI elemzés bemenete (webapp: src/lib/insight-engine.ts)
enum Insights {
    static func aggregate(_ entries: [HabitEntry]) -> [String: Int] {
        let n = max(1, entries.count)
        func rate(_ f: (HabitEntry) -> Bool) -> Int { Int((Double(entries.filter(f).count) / Double(n) * 100).rounded()) }
        return [
            "daysCount": entries.count,
            "scoreAvg": Int((entries.reduce(0) { $0 + $1.score } / Double(n)).rounded()),
            "businessTotal": entries.reduce(0) { $0 + $1.businessMinutes },
            "sleepAvg": entries.reduce(0) { $0 + $1.sleepMinutes } / n,
            "exerciseRate": rate(\.exercise),
            "cleanEatingRate": rate(\.cleanEating),
            "paradigmRate": rate(\.paradigm),
            "satisfactionRate": rate(\.satisfaction),
            "dopamineRate": rate(\.dopamineContent),
            "gamingRate": rate(\.gaming),
        ]
    }

    static func highlights(_ entries: [HabitEntry], name: String) -> [String] {
        guard !entries.isEmpty else { return [] }
        var result: [String] = []
        if let minSleep = entries.filter({ $0.sleepMinutes > 0 }).min(by: { $0.sleepMinutes < $1.sleepMinutes }), minSleep.sleepMinutes < 300 {
            result.append("\(name) egyik nap csak \(Int((Double(minSleep.sleepMinutes) / 60).rounded())) órát aludt.")
        }
        if let maxWork = entries.max(by: { $0.businessMinutes < $1.businessMinutes }), maxWork.businessMinutes > 480 {
            result.append("\(name) rekordja: \(Int((Double(maxWork.businessMinutes) / 60).rounded())) óra munka egy nap alatt.")
        }
        if Double(entries.filter(\.gaming).count) > Double(entries.count) * 0.5 {
            result.append("\(name) a napok több mint felében játszott.")
        }
        if entries.filter(\.exercise).isEmpty && entries.count > 3 {
            result.append("\(name) egyszer sem edzett az elmúlt időszakban.")
        }
        return result
    }
}
