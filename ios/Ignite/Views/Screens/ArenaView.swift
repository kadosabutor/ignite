import SwiftUI

struct ArenaView: View {
    @Environment(AppStore.self) private var store
    @State private var period: LeaderboardPeriod = .week
    @State private var leaderboard: [LeaderboardRow] = []
    @State private var isLoading = false
    @State private var reacted: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                feedSection
                leaderboardSection
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Aréna")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    FriendsView()
                } label: {
                    Image(systemName: "person.2.fill")
                        .overlay(alignment: .topTrailing) {
                            if !store.incoming.isEmpty {
                                Circle().fill(Theme.primary).frame(width: 9, height: 9).offset(x: 5, y: -4)
                            }
                        }
                }
            }
        }
        .navigationDestination(for: Friend.self) { FriendProfileView(friend: $0) }
        .task(id: period) { await loadLeaderboard() }
        .refreshable {
            await store.refreshFriends()
            await loadLeaderboard()
        }
    }

    private func loadLeaderboard() async {
        isLoading = true
        defer { isLoading = false }
        do {
            leaderboard = try await store.leaderboard(period)
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    // MARK: Barátok ma

    private var feedSection: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionTitle(text: "Barátok ma")
                    Spacer()
                    let done = store.friends.filter(\.todayCompleted).count
                    Text("\(done)/\(store.friends.count) rögzített")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
                if store.friends.isEmpty {
                    VStack(spacing: 12) {
                        Text("Még nincsenek barátaid. Hívd meg őket, és versenyezzetek!")
                            .font(.subheadline)
                            .foregroundStyle(Theme.muted)
                        NavigationLink("Barátok keresése") { FriendsView() }
                            .buttonStyle(.ghost)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ForEach(store.friends.sorted { ($0.todayEntry?.score ?? -1) > ($1.todayEntry?.score ?? -1) }) { friend in
                        friendRow(friend)
                    }
                }
            }
        }
    }

    private func friendRow(_ f: Friend) -> some View {
        HStack(spacing: 12) {
            NavigationLink(value: f) {
                HStack(spacing: 12) {
                    AvatarView(avatar: f.avatar, size: 46)
                        .overlay(alignment: .bottomTrailing) {
                            Image(f.streak.level.imageName).resizable().frame(width: 20, height: 20)
                                .offset(x: 4, y: 4)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(f.displayName).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.foreground)
                        Text("\(f.streak.currentStreak) nap · \(f.rank.emoji) \(f.rank.name)")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                    }
                    Spacer()
                    if let e = f.todayEntry {
                        Text("\(Int(e.score.rounded()))")
                            .font(.title3.weight(.black).monospacedDigit())
                            .foregroundStyle(Scoring.scoreColor(e.score))
                    } else {
                        Text("—").font(.title3.weight(.bold)).foregroundStyle(Theme.muted)
                    }
                }
            }
            .buttonStyle(.plain)

            let key = "\(f.id)-\(f.todayCompleted)"
            Button {
                reacted.insert(key)
                Task { await store.react(f.todayCompleted ? .fire : .ping, to: f) }
            } label: {
                Text(f.todayCompleted ? "🔥" : "👋")
                    .font(.title3)
                    .frame(width: 42, height: 42)
                    .background(reacted.contains(key) ? Theme.primary.opacity(0.3) : Theme.surfaceLight, in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(reacted.contains(key))
            .sensoryFeedback(.impact(weight: .medium), trigger: reacted.contains(key))
            .accessibilityLabel(f.todayCompleted ? "Tűz küldése" : "Ping küldése")
        }
    }

    // MARK: Ranglista

    private var leaderboardSection: some View {
        Card {
            VStack(spacing: 16) {
                HStack {
                    SectionTitle(text: "Ranglista")
                    Spacer()
                    if isLoading { ProgressView().controlSize(.small) }
                }
                Picker("Időszak", selection: $period) {
                    ForEach(LeaderboardPeriod.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)

                if leaderboard.count >= 2 {
                    podium
                }
                ForEach(leaderboard.dropFirst(min(3, leaderboard.count >= 2 ? 3 : 0))) { row in
                    HStack(spacing: 12) {
                        Text("\(row.position).").font(.subheadline.weight(.bold).monospacedDigit()).frame(width: 28)
                        AvatarView(avatar: row.avatar, size: 34)
                        Text(row.displayName).font(.subheadline.weight(row.isCurrentUser ? .heavy : .medium))
                        Spacer()
                        Text("\(row.score)").font(.headline.monospacedDigit())
                    }
                    .padding(10)
                    .background(row.isCurrentUser ? Theme.primary.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private var podium: some View {
        let top = Array(leaderboard.prefix(3))
        let order = [1, 0, 2].filter { $0 < top.count }
        return HStack(alignment: .bottom, spacing: 10) {
            ForEach(order, id: \.self) { i in
                let row = top[i]
                VStack(spacing: 6) {
                    Text(["🥇", "🥈", "🥉"][i]).font(.title2)
                    AvatarView(avatar: row.avatar, size: i == 0 ? 64 : 50)
                        .overlay(Circle().strokeBorder(row.isCurrentUser ? Theme.primary : .clear, lineWidth: 2))
                    Text(row.displayName).font(.caption.weight(.semibold)).lineLimit(1)
                    Text("\(row.score)").font(.headline.weight(.black))
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(i == 0 ? Theme.fireGradient : LinearGradient(colors: [Theme.surfaceLight], startPoint: .top, endPoint: .bottom))
                        .frame(height: [90, 64, 48][i])
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
