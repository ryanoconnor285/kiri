import SwiftUI

struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var modeSignUp = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Kiri")
                        .font(.largeTitle.weight(.semibold))
                    Text("STEM recall for pre-med and science coursework")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Sign in with the same account you use on the web app.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)

                        if modeSignUp {
                            TextField("Name", text: $name)
                                .textContentType(.name)
                                .textFieldStyle(.roundedBorder)
                        }
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .textFieldStyle(.roundedBorder)
                        SecureField("Password", text: $password)
                            .textContentType(modeSignUp ? .newPassword : .password)
                            .textFieldStyle(.roundedBorder)

                        if let error {
                            Text(error).foregroundStyle(.red).font(.footnote)
                        }

                        Button(loading ? "…" : (modeSignUp ? "Create account" : "Sign in")) {
                            Task { await submit() }
                        }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                        .tint(KiriTheme.accent(colorScheme))
                        .disabled(loading || email.isEmpty || password.count < 8)

                        Button(modeSignUp ? "Already have an account? Sign in" : "Need an account? Sign up") {
                            modeSignUp.toggle()
                            error = nil
                        }
                        .font(.footnote)
                    }
                    .padding(20)
                    .kiriSurfaceCard()
                }
                .padding(24)
            }
            .background(KiriTheme.background(colorScheme))
        }
    }

    private func submit() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let auth = AuthService()
            if modeSignUp {
                try await auth.signUp(name: name, email: email, password: password)
            } else {
                try await auth.signIn(email: email, password: password)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    LoginView()
}
