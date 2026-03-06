import type { I18nStringProvider } from "src/i18n"

export type LevelData = {
  first: string
  second: number
  floorFunction?: string
  floorHeight?: number
  elementPath?: InternalPath
}

export type WeaveInputWc = HTMLElement & {
  inputEl: HTMLInputElement
}

export type DimensionInputType = "offset" | "fillet" | "shell"

export type DimensionInputDialogType = {
  type: DimensionInputType | ""
  isOpen: boolean
  title: string
  inputLabel: string
  defaultValue?: number
  offset: { defaultValue: number }
  shell: { defaultValue: number }
  fillet: { defaultValue: number }
}

export type ToastStatus = "primary" | "error" | "success" | "warning" | "none"

export type EnableOptions = {
  bFinishEnabled: boolean
  bBackEnabled: boolean
  bNextEnabled: boolean
}

export type ToolbarOptions = EnableOptions & {
  bShowFinishButton: boolean
  bShowBackButton: boolean
  bShowNextButton: boolean
  toolType: FormIt.ToolType
  message: string
}

export type SelectionItemProps = {
  id: any
  label: I18nStringProvider
  acronym: string
  selected: boolean
}
