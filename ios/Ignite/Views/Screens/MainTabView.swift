import SwiftUI

struct MainTabView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        TabView {
            NavigationStack { DashboardView() }
                .tabItem { Label("Ma", systemImage: "flame.fill") }
            NavigationStack { ArenaView() }
                .tabItem { Label("Aréna", systemImage: "trophy.fill") }
            NavigationStack { HistoryView() }
                .tabItem { Label("Előzmények", systemImage: "calendar") }
            NavigationStack { StatsView() }
                .tabItem { Label("Statisztika", systemImage: "chart.xyaxis.line") }
            NavigationStack { ProfileView() }
                .tabItem { Label("Profil", systemImage: "person.crop.circle") }
        }
        .errorAlert(Binding(get: { store.errorMessage }, set: { store.errorMessage = $0 }))
    }
}
