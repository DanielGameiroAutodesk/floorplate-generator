// See https://github.com/spacemakerai/design-system/tree/e852de0082e8fbe8202df1aeb730656165c93c7a/core-v2/src/forma/components/toast

declare global {
  interface Window {
    forma_toasts: {
      push: (params: {
        id?: string
        content:
          | string
          | {
              text: string
              linkText?: string
              url?: string
              title?: string
            }
        status?: "primary" | "error" | "success" | "warning" | "none"
        autoDismiss?: boolean
        onClose?: (automatic: boolean) => void
        timeout?: number
      }) => void
    }
  }
}

// Force this to be an ESM module (as there are no imports at time of writing).
export {}
