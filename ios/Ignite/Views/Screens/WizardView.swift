import SwiftUI

struct WizardView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let date: String

    private enum Step: Int, CaseIterable {
        case sleep, work, health, purity, summary

        var title: String {
            switch self {
            case .sleep: "Alvás"
            case .work: "Business"
            case .health: "Egészség"
            case .purity: "Tisztaság"
            case .summary: "Összegzés"
            }
        }

        var icon: String {
            switch self {
            case .sleep: "🌙"
            case .work: "💼"
            case .health: "💪"
            case .purity: "✨"
            case .summary: "📊"
            }
        }
    }

    @State private var step: Step = .sleep
    @State private var entry: HabitEntry
    @State private var isSaving = false
    @State private var climax: Gamification.DailyRank?
    @State private var climaxDone = false
    @State private var newBadges: [Badge] = []
    @State private var error: String?
    @State private var forward = true
    @State private var editingTime: TimeField?

    private enum TimeField: String, Identifiable {
        case bed, wake
        var id: String { rawValue }
        var title: String { self == .bed ? "Lefekvés" : "Ébredés" }
        var keyPath: WritableKeyPath<HabitEntry, String?> { self == .bed ? \.bedTime : \.wakeUpTime }
        var fallback: String { self == .bed ? "23:00" : "07:00" }
    }

    init(date: String, existing: HabitEntry? = nil) {
        self.date = date
        _entry = State(initialValue: existing ?? HabitEntry.new(date: date))
    }

    private var score: Double { Scoring.totalScore(entry) }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                ScrollView {
                    content
                        .padding(.horizontal, 20)
                        .padding(.vertical, 24)
                        .id(step)
                        .transition(.asymmetric(
                            insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                            removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)
                        ))
                }
                .scrollDismissesKeyboard(.interactively)
                footer
            }

            if let climax {
                ClimaxView(score: score, rank: climax, newBadges: newBadges, isDone: climaxDone) {
                    dismiss()
                }
                .transition(.opacity.combined(with: .scale(scale: 1.1)))
            }
        }
        .onAppear {
            if let existing = store.entry(for: date) { entry = existing }
        }
        .onChange(of: entry.bedTime) { updateSleep() }
        .onChange(of: entry.wakeUpTime) { updateSleep() }
        .sensoryFeedback(.impact(weight: .light), trigger: step)
        .errorAlert($error)
    }

    private func updateSleep() {
        if entry.bedTime != nil, entry.wakeUpTime != nil {
            entry.sleepMinutes = Scoring.sleepMinutes(bedTime: entry.bedTime, wakeUpTime: entry.wakeUpTime)
        }
    }

    // MARK: Fejléc

    private var header: some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(Step.allCases, id: \.self) { s in
                    Capsule()
                        .fill(s.rawValue <= step.rawValue ? Theme.primary : Theme.surfaceLight)
                        .frame(height: 4)
                }
            }
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .frame(width: 36, height: 36)
                        .background(Theme.surfaceLight, in: Circle())
                }
                .foregroundStyle(Theme.foreground)
                Spacer()
                Text("\(step.icon) \(step.title)")
                    .font(.headline.weight(.bold))
                Spacer()
                Text("\(step.rawValue + 1)/\(Step.allCases.count)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(Theme.muted)
                    .frame(width: 36)
            }
            if date != DateUtil.effectiveToday {
                Text(DateUtil.display(date, format: "yyyy. MMMM d., EEEE"))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.warning)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    // MARK: Lépések

    @ViewBuilder
    private var content: some View {
        switch step {
        case .sleep: sleepStep
        case .work: workStep
        case .health: healthStep
        case .purity: purityStep
        case .summary: summaryStep
        }
    }

    private var sleepStep: some View {
        VStack(spacing: 24) {
            Text("Mikor aludtál el és keltél fel?")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                timeCard(.bed, icon: "moon.fill")
                timeCard(.wake, icon: "sun.max.fill")
            }

            if entry.sleepMinutes > 0 {
                HStack(spacing: 10) {
                    Text("😴").font(.largeTitle)
                    Text(Scoring.formatMinutes(entry.sleepMinutes))
                        .font(.system(size: 36, weight: .black, design: .rounded))
                        .contentTransition(.numericText())
                }
                Text("+\(Int(Scoring.sleepPoints(entry.sleepMinutes).rounded())) / \(Int(Scoring.sleepMax)) pont")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.success)
            }
        }
        .sheet(item: $editingTime) { field in
            TimePickerSheet(title: field.title, time: entry[keyPath: field.keyPath] ?? field.fallback) { value in
                entry[keyPath: field.keyPath] = value
            }
            .presentationDetents([.height(340)])
        }
    }

    private func timeCard(_ field: TimeField, icon: String) -> some View {
        let value = entry[keyPath: field.keyPath]
        return Button {
            editingTime = field
        } label: {
            VStack(spacing: 10) {
                Label(field.title, systemImage: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.muted)
                Text(value ?? "--:--")
                    .font(.system(size: 40, weight: .black, design: .rounded).monospacedDigit())
                    .foregroundStyle(value == nil ? Theme.muted : Theme.foreground)
                Text(value == nil ? "Koppints a beállításhoz" : "Módosítás")
                    .font(.caption2)
                    .foregroundStyle(value == nil ? Theme.primary : Theme.muted)
            }
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(value == nil ? Theme.primary.opacity(0.4) : .clear))
        }
        .buttonStyle(.plain)
    }

    private var workStep: some View {
        let hours = entry.businessMinutes / 60
        let minutes = entry.businessMinutes % 60

        return VStack(spacing: 24) {
            Text("Mennyit dolgoztál ma?")
                .font(.title2.weight(.bold))

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(hours)").font(.system(size: 64, weight: .black, design: .rounded)).contentTransition(.numericText())
                Text("óra").foregroundStyle(Theme.muted)
                Text("\(minutes)").font(.system(size: 64, weight: .black, design: .rounded)).contentTransition(.numericText())
                Text("perc").foregroundStyle(Theme.muted)
            }
            .animation(.spring(duration: 0.3), value: entry.businessMinutes)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 5), spacing: 8) {
                ForEach(0...12, id: \.self) { h in
                    chip("\(h)h", selected: hours == h) { entry.businessMinutes = h * 60 + minutes }
                }
            }

            HStack(spacing: 8) {
                ForEach([0, 15, 30, 45], id: \.self) { m in
                    chip(String(format: ":%02d", m), selected: minutes == m) { entry.businessMinutes = hours * 60 + m }
                }
            }

            VStack(spacing: 8) {
                Text("Finomhangolás").font(.caption.weight(.semibold)).foregroundStyle(Theme.muted)
                HStack(spacing: 8) {
                    ForEach([-5, -1, 1, 5], id: \.self) { d in
                        chip(d > 0 ? "+\(d)p" : "\(d)p", selected: false) {
                            entry.businessMinutes = max(0, entry.businessMinutes + d)
                        }
                    }
                }
            }

            Text("+\(Int(Scoring.businessPoints(entry.businessMinutes).rounded())) / \(Int(Scoring.businessMax)) pont")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.success)
        }
        .sensoryFeedback(.selection, trigger: entry.businessMinutes)
    }

    private func chip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(.bold).monospacedDigit())
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(selected ? Theme.background : Theme.foreground)
                .background(selected ? Theme.primary : Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var healthStep: some View {
        VStack(spacing: 14) {
            YesNoPicker(title: "Edzettél ma?", value: $entry.exercise, points: Int(Scoring.exercise))
            YesNoPicker(title: "Tisztán étkeztél?", value: $entry.cleanEating, points: Int(Scoring.cleanEating))
            YesNoPicker(title: "Paradigma váltás?", value: $entry.paradigm, points: Int(Scoring.paradigm))
        }
    }

    private var purityStep: some View {
        VStack(spacing: 14) {
            YesNoPicker(title: "Volt kielégülés?", value: $entry.satisfaction, yesIsGood: false, points: Int(Scoring.noSatisfaction))
            YesNoPicker(title: "Dopamindús tartalom?", value: $entry.dopamineContent, yesIsGood: false, points: Int(Scoring.noDopamine))
            YesNoPicker(title: "Gaming?", value: $entry.gaming, yesIsGood: false, points: Int(Scoring.noGaming))
        }
    }

    private var summaryStep: some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                Text("Várható pont").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.muted)
                Text("\(Int(score.rounded()))")
                    .font(.system(size: 72, weight: .black, design: .rounded))
                    .foregroundStyle(Scoring.scoreColor(score))
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                summaryItem("🌙", "Alvás", Scoring.formatMinutes(entry.sleepMinutes))
                summaryItem("💼", "Munka", Scoring.formatMinutes(entry.businessMinutes))
                summaryItem("💪", "Edzés", entry.exercise ? "✓" : "✗")
                summaryItem("🍎", "Étkezés", entry.cleanEating ? "✓" : "✗")
                summaryItem("🧠", "Paradigma", entry.paradigm ? "✓" : "✗")
                summaryItem("✨", "Tisztaság", entry.isPure ? "✓" : "Részben")
            }

            VStack(alignment: .leading, spacing: 14) {
                Text("Önreflexió").font(.headline.weight(.bold))
                reflection("Hogy telt a napod? (Napló)", placeholder: "Írd le röviden a mai nap eseményeit...", text: $entry.approachedGoal)
                reflection("Akadályozott ma valami?", placeholder: "Nehézségek...", text: $entry.businessObstacle)
                reflection("Mit rontottál el, hogyan lehetnél jobb?", placeholder: "Tanulságok...", text: $entry.personalObstacle)
            }
        }
    }

    private func summaryItem(_ icon: String, _ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(icon).font(.title2)
            Text(label).font(.caption2).foregroundStyle(Theme.muted)
            Text(value).font(.subheadline.weight(.bold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func reflection(_ label: String, placeholder: String, text: Binding<String?>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.muted)
            TextField(placeholder, text: Binding(get: { text.wrappedValue ?? "" }, set: { text.wrappedValue = $0.isEmpty ? nil : $0 }), axis: .vertical)
                .lineLimit(2...6)
                .padding(14)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    // MARK: Lábléc

    private var footer: some View {
        HStack(spacing: 10) {
            if step != .sleep {
                Button("Előző") { go(-1) }
                    .buttonStyle(.ghost)
            }
            if step != .summary {
                Button("Kihagyás") { go(1) }
                    .buttonStyle(.ghost)
                Button("Következő") { go(1) }
                    .buttonStyle(.fire)
            } else {
                Button {
                    Task { await ignite() }
                } label: {
                    Text(isSaving ? "RÖGZÍTÉS..." : "IGNITE DAY 🔥")
                }
                .buttonStyle(.fire)
                .disabled(isSaving)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Theme.background)
    }

    private func go(_ delta: Int) {
        guard let next = Step(rawValue: step.rawValue + delta) else { return }
        forward = delta > 0
        withAnimation(.spring(duration: 0.35)) { step = next }
    }

    private func ignite() async {
        guard !isSaving else { return }
        isSaving = true
        withAnimation(.spring(duration: 0.5)) { climax = Gamification.dailyRank(score) }
        do {
            newBadges = try await store.save(entry, awardXP: true)
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation { climaxDone = true }
        } catch {
            withAnimation { climax = nil }
            isSaving = false
            self.error = "Nem sikerült elmenteni az adatokat. \(error.localizedDescription)"
        }
    }
}

// MARK: - Climax

struct ClimaxView: View {
    let score: Double
    let rank: Gamification.DailyRank
    let newBadges: [Badge]
    let isDone: Bool
    let onContinue: () -> Void

    @State private var shown = 0.0
    @State private var appear = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RadialGradient(colors: [rank.color.opacity(0.45), .clear], center: .center, startRadius: 10, endRadius: 380)
                .ignoresSafeArea()
                .scaleEffect(appear ? 1.15 : 0.6)

            VStack(spacing: 14) {
                Text("NAPI EREDMÉNY")
                    .font(.caption.weight(.heavy))
                    .tracking(4)
                    .foregroundStyle(.white.opacity(0.7))
                Text("\(Int(shown.rounded()))")
                    .font(.system(size: 120, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(value: shown))
                Text(rank.title)
                    .font(.system(size: 34, weight: .black))
                    .tracking(3)
                    .foregroundStyle(rank.color)
                    .shadow(color: rank.color, radius: 16)
                Text(rank.message)
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.85))

                if !newBadges.isEmpty {
                    VStack(spacing: 8) {
                        Text("ÚJ BADGE").font(.caption.weight(.heavy)).tracking(3).foregroundStyle(Theme.warning)
                        ForEach(newBadges) { b in
                            Text("\(b.icon) \(b.name)").font(.headline)
                        }
                    }
                    .padding(.top, 12)
                }

                if isDone {
                    Button(action: onContinue) {
                        Text("TOVÁBB")
                            .font(.headline.weight(.black))
                            .foregroundStyle(.black)
                            .padding(.horizontal, 44)
                            .padding(.vertical, 16)
                            .background(.white, in: Capsule())
                            .shadow(color: .white.opacity(0.5), radius: 20)
                    }
                    .padding(.top, 32)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
        }
        .sensoryFeedback(.success, trigger: appear)
        .onAppear {
            withAnimation(.easeOut(duration: 1.2)) {
                appear = true
                shown = score
            }
        }
    }
}

// MARK: - Időválasztó lap

struct TimePickerSheet: View {
    let title: String
    let onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date

    init(title: String, time: String, onDone: @escaping (String) -> Void) {
        self.title = title
        self.onDone = onDone
        _date = State(initialValue: DateUtil.time(from: time) ?? Date())
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(title).font(.headline.weight(.bold))
                Spacer()
                Button("Kész") {
                    onDone(DateUtil.hhmm(from: date))
                    dismiss()
                }
                .font(.headline)
                .foregroundStyle(Theme.primary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)

            DatePicker(title, selection: $date, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "hu_HU"))
                .frame(maxWidth: .infinity)
        }
        .presentationBackground(Theme.surface)
        .sensoryFeedback(.selection, trigger: date)
    }
}
