import Foundation

/// Keep in sync with apps/web/lib/katex-segments.ts
enum KatexSegment: Equatable {
    case text(String)
    case math(String, display: Bool)
}

enum KatexSegments {
    private static let delimPattern =
        #"\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$"#

    static func split(_ text: String) -> [KatexSegment] {
        guard let regex = try? NSRegularExpression(pattern: delimPattern) else {
            return [.text(text)]
        }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var segments: [KatexSegment] = []
        var last = 0

        regex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match else { return }
            if match.range.location > last {
                segments.append(.text(ns.substring(with: NSRange(location: last, length: match.range.location - last))))
            }
            let display = match.range(at: 1).location != NSNotFound || match.range(at: 2).location != NSNotFound
            let value: String
            if match.range(at: 1).location != NSNotFound {
                value = ns.substring(with: match.range(at: 1))
            } else if match.range(at: 2).location != NSNotFound {
                value = ns.substring(with: match.range(at: 2))
            } else if match.range(at: 3).location != NSNotFound {
                value = ns.substring(with: match.range(at: 3))
            } else {
                value = ns.substring(with: match.range(at: 4))
            }
            segments.append(.math(value, display: display))
            last = match.range.location + match.range.length
        }

        if last < ns.length {
            segments.append(.text(ns.substring(from: last)))
        }
        if segments.isEmpty {
            segments.append(.text(text))
        }
        return segments
    }

    static func isBareLatex(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.range(of: #"\\[a-zA-Z]+\{"#, options: .regularExpression) != nil
            && trimmed.range(of: #"\$|\\\(|\\\["#, options: .regularExpression) == nil
    }

    static func hasExplicitMathDelimiters(_ text: String) -> Bool {
        text.range(
            of: #"\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]"#,
            options: .regularExpression
        ) != nil
    }

    static func isFormulaLine(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed.contains("\n") { return false }
        if hasExplicitMathDelimiters(trimmed) { return false }
        if isBareLatex(trimmed) { return true }
        if trimmed.count > 80 { return false }
        let words = trimmed.split(whereSeparator: \.isWhitespace).filter { !$0.isEmpty }
        if words.count > 6 { return false }
        if trimmed.range(of: #"\b[A-Za-z]{4,}\b.*\b[A-Za-z]{4,}\b"#, options: .regularExpression) != nil,
           trimmed.range(of: "[=^\\\\]", options: .regularExpression) == nil {
            return false
        }
        return trimmed.range(of: "[=^_]", options: .regularExpression) != nil
            && trimmed.range(of: "[A-Za-z]", options: .regularExpression) != nil
    }

    static func isPlainProse(_ text: String) -> Bool {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        if looksLikeHtml(text) { return false }
        if isFormulaLine(text) { return false }
        return split(text).allSatisfy {
            if case .text = $0 { return true }
            return false
        }
    }

    static func looksLikeHtml(_ text: String) -> Bool {
        text.range(of: #"<[a-z][\s\S]*>"#, options: [.regularExpression, .caseInsensitive]) != nil
            || text.contains("data:image/")
    }
}
