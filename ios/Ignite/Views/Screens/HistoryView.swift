import SwiftUI

struct HistoryView: View {
    @Environment(AppStore.self) private var store
    @State private var editingDate: String?
    @State private var showDatePicker = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            SectionTitle(text: "Elmúlt év")
                            Spacer()
                            Text("\(store.entries.count) nap rögzítve")
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                        }
                        HeatmapView(entries: store.entries) { day in
                            editingDate = day
                        }
                        HStack(spacing: 6) {
                            Text("Kevesebb").font(.caption2).foregroundStyle(Theme.muted)
                            ForEach([0.0, 40, 60, 80, 95], id: \.self) { s in
                                RoundedRectangle(cornerRadius: 3).fill(HeatmapView.color(for: s == 0 ? nil : s)).frame(width: 12, height: 12)
                            }
                            Text("Több").font(.caption2).foregroundStyle(Theme.muted)
                        }
                    }
                }

                if !missedDays.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionTitle(text: "Kimaradt napok")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(missedDays, id: \.self) { day in
                                        Button {
                                            editingDate = day
                                        } label: {
                                            VStack(spacing: 2) {
                                                Text(DateUtil.display(day, format: "EEE")).font(.caption2).foregroundStyle(Theme.muted)
                                                Text(DateUtil.display(day, format: "MMM d.")).font(.subheadline.weight(.bold))
                                            }
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .background(Theme.surfaceLight, in: RoundedRectangle(cornerRadius: 12))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }

                LazyVStack(spacing: 10) {
                    ForEach(store.entries) { entry in
                        NavigationLink(value: entry) {
                            EntryRowView(entry: entry)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Előzmények")
        .navigationDestination(for: HabitEntry.self) { entry in
            EntryDetailView(date: entry.date)
        }
        .refreshable { await store.refreshAll() }
        .fullScreenCover(item: Binding(get: { editingDate.map(IdentifiedDay.init) }, set: { editingDate = $0?.id })) { day in
            WizardView(date: day.id)
        }
    }

    /// Az elmúlt 7 nap, amelyről nincs bejegyzés (a mai nélkül)
    private var missedDays: [String] {
        let today = DateUtil.effectiveToday
        return (1...7).map { DateUtil.addDays(today, -$0) }.filter { store.entry(for: $0) == nil }
    }
}

struct IdentifiedDay: Identifiable {
    let id: String
}

struct EntryRowView: View {
    let entry: HabitEntry

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 0) {
                Text(DateUtil.display(entry.date, format: "d")).font(.title2.weight(.black))
                Text(DateUtil.display(entry.date, format: "MMM")).font(.caption2).foregroundStyle(Theme.muted)
            }
            .frame(width: 44)

            VStack(alignment: .leading, spacing: 4) {
                Text(DateUtil.display(entry.date, format: "EEEE")).font(.subheadline.weight(.semibold))
                HStack(spacing: 10) {
                    Label(Scoring.formatMinutes(entry.businessMinutes), systemImage: "briefcase.fill")
                    Label(Scoring.formatMinutes(entry.sleepMinutes), systemImage: "moon.fill")
                }
                .font(.caption)
                .foregroundStyle(Theme.muted)
            }
            Spacer()
            Text("\(Int(entry.score.rounded()))")
                .font(.title2.weight(.black).monospacedDigit())
                .foregroundStyle(Scoring.scoreColor(entry.score))
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.muted)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Heatmap

struct HeatmapView: View {
    let entries: [HabitEntry]
    var onSelect: (String) -> Void = { _ in }

    private let cell: CGFloat = 13
    private let gap: CGFloat = 3

    static func color(for score: Double?) -> Color {
        guard let score else { return Theme.surfaceLight }
        switch score {
        case 90...: return Theme.primary
        case 75...: return Theme.primary.opacity(0.75)
        case 50...: return Theme.primary.opacity(0.5)
        default: return Theme.primary.opacity(0.25)
        }
    }

    var body: some View {
        let scores = Dictionary(entries.map { ($0.date, $0.score) }, uniquingKeysWith: { a, _ in a })
        let weeks = Self.weeks()

        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: gap) {
                    ForEach(Array(weeks.enumerated()), id: \.offset) { index, week in
                        VStack(spacing: gap) {
                            ForEach(week, id: \.self) { day in
                                if let day {
                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(Self.color(for: scores[day]))
                                        .frame(width: cell, height: cell)
                                        .overlay {
                                            if day == DateUtil.effectiveToday {
                                                RoundedRectangle(cornerRadius: 3).strokeBorder(Theme.foreground, lineWidth: 1)
                                            }
                                        }
                                        .onTapGesture { onSelect(day) }
                                } else {
                                    Color.clear.frame(width: cell, height: cell)
                                }
                            }
                        }
                        .id(index)
                    }
                }
            }
            .onAppear { proxy.scrollTo(weeks.count - 1, anchor: .trailing) }
        }
        .frame(height: cell * 7 + gap * 6)
    }

    /// 53 hét, hétfővel kezdődő oszlopok; a jövőbeli napok nil
    static func weeks() -> [[String?]] {
        let today = DateUtil.effectiveToday
        guard let todayDate = DateUtil.date(from: today) else { return [] }
        let weekday = (DateUtil.calendar.component(.weekday, from: todayDate) + 5) % 7 // hétfő = 0
        let lastMonday = DateUtil.addDays(today, -weekday)
        let firstMonday = DateUtil.addDays(lastMonday, -52 * 7)
        return (0...52).map { w in
            (0..<7).map { d in
                let day = DateUtil.addDays(firstMonday, w * 7 + d)
                return day > today ? nil : day
            }
        }
    }
}

