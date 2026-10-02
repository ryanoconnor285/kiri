import Foundation

enum SearchComposeMode {
    case and, or, not
}

struct ParsedCardSearch {
    var textTerms: [String] = []
    var excludeTextTerms: [String] = []
    var deckTitles: [String] = []
    var excludeDeckTitles: [String] = []
    var folderIds: [String] = []
    var isDue: Bool?
    var isNew: Bool?
    var isSuspended: Bool?
    var tagNone: Bool?
    var tags: [String] = []
    var excludeTags: [String] = []
    var flags: [Int] = []
    var addedWithinDays: Int?
    var editedWithinDays: Int?
}

enum CardSearchParser {
    static func tokenize(_ query: String) -> [String] {
        var tokens: [String] = []
        var i = query.startIndex
        while i < query.endIndex {
            while i < query.endIndex, query[i].isWhitespace { i = query.index(after: i) }
            if i >= query.endIndex { break }
            if query[i] == "\"" {
                i = query.index(after: i)
                var s = ""
                while i < query.endIndex, query[i] != "\"" {
                    s.append(query[i])
                    i = query.index(after: i)
                }
                if i < query.endIndex { i = query.index(after: i) }
                let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { tokens.append(trimmed) }
                continue
            }
            var s = ""
            while i < query.endIndex, !query[i].isWhitespace {
                s.append(query[i])
                i = query.index(after: i)
            }
            if !s.isEmpty { tokens.append(s) }
        }
        return tokens
    }

    static func parse(_ raw: String) -> ParsedCardSearch {
        var result = ParsedCardSearch()
        for token in tokenize(raw.trimmingCharacters(in: .whitespacesAndNewlines)) {
            var negated = false
            var body = token
            if body.hasPrefix("-"), body.count > 1 {
                negated = true
                body = String(body.dropFirst())
            }
            if let colon = body.firstIndex(of: ":") {
                let key = String(body[..<colon]).lowercased()
                var value = String(body[body.index(after: colon)...])
                if value.hasPrefix("\""), value.hasSuffix("\""), value.count >= 2 {
                    value = String(value.dropFirst().dropLast())
                }
                switch key {
                case "deck", "folder":
                    let isUuid = UUID(uuidString: value) != nil
                    if isUuid, !negated {
                        result.folderIds.append(value)
                    } else if negated {
                        result.excludeDeckTitles.append(value)
                    } else {
                        result.deckTitles.append(value)
                    }
                    continue
                case "is":
                    let v = value.lowercased()
                    if v == "due" { result.isDue = negated ? false : true }
                    else if v == "new" { result.isNew = negated ? false : true }
                    else if v == "suspended" { result.isSuspended = negated ? false : true }
                    continue
                case "tag":
                    if value.lowercased() == "none" {
                        result.tagNone = !negated
                    } else if negated {
                        result.excludeTags.append(value)
                    } else {
                        result.tags.append(value)
                    }
                    continue
                case "flag":
                    if let n = Int(value), (0...7).contains(n), !negated {
                        result.flags.append(n)
                    }
                    continue
                case "added":
                    if let n = Int(value), n >= 0, !negated { result.addedWithinDays = n }
                    continue
                case "edited":
                    if let n = Int(value), n >= 0, !negated { result.editedWithinDays = n }
                    continue
                default:
                    break
                }
            }
            if negated {
                result.excludeTextTerms.append(body)
            } else {
                result.textTerms.append(body)
            }
        }
        return result
    }

    static func appendToken(_ query: String, token: String, mode: SearchComposeMode = .and) -> String {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let needsQuote = token.contains(" ") || token.contains(":")
        let escaped = token.replacingOccurrences(of: "\"", with: "\\\"")
        let quoted = needsQuote ? "\"\(escaped)\"" : token
        let piece = token.contains(":") ? quoted : "deck:\(quoted)"
        if trimmed.isEmpty { return piece }
        switch mode {
        case .or: return "\(trimmed) OR \(piece)"
        case .not: return "\(trimmed) -\(piece)"
        case .and: return "\(trimmed) \(piece)"
        }
    }

    static func folderIdToken(_ folderId: String) -> String {
        "folder:\(folderId)"
    }
}
