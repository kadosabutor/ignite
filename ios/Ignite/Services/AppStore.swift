import Foundation
import Observation
import Supabase

/// Az app központi állapota – a webapp HabitContext.tsx megfelelője.
@MainActor
@Observable
final class AppStore {
    enum Phase { case loading, signedOut, signedIn }

    var phase: Phase = .loading
    var userId: UUID?
    var profile: UserProfile?
    var entries: [HabitEntry] = [] // dátum szerint csökkenő
    var streak = StreakData()
    var friends: [Friend] = []
    var incoming: [Friend] = []
    var outgoing: [Friend] = []
    var unlockedBadges: [String: Date] = [:]
    var settings = NotificationSettings()
    var errorMessage: String?
    /// Csak debug demó mód: nincs hálózat
    var isDemo = false

    @ObservationIgnored private var authTask: Task<Void, Never>?

    // MARK: - Származtatott értékek

    var todayEntry: HabitEntry? { entry(for: DateUtil.effectiveToday) }

    func entry(for date: String) -> HabitEntry? { entries.first { $0.date == date } }

    var weeklyAverage: Double {
        let start = DateUtil.addDays(DateUtil.effectiveToday, -6)
        let week = entries.filter { $0.date >= start }
        guard !week.isEmpty else { return 0 }
        return week.reduce(0) { $0 + $1.score } / Double(week.count)
    }

    var badges: [Badge] {
        Gamification.badges.map { b in
            var b = b
            b.unlockedAt = unlockedBadges[b.id]
            return b
        }
    }

    // MARK: - Auth

