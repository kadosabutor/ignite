import SwiftUI

// MARK: - Kártya

struct Card<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.05)))
    }
}

struct SectionTitle: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.headline.weight(.bold))
            .foregroundStyle(Theme.foreground)
    }
}

// MARK: - Gombok

struct FireButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.heavy))
            .foregroundStyle(Theme.background)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Theme.fireGradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: Theme.primary.opacity(0.35), radius: 12, y: 4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.foreground)
            .padding(.vertical, 14)
            .padding(.horizontal, 18)
            .background(Theme.surfaceLight, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension ButtonStyle where Self == FireButtonStyle {
    static var fire: FireButtonStyle { FireButtonStyle() }
}

extension ButtonStyle where Self == GhostButtonStyle {
    static var ghost: GhostButtonStyle { GhostButtonStyle() }
}

// MARK: - Pontszám-gyűrű

struct ProgressRing<Label: View>: View {
    let value: Double
    var max: Double = 100
    var lineWidth: CGFloat = 10
    var color: Color = Theme.primary
    @ViewBuilder var label: Label

    var body: some View {
        ZStack {
            Circle().stroke(Theme.surfaceLight, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, value / max))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(duration: 0.8), value: value)
            label
        }
    }
}

// MARK: - Streak ikon

struct StreakIcon: View {
    let level: StreakLevel
    var size: CGFloat = 72
    var animated = false
    @State private var glow = false

    var body: some View {
        Image(level.imageName)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .shadow(color: level.color.opacity(glow ? 0.8 : 0.3), radius: glow ? 18 : 8)
            .onAppear {
                guard animated else { return }
                withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { glow = true }
            }
    }
}

// MARK: - Avatar

struct AvatarView: View {
    let avatar: String
    var size: CGFloat = 44

    var body: some View {
        Group {
            if ["lion", "wolf", "bull"].contains(avatar) {
                Image("avatar_\(avatar)").resizable().scaledToFill()
            } else if let url = URL(string: avatar), url.scheme?.hasPrefix("http") == true {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Theme.surfaceLight
                }
            } else {
                Image("avatar_lion").resizable().scaledToFill()
            }
        }
        .frame(width: size, height: size)
        .background(Theme.surfaceLight)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.08)))
    }
}

// MARK: - Igen/Nem választó

struct YesNoPicker: View {
    let title: String
    @Binding var value: Bool
    /// Igaz, ha az „Igen” a jó válasz (zöld); a tisztaság kérdéseknél a „Nem” a jó.
    var yesIsGood = true
    let points: Int

    var body: some View {
        VStack(spacing: 12) {
            Text(title)
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.foreground)
            HStack(spacing: 12) {
                option("Igen", selected: value, good: yesIsGood) { value = true }
                option("Nem", selected: !value, good: !yesIsGood) { value = false }
            }
            let earned = (value == yesIsGood)
            Text(earned ? "+\(points) pont" : "0 pont")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(earned ? Theme.success : Theme.muted)
                .contentTransition(.numericText())
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .sensoryFeedback(.selection, trigger: value)
    }

    private func option(_ label: String, selected: Bool, good: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.spring(duration: 0.25)) { action() }
        } label: {
            Text(label)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(selected ? Theme.background : Theme.muted)
                .background(
                    selected ? (good ? Theme.success : Theme.error) : Theme.surfaceLight,
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Statisztika csempe

struct StatTile: View {
    let value: String
    let label: String
    var color: Color = Theme.foreground

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title.weight(.heavy))
                    .foregroundStyle(color)
                    .contentTransition(.numericText())
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
        }
    }
}

// MARK: - Hiba-alert

extension View {
    func errorAlert(_ message: Binding<String?>) -> some View {
        alert("Hiba", isPresented: Binding(get: { message.wrappedValue != nil }, set: { if !$0 { message.wrappedValue = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(message.wrappedValue ?? "")
        }
    }
}
