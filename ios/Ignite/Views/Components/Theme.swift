import SwiftUI

/// Színek a webapp src/index.css változói alapján
enum Theme {
    static let background = Color(hex: 0x121212)
    static let surface = Color(hex: 0x1E1E1E)
    static let surfaceLight = Color(hex: 0x2C2C2C)
    static let primary = Color(hex: 0xFF7033)
    static let primaryDark = Color(hex: 0xE65A1F)
    static let foreground = Color(hex: 0xECEDEE)
    static let muted = Color(hex: 0x9BA1A6)
    static let border = Color(hex: 0x334155)
    static let success = Color(hex: 0x4ADE80)
    static let warning = Color(hex: 0xFBBF24)
    static let error = Color(hex: 0xF87171)

    static let fireGradient = LinearGradient(
        colors: [primary, Color(hex: 0xFF4500)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
