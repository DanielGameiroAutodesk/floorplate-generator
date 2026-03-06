import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks"
import * as THREE from "three"
import type { DirectionalLight } from "three"
import { Mesh, Vector3 } from "three"
import suncalc from "suncalc"
import sceneManager, { lightIntensities } from "src/core/three/sceneManager"
import { graphicsSettings } from "src/lib/three/graphics-settings"
import { computed } from "@preact/signals"
import type { SunGroup } from "./api"
import { SunApi, SunDetails } from "./api"
import { projectGeoLocationSignal, projectSignal } from "src/core/project/project"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

const UTM_CENTER_OFFSET_DEGREES = 3
const UTM_ZONE_WIDTH_DEGREES = 6
const HALF_CIRCLE_DEGREES = 180

function computeUtmCentralMeridian(utmZone: number) {
  return (utmZone - 1) * UTM_ZONE_WIDTH_DEGREES - HALF_CIRCLE_DEGREES + UTM_CENTER_OFFSET_DEGREES
}

function computeGridConvergence(latDeg: number, lonDeg: number, utmZone: number) {
  const centralMeridian = computeUtmCentralMeridian(utmZone)
  const latRad = (latDeg * Math.PI) / 180
  const deltaLonRad = (Math.PI / 180) * (lonDeg - centralMeridian)
  return Math.atan(Math.tan(deltaLonRad) * Math.sin(latRad))
}

type SunPosition = [number, number] // azimuth, altitude
const sunPositionSignal = computed<SunPosition | undefined>(() => {
  const sunDate = SunApi.sunDateSignal.value
  if (!sunDate) return
  const projectData = projectSignal.value
  if (!projectData?.geoLocation) return
  const projectUtmZone = projectGeoLocationSignal.value?.utmZone
  if (!projectUtmZone) return
  const [lat, long] = projectData.geoLocation
  const { azimuth, altitude } = suncalc.getPosition(sunDate, lat, long)
  const gridConvergence = computeGridConvergence(lat, long, projectUtmZone)
  const utmAdjustedAzimuth = (azimuth - gridConvergence) % (2 * Math.PI)
  return [utmAdjustedAzimuth, altitude]
})

const defaultSunDate = new Date()
defaultSunDate.setMonth(5)
defaultSunDate.setDate(21)
defaultSunDate.setHours(13)
defaultSunDate.setMinutes(42)
defaultSunDate.setTime(defaultSunDate.getTime() - defaultSunDate.getTimezoneOffset() * 60 * 1000)

/**
 * Modify sun color based on height
 */
const sunColorByHeight = (height: number) => {
  const color1 = "fff000"
  const color2 = "ff0000"

  const cappedHeight = Math.max(height, 0)

  const mixPart = (start: number, end: number) =>
    Math.floor(
      parseInt(color1.substring(start, end), 16) * cappedHeight +
        parseInt(color2.substring(start, end), 16) * (1 - cappedHeight),
    )
  return (mixPart(0, 2) << 16) + (mixPart(2, 4) << 8) + mixPart(4, 6)
}

/**
 * Calculate position of sun in terms of x,y,z coordinates and height
 */
const calculatePosAndHeight = (
  pos: [number, number],
  center: { x: number; y: number; z: number },
  distance: number,
) => {
  let az = pos[0] + Math.PI // suncalc returns azimuth starting in south
  let alt = pos[1]
  let z = Math.sin(alt)
  let hyp = Math.cos(alt)
  let y = Math.cos(az) * hyp
  let x = hyp * Math.sin(az)
  return {
    x: center.x + x * distance,
    y: center.y + y * distance,
    z: center.z + z * distance,
    height: alt,
  }
}

/**
 * Build sunlight and scene and group them together
 * https://threejs.org/docs/#api/en/lights/AmbientLight
 * https://threejs.org/docs/#api/en/lights/DirectionalLight
 */
const buildSun = (): SunGroup => {
  const sunLight = new THREE.DirectionalLight(0xffffff, lightIntensities.sun)

  sunLight.up.set(0, 0, 1)
  sunLight.castShadow = true
  sunLight.shadow.normalBias = 1
  const shadowMapSize = graphicsSettings.shadowMapSize
  sunLight.shadow.mapSize.width = shadowMapSize
  sunLight.shadow.mapSize.height = shadowMapSize
  adjustShadowCam(sunLight)

  sunLight.target.position.set(0, 0, 0)

  sunSphere = new THREE.Mesh(new THREE.SphereGeometry(30, 30, 30), new THREE.MeshLambertMaterial({ color: 0xfff000 }))

  const group = new THREE.Group() as SunGroup
  group.name = SunDetails.name
  group.refs = { bulb: sunSphere, light: sunLight }
  group.add(sunLight)
  group.add(sunSphere)
  sceneManager.scene.add(group)
  sceneManager.scene.add(sunLight.target)

  return group
}

