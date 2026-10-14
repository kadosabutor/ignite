import SwiftUI

struct DashboardView: View {
    @Environment(AppStore.self) private var store
    @State private var showWizard = false
    @State private var showRankInfo = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack(spacing: 10) {
                    Image("logo").resizable().scaledToFit().frame(width: 34, height: 34)
                    Text("IGNITE").font(.title2.weight(.black)).tracking(3)
                    Spacer()
                    if let rank = store.profile?.rank {
                        Button { showRankInfo = true } label: {
                            Text(rank.emoji)
                                .font(.title3)
                                .frame(width: 42, height: 42)
                                .background(rank.color.opacity(0.18), in: Circle())
                        }
                        .accessibilityLabel("Rang részletei")
                    }
                }
                .padding(.top, 8)
                streakSection
                todayCard
                weekCard
                HStack(spacing: 12) {
                    StatTile(value: "\(store.streak.longestStreak)", label: "Leghosszabb sorozat")
                    StatTile(value: "\(Int((store.profile?.monthlyAverage ?? 0).rounded()))", label: "Havi átlag")
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(Theme.background)
        .refreshable { await store.refreshAll() }
        .toolbar(.hidden, for: .navigationBar)
        .fullScreenCover(isPresented: $showWizard) {
            WizardView(date: DateUtil.effectiveToday)
        }
        .sheet(isPresented: $showRankInfo) {
            RankInfoView()
                .presentationDetents([.medium, .large])
        }
    }

    // MARK: Streak

    private var streakSection: some View {
        HStack(spacing: 18) {
            StreakIcon(level: store.streak.level, size: 88, animated: store.streak.currentStreak > 0)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(store.streak.currentStreak) nap")
                    .font(.system(size: 40, weight: .black, design: .rounded))
                    .contentTransition(.numericText())
                Text("Sorozat · \(store.streak.level.name)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(store.streak.level.color)
                if store.streak.cryoFreezeCount > 0 {
                    Text("🧊 \(store.streak.cryoFreezeCount)/3 Cryo-Freeze")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(StreakLevel.frozen.color)
                }
            }
            Spacer()
        }
        .padding(.vertical, 8)
    }

    // MARK: Mai nap

    private var todayCard: some View {
        let entry = store.todayEntry
        let score = entry?.score ?? 0
        let color = entry == nil ? Theme.border : Scoring.scoreColor(score)

        return Card(padding: 20) {
            VStack(spacing: 20) {
                HStack {
                    SectionTitle(text: "Mai nap")
                    Spacer()
                    Text(DateUtil.display(DateUtil.effectiveToday))
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }

                HStack(spacing: 24) {
                    ProgressRing(value: score, color: color) {
                        VStack(spacing: 0) {
                            Text(entry == nil ? "—" : "\(Int(score.rounded()))")
                                .font(.system(size: 44, weight: .black, design: .rounded))
                                .foregroundStyle(entry == nil ? Theme.muted : color)
                                .contentTransition(.numericText())
                            Text("pont").font(.caption).foregroundStyle(Theme.muted)
                        }
                    }
                    .frame(width: 140, height: 140)

                    if let entry {
                        VStack(alignment: .leading, spacing: 12) {
                            statRow("💼", Scoring.formatMinutes(entry.businessMinutes))
                            statRow("🌙", Scoring.formatMinutes(entry.sleepMinutes))
                            statRow("✨", entry.isPure ? "Tiszta" : "Részben")
                            Text(Scoring.scoreLabel(score))
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(color.opacity(0.18), in: Capsule())
                                .foregroundStyle(color)
                        }
                    } else {
                        Text("Még nem rögzítetted a mai napot.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.muted)
                    }
                }
                .frame(maxWidth: .infinity)

                Button {
                    showWizard = true
                } label: {
                    Text(entry == nil ? "NAPI RÖGZÍTÉS INDÍTÁSA 🔥" : "BEJEGYZÉS SZERKESZTÉSE")
                }
                .buttonStyle(.fire)
            }
        }
    }

    private func statRow(_ icon: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(icon)
            Text(value).font(.headline.weight(.bold))
        }
    }

    // MARK: Heti áttekintés

    private var weekCard: some View {
        let today = DateUtil.effectiveToday
        let days = (0..<7).map { DateUtil.addDays(today, $0 - 6) }

        return Card {
            VStack(spacing: 16) {
                HStack {
                    SectionTitle(text: "Heti áttekintés")
                    Spacer()
                    Text("Átlag: \(Int(store.weeklyAverage.rounded()))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                }
                HStack(alignment: .bottom, spacing: 10) {
                    ForEach(days, id: \.self) { day in
                        let entry = store.entry(for: day)
                        let score = entry?.score ?? 0
                        VStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(entry == nil ? Theme.border.opacity(0.4) : Scoring.scoreColor(score))
                                .frame(height: max(10, 110 * score / 100))
                            Text(DateUtil.weekdayShort(day))
                                .font(.caption2.weight(day == today ? .heavy : .medium))
                                .foregroundStyle(day == today ? Theme.primary : Theme.muted)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 132, alignment: .bottom)
            }
        }
    }
}

// MARK: - Rang info

struct RankInfoView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        NavigationStack {
            List {
                if let p = store.profile {
                    Section {
                        HStack {
                            Text(p.rank.emoji).font(.largeTitle)
                            VStack(alignment: .leading) {
                                Text(p.rank.name).font(.title3.weight(.bold)).foregroundStyle(p.rank.color)
                                Text("Havi átlag: \(String(format: "%.1f", p.monthlyAverage))").foregroundStyle(Theme.muted)
                            }
                        }
                    }
                }
                Section("Rangok (havi átlag alapján)") {
                    ForEach(Rank.allCases, id: \.self) { rank in
                        HStack {
                            Text(rank.emoji)
                            Text(rank.name).foregroundStyle(rank.color).fontWeight(.semibold)
                            Spacer()
                            Text("\(Int(rank.minScore))+").foregroundStyle(Theme.muted)
                        }
                    }
                }
            }
            .navigationTitle("Rangrendszer")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
