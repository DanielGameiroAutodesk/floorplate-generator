declare global {
  interface Window {
    forma_websocket?: {
      setProposalId: (proposalId: string) => void
      sendEvent: (payload: unknown) => void
    }
    globalSpinner: { start: () => void; stop: () => void }
    __SCENE_INITIALIZED__: boolean
  }
  let __SUBMODE_ACTIVE__: boolean
}

export {}
