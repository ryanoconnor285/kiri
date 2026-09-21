import Foundation

enum AuthError: Error, LocalizedError {
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .server(let message):
            return message
        }
    }
}

struct AuthService {
    func signIn(email: String, password: String) async throws {
        try await postAuth(path: "sign-in/email", body: ["email": email, "password": password])
    }

    func signUp(name: String, email: String, password: String) async throws {
        try await postAuth(
            path: "sign-up/email",
            body: ["name": name, "email": email, "password": password]
        )
    }

    func signOut() async {
        var request = URLRequest(url: authURL("sign-out"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.loadToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        _ = try? await URLSession.shared.data(for: request)
        await MainActor.run {
            SessionManager.shared.markSignedOut()
        }
    }

    private func postAuth(path: String, body: [String: String]) async throws {
        var request = URLRequest(url: authURL(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }

        if http.statusCode >= 400 {
            let message = parseErrorMessage(data) ?? "Authentication failed"
            throw AuthError.server(message)
        }

        guard let token = extractBearerToken(from: http, data: data) else {
            throw AuthError.server("No session token returned")
        }

        KeychainHelper.saveToken(token)

        let email = parseEmail(from: data)
        await MainActor.run {
            SessionManager.shared.markSignedIn(email: email ?? body["email"])
        }
    }

    private func authURL(_ path: String) -> URL {
        APIConfig.baseURL.appendingPathComponent("api/auth/\(path)")
    }

    private func extractBearerToken(from response: HTTPURLResponse, data: Data) -> String? {
        if let header = response.value(forHTTPHeaderField: "set-auth-token") {
            return decodeToken(header)
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let token = json["token"] as? String { return decodeToken(token) }
            if let session = json["session"] as? [String: Any],
               let token = session["token"] as? String {
                return decodeToken(token)
            }
        }
        return nil
    }

    private func decodeToken(_ raw: String) -> String {
        raw.removingPercentEncoding ?? raw
    }

    private func parseEmail(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let user = json["user"] as? [String: Any], let email = user["email"] as? String {
            return email
        }
        return nil
    }

    private func parseErrorMessage(_ data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let message = json["message"] as? String { return message }
        if let error = json["error"] as? [String: Any], let message = error["message"] as? String {
            return message
        }
        return nil
    }
}
