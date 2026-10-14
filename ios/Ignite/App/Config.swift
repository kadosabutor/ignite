import Foundation

enum Config {
    /// Supabase projekt (ugyanaz, mint a webappé)
    static let supabaseURL = URL(string: "https://thibewmulezvjenwowmh.supabase.co")!

    /// Nyilvános (publishable) kulcs – kliensbe szánt, az adatokat az RLS védi
    static let supabaseKey = "sb_publishable_ucZKDDrqozQXhasSL6pj5g_7nYaNxQX"
}
