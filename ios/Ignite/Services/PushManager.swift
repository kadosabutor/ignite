import UIKit
import UserNotifications
import Supabase

/// Natív push (APNs): engedélykérés, device token mentése a `device_tokens` táblába.
@MainActor
final class PushManager: NSObject {
    static let shared = PushManager()

    /// Engedélykérés (első bejelentkezés után) és regisztráció
    func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
    }

    /// Ha már van engedély, csendben újraregisztrál (token frissítés)
    func registerIfAuthorized() {
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                UIApplication.shared.registerForRemoteNotifications()
            case .notDetermined:
                await requestAuthorization()
            default:
                break
            }
        }
    }

    private let tokenKey = "apnsDeviceToken"

    /// Kijelentkezés előtt: az eszköz tokenje ne maradjon az előző fiókhoz kötve
    func unregisterCurrentToken() async {
        guard let token = UserDefaults.standard.string(forKey: tokenKey) else { return }
        _ = try? await supabase.from("device_tokens").delete().eq("token", value: token).execute()
    }

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: tokenKey)
        Task {
            guard let userId = try? await supabase.auth.session.user.id else { return }
            #if DEBUG
            let environment = "sandbox"
            #else
            let environment = "production"
            #endif
            struct Row: Encodable {
                let user_id: UUID
                let token: String
                let platform: String
                let environment: String
                let updated_at: String
            }
            try? await supabase.from("device_tokens")
                .upsert(Row(user_id: userId, token: token, platform: "ios", environment: environment, updated_at: API.nowTimestamp()),
                        onConflict: "token")
                .execute()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushManager.shared.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs registration failed:", error.localizedDescription)
    }

    // Előtérben is jelenjen meg az értesítés
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}
