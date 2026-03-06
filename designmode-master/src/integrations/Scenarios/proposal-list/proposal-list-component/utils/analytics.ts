export const CONTEXT = "ProposalListV2"

declare global {
  interface Window {
    analytics?: {
      track: (event: string, eventProps?: Record<string, string>) => Promise<void>
    }
  }
}

export default {
  track: (projectId: string, event: string, eventProps?: Record<string, string>) => {
    void window.analytics?.track(`${CONTEXT}: ${event}`, {
      projectId,
      app: CONTEXT,
      ...eventProps,
    })
  },
}