    func start() {
        guard authTask == nil else { return }
        #if DEBUG
        if DemoData.isEnabled { loadDemo(); return }
        #endif
        authTask = Task { [weak self] in
            for await (event, session) in supabase.auth.authStateChanges {
                guard let self else { return }
                switch event {
                case .initialSession, .signedIn:
                    if let session, !session.isExpired {
                        await self.didSignIn(session.user.id)
                    } else if event == .initialSession {
                        self.phase = .signedOut
                    }
                case .signedOut:
                    self.reset()
                default:
                    break
                }
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String, username: String, displayName: String, avatar: String) async throws {
        try await API.signUp(email: email, password: password, username: username, displayName: displayName, avatar: avatar)
    }

    func signOut() async {
        await PushManager.shared.unregisterCurrentToken()
        try? await supabase.auth.signOut()
        reset()
    }

    private func didSignIn(_ id: UUID) async {
        guard userId != id || phase != .signedIn else { return }
        userId = id
        await refreshAll()
        phase = .signedIn
        PushManager.shared.registerIfAuthorized()
    }

    private func reset() {
        userId = nil
        profile = nil
        entries = []
        streak = StreakData()
        friends = []
        incoming = []
        outgoing = []
        unlockedBadges = [:]
        settings = NotificationSettings()
        phase = .signedOut
    }

    // MARK: - Betöltés

    func refreshAll() async {
        guard let id = userId, !isDemo else { return }
        // Minden adat külön töltődik: egy hiba ne ürítse ki az egész appot
        async let p = Result { try await API.profile(id) }
        async let e = Result { try await API.entries(id) }
        async let s = Result { try await API.streak(id) }
        async let b = Result { try await API.unlockedBadges(id) }
        async let st = Result { try await API.settings(id) }
        let (pr, er, sr, br, str) = await (p, e, s, b, st)

        var failures: [Error] = []
        func take<T>(_ r: Result<T, Error>, _ assign: (T) -> Void) {
            switch r {
            case .success(let v): assign(v)
            case .failure(let err): failures.append(err)
            }
        }
        take(pr) { profile = $0 }
        take(er) { entries = $0 }
        take(sr) { streak = $0 }
        take(br) { unlockedBadges = $0 }
        take(str) { settings = $0 }

        if let first = failures.first {
            errorMessage = "Nem sikerült minden adatot betölteni: \(first.localizedDescription)"
        } else {
            // A streak a napváltás miatt elavulhat – újraszámoljuk
            do { try await recomputeStreakAndRank() } catch { errorMessage = error.localizedDescription }
        }
        await refreshFriends()
    }

    func refreshFriends() async {
        guard let id = userId, !isDemo else { return }
        do {
            async let f = API.friends(id)
            async let pending = API.pendingRequests(id)
            let (friendsResult, pendingResult) = try await (f, pending)
            friends = friendsResult
            incoming = pendingResult.incoming
            outgoing = pendingResult.outgoing
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Mentés

    /// Elmenti a bejegyzést, frissíti a streaket, rangot, badge-eket és XP-t.
    /// - Returns: az újonnan megszerzett badge-ek
    @discardableResult
    func save(_ entry: HabitEntry, awardXP: Bool = false) async throws -> [Badge] {
        guard let id = userId else { return [] }
        var e = entry
        e.sleepMinutes = (e.bedTime != nil && e.wakeUpTime != nil)
            ? Scoring.sleepMinutes(bedTime: e.bedTime, wakeUpTime: e.wakeUpTime)
            : e.sleepMinutes
        e.score = Scoring.totalScore(e)
        let isNew = self.entry(for: e.date) == nil
        if e.createdAt == nil { e.createdAt = Date() }

        if isDemo {
            entries.removeAll { $0.date == e.date }
            entries.append(e)
            entries.sort { $0.date > $1.date }
            return Gamification.badges.filter { Gamification.newBadges(current: e, entries: entries, streak: streak, unlocked: Set(unlockedBadges.keys)).contains($0.id) }
        }

        try await API.upsertEntry(id, e)

        // Helyi állapot frissítése (csökkenő dátum szerint)
        entries.removeAll { $0.date == e.date }
        entries.append(e)
        entries.sort { $0.date > $1.date }

        try await recomputeStreakAndRank()

        let newIds = Gamification.newBadges(current: e, entries: entries, streak: streak, unlocked: Set(unlockedBadges.keys))
        if !newIds.isEmpty {
            try await API.insertBadges(id, ids: newIds)
            for b in newIds { unlockedBadges[b] = Date() }
        }

        if awardXP && isNew {
            let xp = Gamification.dailyXP(e)
            try await API.addXP(id, amount: xp)
            profile?.totalXp += xp
        }

        return Gamification.badges.filter { newIds.contains($0.id) }
    }

    func delete(date: String) async throws {
        guard let id = userId else { return }
        if isDemo { entries.removeAll { $0.date == date }; return }
        try await API.deleteEntry(id, date: date)
        entries.removeAll { $0.date == date }
        try await recomputeStreakAndRank()
    }

    /// Streak + havi átlag/rang – a webapp updateStreak() logikája
    private func recomputeStreakAndRank() async throws {
        guard let id = userId else { return }
        let dates = Set(entries.map(\.date))
        let today = DateUtil.effectiveToday
        var check = dates.contains(today) ? today : DateUtil.addDays(today, -1)
        var count = 0
        while dates.contains(check) {
            count += 1
            check = DateUtil.addDays(check, -1)
        }

        var s = streak
        s.currentStreak = count
        s.longestStreak = max(streak.longestStreak, count)
        s.cryoFreezeCount = min(3, count / 7)
        s.level = Scoring.streakLevel(days: count, phoenix: streak.phoenixActive)
        s.lastEntryDate = entries.first?.date

        if s != streak || entries.isEmpty {
            streak = s
            try await API.saveStreak(id, s)
        }

        let monthPrefix = String(today.prefix(7))
        let month = entries.filter { $0.date.hasPrefix(monthPrefix) }
        let avg = month.isEmpty ? 0 : month.reduce(0) { $0 + $1.score } / Double(month.count)
        let rank = Scoring.rank(fromAverage: avg)
        if profile?.rank != rank || abs((profile?.monthlyAverage ?? 0) - avg) >= 0.05 {
            try await API.updateRank(id, monthlyAverage: avg, rank: rank)
            profile?.monthlyAverage = (avg * 10).rounded() / 10
            profile?.rank = rank
        }
    }

    // MARK: - Profil és beállítások

    func saveProfile(displayName: String, bio: String, avatar: String) async throws {
        guard let id = userId else { return }
        if !isDemo { try await API.saveProfile(id, displayName: displayName, bio: bio, avatar: avatar) }
        profile?.displayName = displayName
        profile?.bio = bio
        profile?.avatar = avatar
    }

    func uploadAvatar(_ jpeg: Data) async throws {
        guard let id = userId, let p = profile else { return }
        let url = try await API.uploadAvatar(id, jpeg: jpeg)
        try await saveProfile(displayName: p.displayName, bio: p.bio, avatar: url)
    }

    func saveSettings(_ s: NotificationSettings) async {
        guard let id = userId else { return }
        settings = s
        guard !isDemo else { return }
        do { try await API.saveSettings(id, s) } catch { errorMessage = error.localizedDescription }
    }

    // MARK: - Barátok

    func addFriend(_ user: UserProfile) async throws {
        guard let id = userId else { return }
        try await API.addFriend(id, target: user.id)
        await notify(user.id, title: "👋 Új Barátkérelem!", body: "\(myName) barátkérelmet küldött neked!", type: "friend_request")
        await refreshFriends()
    }

    func accept(_ friend: Friend) async throws {
        guard let id = userId else { return }
        try await API.acceptRequest(id, from: friend.id)
        await notify(friend.id, title: "✅ Barátkérelem Elfogadva!", body: "\(myName) elfogadta a barátkérelmedet!", type: "friend_request_accepted")
        await refreshFriends()
    }

    func reject(_ friend: Friend) async throws {
        guard let id = userId else { return }
        try await API.deletePending(from: friend.id, to: id)
        await refreshFriends()
    }

    func cancel(_ friend: Friend) async throws {
        guard let id = userId else { return }
        try await API.deletePending(from: id, to: friend.id)
        await refreshFriends()
    }

    func remove(_ friend: Friend) async throws {
        guard let id = userId else { return }
        try await API.removeFriend(id, friend: friend.id)
        await refreshFriends()
    }

    func leaderboard(_ period: LeaderboardPeriod) async throws -> [LeaderboardRow] {
        guard let me = profile else { return [] }
        if isDemo {
            var people = friends.map { ($0, Int(($0.todayEntry?.score ?? $0.monthlyAverage).rounded())) }
            let mine = Int((period == .today ? (todayEntry?.score ?? 0) : weeklyAverage).rounded())
            people.sort { $0.1 > $1.1 }
            var rows = people.map { LeaderboardRow(userId: $0.0.id, position: 0, username: $0.0.username, displayName: $0.0.displayName, avatar: $0.0.avatar, rank: $0.0.rank, score: $0.1, isCurrentUser: false) }
            rows.append(LeaderboardRow(userId: me.id, position: 0, username: me.username, displayName: me.displayName, avatar: me.avatar, rank: me.rank, score: mine, isCurrentUser: true))
            rows.sort { $0.score > $1.score }
            return rows.enumerated().map { i, r in
                LeaderboardRow(userId: r.userId, position: i + 1, username: r.username, displayName: r.displayName, avatar: r.avatar, rank: r.rank, score: r.score, isCurrentUser: r.isCurrentUser)
            }
        }
        return try await API.leaderboard(me, friends: friends, period: period)
    }

    func entries(of friend: Friend) async -> [HabitEntry] {
        #if DEBUG
        if isDemo { return DemoData.entries(days: 31, seed: friend.username.count, skipToday: false) }
        #endif
        return (try? await API.friendEntries(friend.id)) ?? []
    }

    enum Reaction { case fire, ping }

    func react(_ reaction: Reaction, to friend: Friend) async {
        switch reaction {
        case .fire:
            await notify(friend.id, title: "Tűz elismerés! 🔥", body: Messages.fire.randomElement()!, type: "fire")
        case .ping:
            await notify(friend.id, title: "Ping! 👋", body: Messages.ping.randomElement()!, type: "ping")
        }
    }

    private var myName: String { profile?.displayName ?? profile?.username ?? "Valaki" }

    private func notify(_ recipient: UUID, title: String, body: String, type: String) async {
        guard !isDemo else { return }
        // Az értesítés hibája ne törje meg a fő műveletet
        try? await API.sendPush(to: recipient, title: title, body: body, type: type)
    }
}

/// Ping / tűz üzenetek (webapp: src/lib/push.ts)
enum Messages {
    static let ping = [
        "Hé, mikor lesz már bejegyzés? 🔥",
        "Ne aludj el, haver! ⚡",
        "Gyerünk, ma is megcsináljuk! 💪",
        "Ébresztő! Ideje rögzíteni! 🌅",
        "A streak nem tartja magát! 🔥",
        "Egy igazi harcos nem hagy ki napot! ⚔️",
        "Tick-tock... a nap véget ér! ⏰",
        "Mutasd meg, miből vagy! 💥",
    ]

    static let fire = [
        "Elismerték a mai teljesítményedet! 🔥",
        "Fantasztikus munka! Tűz vagy! 💪",
        "Valaki elismerésben részesített! 🎉",
        "Tűz elismerés érkezett! Te vagy a hős! ⚔️",
        "Elismerésben részesítettek! Csillogsz! ✨",
        "Valaki tüzet adott neked! Fantasztikus! 🔥",
        "Elismerés érkezett! Folytasd így! 💥",
        "Tűz elismerés! Te vagy a legjobb! 🏆",
    ]
}