/**
 * Adjusts the shadow camera to fit the terrain
 */
function adjustShadowCam(dirLight: DirectionalLight) {
  const terrain = sceneManager.scene.getObjectByName("Terrain")
  if (!terrain || !(terrain instanceof Mesh) || !terrain.geometry.boundingSphere) return
  const { center, radius } = terrain.geometry.boundingSphere
  const camera = dirLight.shadow.camera
  camera.left = -radius
  camera.right = radius
  camera.top = radius
  camera.bottom = -radius

  const distToCenter = new Vector3().copy(dirLight.position).sub(center).length()
  camera.near = distToCenter - radius
  camera.far = distToCenter + radius

  camera.updateProjectionMatrix()
}

const SUN_RADIUS_BUFFER = 200

/**
 * Move sun group along the predefined orbit and apply color variations
 */
const moveSun = (group: SunGroup, sunPosition: SunPosition, bboxDiagonalLength: number) => {
  const center = group.refs.light.target.position.clone()
  const [newLightPos, newBulbPos] = [bboxDiagonalLength, bboxDiagonalLength + SUN_RADIUS_BUFFER].map((distance) =>
    calculatePosAndHeight(sunPosition, center, distance),
  )
  group.refs.light.position.set(newLightPos.x, newLightPos.y, newLightPos.z)
  group.refs.bulb.position.set(newBulbPos.x, newBulbPos.y, newBulbPos.z)
  ;(group.refs.bulb.material as THREE.MeshLambertMaterial).color.set(
    sunColorByHeight(Math.min(0.99999, 2 * newLightPos.height)),
  )
  adjustShadowCam(group.refs.light)
}

/**
 * Show or hide shadows
 */
const toggleShadow = (sun: SunGroup, showShadow: boolean) => {
  sun.refs.light.castShadow = showShadow
}

let sunSphere: Mesh
const sun = buildSun()

/***
 * Side effect component that adds the sun to the scene and
 * positions it based on inputs from positioning
 * components
 *
 */
export const Sun = () => {
  const [diagonalLength, setDiagonalLength] = useState(1000)
  const showShadow = SunApi.showShadowSignal.value
  const sunPosition = sunPositionSignal.value
  const terrainMesh = terrainSignal.value.mesh
  const sunGlobeVisible = SunApi.sunGloveVisibleSignal.value

  useEffect(() => {
    sunSphere.visible = sunGlobeVisible
    sceneManager.render()
  }, [sunGlobeVisible])
  /**
   * Intial position of the sun has to be calculated with terrain altitude and
   * site limits in mind.
   */
  const calculateSunInitPosition: Vector3 = useMemo((): Vector3 => {
    let sunPosition = new Vector3()

    if (!terrainMesh) return sunPosition
    if (!terrainMesh.geometry.boundingBox) terrainMesh.geometry.computeBoundingBox()

    const targetXPos = terrainMesh.position.x
    const targetYPos = terrainMesh.position.y
    const targetZPos = (terrainMesh.geometry.boundingBox!.min.z + terrainMesh.geometry.boundingBox!.max.z) / 2

    sunPosition.set(targetXPos ? targetXPos : 0, targetYPos ? targetYPos : 0, targetZPos ? targetZPos : 0)

    return sunPosition
  }, [terrainMesh])

  useLayoutEffect(() => {
    if (sun) {
      let sunInitPos: Vector3 = calculateSunInitPosition
      sun.refs.light.target.position.set(sunInitPos.x, sunInitPos.y, sunInitPos.z)
      moveSun(sun, sunPosition ?? [Math.PI, 0.5], diagonalLength)
      sceneManager.render(true)
    }
  }, [calculateSunInitPosition, diagonalLength, sunPosition])

  useEffect(() => {
    if (terrainMesh) {
      setDiagonalLength((terrainMesh.geometry.boundingSphere?.radius || 500) * 2)
    }
  }, [terrainMesh])

  /**
   * Use effect will be called when ever there is a change in
   * range slider or any of the input components
   */
  useLayoutEffect(() => {
    if (!sunPosition) return
    const newPositions = sunPosition
    moveSun(sun, newPositions, diagonalLength)
    sceneManager.render(true)
    return () => {
      sceneManager.render(true)
    }
  }, [sunPosition, diagonalLength])

  /**
   * Toggle shadow
   */
  useEffect(() => {
    toggleShadow(sun, showShadow)
    sceneManager.render(true)
    window.globalSpinner.stop()
  }, [showShadow])

  return null
}
