const DOMAIN = "Composition"
const TEMPLATE = "Template"
const OUTDATED_TEMPLATE = "Outdated template"
const PARCEL = "Parcel"
const EDIT_COMPOSITION = "Edit composition"
const TOOL = "House tool"

export const CompositionEventNames = {
  Templates_Add: `${DOMAIN} - ${TEMPLATE} - Add new`,
  Templates_Delete: `${DOMAIN} - ${TEMPLATE} - Delete`,
  Templates_Duplicate: `${DOMAIN} - ${TEMPLATE} - Duplicate`,
  Templates_Publish: `${DOMAIN} - ${TEMPLATE} - Publish update`,
  Templates_Cancel: `${DOMAIN} - ${TEMPLATE} - Cancel update`,
  Templates_Rename: `${DOMAIN} - ${TEMPLATE} - Rename`,
  Templates_ParameterUpdate: `${DOMAIN} - ${TEMPLATE} - Parameter update`,
  Templates_OpenTypePanel: `${DOMAIN} - ${TEMPLATE} - Open type panel`,
  Templates_CloseTypePanel: `${DOMAIN} - ${TEMPLATE} - Close type panel`,

  OutdatedTemplates_OpenPopup: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Open popup`,
  OutdatedTemplates_ClosePopup: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Close popup`,
  OutdatedTemplates_Detach_Start: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Detach - Start`,
  OutdatedTemplates_Detach_Cancel: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Detach - Cancel`,
  OutdatedTemplates_Detach_Complete: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Detach - Complete`,
  OutdatedTemplates_Update: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Update`,
  OutdatedTemplates_UpdateAll: `${DOMAIN} - ${OUTDATED_TEMPLATE} - Update all`,

  Parcel_UpdateTemplate: `${DOMAIN} - ${PARCEL} - Update template`,
  Parcel_SetTemplate: `${DOMAIN} - ${PARCEL} - Set template`,

  EditComposition_Start: `${DOMAIN} - ${EDIT_COMPOSITION} - Start`,
  EditComposition_Exit: `${DOMAIN} - ${EDIT_COMPOSITION} - Exit`,
  EditComposition_EditGraph: `${DOMAIN} - ${EDIT_COMPOSITION} - Edit graph`,

  Tool_Start: `${DOMAIN} - ${TOOL} - Start`,
  Tool_Exit: `${DOMAIN} - ${TOOL} - Exit`,
  Tool_SwitchMode: `${DOMAIN} - ${TOOL} - set mode`,

  Tool_LineStart: `${DOMAIN} - ${TOOL} - Line start`,
  Tool_LineComplete: `${DOMAIN} - ${TOOL} - Line complete`,
  Tool_LineCancel: `${DOMAIN} - ${TOOL} - Line cancel`,

  Tool_SingleStart: `${DOMAIN} - ${TOOL} - Single start`,
  Tool_SinglePlace: `${DOMAIN} - ${TOOL} - Single place`,
  Tool_SingleExit: `${DOMAIN} - ${TOOL} - Single exit`,
}

export const CompositionTrackingDataNames = {
  templateId: "templateId",
  parameterName: "parameterName",
  tool: "tool",
  method: "method",
}