// MARK: - Bejegyzés részletei

struct EntryDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let date: String
    @State private var editing = false
    @State private var confirmDelete = false

    var body: some View {
        Group {
            if let e = store.entry(for: date) {
                ScrollView {
                    VStack(spacing: 16) {
                        Card(padding: 20) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(DateUtil.display(date, format: "yyyy. MMMM d.")).font(.headline)
                                    Text(Scoring.scoreLabel(e.score)).font(.subheadline).foregroundStyle(Scoring.scoreColor(e.score))
                                }
                                Spacer()
                                ProgressRing(value: e.score, lineWidth: 8, color: Scoring.scoreColor(e.score)) {
                                    Text("\(Int(e.score.rounded()))").font(.title.weight(.black))
                                }
                                .frame(width: 86, height: 86)
                            }
                        }

                        Card {
                            VStack(spacing: 12) {
                                detailRow("🌙 Alvás", "\(e.bedTime ?? "–") → \(e.wakeUpTime ?? "–") · \(Scoring.formatMinutes(e.sleepMinutes))")
                                detailRow("💼 Business", Scoring.formatMinutes(e.businessMinutes))
                                detailRow("💪 Edzés", e.exercise ? "Igen" : "Nem")
                                detailRow("🍎 Tiszta étkezés", e.cleanEating ? "Igen" : "Nem")
                                detailRow("🧠 Paradigma", e.paradigm ? "Igen" : "Nem")
                                detailRow("✨ Tisztaság", "\(Scoring.purityCount(e))/3")
                            }
                        }

                        if [e.approachedGoal, e.businessObstacle, e.personalObstacle].contains(where: { !($0 ?? "").isEmpty }) {
                            Card {
                                VStack(alignment: .leading, spacing: 14) {
                                    SectionTitle(text: "Önreflexió")
                                    reflection("Napló", e.approachedGoal)
                                    reflection("Akadályok", e.businessObstacle)
                                    reflection("Tanulságok", e.personalObstacle)
                                }
                            }
                        }
                    }
                    .padding(16)
                }
            } else {
                ContentUnavailableView("Nincs bejegyzés", systemImage: "calendar.badge.exclamationmark")
            }
        }
        .background(Theme.background)
        .navigationTitle(DateUtil.display(date, format: "MMM d., EEEE"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Szerkesztés", systemImage: "pencil") { editing = true }
                    Button("Törlés", systemImage: "trash", role: .destructive) { confirmDelete = true }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .fullScreenCover(isPresented: $editing) { WizardView(date: date) }
        .confirmationDialog("Biztosan törlöd ezt a bejegyzést?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Törlés", role: .destructive) {
                Task {
                    do {
                        try await store.delete(date: date)
                        dismiss()
                    } catch {
                        store.errorMessage = error.localizedDescription
                    }
                }
            }
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(Theme.muted)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    @ViewBuilder
    private func reflection(_ title: String, _ text: String?) -> some View {
        if let text, !text.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(Theme.muted)
                Text(text).font(.body)
            }
        }
    }
}

extension Scoring {
    /// Hány negatív szokást kerültél el (0–3) – „méltóságőrző” összesítés
    static func purityCount(_ e: HabitEntry) -> Int {
        [e.satisfaction, e.dopamineContent, e.gaming].filter { !$0 }.count
    }
}
