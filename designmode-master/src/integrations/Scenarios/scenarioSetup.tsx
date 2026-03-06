import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { GetUnifiedProject } from "./unifiedProjectClient"
import {
  getGeolocationForSiteDesignSpaceModel,
  getRefPointFromScenarioModels,
} from "src/integrations/spaces/geolocation"
import { CreateSite } from "./projectServiceClient"
import { createUrn, parseUrn } from "src/lib/element/urn"
import {
  createModel,
  getScenario,
  type GetScenarioResponse,
  type ModelReference,
  type ModelResponse,
  updateScenario,
} from "src/integrations/spaces/spaceClient/spaceClientv4"
import {
  INTERNAL_MODEL_REFERENCE_SITE_DESIGN,
  SITE_DESIGN_AUTHORING_ENGINE,
  SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
} from "./scenario"
import { useState } from "preact/hooks"
import { useEffect } from "preact/compat"
import type { Urn } from "forma-elements"
import { v4 as uuidv4 } from "uuid"
import type { BaseElement } from "src/lib/element/base"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { GroupClient } from "src/integrations/group-element-system/client"
import { ProposalClientV3 } from "src/core/proposal-element-system/ProposalClient"
import { orderAndWaitForTerrain } from "./terrainOrdering"

type GeoLocationSelectedEvent = CustomEvent<GeoLocationSelectedEventData>

type GeoLocationSelectedEventData = {
  wgs84Lat: number
  wgs84Lng: number
  countryCode: string
  address?: string
}

type Geolocation = [number, number]
type LocationData = {
  geoLocation: Geolocation
  countryCode: string
  address?: string
}
type InitialPosition = {
  latLng: {
    lat: number
    lng: number
  }
  zoom: number
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-geolocation-picker": JSX.HTMLAttributes<HTMLElement> & {
        onGeolocationSelected: (data: GeoLocationSelectedEvent) => void
        initialPosition?: InitialPosition
      }
    }
  }
}

type designApp = "designmode" | "buildingdesign"

const getDesignApp = (): designApp => {
  const queryParams = new URLSearchParams(window.location.search)
  switch (queryParams.get("designApp")) {
    case "buildingdesign":
      return "buildingdesign"
    case "designmode":
      return "designmode"
    default:
      return "designmode"
  }
}

/**
 * Creates a new base proposal for the given authcontext, returns the URN of the proposal
 * @param {string} authContext
 * @returns {Promise<Urn>}
 */
const createProposal = async (
  authContext: string,
  scenarioInfo: { scenarioId: string; fileUrn: string; accProjectId: string },
  terrainUrn: Urn | null, // Add terrain URN parameter
): Promise<Urn> => {
  const { scenarioId, fileUrn, accProjectId } = scenarioInfo
  const baseId = uuidv4()
  const baseRevision = Date.now().toString()
  const baseUrn = createUrn("group", authContext, baseId, baseRevision)
  const baseElement: BaseElement = {
    urn: baseUrn,
    children: [],
    properties: {
      category: "group",
      component: true,
      indicator: "A",
      name: "Untitled base",
      tags: ["scenario", "base"],
    },
  }
  const baseContainer = ElementContainer.fromDraftElement(baseElement)
  await GroupClient.saveGroups([{ urn: baseUrn, container: baseContainer, dependenciesPersisted: true }], authContext)

  const baseKey = uuidv4()
  const terrainKey = uuidv4()

  // Create proposal with both base and terrain children
  const urnObjects = terrainUrn
    ? [
        { urn: baseUrn, key: baseKey },
        { urn: terrainUrn, key: terrainKey },
      ]
    : [{ urn: baseUrn, key: baseKey }]
  const proposal = await ProposalClientV3.create(
    {
      children: urnObjects,
      properties: {
        flags: {
          [baseKey]: {
            base: true,
            scenario: true,
            fixed: true,
            lock: true,
          },
        },
        scenario: {
          scenarioId,
          fileUrn,
          accProjectId,
        },
      },
    },
    authContext,
  )

  return proposal.urn
}

