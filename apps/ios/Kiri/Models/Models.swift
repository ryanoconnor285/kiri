import Foundation
import SwiftData

@Model
final class Deck {
    @Attribute(.unique) var id: UUID
    var title: String
    var deckDescription: String?
    var createdAt: Date
    @Relationship(deleteRule: .cascade, inverse: \Card.deck)
    var cards: [Card]

    init(id: UUID = UUID(), title: String, deckDescription: String? = nil, createdAt: Date = .now) {
        self.id = id
        self.title = title
        self.deckDescription = deckDescription
        self.createdAt = createdAt
        self.cards = []
    }
}

@Model
final class Card {
    @Attribute(.unique) var id: UUID
    var deckId: UUID
    var frontText: String
    var backText: String
    var frontPencilData: Data?
    var backPencilData: Data?
    var createdAt: Date
    var updatedAt: Date
    var deck: Deck?
    @Relationship(deleteRule: .cascade, inverse: \ReviewState.card)
    var reviewState: ReviewState?

    init(
        id: UUID = UUID(),
        deckId: UUID,
        frontText: String = "",
        backText: String = "",
        frontPencilData: Data? = nil,
        backPencilData: Data? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.deckId = deckId
        self.frontText = frontText
        self.backText = backText
        self.frontPencilData = frontPencilData
        self.backPencilData = backPencilData
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class ReviewState {
    var cardId: UUID
    var userId: UUID
    var interval: Int
    var repetitionCount: Int
    var easeFactor: Double
    var dueDate: Date
    var card: Card?

    init(
        cardId: UUID,
        userId: UUID,
        interval: Int = 0,
        repetitionCount: Int = 0,
        easeFactor: Double = 2.5,
        dueDate: Date = .now
    ) {
        self.cardId = cardId
        self.userId = userId
        self.interval = interval
        self.repetitionCount = repetitionCount
        self.easeFactor = easeFactor
        self.dueDate = dueDate
    }
}
