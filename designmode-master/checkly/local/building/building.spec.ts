import test, { expect } from "@playwright/test"
import {
  checkBuildingSize,
  CLOSE_BUTTON_SELECTOR,
  gotoTestProposal,
  I3DS_CREATE_SELECTOR,
  I3DS_EDIT_SELECTOR,
  LINE_TOOL_SELECTOR,
} from "../lib"

// Test creating a 3d sketch building using the line tool
test(`Building`, async ({ page }, testInfo) => {
  // Since this is a long test, set the timeout to 90 seconds
  test.setTimeout(240_000)

  // Change this value to the expected BC area of the building
  const checkArea = "2,142 m²"

  await test.step("Go to proposal", async () => await gotoTestProposal(page, testInfo))

  await test.step("Disable labels", async () => {
    // Disable labels
    if ((await page.locator('weave-tooltip[text="Hide Labels"]').count()) > 0) {
      await page.locator('weave-tooltip[text="Hide Labels"]').click()
    }
  })

  await test.step("Start 3d sketch", async () => {
    // Start 3d sketch
    await page.locator(I3DS_CREATE_SELECTOR).click()
    // Wait for line tool button to display
    await page.waitForSelector(LINE_TOOL_SELECTOR, {
      state: "attached",
      timeout: 60000,
    })
    // Screenshot 3d sketch mode loaded
    await testInfo.attach("3d-sketch-local-3ds-mode-loaded.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-3ds-mode-loaded.png`,
      }),
      contentType: "image/png",
    })

    // Verify clean slate
    expect(await page.screenshot({ clip: { x: 327, y: 60, width: 617, height: 584 } })).toMatchSnapshot(
      `clean-dm.png`,
      {
        maxDiffPixelRatio: 0.0001,
      },
    )
  })

  await test.step("Create 3d sketch volume", async () => {
    await page.locator(LINE_TOOL_SELECTOR).click()

    await page.waitForTimeout(1000)

    console.log("Drawing volume")
    await page.mouse.click(686, 344)
    await page.mouse.click(725, 372)
    await page.mouse.click(789, 308)
    await page.mouse.click(691, 347)
    await page.waitForTimeout(5000)
    await page.mouse.click(692, 309)
    await page.waitForTimeout(1000)

    // Take screenshot
    await testInfo.attach("3d-sketch-local-volume-created.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-volume-created.png`,
      }),
      contentType: "image/png",
    })
  })

  /* 
    If proposal changes, run the following command in the browser console to get 
    the new volume and use it for the test comparison below:
    WSM.APIComputeVolumeReadOnly(
      WSM.GroupInstancePath.GetFinalObjectHistoryID(FormIt.Selection.GetSelections()[0]).History,
      WSM.APIGetObjectsByTypeReadOnly(
        WSM.GroupInstancePath.GetFinalObjectHistoryID(FormIt.Selection.GetSelections()[0]).History,
        WSM.GroupInstancePath.GetFinalObjectHistoryID(FormIt.Selection.GetSelections()[0]).Object,
        WSM.nObjectType.nBodyType,
        true,
      )[0],
    )
    */
  await test.step("Verify volume", async () => {
    const testVal = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return eval(`() => {
          // Check if there is 1 selection
          var selections = FormIt.Selection.GetSelections();
          if(selections.length !== 1) return 1
          var finalObjHist = WSM.GroupInstancePath.GetFinalObjectHistoryID(selections[0])
          var finalObj = finalObjHist.Object
          var finalHist = finalObjHist.History
          // Check if the selection is a face
          if(WSM.APIGetObjectTypeReadOnly(finalHist, finalObj) !== WSM.nObjectType.nFaceType) return 2
          var bodyIds = WSM.APIGetObjectsByTypeReadOnly(finalHist, finalObj, WSM.nObjectType.nBodyType, true)
          // Check if there is 1 body
          if(bodyIds.length !== 1) return 3
          var volume = WSM.APIComputeVolumeReadOnly(finalHist, bodyIds[0])
          // Check if the volume is correct (USE NEW VOLUME VALUE HERE)
          var checkVolume = 2946911.367274052
          if(Math.abs(volume - checkVolume) > 100) return 4
          return 0
          }`)()
    })

    expect(testVal).toBe(0)
  })

  await test.step("Add floors to 3d building", async () => {
    console.log("Clicking Add floors button")
    // Add floors
    await page.locator('[id="AddFloors"]').getByRole("button").click()

    // Wait for floor plans to be visible (indicates the building/floors are saved)
    await expect(page.getByText("Site area", { exact: true })).toBeVisible()

    // Wait a second
    await page.waitForTimeout(1000)

    // Screenshot the created building in 3d sketch
    await testInfo.attach("3d-sketch-local-saved-3ds.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-saved-3ds.png`,
      }),
      contentType: "image/png",
    })
    // Compare screenshot for any camera issues
    expect(await page.screenshot({ clip: { x: 327, y: 60, width: 617, height: 584 } })).toMatchSnapshot(
      `saved-3ds.png`,
      {
        maxDiffPixelRatio: 0.0001,
      },
    )
  })

  await test.step("Check 3d sketch building size", async () => {
    await checkBuildingSize(page, checkArea)

    // Exit 3d sketch
    console.log("Exit 3d sketch mode")
    await page.locator(CLOSE_BUTTON_SELECTOR).click()

    // Verify the Edit in 3d sketch button exists
    await expect(page.getByRole("button", { name: "Edit in 3D Sketch" })).toBeVisible()

    // Check the area metrics value from outside 3d sketch
    await checkBuildingSize(page, checkArea)

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-local-verified-dm.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-verified-dm.png`,
      }),
      contentType: "image/png",
    })
  })

  await test.step("Check 3d sketch building after reload", async () => {
    // Wait for a save to finish
    await page.waitForTimeout(5000)

    // Reload the page
    await page.reload()
    await page.waitForSelector(I3DS_CREATE_SELECTOR, {
      state: "attached",
      timeout: 60000,
    })

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-local-dm-reload.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-dm-reload.png`,
      }),
      contentType: "image/png",
    })

    await page.waitForTimeout(1000)

    // Click the element
    await page.mouse.click(728, 313)

    // Check building size from outside 3d sketch
    await checkBuildingSize(page, checkArea)

    // Start 3d sketch
    await page.locator(I3DS_EDIT_SELECTOR).click()

    // Verify the Floor details appear
    await expect(page.getByText("Floor details")).toBeVisible({ timeout: 30000 })

    // Check the area metrics value from inside 3d sketch
    await checkBuildingSize(page, checkArea)

    // Screenshot the newly created building
    await testInfo.attach("3d-sketch-local-verified-reload-3ds.png", {
      body: await page.screenshot({
        path: `./test-results/3d-sketch/local-verified-reload-3ds.png`,
      }),
      contentType: "image/png",
    })
  })
})
