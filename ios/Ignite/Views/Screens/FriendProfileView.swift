import SwiftUI
import Charts

struct FriendProfileView: View {
    @Environment(AppStore.self) private var store
    let friend: Friend

    @State private var friendEntries: [HabitEntry] = []
    @State private var insight: InsightResult?
    @State private var isLoadingInsight = false
    @State private var insightError: String?

    private var myEntries: [HabitEntry] {
        let start = DateUtil.addDays(DateUtil.effectiveToday, -30)
        return store.entries.filter { $0.date >= start }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                vsCard
                weekChart
                insightCard
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle(friend.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            friendEntries = await store.entries(of: friend)
        }
    }

    private var header: some View {
        Card(padding: 20) {
            HStack(spacing: 16) {
                AvatarView(avatar: friend.avatar, size: 72)
                VStack(alignment: .leading, spacing: 4) {
                    Text(friend.displayName).font(.title3.weight(.bold))
                    Text("@\(friend.username)").font(.caption).foregroundStyle(Theme.muted)
                    Text("\(friend.rank.emoji) \(friend.rank.name)").font(.subheadline.weight(.semibold)).foregroundStyle(friend.rank.color)
                }
                Spacer()
                VStack(spacing: 2) {
                    StreakIcon(level: friend.streak.level, size: 44)
                    Text("\(friend.streak.currentStreak) nap").font(.caption.weight(.bold))
                }
            }
        }
    }

    private var vsCard: some View {
        let mine = Scoring.radarStats(myEntries)
        let theirs = Scoring.radarStats(friendEntries)
        return Card {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "VS · elmúlt 30 nap")
                RadarChart(series: [
                    .init(name: "Te", stats: mine, color: Theme.primary),
                    .init(name: friend.displayName, stats: theirs, color: Color(hex: 0x33CCFF)),
                ])
                .frame(height: 280)
            }
        }
    }

    private var weekChart: some View {
        let today = DateUtil.effectiveToday
        let days = (0..<7).map { DateUtil.addDays(today, $0 - 6) }
        struct Point: Identifiable { let id = UUID(); let day: String; let who: String; let score: Double }
        let points: [Point] = days.flatMap { day in
            [
                Point(day: day, who: "Te", score: store.entry(for: day)?.score ?? 0),
                Point(day: day, who: friend.displayName, score: friendEntries.first { $0.date == day }?.score ?? 0),
            ]
        }
        return Card {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "Heti pontszámok")
                Chart(points) { p in
                    BarMark(x: .value("Nap", DateUtil.weekdayShort(p.day)), y: .value("Pont", p.score))
                        .foregroundStyle(by: .value("Ki", p.who))
                        .position(by: .value("Ki", p.who))
                        .cornerRadius(4)
                }
                .chartForegroundStyleScale([ "Te": Theme.primary, friend.displayName: Color(hex: 0x33CCFF) ])
                .chartYScale(domain: 0...100)
                .frame(height: 180)
            }
        }
    }

    private var insightCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                SectionTitle(text: "AI elemzés")
                if let insight {
                    insightContent(insight)
                } else {
                    Text("Az AI összehasonlítja az elmúlt 30 napotokat, és kapsz egy napi küldetést.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
                if let insightError {
                    Text(insightError).font(.footnote).foregroundStyle(Theme.error)
                }
                Button {
                    Task { await loadInsight() }
                } label: {
                    if isLoadingInsight {
                        ProgressView().tint(Theme.background)
                    } else {
                        Text(insight == nil ? "ELEMZÉS INDÍTÁSA 🧠" : "ÚJ ELEMZÉS")
                    }
                }
                .buttonStyle(.fire)
                .disabled(isLoadingInsight || myEntries.isEmpty || friendEntries.isEmpty)
            }
        }
    }

    @ViewBuilder
    private func insightContent(_ r: InsightResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(r.title).font(.title3.weight(.black))
            Text(r.verdict_short).font(.headline).foregroundStyle(Theme.primary)
            ForEach(r.key_stats) { s in
                HStack {
                    Text(s.label).font(.subheadline)
                    Spacer()
                    Text(s.diff).font(.subheadline.weight(.bold))
                        .foregroundStyle(s.advantage == "user" ? Theme.success : s.advantage == "friend" ? Theme.error : Theme.muted)
                }
            }
            ForEach(r.sections) { section in
                VStack(alignment: .leading, spacing: 6) {
                    Text(section.title).font(.subheadline.weight(.bold))
                    Text(section.text).font(.subheadline).foregroundStyle(Theme.foreground.opacity(0.9))
                    HStack(spacing: 8) {
                        ProgressView(value: section.scoreUser, total: 100).tint(Theme.primary)
                        ProgressView(value: section.scoreFriend, total: 100).tint(Color(hex: 0x33CCFF))
                    }
                }
                .padding(12)
                .background(Theme.surfaceLight, in: RoundedRectangle(cornerRadius: 14))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("🎯 MAI KÜLDETÉS").font(.caption.weight(.heavy)).tracking(2).foregroundStyle(Theme.warning)
                Text(r.daily_mission).font(.subheadline.weight(.semibold))
            }
        }
    }

    private func loadInsight() async {
        isLoadingInsight = true
        insightError = nil
        defer { isLoadingInsight = false }
        do {
            insight = try await API.generateInsight(
                userEntries: myEntries,
                friendEntries: friendEntries,
                userName: store.profile?.displayName ?? "Te",
                friendName: friend.displayName
            )
        } catch {
            insightError = error.localizedDescription
        }
    }
}
