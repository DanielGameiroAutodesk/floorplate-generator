import type { ComponentChildren } from "preact"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"

type Props = {
  children: ComponentChildren
  fallback?: ComponentChildren
}
export default function ErrorBoundary({ children, fallback = null }: Props) {
  const [error] = useErrorBoundary((error) => {
    captureException(error)
  })

  return <>{error ? fallback : children}</>
}
