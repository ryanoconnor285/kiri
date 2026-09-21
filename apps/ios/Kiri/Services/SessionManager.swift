import Foundation
import Observation

@Observable
final class SessionManager {
    static let shared = SessionManager()

    private(set) var isAuthenticated: Bool
    private(set) var userEmail: String?

    private init() {
        isAuthenticated = KeychainHelper.loadToken() != nil
    }

    func markSignedIn(email: String?) {
        isAuthenticated = true
        userEmail = email
    }

    func markSignedOut() {
        KeychainHelper.deleteToken()
        isAuthenticated = false
        userEmail = nil
    }

    func bearerToken() -> String? {
        KeychainHelper.loadToken()
    }
}
