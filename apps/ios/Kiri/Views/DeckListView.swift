import SwiftUI

struct DeckListView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Bindable private var session = SessionManager.shared
    @State private var decks: [DeckDTO] = []
    @State private var loading = true
    @State private var error: String?
    @State private var newTitle = ""

    private let deckRepo = DeckRepository()

    private var sortedDecks: [DeckDTO] {
        decks.sorted { lhs, rhs in
            if depth(of: lhs) != depth(of: rhs) {
                return depth(of: lhs) < depth(of: rhs)
            }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private var totalDue: Int {
        decks.reduce(0) { $0 + ($1.dueCount ?? 0) }
    }

    private var firstDueDeck: DeckDTO? {
        decks.first { ($0.dueCount ?? 0) > 0 }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerBlock
                    reviewHero
                    createDeckBlock
                    decksSection
                }
                .padding()
            }
            .background(KiriTheme.background(colorScheme))
            .navigationTitle("Kiri")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Text(session.userEmail ?? "Signed in")
                        Button("Sign out", role: .destructive) {
                            Task { await AuthService().signOut() }
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Refresh") { Task { await load() } }
                }
            }
            .refreshable { await load() }
            .navigationDestination(for: DeckDTO.self) { deck in
                DeckDetailView(deckId: deck.id, deckTitle: deck.title)
            }
            .task { await load() }
        }
        .tint(KiriTheme.accent(colorScheme))
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(timeGreeting())
                .font(.title2.weight(.semibold))
            Text("Ready to study?")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var reviewHero: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TODAY'S STUDY")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(totalDue > 0 ? "\(totalDue) card\(totalDue == 1 ? "" : "s")" : "All caught up")
                .font(.title3.weight(.semibold))
            Text(
                totalDue > 0
                    ? "Cards waiting across your folders."
                    : "Nothing is due right now."
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)

            if let deck = firstDueDeck {
                NavigationLink {
                    StudyView(deckId: deck.id, deckTitle: deck.title)
                } label: {
                    Text("Start study")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(KiriTheme.accent(colorScheme))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kiriSurfaceCard()
    }

    private var createDeckBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("New top-level folder or deck")
                .font(.headline)
            HStack {
                TextField("e.g. Organic Chemistry", text: $newTitle)
                    .textFieldStyle(.roundedBorder)
                Button("Create") {
                    Task { await createDeck(parentId: nil, title: newTitle) }
                }
                .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(16)
        .kiriSurfaceCard()
    }

    @ViewBuilder
    private var decksSection: some View {
        Text("YOUR DECKS")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)

        if loading {
            ProgressView()
        } else if let error {
            Text(error).foregroundStyle(.red)
        } else if rootDecks.isEmpty {
            Text("No decks yet. Create one above or use the web app.")
                .foregroundStyle(.secondary)
        } else {
            VStack(spacing: 8) {
                ForEach(sortedDecks) { deck in
                    NavigationLink(value: deck) {
                        deckRow(deck)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func deckRow(_ deck: DeckDTO) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.secondary.opacity(0.35))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 4) {
                Text(deck.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(metadata(for: deck))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if (deck.dueCount ?? 0) > 0 {
                Text("\(deck.dueCount!) ready")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(KiriTheme.accent(colorScheme).opacity(0.12))
                    .foregroundStyle(KiriTheme.accent(colorScheme))
                    .clipShape(Capsule())
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.leading, CGFloat(depth(of: deck)) * 10)
        .padding(14)
        .kiriSurfaceCard()
    }

    private func metadata(for deck: DeckDTO) -> String {
        var parts = ["\(deck.cardCount ?? 0) cards"]
        if let due = deck.dueCount, due > 0 {
            parts.append("\(due) due")
        }
        return parts.joined(separator: " · ")
    }

    private func timeGreeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private var rootDecks: [DeckDTO] {
        decks.filter { $0.parentId == nil }
    }

    private func depth(of deck: DeckDTO) -> Int {
        var level = 0
        var parentId = deck.parentId
        var guardSet = Set<String>()
        while let pid = parentId, !guardSet.contains(pid) {
            guardSet.insert(pid)
            level += 1
            parentId = decks.first(where: { $0.id == pid })?.parentId
        }
        return level
    }

    private func load() async {
        loading = true
        error = nil
        do {
            decks = try await deckRepo.fetchDecks()
        } catch let err {
            self.error = err.localizedDescription
        }
        loading = false
    }

    private func createDeck(parentId: String?, title: String) async {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            _ = try await deckRepo.createDeck(title: trimmed, parentId: parentId)
            newTitle = ""
            await load()
        } catch let err {
            self.error = err.localizedDescription
        }
    }
}

#Preview {
    DeckListView()
}
