import SwiftUI
import PencilKit

struct StudyView: View {
    let deckId: String
    let deckTitle: String

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @State private var hopper: [StudyQueueItem] = []
    @State private var sessionTotal = 0
    @State private var doneCount = 0
    @State private var showingBack = false
    @State private var loading = true
    @State private var submitting = false
    @State private var error: String?

    private let recallRepo = RecallRepository()

    private var current: StudyQueueItem? { hopper.first }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Button("Leave") {
                    Task { await leaveRound() }
                }
                Spacer()
                if sessionTotal > 0 {
                    Text("\(doneCount + (current == nil ? 0 : 1)) of \(sessionTotal)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if loading {
                ProgressView("Loading round…")
            } else if let error {
                Text(error).foregroundStyle(.red)
            } else if current == nil {
                ContentUnavailableView(
                    sessionTotal == 0 ? "Nothing due" : "Round clear",
                    systemImage: "checkmark.circle",
                    description: Text(
                        sessionTotal == 0
                            ? "Nothing is waiting in this folder or its nested decks."
                            : "You studied \(doneCount) card\(doneCount == 1 ? "" : "s") this round."
                    )
                )
                Button("Back to folder") { dismiss() }
            } else if let item = current {
                Text(showingBack ? "Answer" : "Prompt")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                cardFace(item.card)
                    .onTapGesture {
                        if !showingBack { showingBack = true }
                    }

                if showingBack {
                    VStack(spacing: 8) {
                        Text("How did you do?")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        ReviewChoice(title: "Right", hint: "Got it — next card", accent: KiriTheme.success(colorScheme)) {
                            Task { await markStudy(.right) }
                        }
                        ReviewChoice(title: "Wrong", hint: "Back of the deck this session", accent: KiriTheme.danger(colorScheme)) {
                            Task { await markStudy(.wrong) }
                        }
                    }
                    .disabled(submitting)
                }
            }
        }
        .padding()
        .background(KiriTheme.background(colorScheme))
        .navigationTitle(deckTitle)
        .navigationBarTitleDisplayMode(.inline)
        .tint(KiriTheme.accent(colorScheme))
        .navigationBarBackButtonHidden(submitting)
        .task { await loadQueue() }
    }

    @ViewBuilder
    private func cardFace(_ card: RecallCardDTO) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                if let b64 = showingBack ? card.backPencilData : card.frontPencilData,
                   let data = Data(base64Encoded: b64),
                   let drawing = try? PKDrawing(data: data),
                   !drawing.bounds.isEmpty {
                    PencilPreviewView(drawing: drawing)
                        .frame(height: 160)
                }
                let text = showingBack ? card.backText : card.frontText
                if !text.isEmpty {
                    KatexView(latex: text)
                        .frame(minHeight: 60)
                }
            }
            .padding()
        }
        .background(KiriTheme.canvasPaper(colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: KiriTheme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: KiriTheme.radiusLG)
                .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
        )
    }

    private func loadQueue() async {
        loading = true
        error = nil
        do {
            let due = try await recallRepo.fetchDueCards(deckId: deckId)
            hopper = due.map {
                StudyQueueItem(id: $0.cardId, card: $0.card, meta: StudyMeta())
            }
            sessionTotal = hopper.count
            doneCount = 0
            showingBack = false
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func markStudy(_ rating: StudyRating) async {
        guard var item = current, !submitting else { return }
        submitting = true
        defer { submitting = false }
        error = nil

        let step = StudyQueue.applyStudy(meta: item.meta, rating: rating)
        item.meta = step.meta

        do {
            if let quality = step.submit {
                try await recallRepo.submitReview(cardId: item.id, quality: quality)
            }
            hopper.removeFirst()
            if !step.done {
                hopper.append(item)
            } else {
                doneCount += 1
            }
            showingBack = false
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func leaveRound() async {
        submitting = true
        defer { submitting = false }
        for item in hopper {
            if let quality = StudyQueue.leaveQuality(meta: item.meta) {
                try? await recallRepo.submitReview(cardId: item.id, quality: quality)
            }
        }
        dismiss()
    }
}

private struct ReviewChoice: View {
    let title: String
    let hint: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).fontWeight(.semibold)
                Text(hint).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .buttonStyle(.bordered)
        .tint(accent)
    }
}

struct PencilPreviewView: UIViewRepresentable {
    let drawing: PKDrawing

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.isUserInteractionEnabled = false
        canvas.backgroundColor = .clear
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        canvas.drawing = drawing
    }
}