async function createNewSite(scenario: GetScenarioResponse, locationData: LocationData) {
  const { geoLocation, countryCode, address } = locationData
  const terrainModel = scenario.models.find((model) =>
    model.representations?.find((rep) => rep.typeid.includes(".terrain")),
  )
  const accProjectData = await GetUnifiedProject(scenario.scenario.accProjectId)

  // Create a new site
  const project = await CreateSite({
    name: address || "New Site Design",
    countryCode: countryCode.toLowerCase(),
    unifiedProjectId: accProjectData.id,
    geoLocation: geoLocation,
    tags: ["isCommercial"],
    inviteOnly: false,
    version: 2,
    metadata: {
      isCommercial: true,
      isDraft: false,
    },
  })

  // Order terrain for the site location
  const terrainUrn = terrainModel ? null : await orderAndWaitForTerrain(geoLocation, project.id, countryCode)

  // Create proposal with both base and terrain
  const proposalURN = await createProposal(
    project.id,
    {
      accProjectId: scenario.scenario.accProjectId,
      fileUrn: scenario.scenario.fileUrn,
      scenarioId: scenario.scenario.id,
    },
    terrainUrn,
  )
  const { id: proposalId } = parseUrn(proposalURN)

  // Create new model as none exists
  const geolocation = await getGeolocationForSiteDesignSpaceModel({
    latitude: geoLocation[0],
    longitude: geoLocation[1],
    ellipsoidHeight: 0, //TODO is this forever 0?
  })
  const model = await createModel({
    projectId: scenario.scenario.accProjectId,
    fileUrn: scenario.scenario.fileUrn,
    name: SITE_DESIGN_SCENARIO_BASE_MODEL_NAME,
    authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
    sourceReference: proposalURN,
    geolocation,
    custom: {
      siteDesign: { internalModelReference: INTERNAL_MODEL_REFERENCE_SITE_DESIGN },
    },
  })

  // Add new model to scenario model referencesfr
  const updatedModels: ModelReference[] = [
    ...(scenario.scenario.models || []),
    {
      fileUrn: model.fileUrn,
      id: model.id,
      revision: model.revision,
      authoringEngine: SITE_DESIGN_AUTHORING_ENGINE,
    },
  ]

  // Update scenario with site design data
  await updateScenario({
    projectId: scenario.scenario.accProjectId,
    fileUrn: scenario.scenario.fileUrn,
    scenarioId: scenario.scenario.id,
    id: scenario.scenario.id,
    revision: scenario.scenario.revision,
    name: scenario.scenario.name,
    models: updatedModels,
  })

  window.location.href = `/${getDesignApp()}/${project.id}/${proposalId}`
  return
}

export const ScenarioSetup = () => {
  const isLoaded = useLazyLoadScript(
    "/web-components/forma-geolocation-picker/forma-geolocation-picker.js",
    "site-design",
  )

  const queryParams = new URLSearchParams(window.location.search)
  const scenarioId = queryParams.get("scenarioId")!
  const projectId = queryParams.get("accProjectId")!
  const fileUrn = queryParams.get("fileUrn")!

  const [scenarioData, setScenarioData] = useState<GetScenarioResponse>()
  const [siteDesign, setSiteDesign] = useState<ModelResponse | undefined>()
  const [selectedLocation, setSelectedLocation] = useState<LocationData | undefined>()
  const [showMapSelector, setShowMapSelector] = useState(false)
  const [isCreatingSite, setIsCreatingSite] = useState(false)

  useEffect(() => {
    getScenario({
      projectId,
      scenarioId,
      fileUrn,
    })
      .then((scenario) => {
        setScenarioData(scenario)
        setSiteDesign(scenario.models.find((model) => model.authoringEngine === "SITE_DESIGN"))
      })
      .catch(console.error)
  }, [projectId, scenarioId, fileUrn])

  useEffect(() => {
    if (scenarioData) {
      getRefPointFromScenarioModels(scenarioData)
        .then((point) => {
          if (point) {
            // When loading from existing models, use a default country code
            setSelectedLocation({
              geoLocation: [point.latitude, point.longitude],
              countryCode: "NO", // Default country code when loading from existing scenario
            })
          }
        })
        .catch(console.error)
    }
  }, [scenarioData])

  useEffect(() => {
    if (scenarioData && !selectedLocation) {
      setShowMapSelector(true)
    }
  }, [scenarioData, selectedLocation])

  useEffect(() => {
    if (scenarioData && selectedLocation && !siteDesign) {
      setIsCreatingSite(true)
      createNewSite(scenarioData, selectedLocation).catch((error) => {
        console.error(error)
        setIsCreatingSite(false)
      })
    } else if (scenarioData && siteDesign) {
      const { authcontext, id } = parseUrn(siteDesign.sourceReference as Urn)

      console.log(authcontext)

      if (authcontext.startsWith("doc_")) {
        window.location.href = `/${getDesignApp()}/${authcontext}/${id}?accProjectId=${scenarioData.scenario.accProjectId}&fileUrn=${fileUrn}&scenarioId=${scenarioData.scenario.id}&accHubId=${scenarioData.scenario.hubId}&accFolderId=${scenarioData.scenario.folderUrn}`
      } else {
        window.location.href = `/${getDesignApp()}/${authcontext}/${id}`
      }
    }
  }, [scenarioData, selectedLocation, siteDesign, fileUrn])

  return (
    <>
      <div
        style={{
          width: "100vw",
          height: "100vh",
        }}
      >
        {isLoaded && showMapSelector && (
          <forma-geolocation-picker
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
            onGeolocationSelected={(e) => {
              setSelectedLocation({
                geoLocation: [e.detail.wgs84Lat, e.detail.wgs84Lng],
                countryCode: e.detail.countryCode,
                address: e.detail.address,
              })
            }}
          ></forma-geolocation-picker>
        )}

        {isCreatingSite && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              color: "white",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>Loading...</div>
            <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>Creating site and preparing terrain...</div>
          </div>
        )}
      </div>
    </>
  )
}
