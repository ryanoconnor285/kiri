import Foundation

struct DeckDTO: Identifiable, Codable, Hashable {
    let id: String
    let parentId: String?
    let title: String
    let description: String?
    let createdAt: String?
    let cardCount: Int?
    let dueCount: Int?
}

struct CardDTO: Identifiable, Codable, Hashable {
    let id: String
    let deckId: String
    let frontText: String
    let backText: String
    let frontPencilData: String?
    let backPencilData: String?
    let createdAt: String?
    let updatedAt: String?
}

/// Card fields returned by `dueCards { card { … } }` (subset of `CardDTO`).
struct RecallCardDTO: Codable, Hashable {
    let id: String
    let frontText: String
    let backText: String
    let frontPencilData: String?
    let backPencilData: String?
}

struct DueCardDTO: Codable, Identifiable {
    var id: String { cardId }
    let cardId: String
    let card: RecallCardDTO
}

struct DeckRepository {
    private let client = GraphQLClient()

    func fetchDecks() async throws -> [DeckDTO] {
        struct Response: Decodable { let decks: [DeckDTO] }
        let data = try await client.fetch(query: GraphQLOperations.decksQuery, as: Response.self)
        return data.decks
    }

    func createDeck(title: String, parentId: String?) async throws -> DeckDTO {
        struct Response: Decodable { let createDeck: DeckDTO }
        var variables: [String: Any] = ["title": title]
        if let parentId { variables["parentId"] = parentId }
        let data = try await client.fetch(
            query: GraphQLOperations.createDeckMutation,
            variables: variables,
            as: Response.self
        )
        return data.createDeck
    }
}

struct CardRepository {
    private let client = GraphQLClient()

    func fetchCards(deckId: String) async throws -> [CardDTO] {
        struct Response: Decodable { let cards: [CardDTO] }
        let data = try await client.fetch(
            query: GraphQLOperations.cardsQuery,
            variables: ["deckId": deckId],
            as: Response.self
        )
        return data.cards
    }

    func upsertCard(
        deckId: String,
        id: String?,
        frontText: String,
        backText: String,
        frontPencilData: String? = nil,
        backPencilData: String? = nil
    ) async throws -> CardDTO {
        struct Response: Decodable { let upsertCard: CardDTO }
        var variables: [String: Any] = [
            "deckId": deckId,
            "frontText": frontText,
            "backText": backText,
        ]
        if let id { variables["id"] = id }
        if let frontPencilData { variables["frontPencilData"] = frontPencilData }
        if let backPencilData { variables["backPencilData"] = backPencilData }
        let data = try await client.fetch(
            query: GraphQLOperations.upsertCardMutation,
            variables: variables,
            as: Response.self
        )
        return data.upsertCard
    }

    func deleteCard(id: String) async throws {
        struct Response: Decodable { let deleteCard: Bool }
        _ = try await client.fetch(
            query: GraphQLOperations.deleteCardMutation,
            variables: ["id": id],
            as: Response.self
        )
    }

    func importPreview(rawText: String) async throws -> [CardDTO] {
        struct ImportCard: Decodable {
            let frontText: String
            let backText: String
        }
        struct Response: Decodable {
            let aiImportCards: ImportPayload
        }
        struct ImportPayload: Decodable {
            let cards: [ImportCard]
        }
        let data = try await client.fetch(
            query: GraphQLOperations.aiImportMutation,
            variables: ["rawText": rawText],
            as: Response.self
        )
        return data.aiImportCards.cards.map {
            CardDTO(
                id: UUID().uuidString,
                deckId: "",
                frontText: $0.frontText,
                backText: $0.backText,
                frontPencilData: nil,
                backPencilData: nil,
                createdAt: nil,
                updatedAt: nil
            )
        }
    }
}

struct NoteListDTO: Identifiable, Codable, Hashable {
    let id: String
    let deckId: String
    let title: String
    let pageCount: Int?
    let createdAt: String?
    let updatedAt: String?
}

struct NotePageDTO: Identifiable, Codable, Hashable {
    let id: String
    let noteId: String
    let pageIndex: Int
    let paperStyle: String
    let pencilData: String?
    let updatedAt: String?
}

