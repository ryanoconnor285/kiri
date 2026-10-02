import SwiftUI

struct MultipleChoiceStudyView: View {
    @Environment(\.colorScheme) private var colorScheme

    let questionHtml: String
    let choices: [String]
    let allowMultiple: Bool
    let correctIndices: [Int]?
    let explanationHtml: String
    let shuffleSeed: Int
    let revealed: Bool
    let onReveal: () -> Void

    @State private var selected: Set<Int> = []

    private var order: [Int] {
        MultipleChoiceShuffle.shuffleIndices(length: choices.count, seed: shuffleSeed)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            KatexView(latex: questionHtml)
                .frame(minHeight: 44)

            Text(allowMultiple ? "Check all that apply." : "Select one answer.")
                .font(.caption)
                .foregroundStyle(.secondary)

            ForEach(order, id: \.self) { choiceIndex in
                optionButton(choiceIndex: choiceIndex)
            }

            if !revealed {
                Button("Check answer", action: onReveal)
                    .buttonStyle(.borderedProminent)
                    .tint(KiriTheme.accent(colorScheme))
            } else if !explanationHtml.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                KatexView(latex: explanationHtml)
                    .frame(minHeight: 44)
            }
        }
        .padding()
        .background(KiriTheme.canvasPaper(colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: KiriTheme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: KiriTheme.radiusLG)
                .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
        )
        .onChange(of: shuffleSeed) { _, _ in selected = [] }
        .onChange(of: revealed) { _, isRevealed in
            if !isRevealed { selected = [] }
        }
    }

    @ViewBuilder
    private func optionButton(choiceIndex: Int) -> some View {
        let isSelected = selected.contains(choiceIndex)
        let isCorrect = revealed && (correctIndices?.contains(choiceIndex) == true)
        let isIncorrect = revealed && isSelected && !isCorrect

        Button {
            guard !revealed else { return }
            if allowMultiple {
                if selected.contains(choiceIndex) {
                    selected.remove(choiceIndex)
                } else {
                    selected.insert(choiceIndex)
                }
            } else {
                selected = [choiceIndex]
            }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: boxIcon(isSelected: isSelected))
                    .foregroundStyle(isCorrect ? KiriTheme.success(colorScheme) : .primary)
                Text(choices[choiceIndex])
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .background(optionBackground(isSelected: isSelected, isCorrect: isCorrect, isIncorrect: isIncorrect))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .disabled(revealed)
    }

    private func boxIcon(isSelected: Bool) -> String {
        allowMultiple
            ? (isSelected ? "checkmark.square.fill" : "square")
            : (isSelected ? "largecircle.fill.circle" : "circle")
    }

    private func optionBackground(isSelected: Bool, isCorrect: Bool, isIncorrect: Bool) -> Color {
        if isCorrect {
            return KiriTheme.success(colorScheme).opacity(0.15)
        }
        if isIncorrect {
            return KiriTheme.danger(colorScheme).opacity(0.12)
        }
        if isSelected {
            return KiriTheme.accent(colorScheme).opacity(colorScheme == .dark ? 0.28 : 0.14)
        }
        return KiriTheme.surfaceSecondary(colorScheme)
    }
}
