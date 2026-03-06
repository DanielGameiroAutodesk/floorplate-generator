import type { Urn } from "@spacemakerai/element-types"

export type WeaveModalElement = HTMLElement & { show: () => void; close: () => void }

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "sm-library-v2": JSX.HTMLAttributes<HTMLElement> & {
        projectid: string
        proposalurn: string
        addmenufeature?: boolean
        contextualdata?: boolean
        siteconceptfeature?: boolean
      }
      "forma-project-header": JSX.HTMLAttributes<HTMLElement> & { projectid: string }
      "forma-sidebar": JSX.HTMLAttributes<HTMLElement> & {
        tab: string
        custom?: boolean
        ontabchanged: (e: CustomEvent<string>) => void
        showextensions?: boolean
        "hide-tabs"?: string | null
      }
      "forma-navbar-project-members": JSX.HTMLAttributes<HTMLElement> & {
        "project-id"?: string
        "invite-link-to"?: string
      }
      "forma-sidebar-link": JSX.HTMLAttributes<HTMLElement> & { href: string; slot?: string }
      "forma-project-settings": JSX.HTMLAttributes<HTMLElement> & {
        "has-edit-access": boolean
        "imperial-units": boolean
      }
      "forma-sidebar-button": JSX.HTMLAttributes<HTMLElement> & { active?: true; pulse?: true }
      "forma-compass": JSX.HTMLAttributes<HTMLElement> & { dock?: boolean }
      "forma-toolbar": JSX.HTMLAttributes<HTMLElement> & { direction?: "horizontal" | "vertical" }
      "forma-check": JSX.HTMLAttributes<HTMLElement>
      "forma-camera-24": JSX.HTMLAttributes<HTMLElement>
      "forma-2d-24": JSX.HTMLAttributes<HTMLElement>
      "forma-3d-24": JSX.HTMLAttributes<HTMLElement>
      "forma-eye-16": JSX.HTMLAttributes<HTMLElement>
      "forma-eye-hidden-16": JSX.HTMLAttributes<HTMLElement>
      "forma-external-link-16": JSX.HTMLAttributes<HTMLElement>
      "forma-eye-24": JSX.HTMLAttributes<HTMLElement>
      "forma-floor-height-16": JSX.HTMLAttributes<HTMLElement>
      "forma-floor-quantity-14": JSX.HTMLAttributes<HTMLElement>
      "weave-dot": JSX.HTMLAttributes<HTMLElement>
      "weave-chevron-up": JSX.HTMLAttributes<HTMLElement>
      "weave-chevron-down": JSX.HTMLAttributes<HTMLElement>
      "forma-guides-measurements-24": JSX.HTMLAttributes<HTMLElement>
      "forma-refresh-16": JSX.HTMLAttributes<HTMLElement>
      "forma-trash-16": JSX.HTMLAttributes<HTMLElement>
      "forma-extensions-16": JSX.HTMLAttributes<HTMLElement>
      "forma-zoom-24": JSX.HTMLAttributes<HTMLElement>
      "forma-elevation-11": JSX.HTMLAttributes<HTMLElement>
      "forma-fountain-pen-24": JSX.HTMLAttributes<HTMLElement>
      "forma-height-12": JSX.HTMLAttributes<HTMLElement>
      "forma-lookFrom-24": JSX.HTMLAttributes<HTMLElement>
      "forma-measure-24": JSX.HTMLAttributes<HTMLElement>
      "forma-move-24": JSX.HTMLAttributes<HTMLElement>
      "forma-navbar": JSX.HTMLAttributes<HTMLElement> & { "project-id": string }
      "forma-navbar-skeleton": JSX.HTMLAttributes<HTMLElement> & { children?: JSX.Element[] | JSX.Element }
      "forma-navbar-project-header": JSX.HTMLAttributes<HTMLElement> & { "project-id": string }
      "forma-navbar-add-button": JSX.HTMLAttributes<HTMLButtonElement>
      "forma-offset-24": JSX.HTMLAttributes<HTMLElement>
      "forma-license-banner": JSX.HTMLAttributes<HTMLElement> & { "project-id": string }
      "forma-tilt-24": JSX.HTMLAttributes<HTMLElement>
      "forma-toolbar-divider": JSX.HTMLAttributes<HTMLElement>
      "forma-toolbar-button": JSX.HTMLAttributes<HTMLElement> & {
        active?: boolean
        disabled?: boolean
      }
      "forma-toolbar-close-button": JSX.HTMLAttributes<HTMLElement>
      "forma-icon-arrow-left": JSX.HTMLAttributes<HTMLElement>
      "forma-icon-arrow-right": JSX.HTMLAttributes<HTMLElement>
      "forma-toolbar-overflow-button": JSX.HTMLAttributes<HTMLElement> & {
        label?: string
        shortcut?: string
        active?: boolean
        highlighted?: boolean
      }
      "forma-toolbar-overflow-menu": JSX.HTMLAttributes<HTMLElement> & { label?: string }
      "weave-icon-button": JSX.HTMLAttributes<HTMLElement>
      "weave-solid-slim-plus-operator": JSX.HTMLAttributes<HTMLElement>
      "weave-solid-plus-operator": JSX.HTMLAttributes<HTMLElement>
      "weave-edit": JSX.HTMLAttributes<HTMLElement>
      "weave-solid-minus-operator": JSX.HTMLAttributes<HTMLElement>
      "weave-skeleton-item": JSX.HTMLAttributes<HTMLElement> & {
        height: string
        radius: string
        width: string
      }
      "weave-text-link": JSX.HTMLAttributes<HTMLElement> & {
        href: string
        target?: "_top" | "_blank" | "_self" | "_parent"
        variant?: "primary" | "secondary"
      }
      "weave-segmented-buttons-group": JSX.HTMLAttributes<HTMLElement> & { noborder?: boolean }
      "weave-radio-button-group": JSX.HTMLAttributes<HTMLElement>
      "weave-radio-button": JSX.HTMLAttributes<HTMLElement>
      "weave-segmented-button": JSX.HTMLAttributes<HTMLElement>
      "weave-checkbox": JSX.HTMLAttributes<HTMLElement> & {
        disabled?: boolean
        value?: string
        checked?: boolean
        name?: string
        indeterminate?: boolean
        label?: string
        showlabel?: boolean
      }
      "weave-progress": { size?: "xs" | "s" | "m" | "l" | "xl"; style?: string | JSX.CSSProperties }
      "weave-progress-bar": {
        percentcomplete?: string
      }
      "weave-button": JSX.HTMLAttributes<HTMLElement> & {
        type?: "button" | "submit" | "reset"
        variant?: "outlined" | "flat" | "solid" | "white"
        density?: "high" | "medium"
        iconposition?: "left" | "right"
      }
      "weave-linkbutton": JSX.HTMLAttributes<HTMLAnchorElement> & {
        variant?: "outlined" | "flat" | "solid"
        density?: "high" | "medium"
        iconposition?: "left" | "right"
      }
      "weave-timestamp": JSX.HTMLAttributes<HTMLElement> & {
        timestamp: string
      }
      "weave-close": JSX.HTMLAttributes<HTMLElement>
      "weave-slider": {
        value: string
        min?: string
        max?: string
        step?: string
        variant?: "continuous" | "discrete"
        label?: string
        width?: string
        onChange?: (e: CustomEvent<string>) => void
        onInput?: (e: CustomEvent<string>) => void
        onMouseUp?: (e: CustomEvent<string>) => void
        disabled?: boolean
      }
      "weave-inputslider": {
        children?: JSX.Element[]
      }
      "weave-tile": JSX.HTMLAttributes<HTMLElement> & {
        variant: "vertical" | "horizontal"
        height?: number
        width?: number
        disabled?: boolean
        selected?: boolean
        children?: JSX.Element[]
      }
      "weave-input": JSX.HTMLAttributes<HTMLInputElement> & {
        showlabel?: boolean
        name?: string
        unit?: string
        variant?: string
      }
      "weave-editable": {
        edit?: boolean
        doubleclick?: boolean
        children?: JSX.Element[] | string
        className?: string
        onInput?: (e: CustomEvent<{ value: string }>) => void // triggers when typing, contains the text `event.detail.value`
        onChange?: (e: CustomEvent<{ value: string }>) => void // contains the text `event.detail.value`
        onCancel?: (e: CustomEvent<{ value: string }>) => void // contains the old text `event.detail.value`
      }
      "weave-menu-container": JSX.HTMLAttributes<HTMLElement> & {
        title: string
        open: boolean
        top?: number
        left?: number
        right?: number
        children?: JSX.Element[] | JSX.Element
      }
      "weave-flyout": JSX.HTMLAttributes<HTMLElement> & {
        nub?: "up-left" | "up-right" | "up-center" | "down-center" | "down-left" | "left-center" | "right-center"
        open?: boolean
      }
      "weave-menu": JSX.HTMLAttributes<HTMLElement> & {
        left: number
        top: number
        disabled?: boolean
        maxwidth?: number
        minwidth?: number
        nochecks?: boolean
        noedit?: boolean
        open?: boolean
      }
      "weave-menu-item": JSX.HTMLAttributes<HTMLElement> & {
        selected?: boolean
        nocheck?: boolean
        check?: "true"
        subopen?: boolean
      }
      "weave-menu-sub": JSX.HTMLAttributes<HTMLElement> & {
        slot: "submenu"
        maxwidth?: string
        minwidth?: string
        nochecks?: boolean
        top?: string
        left?: string
      }
      "weave-modal": JSX.HTMLAttributes<WeaveModalElement> & {
        width?: string
        hideclose?: boolean
        children?: JSX.Element[] | JSX.Element
      }
      "forma-select-native": JSX.HTMLAttributes<HTMLSelectElement> & {
        style?: Record<string, string>
        placeholder?: string
        value?: number | string
        children?: any
        onChange?: (e: any) => void
        disabled?: boolean
      }
      "forma-tooltip": JSX.HTMLAttributes<HTMLElement> & {
        nub?: "up-left" | "up-right" | "up-center" | "down-center" | "down-left" | "left-center" | "right-center"
        text?: string
        shortcutmac?: string
        shortcutwindows?: string
        distancex?: string
        distancey?: string
        noarrow?: boolean
        description?: string
        link?: string
        image?: string
      }
      "weave-tooltip": JSX.HTMLAttributes<HTMLElement> & {
        nub?:
          | "up-left"
          | "up-right"
          | "up-center"
          | "down-center"
          | "down-left"
          | "down-right"
          | "left-center"
          | "right-center"
        text?: string
        description?: string
        link?: string
        image?: string
        closedelay?: number
        width?: string
        shortcutmac?: string
        shortcutwindows?: string
        splitshortcutonspace?: boolean
      }
      "weave-select": JSX.HTMLAttributes<HTMLElement> & {
        placeholder?: any
        value: any
        children: JSX.Element[]
        onChange: (e: CustomEvent<{ value: string; text: string }>) => void
      }
      "weave-select-option": JSX.HTMLAttributes<HTMLElement> & {
        disabled?: true
        value: any
        children?: JSX.Element | string
      }
      "forma-context-menu-container": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu": JSX.HTMLAttributes<HTMLElement> & any
      "forma-context-menu-item": JSX.HTMLAttributes<HTMLElement> & {
        text: string
        "shortcut-mac"?: string
        "shortcut-windows"?: string
        disabled?: boolean
      }
      "forma-context-menu-sub-menu": JSX.HTMLAttributes<HTMLElement> & {
        text: string
        disabled?: boolean
      }
      "forma-context-menu-divider": JSX.HTMLAttributes<HTMLElement>
      "forma-project-members": JSX.HTMLAttributes<HTMLElement> & { projectid: string; "invite-link-to": string }
      "sm-join-project-button": JSX.HTMLAttributes<HTMLElement> & { "project-id": string }
      "forma-chevron-small": JSX.HTMLAttributes<HTMLElement>
      "forma-resizable-section": JSX.HTMLAttributes<HTMLElement>
      "forma-file-import": JSX.HTMLAttributes<HTMLElement> & {
        projectId: string
        urn?: Urn
        libraryItem?: any
        closeModal: () => void
        setHeadingType: (type: "single" | "tabs") => void
        proposalUrn?: Urn
        setActiveItem?: (id?: string) => void
      }
      "forma-expanded-tooltip": JSX.HTMLAttributes<HTMLElement> & {
        text?: string
        position?: "left" | "right" | "bottom" | "top"
        ["target-id"]?: string
        ["target-shadow-root"]?: string
        componentPosition?: string
        loadingduration?: number
        shortcut?: string
        visible?: boolean | string // TODO: web-component should behave according to spec (if visible attribute is not set, it should be treated as false / not visible)
      }
      "weave-floating": JSX.HTMLAttributes<HTMLElement> & {
        target: string
        offset?: number
        "show-arrow"?: boolean
        placement?:
          | "top"
          | "top-start"
          | "top-end"
          | "right"
          | "right-start"
          | "right-end"
          | "left"
          | "left-start"
          | "left-end"
          | "bottom"
          | "bottom-start"
          | "bottom-end"
      }
      "forma-analyse-wind-16": JSX.HTMLAttributes<HTMLElement>
      "forma-analyse-solarpanel-16": JSX.HTMLAttributes<HTMLElement>
      "forma-analyse-sun-16": JSX.HTMLAttributes<HTMLElement>
      "forma-analyse-noise-16": JSX.HTMLAttributes<HTMLElement>
      "weave-tripple-dot": JSX.HTMLAttributes<HTMLElement>
      "forma-analyse-microclimate-16": JSX.HTMLAttributes<HTMLElement>
      "forma-analyse-daylight-16": JSX.HTMLAttributes<HTMLElement>
      "forma-camera-position-16": JSX.HTMLAttributes<HTMLElement>
      "forma-info-16": JSX.HTMLAttributes<HTMLElement>
      "weave-avatar": {
        key?: string
        name: string
        image?: string
        alt?: string
        tooltip?: string
        label?: string
        size: "small" | "medium" | "medium-32" | "large" | "extralarge" | "extralarge-180"
      }
      "weave-avatarbundle": {
        size?: string
        variant?: string
        children?: JSX.Element[]
      }
      "weave-tabs": {
        init?: string
        variant?: string
        gap?: string
        children?: JSX.Element[]
      }
      "weave-tab": {
        init?: string
        variant: string
        gap?: string
        hpadding?: string
        label: string
        htmlFor?: string
      }
      "weave-badge": {
        variant: "text" | "dot" | "icon"
        size?: "s" | "l"
        customBackgroundColor?: string
        customColor?: string
        children?: JSX.Element[] | string
        slot?: string
        style?: JSX.CSSProperties
        onClick?: JSX.MouseEventHandler<HTMLElement>
      }
      "weave-toggle": {
        disabled?: boolean
        toggled: boolean
        onChange?: (
          e: CustomEvent<{
            value: "on" | "off"
            checked: boolean
          }>,
        ) => void
      }
    }
  }
}
