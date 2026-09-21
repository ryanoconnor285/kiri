import Foundation

/// Keep in sync with apps/web/lib/recall-queue.ts
enum StudyRating {
    case right, wrong
}

struct StudyMeta {
    var wrongAttempts: Int = 0
}

struct StudyStep {
    let submit: Int?
    let done: Bool
    let meta: StudyMeta
}

enum StudyQueue {
    static func applyStudy(meta: StudyMeta, rating: StudyRating) -> StudyStep {
        switch rating {
        case .right:
            return StudyStep(submit: 4, done: true, meta: meta)
        case .wrong:
            return StudyStep(
                submit: nil,
                done: false,
                meta: StudyMeta(wrongAttempts: meta.wrongAttempts + 1)
            )
        }
    }

    static func leaveQuality(meta: StudyMeta) -> Int? {
        meta.wrongAttempts > 0 ? 0 : nil
    }
}

struct StudyQueueItem: Identifiable {
    let id: String
    let card: RecallCardDTO
    var meta: StudyMeta
}

typealias RecallRating = StudyRating
typealias RecallMeta = StudyMeta
typealias RecallStep = StudyStep
typealias RecallQueue = StudyQueue
typealias RecallQueueItem = StudyQueueItem
