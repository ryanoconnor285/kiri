import Foundation

/// Matches `@kiri/card-templates` `shuffleIndices` (LCG seed).
enum MultipleChoiceShuffle {
    static func shuffleIndices(length: Int, seed: Int) -> [Int] {
        guard length > 0 else { return [] }
        var indices = Array(0 ..< length)
        var s = UInt32(bitPattern: Int32(truncatingIfNeeded: seed))
        if length == 1 { return indices }
        for i in stride(from: length - 1, through: 1, by: -1) {
            s = s &* 1_664_525 &+ 1_013_902_423
            let j = Int(s % UInt32(i + 1))
            indices.swapAt(i, j)
        }
        return indices
    }
}
