import Foundation

enum DeckTreeHelpers {
    /// All deck ids in the subtree rooted at `rootId` (includes root).
    static func collectSubtreeDeckIds(decks: [DeckDTO], rootId: String) -> [String] {
        var byParent: [String?: [DeckDTO]] = [:]
        for deck in decks {
            byParent[deck.parentId, default: []].append(deck)
        }

        var ids: [String] = []
        var queue = [rootId]
        var seen = Set<String>()

        while !queue.isEmpty {
            let id = queue.removeFirst()
            if seen.contains(id) { continue }
            seen.insert(id)
            ids.append(id)
            for child in byParent[id] ?? [] {
                queue.append(child.id)
            }
        }
        return ids
    }

    static func subtreeImpact(decks: [DeckDTO], rootId: String) -> (subfolderCount: Int, totalCards: Int) {
        let deckIds = collectSubtreeDeckIds(decks: decks, rootId: rootId)
        let byId = Dictionary(uniqueKeysWithValues: decks.map { ($0.id, $0) })
        var totalCards = 0
        for id in deckIds {
            totalCards += byId[id]?.cardCount ?? 0
        }
        return (max(0, deckIds.count - 1), totalCards)
    }

    static func deleteDeckConfirmMessage(title: String, subfolderCount: Int, totalCards: Int) -> String {
        var lines = [
            "Delete \"\(title)\" and everything inside it?",
            "",
            "This permanently removes:",
            "• this folder",
        ]
        if subfolderCount > 0 {
            let noun = subfolderCount == 1 ? "" : "s"
            lines.append("• \(subfolderCount) nested subfolder\(noun)")
        }
        if totalCards > 0 {
            let noun = totalCards == 1 ? "" : "s"
            lines.append("• \(totalCards) flashcard\(noun) in this tree")
        }
        lines.append("• all notebooks in those folders")
        lines.append("")
        lines.append("This cannot be undone.")
        return lines.joined(separator: "\n")
    }
}
