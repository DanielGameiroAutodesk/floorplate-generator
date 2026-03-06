import type { Tutorial } from "./model"
import analysis from "./img/analysis.jpg"
import { isResourcesModalOpenSignal } from "./state/hasClosedResourcesModal"
import {
  addBuildingsTutorialState,
  orderDataTutorialState,
  importModelTutorialState,
} from "./state/tutorialStateSignals"
import {
  createModalTrackingAdvanceWhen,
  createToolActivationTrackingAdvanceWhen,
  createElementPlacementDetection,
} from "./utils/autoAdvanceHelpers"
import ContextualDataIcon from "./icons/ContextualDataIcon"
import BuildingIcon from "./icons/BuildingIcon"
import SunIcon from "./icons/SunIcon"

// Tool ID constants
const TOOL_IDS = {
  LINE_BUILDING: "lineBuilding",
  DRAW_POLYGON: "drawPolygon",
  PLACE_MODE_MANUAL: "placeMode:manual",
} as const

const TUTORIAL_IDS = {
  ASSESS_ENVIRONMENTAL_CONDITIONS_TUTORIAL: "assess-environmental-conditions-tutorial",
  ADD_BUILDINGS_TUTORIAL: "add-buildings-tutorial",
  SET_UP_YOUR_SITE_TUTORIAL: "set-up-your-site-tutorial",
}

// Site setup tutorial
const setUpYourSiteTutorial = (): Tutorial => {
  orderDataTutorialState.siteLimitToolWasActivatedSignal.value = false
  return {
    id: TUTORIAL_IDS.SET_UP_YOUR_SITE_TUTORIAL,
    title: (t) => t(($) => $.tutorials.setUpYourSite.title),
    description: (t) => t(($) => $.tutorials.setUpYourSite.description),
    icon: <ContextualDataIcon />,
    time: 2,
    reviewHeader: (t) => t(($) => $.tutorials.setUpYourSite.reviewHeader),
    reviewText: (t) =>
      t.icu(($) => $.tutorials.setUpYourSite.reviewText, {
        br: <br />,
      }),
    steps: [
      {
        header: (t) => t(($) => $.tutorials.setUpYourSite.steps.openContextualTab.header),
        text: (t) =>
          t.icu(($) => $.tutorials.setUpYourSite.steps.openContextualTab.text, {
            bold: (children: string) => <strong>{children}</strong>,
          }),
        targetId: "contextual-tab",
        placement: "right",
        highlightBorder: true,
      },
      {
        header: (t) => t(($) => $.tutorials.setUpYourSite.steps.browseAndOrder.header),
        text: (t) =>
          t.icu(($) => $.tutorials.setUpYourSite.steps.browseAndOrder.text, {
            bold: (children: string) => <strong>{children}</strong>,
            br: <br />,
          }),
        targetId: "order-data-button",
        placement: "right",
      },
      {
        header: (t) => t(($) => $.tutorials.setUpYourSite.steps.orderStarterPackage.header),
        text: (t) =>
          t.icu(($) => $.tutorials.setUpYourSite.steps.orderStarterPackage.text, {
            bold: (children: string) => <strong>{children}</strong>,
          }),
        placement: "right",
        hideNextButton: true,
        hideLightbox: true,
        targetId: "add-package-provider",
      },
      {
        header: (t) => t(($) => $.tutorials.setUpYourSite.steps.orderData.header),
        text: (t) => t(($) => $.tutorials.setUpYourSite.steps.orderData.text),
        targetId: "order-button",
        placement: "left",
        hideLightbox: true,
        hideNextButton: true,
        advanceOnClick: false,
        advanceWhen: createModalTrackingAdvanceWhen(
          isResourcesModalOpenSignal,
          orderDataTutorialState.resourcesModalWasOpenedSignal,
        ),
      },
      {
        header: (t) => t(($) => $.tutorials.setUpYourSite.steps.drawSiteLimit.header),
        text: (t) =>
          t.component(($) => $.tutorials.setUpYourSite.steps.drawSiteLimit.text, {
            br: <br />,
          }),
        targetId: "limits-toolbar",
        placement: "left",
        hideLightbox: true,
        hideNextButton: true,
        advanceOnClick: false,
        hideCoachmarkWhileToolActive: TOOL_IDS.DRAW_POLYGON,
        advanceWhen: createToolActivationTrackingAdvanceWhen(
          TOOL_IDS.DRAW_POLYGON,
          orderDataTutorialState.siteLimitToolWasActivatedSignal,
        ),
      },
    ],
  }
}

