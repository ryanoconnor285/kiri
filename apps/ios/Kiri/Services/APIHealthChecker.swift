import Foundation
import Observation

@Observable
final class APIHealthChecker {
    static let shared = APIHealthChecker()

    enum Status: Equatable {
        case idle
        case checking
        case reachable
        case unreachable(message: String)
    }

    private(set) var status: Status = .idle

    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 8
        session = URLSession(configuration: config)
    }

    @MainActor
    func checkOnLaunch() async {
        guard status == .idle else { return }
        await check()
    }

    @MainActor
    func check() async {
        status = .checking
        let url = APIConfig.healthURL

        do {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            let (_, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200 ... 299).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                status = .unreachable(message: "HTTP \(code)")
                return
            }
            status = .reachable
        } catch {
            status = .unreachable(message: error.localizedDescription)
        }
    }
}
