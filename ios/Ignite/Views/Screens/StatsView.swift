import SwiftUI
import Charts

struct StatsView: View {
    @Environment(AppStore.self) private var store

    enum Range: Int, CaseIterable, Identifiable {
        case week = 7, month = 30, quarter = 90
        var id: Int { rawValue }
        var title: String {
            switch self {
            case .week: "7 nap"
            case .month: "30 nap"
            case .quarter: "90 nap"
            }
        }
    }

    @State private var range: Range = .month

    private var rangeEntries: [HabitEntry] {
        let start = DateUtil.addDays(DateUtil.effectiveToday, -(range.rawValue - 1))
        return store.entries.filter { $0.date >= start }.sorted { $0.date < $1.date }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Picker("Időszak", selection: $range) {
                    ForEach(Range.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)

                summaryTiles
                scoreChart
                workSleepChart
                radarCard
                habitRates
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Statisztika")
    }

    private var summaryTiles: some View {
        let entries = rangeEntries
        let avg = entries.isEmpty ? 0 : entries.reduce(0) { $0 + $1.score } / Double(entries.count)
        let best = entries.map(\.score).max() ?? 0
        return HStack(spacing: 12) {
            StatTile(value: "\(Int(avg.rounded()))", label: "Átlag", color: Scoring.scoreColor(avg))
            StatTile(value: "\(Int(best.rounded()))", label: "Legjobb")
            StatTile(value: "\(entries.count)", label: "Rögzített nap")
        }
    }

    private var scoreChart: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "Napi pontszám")
                if rangeEntries.isEmpty {
                    empty
                } else {
                    Chart(rangeEntries) { e in
                        AreaMark(x: .value("Nap", DateUtil.date(from: e.date) ?? .now, unit: .day), y: .value("Pont", e.score))
                            .foregroundStyle(LinearGradient(colors: [Theme.primary.opacity(0.4), .clear], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.monotone)
                        LineMark(x: .value("Nap", DateUtil.date(from: e.date) ?? .now, unit: .day), y: .value("Pont", e.score))
                            .foregroundStyle(Theme.primary)
                            .interpolationMethod(.monotone)
                            .lineStyle(StrokeStyle(lineWidth: 2.5))
                        if range == .week {
                            PointMark(x: .value("Nap", DateUtil.date(from: e.date) ?? .now, unit: .day), y: .value("Pont", e.score))
                                .foregroundStyle(Theme.primary)
                        }
                    }
                    .chartYScale(domain: 0...100)
                    .frame(height: 200)
                }
            }
        }
    }

    private var workSleepChart: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "Munka és alvás (óra)")
                if rangeEntries.isEmpty {
                    empty
                } else {
                    Chart {
                        ForEach(rangeEntries) { e in
                            BarMark(x: .value("Nap", DateUtil.date(from: e.date) ?? .now, unit: .day), y: .value("Óra", Double(e.businessMinutes) / 60))
                                .foregroundStyle(by: .value("Típus", "Munka"))
                                .position(by: .value("Típus", "Munka"))
                            BarMark(x: .value("Nap", DateUtil.date(from: e.date) ?? .now, unit: .day), y: .value("Óra", Double(e.sleepMinutes) / 60))
                                .foregroundStyle(by: .value("Típus", "Alvás"))
                                .position(by: .value("Típus", "Alvás"))
                        }
                    }
                    .chartForegroundStyleScale(["Munka": Theme.primary, "Alvás": Color(hex: 0x33CCFF)])
                    .frame(height: 200)
                }
            }
        }
    }

    private var radarCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "Profil")
                RadarChart(series: [.init(name: "Te", stats: Scoring.radarStats(rangeEntries), color: Theme.primary)])
                    .frame(height: 260)
            }
        }
    }

    private var habitRates: some View {
        let entries = rangeEntries
        let n = Double(max(1, entries.count))
        let rows: [(String, Double, Bool)] = [
            ("💪 Edzés", Double(entries.filter(\.exercise).count) / n, true),
            ("🍎 Tiszta étkezés", Double(entries.filter(\.cleanEating).count) / n, true),
            ("🧠 Paradigma", Double(entries.filter(\.paradigm).count) / n, true),
            ("✨ Tiszta nap", Double(entries.filter(\.isPure).count) / n, true),
        ]
        return Card {
            VStack(alignment: .leading, spacing: 14) {
                SectionTitle(text: "Szokások aránya")
                ForEach(rows, id: \.0) { row in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(row.0).font(.subheadline)
                            Spacer()
                            Text("\(Int((row.1 * 100).rounded()))%").font(.subheadline.weight(.bold).monospacedDigit())
                        }
                        ProgressView(value: row.1).tint(row.1 >= 0.7 ? Theme.success : row.1 >= 0.4 ? Theme.warning : Theme.error)
                    }
                }
            }
        }
    }

    private var empty: some View {
        Text("Ebben az időszakban még nincs bejegyzés.")
            .font(.subheadline)
            .foregroundStyle(Theme.muted)
            .frame(maxWidth: .infinity, minHeight: 120)
    }
}

// MARK: - Radar diagram

struct RadarChart: View {
    struct Series: Identifiable {
        var id: String { name }
        let name: String
        let stats: RadarStats
        let color: Color
    }

    let series: [Series]

    var body: some View {
        VStack(spacing: 10) {
            GeometryReader { geo in
                let size = min(geo.size.width, geo.size.height)
                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                let radius = size / 2 - 28

                ZStack {
                    ForEach([0.25, 0.5, 0.75, 1.0], id: \.self) { level in
                        polygon(values: Array(repeating: level * 100, count: 5), center: center, radius: radius)
                            .stroke(Theme.border.opacity(0.6), lineWidth: 1)
                    }
                    ForEach(0..<5, id: \.self) { i in
                        Path { p in
                            p.move(to: center)
                            p.addLine(to: point(i, value: 100, center: center, radius: radius))
                        }
                        .stroke(Theme.border.opacity(0.6), lineWidth: 1)
                    }
                    ForEach(series) { s in
                        polygon(values: s.stats.values, center: center, radius: radius)
                            .fill(s.color.opacity(0.25))
                        polygon(values: s.stats.values, center: center, radius: radius)
                            .stroke(s.color, lineWidth: 2)
                    }
                    ForEach(0..<5, id: \.self) { i in
                        Text(RadarStats.labels[i])
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.muted)
                            .position(point(i, value: 122, center: center, radius: radius))
                    }
                }
            }
            if series.count > 1 {
                HStack(spacing: 16) {
                    ForEach(series) { s in
                        Label { Text(s.name).font(.caption) } icon: { Circle().fill(s.color).frame(width: 8, height: 8) }
                    }
                }
            }
        }
    }

    private func point(_ i: Int, value: Double, center: CGPoint, radius: CGFloat) -> CGPoint {
        let angle = -Double.pi / 2 + Double(i) * 2 * .pi / 5
        let r = radius * CGFloat(value / 100)
        return CGPoint(x: center.x + r * cos(angle), y: center.y + r * sin(angle))
    }

    private func polygon(values: [Double], center: CGPoint, radius: CGFloat) -> Path {
        Path { p in
            for (i, v) in values.enumerated() {
                let pt = point(i, value: max(0, min(100, v)), center: center, radius: radius)
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            p.closeSubpath()
        }
    }
}
