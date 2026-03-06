import { formItKeyboardModifier } from "@spacemakerai/web-sketch-renderer"
import { formitInitializedSignal } from "./api/useInitialize"
import { HotkeyCategory } from "src/core/hotkeys"

// the commmand interfaces from FormIt
interface FormItCommand {
  Command?: string
  Name: string
  TKeyPair: TKeyPair
}

interface KeyEvent {
  Code: number
  Modifier: number
  objectName: string
}

interface TKeyPair {
  Key1: KeyEvent
  Key2: KeyEvent
  objectName: string
}

// the Forma interface uses FormIt Commands but optionally adds other properties
interface FormaFormItCommand extends FormItCommand {
  ToolType?: FormIt.ToolType
  Category?: HotkeyCategory
  IncludeInQuickAccess?: boolean
}

// given a FormIt.ToolType,
// returns the UI-friendly tool name
export const getNameFromToolType = (toolType: FormIt.ToolType) => {
  const foundToolMeta = toolMeta?.find((item) => item.ToolType === toolType)
  return foundToolMeta ? foundToolMeta.Name : undefined
}

// given a FormIt.ToolType,
// returns the shortcut string
export const getShortcutFromToolType = (toolType: FormIt.ToolType): string | undefined => {
  // find the shortcut by ToolType
  const foundToolMeta = toolMeta?.find((item) => item.ToolType === toolType)

  if (foundToolMeta === undefined) {
    return undefined
  }

  if (foundToolMeta.TKeyPair) {
    return getShortcutStringFromKeyPair(foundToolMeta.TKeyPair)
  }

  return undefined
}

// given a FormIt command or tool name,
// returns the entire command with keycodes and modifiers
// input must match Command or Name from defaultShortcuts
export const getFormItCommandFromName = (commandOrName: string): FormItCommand | undefined => {
  if (!toolMeta) {
    return undefined
  }

  const foundToolMeta = toolMeta.find(
    (item) => commandOrName === item.Name || (item.Command && commandOrName === item.Command),
  )

  return foundToolMeta as FormItCommand | undefined
}

export function hasShortCut(keypair: TKeyPair): boolean {
  const command = toolMeta?.find((shortcut) => keypair === shortcut.TKeyPair)
  return command !== undefined ? true : false
}

// parses defaultShortcuts for a given command or name
// input must match Command or Name from defaultShortcuts
export const getShortcutFromCommandOrName = (commandOrName: string): string | undefined => {
  // get the actual command from the string
  const command = getFormItCommandFromName(commandOrName)

  // handle no command case
  if (command === undefined) {
    return undefined
  }

  // ignore shortcuts that are not configured
  if (command.Command && FormIt.Configuration.IsShortcutCommandConfigured(command.Command)) {
    return getShortcutStringFromKeyPair(command.TKeyPair)
  }

  return undefined
}

export const getNameFromFormItCommand = (FormItCommand: string) => {
  const foundToolMeta = toolMeta?.find((item) => item.Command === FormItCommand)
  return foundToolMeta ? foundToolMeta.Name : undefined
}

export const getShortcutStringFromKeyPair = (keypair: TKeyPair): string => {
  let key1String = FormIt.Shortcuts.GetKeycodeString(keypair.Key1.Code, keypair.Key1.Modifier)
  let key2String: string | undefined = undefined

  if (keypair.Key2.Code !== 0) {
    key2String = FormIt.Shortcuts.GetKeycodeString(keypair.Key2.Code, keypair.Key2.Modifier)
  }

  // handle MacOS
  if (navigator.userAgent.toLowerCase().includes("mac")) {
    key1String = key1String.replace("Ctrl", "⌘")
  }

  return `${key1String}${key2String ? key2String : ""}`
}

// Returns the FormaFormItCommand for a single key board event
export const getFormItCommandForKeyEvent = (e: KeyboardEvent): FormaFormItCommand | undefined => {
  const modifierKey = formItKeyboardModifier(e)
  const command = toolMeta!.find(
    (shortcut) =>
      shortcut.TKeyPair.Key1.Code === e.keyCode &&
      shortcut.TKeyPair.Key1.Modifier === modifierKey &&
      shortcut.TKeyPair.Key2.Code === 0 &&
      shortcut.TKeyPair.Key2.Modifier === 0,
  )
  return command
}

