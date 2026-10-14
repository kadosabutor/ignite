import SwiftUI

@main
struct IgniteApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.dark)
                .tint(Theme.primary)
                .task { store.start() }
        }
    }
}

struct RootView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            switch store.phase {
            case .loading:
                LoadingView()
            case .signedOut:
                AuthView()
                    .transition(.opacity)
            case .signedIn:
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: store.phase)
    }
}

struct LoadingView: View {
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 16) {
            Image("logo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .scaleEffect(pulse ? 1.06 : 0.94)
            Text("IGNITE")
                .font(.title.weight(.black))
                .tracking(4)
                .foregroundStyle(Theme.foreground)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}