struct NoteDTO: Identifiable, Codable, Hashable {
    let id: String
    let deckId: String
    let title: String
    let pageCount: Int?
    let createdAt: String?
    let updatedAt: String?
    let pages: [NotePageDTO]?
}

struct NoteRepository {
    private let client = GraphQLClient()

    func fetchNotes(deckId: String) async throws -> [NoteListDTO] {
        struct Response: Decodable { let notes: [NoteListDTO] }
        let data = try await client.fetch(
            query: GraphQLOperations.notesQuery,
            variables: ["deckId": deckId],
            as: Response.self
        )
        return data.notes
    }

    func fetchNote(id: String) async throws -> NoteDTO {
        struct Response: Decodable { let note: NoteDTO? }
        let data = try await client.fetch(
            query: GraphQLOperations.noteQuery,
            variables: ["id": id],
            as: Response.self
        )
        guard let note = data.note else {
            throw GraphQLError.requestFailed("Notebook not found")
        }
        return note
    }

    func createNote(deckId: String, title: String? = nil) async throws -> NoteListDTO {
        struct Response: Decodable { let createNote: NoteListDTO }
        var variables: [String: Any] = ["deckId": deckId]
        if let title { variables["title"] = title }
        let data = try await client.fetch(
            query: GraphQLOperations.createNoteMutation,
            variables: variables,
            as: Response.self
        )
        return data.createNote
    }

    func updateNote(id: String, title: String) async throws {
        struct Response: Decodable {
            struct Updated: Decodable { let id: String }
            let updateNote: Updated
        }
        _ = try await client.fetch(
            query: GraphQLOperations.updateNoteMutation,
            variables: ["id": id, "title": title],
            as: Response.self
        )
    }

    func deleteNote(id: String) async throws {
        struct Response: Decodable { let deleteNote: Bool }
        _ = try await client.fetch(
            query: GraphQLOperations.deleteNoteMutation,
            variables: ["id": id],
            as: Response.self
        )
    }

    func upsertNotePage(
        noteId: String,
        pageIndex: Int,
        paperStyle: String?,
        pencilData: String?
    ) async throws -> NotePageDTO {
        struct Response: Decodable { let upsertNotePage: NotePageDTO }
        var variables: [String: Any] = ["noteId": noteId, "pageIndex": pageIndex]
        if let paperStyle { variables["paperStyle"] = paperStyle }
        if let pencilData { variables["pencilData"] = pencilData }
        let data = try await client.fetch(
            query: GraphQLOperations.upsertNotePageMutation,
            variables: variables,
            as: Response.self
        )
        return data.upsertNotePage
    }

    func addNotePage(noteId: String, paperStyle: String?) async throws -> NotePageDTO {
        struct Response: Decodable { let addNotePage: NotePageDTO }
        var variables: [String: Any] = ["noteId": noteId]
        if let paperStyle { variables["paperStyle"] = paperStyle }
        let data = try await client.fetch(
            query: GraphQLOperations.addNotePageMutation,
            variables: variables,
            as: Response.self
        )
        return data.addNotePage
    }

    func deleteNotePage(id: String) async throws {
        struct Response: Decodable { let deleteNotePage: Bool }
        _ = try await client.fetch(
            query: GraphQLOperations.deleteNotePageMutation,
            variables: ["id": id],
            as: Response.self
        )
    }
}

struct RecallRepository {
    private let client = GraphQLClient()

    func fetchDueCards(deckId: String) async throws -> [DueCardDTO] {
        struct Response: Decodable { let dueCards: [DueCardDTO] }
        let data = try await client.fetch(
            query: GraphQLOperations.dueCardsQuery,
            variables: ["deckId": deckId],
            as: Response.self
        )
        return data.dueCards
    }

    func submitReview(cardId: String, quality: Int) async throws {
        struct Response: Decodable { let submitReview: SubmitResult }
        struct SubmitResult: Decodable { let cardId: String }
        _ = try await client.fetch(
            query: GraphQLOperations.submitReviewMutation,
            variables: ["cardId": cardId, "quality": quality],
            as: Response.self
        )
    }
}
