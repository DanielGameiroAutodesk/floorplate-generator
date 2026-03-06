// Haven't spent any time on typing these yet. Should copy from somewhere.

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-context-menu-container": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu-divider": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu-item": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu-sub-menu": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu": JSX.HTMLAttributes<HTMLElement> & any
      "forma-check": JSX.HTMLAttributes<HTMLElement> & any
      // Technically not part of the design system -- added here because others are defined here
      "forma-docs-file-saver": JSX.HTMLAttributes<HTMLElement> & any
      "weave-avatarbundle": JSX.HTMLAttributes<HTMLElement> & any
      "weave-avatar": JSX.HTMLAttributes<HTMLElement> & any
      "weave-button": JSX.HTMLAttributes<HTMLElement> & any
      "weave-checkbox": JSX.HTMLAttributes<HTMLElement> & any
      "weave-close": JSX.HTMLAttributes<HTMLElement> & any
      "weave-icon-button": JSX.HTMLAttributes<HTMLElement> & any
      "weave-menu-container": JSX.HTMLAttributes<HTMLElement> & any
      "weave-menu-item": JSX.HTMLAttributes<HTMLElement> & any
      "weave-menu": JSX.HTMLAttributes<HTMLElement> & any
      "weave-progress-bar": JSX.HTMLAttributes<HTMLElement> & any
      "weave-skeleton-item": JSX.HTMLAttributes<HTMLElement> & any
      "weave-tile": JSX.HTMLAttributes<HTMLElement> & any
      "weave-timestamp": JSX.HTMLAttributes<HTMLElement> & any
      "weave-tooltip": JSX.HTMLAttributes<HTMLElement> & any
      "weave-tripple-dot": JSX.HTMLAttributes<HTMLElement> & any
    }
  }
}

export {}
