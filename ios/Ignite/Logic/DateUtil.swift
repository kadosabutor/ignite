import Foundation

/// Minden napló-dátum budapesti naptári nap (YYYY-MM-DD), 04:00-s napzárással –
/// ugyanúgy, mint a webappban (src/lib/scoring.ts).
enum DateUtil {
    static let timeZone = TimeZone(identifier: "Europe/Budapest")!
    static let cutoffHour = 4

    static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = timeZone
        c.locale = Locale(identifier: "hu_HU")
        c.firstWeekday = 2
        return c
    }()

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Budapesti naptári nap egy adott pillanatra
    static func dayString(from date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// A nap délben (budapesti idő) – megjelenítéshez és napszámításhoz
    static func date(from day: String) -> Date? {
        guard let d = dayFormatter.date(from: day) else { return nil }
        return calendar.date(byAdding: .hour, value: 12, to: d)
    }

    static func addDays(_ day: String, _ days: Int) -> String {
        guard let d = date(from: day), let r = calendar.date(byAdding: .day, value: days, to: d) else { return day }
        return dayString(from: r)
    }

    static func daysBetween(_ from: String, _ to: String) -> Int {
        guard let a = date(from: from), let b = date(from: to) else { return 0 }
        return calendar.dateComponents([.day], from: a, to: b).day ?? 0
    }

    static var today: String { dayString(from: Date()) }

    static var currentHour: Int { calendar.component(.hour, from: Date()) }

    /// A naplózás napja: 04:00 előtt még a tegnapi nap
    static var effectiveToday: String {
        currentHour >= cutoffHour ? today : addDays(today, -1)
    }

    /// H, K, Sze, Cs, P, Szo, V
    static func weekdayShort(_ day: String) -> String {
        guard let d = date(from: day) else { return "" }
        let symbols = ["V", "H", "K", "Sze", "Cs", "P", "Szo"]
        return symbols[calendar.component(.weekday, from: d) - 1]
    }

    static func display(_ day: String, format: String = "MMM d., EEE") -> String {
        guard let d = date(from: day) else { return day }
        let f = DateFormatter()
        f.locale = Locale(identifier: "hu_HU")
        f.timeZone = timeZone
        f.dateFormat = format
        return f.string(from: d)
    }

    // MARK: HH:mm <-> Date (DatePickerhez)

    static func time(from hhmm: String?) -> Date? {
        guard let hhmm, case let parts = hhmm.split(separator: ":"), parts.count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return calendar.date(bySettingHour: h, minute: m, second: 0, of: Date())
    }

    static func hhmm(from date: Date) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}
