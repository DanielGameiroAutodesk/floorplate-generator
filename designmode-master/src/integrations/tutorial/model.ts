import type { ReactNode } from "react"
import type { I18nStringProvider, Translator } from "src/i18n"

export type CoachmarkPlacement = "top" | "right" | "bottom" | "left"

export interface TutorialStep {
  /**
   * Short text displayed in the step overview in the widget.
   */
  header: I18nStringProvider

  /**
   * Optional Coachmark specific header.
   */
  coachmarkHeader?: string

  /**
   * Full text content shown in the coachmark.
   */
  text: (t: Translator) => ReactNode
  /**
   * The value of the id or `data-tutorial-target` attribute to anchor this step's coachmark to.
   * If no element is found via deep traversal, the controller shows a fallback coachmark.
   * If targetId is provided, clicking the target element will advance to the next step.
   */
  targetId?: string

  /**
   * Whether clicking the target element should advance to the next step.
   * Only applies when targetId is provided. Defaults to true.
   */
  advanceOnClick?: boolean

  /**
   * The placement of the coachmark relative to the target element.
   * If not specified, the controller will attempt to calculate the best position.
   */
  placement?: CoachmarkPlacement

  /**
   * Whether to hide the next button in the coachmark.
   */
  hideNextButton?: boolean

  /**

   * Whether to hide the lightbox overlay on the target element.
   */
  hideLightbox?: boolean

  /**
   * Whether to hide the widget. The default is false.
   */
  hideWidget?: boolean

  /**
   * The optional image to display in the coachmark.
   */
  image?: (t: Translator) => ReactNode

  /**
   * Whether to add a blue flashing border highlight to the target element.
   * Only applies when targetId is specified.
   */
  highlightBorder?: boolean

  /**
   * Whether to programmatically click the target element when the user clicks the "Next" button.
   * Only applies when targetId is specified and the target element is a clickable button-like element.
   * The click happens before advancing to the next step.
   */
  clickOnNext?: boolean

  /**
   * Optional condition that must be met before automatically advancing to the next step.
   * The function is called repeatedly (every 300ms) to check if the condition is satisfied.
   * When the condition becomes true, the step will auto-advance.
   *
   * The function has access to closures, so you can capture initial state when defining it.
   *
   * Example: Wait for a library item to be imported
   * ```ts
   * import { libraryItemsState } from "src/integrations/library/state"
   *
   * // Capture initial count when tutorial step is defined
   * const initialLibraryCount = libraryItemsState.peek?.()?.length ?? 0
   *
   * advanceWhen: () => {
   *   const currentCount = libraryItemsState.peek?.()?.length ?? 0
   *   return currentCount > initialLibraryCount // Only advance when count INCREASES
   * }
   * ```
   */
  advanceWhen?: () => boolean

  /**
   * If specified, the coachmark will be hidden while the specified tool is active.
   * Use with `advanceWhen` if you want to advance when the tool becomes inactive.
   * Useful for steps where the user needs to use a tool without UI distraction.
   *
   * Example: Hide coachmark while drawing with the basic building tool
   * ```ts
   * hideCoachmarkWhileToolActive: "lineBuilding"
   * ```
   */
  hideCoachmarkWhileToolActive?: string

  /**
   * If specified, the coachmark will be hidden while the specified DOM element exists.
   * Useful for hiding the coachmark when a modal or overlay is open.
   *
   * Example: Hide coachmark while import modal is open
   * ```ts
   * hideWhileElementExists: "#resourcesModal"
   * ```
   */
  hideWhileElementExists?: string
}

export interface Tutorial {
  id: string
  title: I18nStringProvider
  description: (t: Translator) => ReactNode
  time: number
  icon?: ReactNode
  steps: TutorialStep[]
  reviewHeader?: I18nStringProvider
  reviewText?: (t: Translator) => ReactNode
}

export interface ActiveTutorialState {
  tutorial: Tutorial
  currentStepIndex: number
  /** True when the tutorial has finished all steps. */
  completed: boolean
}

export type CurrentStep =
  | (TutorialStep & { stepType: "tutorial" })
  | { stepType: "review"; header: I18nStringProvider; text?: (t: Translator) => ReactNode }
