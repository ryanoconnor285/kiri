import Foundation

enum GraphQLError: Error, LocalizedError {
    case unauthorized
    case requestFailed(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Please sign in again."
        case .requestFailed(let message):
            return message
        case .invalidResponse:
            return "Invalid server response"
        }
    }
}

struct GraphQLClient {
    func fetch<T: Decodable>(
        query: String,
        variables: [String: Any]? = nil,
        as type: T.Type = T.self
    ) async throws -> T {
        var request = URLRequest(url: APIConfig.baseURL.appendingPathComponent("graphql"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = SessionManager.shared.bearerToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["query": query]
        if let variables {
            body["variables"] = variables
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GraphQLError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            await MainActor.run { SessionManager.shared.markSignedOut() }
            throw GraphQLError.unauthorized
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if let errors = json?["errors"] as? [[String: Any]],
           let message = errors.first?["message"] as? String {
            if message.localizedCaseInsensitiveContains("sign in") {
                await MainActor.run { SessionManager.shared.markSignedOut() }
                throw GraphQLError.unauthorized
            }
            throw GraphQLError.requestFailed(message)
        }

        guard let dataObj = json?["data"],
              JSONSerialization.isValidJSONObject(dataObj) else {
            throw GraphQLError.invalidResponse
        }

        let payload = try JSONSerialization.data(withJSONObject: dataObj)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: payload)
    }
}
