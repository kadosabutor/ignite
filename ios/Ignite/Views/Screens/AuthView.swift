import SwiftUI

struct AuthView: View {
    @Environment(AppStore.self) private var store

    enum Mode { case login, register }

    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var avatar = "lion"
    @State private var isWorking = false
    @State private var error: String?
    @State private var info: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 10) {
                    Image("logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 88, height: 88)
                    Text("IGNITE")
                        .font(.largeTitle.weight(.black))
                        .tracking(6)
                    Text(mode == .login ? "Lépj be és gyújtsd be a napot." : "Csatlakozz és kezdd el a sorozatot.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
                .padding(.top, 48)

                VStack(spacing: 14) {
                    field("Email", text: $email, systemImage: "envelope")
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)

                    secureField

                    if mode == .register {
                        field("Felhasználónév", text: $username, systemImage: "at")
                            .textContentType(.username)
                        field("Megjelenítendő név", text: $displayName, systemImage: "person")
                            .textContentType(.name)
                            .textInputAutocapitalization(.words)
                        avatarPicker
                    }
                }

                Button {
                    Task { await submit() }
                } label: {
                    if isWorking {
                        ProgressView().tint(Theme.background)
                    } else {
                        Text(mode == .login ? "BELÉPÉS 🔥" : "REGISZTRÁCIÓ 🔥")
                    }
                }
                .buttonStyle(.fire)
                .disabled(isWorking || !isValid)
                .opacity(isValid ? 1 : 0.6)

                Button {
                    withAnimation(.spring(duration: 0.3)) { mode = mode == .login ? .register : .login }
                } label: {
                    Text(mode == .login ? "Nincs még fiókod? **Regisztrálj**" : "Van már fiókod? **Lépj be**")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .errorAlert($error)
        .alert("Erősítsd meg az emailed", isPresented: Binding(get: { info != nil }, set: { if !$0 { info = nil } })) {
            Button("OK") { withAnimation { mode = .login } }
        } message: {
            Text(info ?? "")
        }
    }

    private var isValid: Bool {
        let base = email.contains("@") && password.count >= 6
        return mode == .login ? base : base && username.count >= 3
    }

    private func field(_ title: String, text: Binding<String>, systemImage: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage).foregroundStyle(Theme.muted).frame(width: 20)
            TextField(title, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var secureField: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock").foregroundStyle(Theme.muted).frame(width: 20)
            SecureField("Jelszó (min. 6 karakter)", text: $password)
                .textContentType(mode == .login ? .password : .newPassword)
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var avatarPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Válassz avatart").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.muted)
            HStack(spacing: 16) {
                ForEach(["lion", "wolf", "bull"], id: \.self) { a in
                    Button {
                        avatar = a
                    } label: {
                        AvatarView(avatar: a, size: 64)
                            .overlay(Circle().strokeBorder(avatar == a ? Theme.primary : .clear, lineWidth: 3))
                            .scaleEffect(avatar == a ? 1.08 : 1)
                    }
                    .buttonStyle(.plain)
                }
            }
            .animation(.spring(duration: 0.25), value: avatar)
            .sensoryFeedback(.selection, trigger: avatar)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func submit() async {
        isWorking = true
        defer { isWorking = false }
        do {
            switch mode {
            case .login:
                try await store.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            case .register:
                let name = displayName.trimmingCharacters(in: .whitespaces)
                let uname = username.lowercased().trimmingCharacters(in: .whitespaces)
                try await store.signUp(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password,
                    username: uname,
                    displayName: name.isEmpty ? uname : name,
                    avatar: avatar
                )
                info = "Küldtünk egy megerősítő linket az email címedre. Megerősítés után be tudsz lépni."
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
