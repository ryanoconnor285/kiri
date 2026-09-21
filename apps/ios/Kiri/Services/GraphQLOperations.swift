enum GraphQLOperations {
    static let decksQuery = """
    query {
      decks {
        id
        parentId
        title
        description
        createdAt
        cardCount
        dueCount
      }
    }
    """

    static let cardsQuery = """
    query($deckId: String!) {
      cards(deckId: $deckId, limit: 500) {
        id
        deckId
        frontText
        backText
        frontPencilData
        backPencilData
        createdAt
        updatedAt
      }
    }
    """

    static let dueCardsQuery = """
    query($deckId: String!) {
      dueCards(deckId: $deckId) {
        cardId
        card {
          id
          frontText
          backText
          frontPencilData
          backPencilData
        }
      }
    }
    """

    static let createDeckMutation = """
    mutation($title: String!, $parentId: String) {
      createDeck(title: $title, parentId: $parentId) {
        id
        parentId
        title
        description
        createdAt
        cardCount
        dueCount
      }
    }
    """

    static let upsertCardMutation = """
    mutation($deckId: String!, $frontText: String!, $backText: String!, $id: String, $frontPencilData: String, $backPencilData: String) {
      upsertCard(deckId: $deckId, frontText: $frontText, backText: $backText, id: $id, frontPencilData: $frontPencilData, backPencilData: $backPencilData) {
        id
        deckId
        frontText
        backText
        frontPencilData
        backPencilData
      }
    }
    """

    static let submitReviewMutation = """
    mutation($cardId: String!, $quality: Int!) {
      submitReview(cardId: $cardId, quality: $quality) { cardId }
    }
    """

    static let aiImportMutation = """
    mutation($rawText: String!) {
      aiImportCards(rawText: $rawText) {
        normalizedCount
        cards { frontText backText }
      }
    }
    """

    static let deleteCardMutation = """
    mutation($id: String!) {
      deleteCard(id: $id)
    }
    """

    static let notesQuery = """
    query($deckId: String!) {
      notes(deckId: $deckId) {
        id
        deckId
        title
        pageCount
        createdAt
        updatedAt
      }
    }
    """

    static let noteQuery = """
    query($id: String!) {
      note(id: $id) {
        id
        deckId
        title
        pageCount
        createdAt
        updatedAt
        pages {
          id
          noteId
          pageIndex
          paperStyle
          pencilData
          updatedAt
        }
      }
    }
    """

    static let createNoteMutation = """
    mutation($deckId: String!, $title: String) {
      createNote(deckId: $deckId, title: $title) {
        id
        deckId
        title
        pageCount
        createdAt
        updatedAt
      }
    }
    """

    static let updateNoteMutation = """
    mutation($id: String!, $title: String!) {
      updateNote(id: $id, title: $title) {
        id
        title
        updatedAt
      }
    }
    """

    static let deleteNoteMutation = """
    mutation($id: String!) {
      deleteNote(id: $id)
    }
    """

    static let upsertNotePageMutation = """
    mutation($noteId: String!, $pageIndex: Int!, $paperStyle: String, $pencilData: String) {
      upsertNotePage(noteId: $noteId, pageIndex: $pageIndex, paperStyle: $paperStyle, pencilData: $pencilData) {
        id
        noteId
        pageIndex
        paperStyle
        pencilData
        updatedAt
      }
    }
    """

    static let addNotePageMutation = """
    mutation($noteId: String!, $paperStyle: String) {
      addNotePage(noteId: $noteId, paperStyle: $paperStyle) {
        id
        noteId
        pageIndex
        paperStyle
        pencilData
        updatedAt
      }
    }
    """

    static let deleteNotePageMutation = """
    mutation($id: String!) {
      deleteNotePage(id: $id)
    }
    """
}