// Building design tutorials
const addBuildingsTutorial = (): Tutorial => {
  // Reset signals when tutorial starts/restarts to prevent auto-skip on restart
  addBuildingsTutorialState.importModalWasOpenedSignal.value = false
  addBuildingsTutorialState.lineBuildingWasActivatedSignal.value = false

  // Reset signals when tutorial starts/restarts to prevent auto-skip on restart
  importModelTutorialState.importModalWasOpenedSignal.value = false
  importModelTutorialState.initialElementCountSignal.value = null

  return {
    id: TUTORIAL_IDS.ADD_BUILDINGS_TUTORIAL,
    title: (t) => t(($) => $.tutorials.addBuildings.title),
    description: (t) => t(($) => $.tutorials.addBuildings.description),
    icon: <BuildingIcon />,
    time: 3,
    reviewHeader: (t) => t(($) => $.tutorials.addBuildings.reviewHeader),
    reviewText: (t) => t(($) => $.tutorials.addBuildings.reviewText),
    steps: [
      {
        header: (t) => t(($) => $.tutorials.addBuildings.steps.selectBuildingsTool.header),
        text: (t) =>
          t.icu(($) => $.tutorials.addBuildings.steps.selectBuildingsTool.text, {
            bold: (children: string) => <strong>{children}</strong>,
          }),
        placement: "left",
        targetId: "building-toolbar",
        hideLightbox: true,
        highlightBorder: true,
        hideNextButton: true,
        advanceOnClick: false,
        hideCoachmarkWhileToolActive: TOOL_IDS.LINE_BUILDING,
        advanceWhen: createToolActivationTrackingAdvanceWhen(
          TOOL_IDS.LINE_BUILDING,
          addBuildingsTutorialState.lineBuildingWasActivatedSignal,
        ),
      },
      {
        header: (t) => t(($) => $.tutorials.addBuildings.steps.exploreParametricOptions.header),
        text: (t) => t(($) => $.tutorials.addBuildings.steps.exploreParametricOptions.text),
        placement: "left",
        targetId: "element-properties",
      },
      {
        header: (t) => t(($) => $.tutorials.addBuildings.steps.importModel.header),
        text: (t) => t(($) => $.tutorials.addBuildings.steps.importModel.text),
        placement: "right",
        highlightBorder: true,
        targetId: "library-tab",
      },
      // TODO: update target id to importmodel-button in toolbar instead
      {
        header: (t) => t(($) => $.tutorials.addBuildings.steps.importModel.header),
        text: (t) =>
          t.icu(($) => $.tutorials.addBuildings.steps.importModel.text, {
            bold: (children: string) => <strong>{children}</strong>,
          }),
        placement: "right",
        hideLightbox: true,
        hideNextButton: true,
        targetId: "import-button",
        advanceOnClick: false,
        hideWhileElementExists: "#resourcesModal",
        advanceWhen: createModalTrackingAdvanceWhen(
          isResourcesModalOpenSignal,
          importModelTutorialState.importModalWasOpenedSignal,
        ),
      },
      // TODO: Is this step necessary?
      {
        header: (t) => t(($) => $.tutorials.addBuildings.steps.placeInScene.header),
        text: (t) => t(($) => $.tutorials.addBuildings.steps.placeInScene.text),
        placement: "right",
        hideLightbox: true,
        hideNextButton: true,
        advanceOnClick: false,
        targetId: "library-item",
        hideCoachmarkWhileToolActive: TOOL_IDS.PLACE_MODE_MANUAL,
        advanceWhen: createElementPlacementDetection(importModelTutorialState.initialElementCountSignal),
      },
    ],
  }
}

// Run sun hours analysis tutorial
const assessEnvironmentalConditionsTutorial = (): Tutorial => ({
  id: TUTORIAL_IDS.ASSESS_ENVIRONMENTAL_CONDITIONS_TUTORIAL,
  title: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.title),
  description: (t) =>
    t.component(($) => $.tutorials.assessEnvironmentalConditions.description, {
      br: <br />,
    }),
  icon: <SunIcon />,
  time: 2,
  reviewHeader: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.reviewHeader),
  reviewText: (t) =>
    t.component(($) => $.tutorials.assessEnvironmentalConditions.reviewText, {
      br: <br />,
    }),
  steps: [
    {
      header: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.selectAnalysis.header),
      text: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.selectAnalysis.text),
      targetId: "sun-analysis-select",
      placement: "left",
      highlightBorder: true,
      hideNextButton: false,
      clickOnNext: true,
    },
    {
      header: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.selectDate.header),
      text: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.selectDate.text),
      targetId: "sun-analysis-date",
      placement: "left",
      advanceOnClick: false,
    },
    {
      header: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.runAnalysis.header),
      text: (t) =>
        t.component(($) => $.tutorials.assessEnvironmentalConditions.steps.runAnalysis.text, {
          br: <br />,
        }),
      targetId: "sun-analysis-run",
      placement: "left",
      hideNextButton: false,
      clickOnNext: true,
    },
    {
      header: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.openAnalysisResults.header),
      image: (t) => (
        <img
          src={analysis}
          alt={t(($) => $.tutorials.assessEnvironmentalConditions.steps.openAnalysisResults.altText)}
        />
      ),
      text: (t) => t(($) => $.tutorials.assessEnvironmentalConditions.steps.openAnalysisResults.text),
      targetId: "sun-analysis-open-results",
      placement: "left",
      hideNextButton: false,
    },
  ],
})

export const builtInTutorials: Tutorial[] = [
  setUpYourSiteTutorial(),
  addBuildingsTutorial(),
  assessEnvironmentalConditionsTutorial(),
]