// TOOL META:
// all tool metadata
// including names (in English), shortcuts, commands, and ToolTypes
let toolMeta: FormaFormItCommand[] | null = null
formitInitializedSignal.subscribe((isInitialized) => {
  if (!isInitialized) {
    return
  }
  toolMeta = [
    /* SELECTION TOOLS */
    {
      ToolType: FormIt.ToolType.SELECTION,
      Command: "Tools: Select",
      Name: "Select",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 32, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.LASSO_SELECTION,
      Command: "Tools: Lasso Select",
      Name: "Lasso select",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 76, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 76, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Select All",
      Name: "Select All",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 65, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* SELECTION FILTER */
    {
      Command: "Selection Filter: Vertices",
      Name: "Selection Filter: Vertices",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 86, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Selection Filter: Edges",
      Name: "Selection Filter: Edges",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Selection Filter: Faces",
      Name: "Selection Filter: Faces",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Selection Filter: Solids",
      Name: "Selection Filter: Solids",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Selection Filter: Meshes",
      Name: "Selection Filter: Meshes",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Selection Filter: Groups",
      Name: "Selection Filter: Groups",
      Category: HotkeyCategory.Selection,
      TKeyPair: {
        Key1: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* SKETCH TOOLS */
    {
      ToolType: FormIt.ToolType.VERTEX,
      Command: "Draw: Vertex",
      Name: "Vertex",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 86, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
      IncludeInQuickAccess: false,
    },
    {
      ToolType: FormIt.ToolType.POLYLINE,
      Command: "Draw: Line",
      Name: "Line",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 76, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.RECTANGLE,
      Command: "Draw: Rectangle",
      Name: "Rectangle",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 82, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.POLYGON,
      Command: "Draw: Polygon",
      Name: "Polygon",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 89, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.ARC,
      Command: "Draw: Arc by three arc points",
      Name: "Arc by Three Points",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.ARCCENTERRADIUS,
      Command: "Draw: Arc by center and radius",
      Name: "Arc by Center Radius",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.CIRCLE,
      Command: "Draw: Circle",
      Name: "Circle",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.SPLINE,
      Command: "Draw: Spline",
      Name: "Spline",
      Category: HotkeyCategory["Sketch Tools"],
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.OFFSET_LINE,
      Command: "Draw: Offset Line",
      Name: "Offset Line",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 76, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
      IncludeInQuickAccess: false,
    },
    {
      ToolType: FormIt.ToolType.ARRAY,
      Command: "Tools: Array",
      Name: "Array",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 82, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* MODIFICATION TOOLS */
    {
      ToolType: FormIt.ToolType.TRANSLATION,
      Command: "Tools: Move",
      Name: "Move",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.TRANSLATION_IMPLICIT,
      Name: "Move",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.ROTATION,
      Command: "Tools: Rotate",
      Name: "Rotate",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 82, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.DRAG_FACE,
      Command: "Tools: Extrude Face",
      Name: "Extrude Face",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.EXTRUDE_EDGES,
      Command: "Tools: Extrude Edges",
      Name: "Extrude Edges",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.REVERSE_FACE,
      Command: "Tools: Reverse Faces",
      Name: "Reverse Faces",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 82, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.BLEND,
      Command: "Tools: Fillet",
      Name: "Fillet",
      IncludeInQuickAccess: true,
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 73, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.FLATTEN_FACES,
      Command: "Tools: Flatten Faces",
      Name: "Flatten Faces",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.TAPER_FACE,
      Command: "Tools: Taper Face",
      Name: "Tilt Face",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 84, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.MIRROR,
      Command: "Tools: Mirror",
      Name: "Mirror",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 73, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.SCALE_OBJECTS,
      Command: "Tools: Scale",
      Name: "Scale",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.NON_UNIFORM_SCALE_OBJECTS,
      Command: "Tools: Non-uniform Scale",
      Name: "Non-Uniform Scale",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 78, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 85, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.OFFSET_EDGES,
      Command: "Tools: Offset Edges",
      Name: "Offset Edges",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.OFFSET_FACE,
      Command: "Tools: Offset Face",
      Name: "Offset Face",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.SMOOTH_EDGES,
      Command: "Tools: Smooth Edges",
      Name: "Smooth Edges",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.UNSMOOTH_EDGES,
      Command: "Tools: Unsmooth Edges",
      Name: "Unsmooth Edges",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 85, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.MERGE,
      Command: "Tools: Merge Edges and Vertices",
      Name: "Merge Edges and Vertices",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* MATERIALS */
    {
      ToolType: FormIt.ToolType.PAINTBRUSH,
      Command: "Tools: Paint With Material",
      Name: "Paint",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 66, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.EDIT_TEXTURES,
      Command: "Tools: Adjust Material Placement",
      Name: "Adjust Material Placement",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 80, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* MESH CONVERSION */
    {
      ToolType: FormIt.ToolType.MESHES_TO_OBJECTS,
      Command: "Meshes to Objects",
      Name: "Meshes to Objects",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.OBJECTS_TO_MESHES,
      Command: "Objects to Meshes",
      Name: "Objects to Meshes",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* ADVANCED MODELING TOOLS */
    {
      ToolType: FormIt.ToolType.CUT,
      Command: "Tools: Cut Geometry (Toolbar)",
      Name: "Cut Geometry",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.CUT_CONTEXTMENU,
      Command: "Tools: Cut Geometry (Context Menu)",
      Name: "Cut Geometry",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.JOIN,
      Command: "Tools: Join Geometry (Toolbar)",
      Name: "Join Geometry",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 74, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.JOIN_CONTEXTMENU,
      Command: "Tools: Join Geometry (Context Menu)",
      Name: "Join Geometry",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 74, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.INTERSECT,
      Command: "Tools: Intersect Geometry (Toolbar)",
      Name: "Intersect Geometry",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 73, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.INTERSECT_CONTEXTMENU,
      Command: "Tools: Intersect Geometry (Context Menu)",
      Name: "Intersect Geometry",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 73, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.LOFT_EDGES,
      Command: "Tools: Loft",
      Name: "Loft",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 76, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.SWEEP,
      Command: "Tools: Sweep",
      Name: "Sweep",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 87, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.COVER_EDGES,
      Command: "Tools: Cover",
      Name: "Cover",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 86, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.SHELL_BODY,
      Command: "Tools: Shell",
      Name: "Shell",
      Category: HotkeyCategory.Tools,
      IncludeInQuickAccess: true,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 72, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.OFFSET_BODY,
      Command: "Tools: Offset Solid",
      Name: "Offset Solid",
      IncludeInQuickAccess: true,
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 79, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* GROUPS */
    {
      ToolType: FormIt.ToolType.GROUP_CONTEXTMENU,
      Command: "Group: Group (Context Menu)",
      Name: "Group",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 71, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.GROUP_EDIT_IN_CONTEXT_CONTEXTMENU,
      Command: "Group: Edit Group (Context Menu)",
      Name: "Edit Group",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.GROUP_EDIT_IN_CONTEXT_CONTEXTMENU,
      Command: "Group: Edit Group (Context Menu)",
      Name: "Edit Group",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 13, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.GROUP_EDIT_IN_CONTEXT_CONTEXTMENU,
      Command: "Group: Finish Group Edit",
      Name: "Finish Group Edit",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.UNGROUP_CONTEXTMENU,
      Command: "Group: UnGroup (Context Menu)",
      Name: "Ungroup",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 85, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.UNGROUP_ALL_CONTEXTMENU,
      Command: "Group: UnGroup All (Context Menu)",
      Name: "Ungroup All",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 85, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.GROUP_MAKE_UNIQUE_CONTEXTMENU,
      Command: "Group: Make Unique (Context Menu)",
      Name: "Detach",
      Category: HotkeyCategory.Groups,
      TKeyPair: {
        Key1: { Code: 68, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* COPY, PASTE, DELETE */
    {
      ToolType: FormIt.ToolType.COPY,
      Command: "Edit: Copy",
      Name: "Copy",
      Category: HotkeyCategory.Clipboard,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Paste",
      ToolType: FormIt.ToolType.PASTE,
      Name: "Paste",

      TKeyPair: {
        Key1: { Code: 86, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Paste In Place",
      Name: "Paste in Place",
      Category: HotkeyCategory.Clipboard,
      TKeyPair: {
        Key1: { Code: 86, Modifier: 3, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Cut",
      Name: "Cut",
      Category: HotkeyCategory.Clipboard,
      TKeyPair: {
        Key1: { Code: 88, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.DELETE_OBJECT,
      Command: "Edit: Delete",
      Category: HotkeyCategory.Tools,
      Name: "Delete",
      // delete key
      TKeyPair: {
        Key1: { Code: 46, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.DELETE_OBJECT,
      Command: "Edit: Delete",
      Category: HotkeyCategory.Tools,
      Name: "Delete",
      // backspace key
      TKeyPair: {
        Key1: { Code: 8, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* DISPLAY */
    // not used yet, but these should be hooked up some day
    {
      Command: "Display: Back Faces",
      Name: "Display Back Faces",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 68, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 66, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Display: Watertight Issues",
      Name: "Display Watertight Issues",
      IncludeInQuickAccess: false,
      TKeyPair: {
        Key1: { Code: 68, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 87, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Display: Axes",
      Name: "Display Axes",
      TKeyPair: {
        Key1: { Code: 68, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Application Settings: Hide Group Context",
      Name: "Show/Hide Surroundings",
      Category: HotkeyCategory.Camera,
      TKeyPair: {
        Key1: { Code: 72, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* MEASURE TOOLS */
    {
      ToolType: FormIt.ToolType.LINEAR_MEASURE,
      Command: "Tools: Measure",
      Name: "Measure",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.ANGULAR_MEASURE,
      Command: "Tools: Measure Angle",
      Name: "Measure Angle",
      Category: HotkeyCategory.Tools,
      TKeyPair: {
        Key1: { Code: 77, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* SNAPPING + INFERENCING */
    {
      Command: "Inferencing: Clear Inference Axes",
      Name: "Clear Inference Axes",
      Category: HotkeyCategory.Snapping,
      TKeyPair: {
        Key1: { Code: 67, Modifier: 4, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Inferencing: Clear Inference Axes",
      Name: "Clear Inference Axes",
      Category: HotkeyCategory.Snapping,
      TKeyPair: {
        Key1: { Code: 32, Modifier: 1, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* VIEWS + CAMERA */
    {
      ToolType: FormIt.ToolType.CAMERA_SWIVEL,
      Command: "View: Swivel Camera",
      Name: "Swivel",
      Category: HotkeyCategory.Camera,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 86, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.ALIGN_WITH_FACE,
      Command: "View: Align Camera With Face",
      Name: "Align Camera with Face",
      Category: HotkeyCategory.Camera,
      TKeyPair: {
        Key1: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 70, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "View: Zoom All",
      Name: "Zoom All",
      Category: HotkeyCategory.Camera,
      // ZA
      TKeyPair: {
        Key1: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 65, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "View: Zoom All",
      Name: "Zoom All",
      Category: HotkeyCategory.Camera,
      // ZE
      TKeyPair: {
        Key1: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 69, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "View: Zoom Selection",
      Name: "Zoom Selection",
      Category: HotkeyCategory.Camera,
      TKeyPair: {
        Key1: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    // Cntrl + F to match Design Mode
    {
      Command: "View: Zoom Selection",
      Name: "Zoom Selection",
      Category: HotkeyCategory.Camera,
      TKeyPair: {
        Key1: { Code: 70, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* AXES */
    {
      ToolType: FormIt.ToolType.SET_AXES,
      Command: "Edit: Set Axes",
      Name: "Edit Axes",
      Category: HotkeyCategory.Snapping,
      TKeyPair: {
        Key1: { Code: 83, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      ToolType: FormIt.ToolType.RESET_AXES,
      Command: "Edit: Reset Axes",
      Name: "Reset Axes",
      Category: HotkeyCategory.Snapping,
      TKeyPair: {
        Key1: { Code: 82, Modifier: 0, objectName: "KeyboardInputEvent" },
        Key2: { Code: 90, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },

    /* UNDO/REDO */
    {
      Command: "Edit: Undo",
      Name: "Undo",
      Category: HotkeyCategory.History,
      TKeyPair: {
        Key1: { Code: 90, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Redo",
      Name: "Redo",
      Category: HotkeyCategory.History,
      // Ctrl + Y
      TKeyPair: {
        Key1: { Code: 89, Modifier: 2, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
    {
      Command: "Edit: Redo",
      Name: "Redo",
      Category: HotkeyCategory.History,
      // Ctrl + Shift + Z
      TKeyPair: {
        Key1: { Code: 90, Modifier: 3, objectName: "KeyboardInputEvent" },
        Key2: { Code: 0, Modifier: 0, objectName: "KeyboardInputEvent" },
        objectName: "TKeyPair",
      },
    },
  ]
})

export { toolMeta }
