import Foundation

enum APIConfig {
    /// True for the Staging build configuration (`SWIFT_ACTIVE_COMPILATION_CONDITIONS`).
    static var isStaging: Bool {
        #if STAGING
        true
        #else
        false
        #endif
    }

    static var baseURL: URL {
        if let env = ProcessInfo.processInfo.environment["KIRI_API_URL"],
           let url = URL(string: env) {
            return url
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "KIRIApiURL") as? String,
           let url = URL(string: plist) {
            return url
        }
        return URL(string: "http://localhost:4000")!
    }

    static var healthURL: URL {
        baseURL.appending(path: "health")
    }

    static var displayHost: String {
        baseURL.host ?? baseURL.absoluteString
    }
}
