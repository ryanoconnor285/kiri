import Foundation

enum SM2Calculator {
    struct Result {
        let interval: Int
        let repetitionCount: Int
        let easeFactor: Double
        let dueDate: Date
    }

    static func calculate(quality: Int, previous: ReviewState) -> Result {
        var interval = previous.interval
        var repetitionCount = previous.repetitionCount
        var easeFactor = previous.easeFactor

        if quality < 3 {
            repetitionCount = 0
            interval = 1
        } else {
            if repetitionCount == 0 {
                interval = 1
            } else if repetitionCount == 1 {
                interval = 6
            } else {
                interval = Int(round(Double(interval) * easeFactor))
            }
            repetitionCount += 1
        }

        easeFactor = max(1.3, easeFactor + (0.1 - Double(5 - quality) * (0.08 + Double(5 - quality) * 0.02)))

        let dueDate = Calendar.current.date(byAdding: .day, value: interval, to: .now) ?? .now

        return Result(
            interval: interval,
            repetitionCount: repetitionCount,
            easeFactor: easeFactor,
            dueDate: dueDate
        )
    }
}
