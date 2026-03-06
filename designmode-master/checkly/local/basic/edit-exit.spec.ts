import test, { expect, type Page } from "@playwright/test"
import {
  CLOSE_BUTTON_SELECTOR,
  CONVERT_TO_I3DS_SELECTOR,
  gotoMainProposal,
  I3DS_CREATE_SELECTOR,
  I3DS_EDIT_SELECTOR,
  LINE_TOOL_SELECTOR,
  RIGHT_MENU_EDIT_3DS_SELECTOR,
} from "../lib"

// Test entering and exiting 3d sketch mode in different ways
test(`Edit / Exit`, async ({ page }, testInfo) => {
  // Since this is a long test, set the timeout to 240 seconds
  test.setTimeout(270_000)

  await test.step("Go to main proposal", async () => await gotoMainProposal(page))

  // Screenshot loaded
  await testInfo.attach("3d-sketch-local-edit-exit-forma-loaded.png", {
    body: await page.screenshot({
      path: `./test-results/3d-sketch/local-edit-exit-forma-loaded.png`,
    }),
    contentType: "image/png",
  })

  // TEST 1: Create
  await test.step("Create", async () => {
    await editElement(page, undefined, undefined, true)
  })

  // TEST 2: 3d sketch
  await test.step("3d sketch", async () => {
    const x = 476,
      y = 539
    await editElement(page, x, y, false, true, false, true)
    await checkDblClick(page, x, y)
  })

  // TEST 3: Basic Building
  await test.step("Basic Building", async () => {
    const x = 815,
      y = 530
    await editElement(page, x, y, true, false, true, false)
    await checkDblClick(page, x, y, true)
  })

  // TEST 4: Contextual Building
  await test.step("Contextual Building", async () => {
    const x = 510,
      y = 350
    await editElement(page, x, y, false, true, false, true, true)
    // Enter base layer edit
    await checkDblClick(page, x, y, true, true)
    // Enter 3d sketch
    await checkDblClick(page, x, y)
  })

  // TEST 5: Volume
  await test.step("Volume", async () => {
    const x = 766,
      y = 543
    await editElement(page, x, y, false, true, false, false)
    await checkDblClick(page, x, y)
  })

  // TEST 6: Constraint
  await test.step("Constraint", async () => {
    const x = 854,
      y = 514
    await editElement(page, x, y, false, true, false, false)
    await checkDblClick(page, x, y)
  })

  // TEST 6: Library Import
  await test.step("Library Import", async () => {
    const x = 674,
      y = 509
    await editElement(page, x, y, false, true, false, true)
    await checkDblClick(page, x, y)
  })

  // TEST 7: Revit
  await test.step("Revit", async () => {
    const x = 700,
      y = 564
    await editElement(page, x, y, true, false, false, false)
    await checkDblClick(page, x, y, true)
  })

  // TEST 8: Rhino
  await test.step("Rhino", async () => {
    const x = 721,
      y = 510
    await editElement(page, x, y, true, false, true, false)
    await checkDblClick(page, x, y, true)
  })

  // TEST 9: Dynamo Import
  await test.step("Dynamo Import", async () => {
    const x = 906,
      y = 246
    await editElement(page, x, y, false, true, false, true)
    await checkDblClick(page, x, y)
  })

  // TEST 10: Converted Rhino
  await test.step("Converted Rhino", async () => {
    const x = 861,
      y = 585
    await editElement(page, x, y, false, true, false, true)
    await checkDblClick(page, x, y)
  })
})

async function editElement(
  page: Page,
  x?: number,
  y?: number,
  expectToolbarCreate = false,
  expectToolbarEdit = false,
  expectConvert = false,
  expectRightMenuEdit = false,
  shouldEditBase = false,
) {
  if (x && y) {
    console.log("Editing element at ", x, ",", y)
    // Select existing 3d sketch element
    await page.mouse.click(x, y)
    await page.waitForTimeout(1000)
  } else console.log("Opening 3d sketch in create mode")

  // Verify certain ui elements are visible
  await verifyElementVisibility(page, I3DS_CREATE_SELECTOR, expectToolbarCreate)
  await verifyElementVisibility(page, I3DS_EDIT_SELECTOR, expectToolbarEdit)
  await verifyElementVisibility(page, CONVERT_TO_I3DS_SELECTOR, expectConvert)
  await verifyElementVisibility(page, RIGHT_MENU_EDIT_3DS_SELECTOR, expectRightMenuEdit)

  async function _editElementInternal(selector: string) {
    // Click the edit button
    await page.locator(selector).click()
    // The 3d sketch line button should be visible
    await expect(page.locator(LINE_TOOL_SELECTOR)).toBeVisible()
    // Then exit
    await exit3DSketch(page, true)
  }

  // Enter base layer if we need to
  if (shouldEditBase) await page.locator("button").filter({ hasText: "Edit base to make changes" }).click()

  // Go through each button to check 3d sketch opens
  if (expectToolbarEdit) await _editElementInternal(I3DS_EDIT_SELECTOR)
  if (expectConvert) await _editElementInternal(CONVERT_TO_I3DS_SELECTOR)
  if (expectRightMenuEdit) await _editElementInternal(RIGHT_MENU_EDIT_3DS_SELECTOR)

  // Clear selection
  await clearSelection(page)
}

async function checkDblClick(page: Page, x?: number, y?: number, falseCheck = false, noExit = false) {
  if (!x || !y) return

  console.log("Double clicking element at ", x, ",", y)

  await page.mouse.move(x, y)
  await page.mouse.dblclick(x, y)

  if (falseCheck) {
    console.log("Expecting 3d sketch not to open")
    await expect(page.locator(LINE_TOOL_SELECTOR)).not.toBeVisible()
  } else {
    console.log("Expecting 3d sketch to open")
    await expect(page.locator(LINE_TOOL_SELECTOR)).toBeVisible()
  }

  if (noExit) {
    console.log("Not exiting 3d sketch or clearing selection")
    return
  }

  // Exit 3d sketch
  if (!falseCheck) await exit3DSketch(page)
  else {
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    // Press again to be sure a different editor is not opened
    await page.keyboard.press("Escape")
    // The 3d sketch create button should be visible again
    await expect(page.locator(I3DS_CREATE_SELECTOR)).toBeVisible()
  }
}

async function exit3DSketch(page: Page, noClear = false) {
  // Exit 3d sketch
  console.log("Exiting 3d sketch mode")
  await page.locator(CLOSE_BUTTON_SELECTOR).getByRole("button").click()
  await page.waitForTimeout(500)

  if (!noClear) await clearSelection(page)
}

async function clearSelection(page: Page) {
  // Press the escape button to clear the selection in dm
  await page.keyboard.press("Escape")

  // Press again to be sure a different editor or base layer is not opened
  await page.keyboard.press("Escape")

  // The 3d sketch create button should be visible again
  await expect(page.locator(I3DS_CREATE_SELECTOR)).toBeVisible()
}

async function verifyElementVisibility(page: Page, selector: string, shouldBeVisible: boolean) {
  if (shouldBeVisible) await expect(page.locator(selector)).toBeVisible()
  else await expect(page.locator(selector)).not.toBeVisible()
}
