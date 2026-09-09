import Foundation

enum GraphQLError: Error, LocalizedError {
    case unauthorized
    case requestFailed(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Not authenticated"
        case .requestFailed(let message):
            return message
        case .invalidResponse:
            return "Invalid server response"
        }
    }
}

struct GraphQLClient {
    static var baseURL: URL {
        URL(string: ProcessInfo.processInfo.environment["KIRI_API_URL"] ?? "http://localhost:4000")!
    }

    func fetch<T: Decodable>(query: String, variables: [String: Any]? = nil) async throws -> T {
        var request = URLRequest(url: GraphQLClient.baseURL.appendingPathComponent("graphql"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = KeychainHelper.loadToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["query": query]
        if let variables {
            body["variables"] = variables
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw GraphQLError.requestFailed("HTTP error")
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        if let errors = json?["errors"] as? [[String: Any]],
           let message = errors.first?["message"] as? String {
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

    /// Stub: sync local deck cards to server via upsertCard mutation
    func syncDeck(deckId: UUID, cards: [Card]) async throws {
        for card in cards {
            let mutation = """
            mutation($deckId: String!, $frontText: String!, $backText: String!, $id: String) {
              upsertCard(deckId: $deckId, frontText: $frontText, backText: $backText, id: $id) { id }
            }
            """
            let _: UpsertResponse = try await fetch(
                query: mutation,
                variables: [
                    "deckId": deckId.uuidString,
                    "frontText": card.frontText,
                    "backText": card.backText,
                    "id": card.id.uuidString,
                ]
            )
        }
    }
}

private struct UpsertResponse: Decodable {
    let upsertCard: UpsertCardResult
}

private struct UpsertCardResult: Decodable {
    let id: String
}
