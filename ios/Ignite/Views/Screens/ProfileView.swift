import SwiftUI
import PhotosUI

struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading = false
    @State private var showEdit = false
    @State private var showSettings = false
    @State private var selectedBadge: Badge?

    var body: some View {
        ScrollView {
            if let p = store.profile {
                VStack(spacing: 16) {
                    header(p)
                    xpCard(p)
                    HStack(spacing: 12) {
                        StatTile(value: "\(store.streak.currentStreak)", label: "Sorozat")
                        StatTile(value: "\(store.streak.longestStreak)", label: "Rekord")
                        StatTile(value: "\(store.entries.count)", label: "Nap")
                    }
                    badgesCard
                    Button("Kijelentkezés", role: .destructive) {
                        Task { await store.signOut() }
                    }
                    .buttonStyle(.ghost)
                    .padding(.top, 8)
                }
                .padding(16)
            }
        }
        .background(Theme.background)
        .navigationTitle("Profil")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Profil szerkesztése", systemImage: "pencil") { showEdit = true }
                    Button("Értesítések", systemImage: "bell") { showSettings = true }
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .sheet(isPresented: $showEdit) { EditProfileView() }
        .sheet(isPresented: $showSettings) { NotificationSettingsView() }
        .sheet(item: $selectedBadge) { badge in
            VStack(spacing: 14) {
                Text(badge.icon).font(.system(size: 64)).grayscale(badge.isUnlocked ? 0 : 1)
                Text(badge.name).font(.title2.weight(.bold))
                Text(badge.description).multilineTextAlignment(.center).foregroundStyle(Theme.muted)
                Text(badge.isUnlocked ? "Megszerezve ✓" : "Feltétel: \(badge.requirement)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(badge.isUnlocked ? Theme.success : Theme.warning)
            }
            .padding(24)
            .presentationDetents([.height(320)])
        }
        .onChange(of: photoItem) { Task { await uploadPhoto() } }
    }

    private func header(_ p: UserProfile) -> some View {
        VStack(spacing: 10) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                AvatarView(avatar: p.avatar, size: 104)
                    .overlay {
                        if isUploading {
                            Circle().fill(.black.opacity(0.5))
                            ProgressView()
                        }
                    }
                    .overlay(alignment: .bottomTrailing) {
                        Image(systemName: "camera.fill")
                            .font(.caption)
                            .padding(7)
                            .background(Theme.primary, in: Circle())
                            .foregroundStyle(Theme.background)
                    }
            }
            Text(p.displayName).font(.title2.weight(.bold))
            Text("@\(p.username)").font(.subheadline).foregroundStyle(Theme.muted)
            Text("\(p.rank.emoji) \(p.rank.name)")
                .font(.subheadline.weight(.bold))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(p.rank.color.opacity(0.18), in: Capsule())
                .foregroundStyle(p.rank.color)
            if !p.bio.isEmpty {
                Text(p.bio).font(.subheadline).multilineTextAlignment(.center).foregroundStyle(Theme.foreground.opacity(0.85))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func xpCard(_ p: UserProfile) -> some View {
        let lvl = Gamification.level(fromXP: p.totalXp)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Level \(lvl.level)").font(.headline.weight(.black))
                    Spacer()
                    Text("\(p.totalXp) / \(lvl.nextLevelXP) XP").font(.caption.monospacedDigit()).foregroundStyle(Theme.muted)
                }
                ProgressView(value: lvl.progress, total: 100).tint(Theme.primary)
            }
        }
    }

    private var badgesCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionTitle(text: "Badge-ek")
                    Spacer()
                    Text("\(store.badges.filter(\.isUnlocked).count)/\(store.badges.count)").font(.caption).foregroundStyle(Theme.muted)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 14) {
                    ForEach(store.badges) { badge in
                        Button { selectedBadge = badge } label: {
                            VStack(spacing: 6) {
                                Text(badge.icon)
                                    .font(.system(size: 34))
                                    .grayscale(badge.isUnlocked ? 0 : 1)
                                    .opacity(badge.isUnlocked ? 1 : 0.35)
                                Text(badge.name)
                                    .font(.caption2.weight(.semibold))
                                    .multilineTextAlignment(.center)
                                    .foregroundStyle(badge.isUnlocked ? Theme.foreground : Theme.muted)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func uploadPhoto() async {
        guard let item = photoItem,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.squareThumbnail(side: 512).jpegData(compressionQuality: 0.85) else { return }
        isUploading = true
        defer { isUploading = false; photoItem = nil }
        do {
            try await store.uploadAvatar(jpeg)
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

extension UIImage {
    /// Középre vágott, négyzetes kép (a webes ImageCropper egyszerűsített megfelelője)
    func squareThumbnail(side: CGFloat) -> UIImage {
        let minSide = min(size.width, size.height)
        let origin = CGPoint(x: (size.width - minSide) / 2, y: (size.height - minSide) / 2)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        return renderer.image { _ in
            let scale = side / minSide
            draw(in: CGRect(x: -origin.x * scale, y: -origin.y * scale, width: size.width * scale, height: size.height * scale))
        }
    }
}

// MARK: - Profil szerkesztése

struct EditProfileView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var bio = ""
    @State private var avatar = "lion"
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Név") {
                    TextField("Megjelenítendő név", text: $displayName)
                }
                Section("Bemutatkozás") {
                    TextField("Pár szó magadról", text: $bio, axis: .vertical).lineLimit(2...5)
                }
                Section("Alap avatar") {
                    HStack(spacing: 16) {
                        ForEach(["lion", "wolf", "bull"], id: \.self) { a in
                            Button { avatar = a } label: {
                                AvatarView(avatar: a, size: 56)
                                    .overlay(Circle().strokeBorder(avatar == a ? Theme.primary : .clear, lineWidth: 3))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .navigationTitle("Profil szerkesztése")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Mégse") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Mentés") {
                        Task {
                            isSaving = true
                            do {
                                try await store.saveProfile(displayName: displayName, bio: bio, avatar: avatar)
                                dismiss()
                            } catch {
                                store.errorMessage = error.localizedDescription
                            }
                            isSaving = false
                        }
                    }
                    .disabled(isSaving || displayName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                guard let p = store.profile else { return }
                displayName = p.displayName
                bio = p.bio
                avatar = p.avatar
            }
        }
    }
}

// MARK: - Értesítések

struct NotificationSettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var s = NotificationSettings()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Értesítések", isOn: $s.enabled)
                } footer: {
                    Text("Az emlékeztetőket a szerver küldi, budapesti idő szerint. Délután és este csak akkor, ha még nem rögzítetted a napot.")
                }
                if s.enabled {
                    Section("Napi emlékeztetők") {
                        reminder("Reggeli motiváció", isOn: $s.morningEnabled, time: $s.morningTime)
                        reminder("Délutáni emlékeztető", isOn: $s.afternoonEnabled, time: $s.afternoonTime)
                        reminder("Esti felszólítás", isOn: $s.eveningEnabled, time: $s.eveningTime)
                    }
                    Section("Egyéb") {
                        Toggle("Streak figyelmeztetések", isOn: $s.streakEnabled)
                        Toggle("Barátok (ping, tűz)", isOn: $s.socialEnabled)
                    }
                }
            }
            .navigationTitle("Értesítések")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kész") {
                        Task {
                            await store.saveSettings(s)
                            if s.enabled { await PushManager.shared.requestAuthorization() }
                            dismiss()
                        }
                    }
                }
            }
            .onAppear { s = store.settings }
        }
    }

    private func reminder(_ title: String, isOn: Binding<Bool>, time: Binding<String>) -> some View {
        VStack(alignment: .leading) {
            Toggle(title, isOn: isOn)
            if isOn.wrappedValue {
                // A cron egész órákra fut, ezért órát választunk
                Picker("Időpont", selection: time) {
                    ForEach(5..<24, id: \.self) { h in
                        let t = String(format: "%02d:00", h)
                        Text(t).tag(t)
                    }
                }
            }
        }
    }
}
