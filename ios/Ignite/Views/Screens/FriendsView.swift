import SwiftUI

struct FriendsView: View {
    @Environment(AppStore.self) private var store
    @State private var query = ""
    @State private var results: [UserProfile] = []
    @State private var isSearching = false
    @State private var error: String?

    var body: some View {
        List {
            if !query.isEmpty {
                Section("Találatok") {
                    if isSearching {
                        ProgressView()
                    } else if results.isEmpty {
                        Text("Nincs találat").foregroundStyle(Theme.muted)
                    }
                    ForEach(results.filter { $0.id != store.userId }) { user in
                        HStack(spacing: 12) {
                            AvatarView(avatar: user.avatar, size: 40)
                            VStack(alignment: .leading) {
                                Text(user.displayName).fontWeight(.semibold)
                                Text("@\(user.username)").font(.caption).foregroundStyle(Theme.muted)
                            }
                            Spacer()
                            relationButton(user)
                        }
                    }
                }
            }

            if !store.incoming.isEmpty {
                Section("Bejövő kérelmek") {
                    ForEach(store.incoming) { f in
                        HStack(spacing: 12) {
                            AvatarView(avatar: f.avatar, size: 40)
                            Text(f.displayName).fontWeight(.semibold)
                            Spacer()
                            Button { run { try await store.accept(f) } } label: {
                                Image(systemName: "checkmark").fontWeight(.bold)
                            }
                            .buttonStyle(.borderedProminent)
                            Button { run { try await store.reject(f) } } label: {
                                Image(systemName: "xmark")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }

            if !store.outgoing.isEmpty {
                Section("Elküldött kérelmek") {
                    ForEach(store.outgoing) { f in
                        HStack(spacing: 12) {
                            AvatarView(avatar: f.avatar, size: 40)
                            Text(f.displayName)
                            Spacer()
                            Button("Visszavonás", role: .destructive) { run { try await store.cancel(f) } }
                                .font(.caption)
                        }
                    }
                }
            }

            Section("My Circle (\(store.friends.count))") {
                if store.friends.isEmpty {
                    Text("Keress rá a barátaidra felhasználónév alapján.").foregroundStyle(Theme.muted)
                }
                ForEach(store.friends) { f in
                    NavigationLink(value: f) {
                        HStack(spacing: 12) {
                            AvatarView(avatar: f.avatar, size: 40)
                            VStack(alignment: .leading) {
                                Text(f.displayName).fontWeight(.semibold)
                                Text("\(f.rank.emoji) \(f.rank.name) · \(f.streak.currentStreak) nap")
                                    .font(.caption).foregroundStyle(Theme.muted)
                            }
                        }
                    }
                    .swipeActions {
                        Button("Törlés", role: .destructive) { run { try await store.remove(f) } }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Barátok")
        .searchable(text: $query, prompt: "Felhasználónév vagy név")
        .textInputAutocapitalization(.never)
        .task(id: query) {
            guard !query.isEmpty else { results = []; return }
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            isSearching = true
            defer { isSearching = false }
            results = (try? await API.searchUsers(query)) ?? []
        }
        .refreshable { await store.refreshFriends() }
        .errorAlert($error)
    }

    @ViewBuilder
    private func relationButton(_ user: UserProfile) -> some View {
        if store.friends.contains(where: { $0.id == user.id }) {
            Text("Barát").font(.caption).foregroundStyle(Theme.success)
        } else if store.outgoing.contains(where: { $0.id == user.id }) || store.incoming.contains(where: { $0.id == user.id }) {
            Text("Függőben").font(.caption).foregroundStyle(Theme.muted)
        } else {
            Button("Hozzáadás") { run { try await store.addFriend(user) } }
                .buttonStyle(.borderedProminent)
                .font(.caption.weight(.semibold))
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        Task {
            do { try await action() } catch { self.error = error.localizedDescription }
        }
    }
}
