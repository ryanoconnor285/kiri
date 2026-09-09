import SwiftUI
import SwiftData

@main
struct KiriApp: App {
    var body: some Scene {
        WindowGroup {
            DeckListView()
        }
        .modelContainer(for: [Deck.self, Card.self, ReviewState.self])
    }
}
