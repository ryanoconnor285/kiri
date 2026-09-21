import Foundation

struct ApkgImportService {
    struct Result: Decodable {
        let importedCount: Int
        let skippedCount: Int
    }

    func upload(deckId: String, fileURL: URL) async throws -> Result {
        let data = try Data(contentsOf: fileURL)
        var components = URLComponents(
            url: APIConfig.baseURL.appendingPathComponent("api/import/apkg"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "deckId", value: deckId)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        if let token = SessionManager.shared.bearerToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw GraphQLError.invalidResponse
        }
        if http.statusCode == 401 {
            await MainActor.run { SessionManager.shared.markSignedOut() }
            throw GraphQLError.unauthorized
        }
        if http.statusCode >= 400 {
            if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
               let error = json["error"] as? String {
                throw GraphQLError.requestFailed(error)
            }
            throw GraphQLError.requestFailed("Anki import failed")
        }
        return try JSONDecoder().decode(Result.self, from: responseData)
    }
}
