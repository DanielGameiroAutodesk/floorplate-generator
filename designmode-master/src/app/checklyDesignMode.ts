/* Append a div that we can use to identify if App was initialized with checkly
 * https://app.checklyhq.com/groups/416168/edit
 **/
export function checklyDesignModeInitialized() {
  const INITIALIZED_ID = "designmode-initialized"
  const alreadyExists = document.getElementById(INITIALIZED_ID)
  if (!alreadyExists) {
    const designModeInitializedDiv = document.createElement("div")
    designModeInitializedDiv.setAttribute("id", INITIALIZED_ID)
    designModeInitializedDiv.style.width = "0"
    designModeInitializedDiv.style.height = "0"
    document.body.appendChild(designModeInitializedDiv)
  }
}

/* Append a div that we can use to identify if App was loaded with checkly
 * https://app.checklyhq.com/groups/416168/edit
 **/
export function checklyDesignModeLoaded() {
  const LOADED_ID = "designmode-loaded"
  const alreadyExists = document.getElementById(LOADED_ID)
  if (!alreadyExists) {
    const designModeLoadedDiv = document.createElement("div")
    designModeLoadedDiv.setAttribute("id", LOADED_ID)
    designModeLoadedDiv.style.width = "0"
    designModeLoadedDiv.style.height = "0"
    document.body.appendChild(designModeLoadedDiv)
  }
}
