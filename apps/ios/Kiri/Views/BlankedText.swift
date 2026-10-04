import SwiftUI

/// Renders `Y [[increases]] as X [[decreases]]` with covered, tappable blanks.
struct BlankedText: View {
    let text: String
    var revealed: Bool = false

    @Environment(\.colorScheme) private var colorScheme
    @State private var open: Set<Int> = []

    private var parts: [BlankPart] {
        BlankParser.split(text)
    }

    var body: some View {
        if parts.allSatisfy(\.isText) {
            KatexView(latex: text)
        } else {
            FlowLayout(spacing: 4) {
                ForEach(parts) { part in
                    if part.isBlank {
                        blankChip(part)
                    } else {
                        Text(part.value)
                            .foregroundStyle(optionForeground)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .onChange(of: text) { _, _ in open = [] }
        }
    }

    private func blankChip(_ part: BlankPart) -> some View {
        let shown = revealed || open.contains(part.id)
        return Button {
            guard !revealed, !shown else { return }
            open.insert(part.id)
        } label: {
            Text(part.value)
                .foregroundStyle(shown ? optionForeground : Color.clear)
                .padding(.horizontal, 4)
                .background(shown ? KiriTheme.accent(colorScheme).opacity(0.16) : optionForeground)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(shown ? part.value : "Hidden word")
    }

    private var optionForeground: Color {
        colorScheme == .dark
            ? Color(red: 0.95, green: 0.96, blue: 0.97)
            : Color(red: 0.11, green: 0.11, blue: 0.12)
    }
}

private struct BlankPart: Identifiable {
    let id: Int
    let value: String
    let isBlank: Bool
    var isText: Bool { !isBlank }
}

enum BlankMarkup {
    static func hasBlanks(_ text: String) -> Bool {
        text.contains("[[") && text.contains("]]")
    }

    static func parenthesesToBlanks(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"\(([^()]+)\)"#) else { return text }
        let ns = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        var result = text
        for match in matches.reversed() {
            guard match.numberOfRanges >= 2 else { continue }
            let inner = ns.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
            if inner.isEmpty || inner.count > 48 { continue }
            if inner.contains("$") || inner.contains("[[") || inner.contains("]]") { continue }
            if inner.range(of: #"^c\d+::"#, options: .regularExpression) != nil { continue }
            if let range = Range(match.range, in: result) {
                result.replaceSubrange(range, with: "[[\(inner)]]")
            }
        }
        return result
    }
}

private enum BlankParser {
    static func split(_ text: String) -> [BlankPart] {
        var parts: [BlankPart] = []
        var remaining = text
        var index = 0
        while let start = remaining.range(of: "[[") {
            let before = String(remaining[..<start.lowerBound])
            if !before.isEmpty {
                parts.append(BlankPart(id: index, value: before, isBlank: false))
                index += 1
            }
            remaining = String(remaining[start.upperBound...])
            guard let end = remaining.range(of: "]]") else {
                parts.append(BlankPart(id: index, value: "[[" + remaining, isBlank: false))
                return parts
            }
            let inner = remaining[..<end.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
            parts.append(BlankPart(id: index, value: inner, isBlank: true))
            index += 1
            remaining = String(remaining[end.upperBound...])
        }
        if !remaining.isEmpty {
            parts.append(BlankPart(id: index, value: remaining, isBlank: false))
        }
        return parts
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(in: proposal.width ?? .infinity, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(in: bounds.width, subviews: subviews)
        for (subview, origin) in zip(subviews, result.origins) {
            subview.place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(in width: CGFloat, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x)
        }
        return (CGSize(width: maxX, height: y + rowHeight), origins)
    }
}
