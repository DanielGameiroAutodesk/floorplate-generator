import { bufferSectionBox, type SectionBox } from "src/integrations/section-box/tooling/sectionBox"
import * as THREE from "three"

const BUFFER = 0.01

export const getClippingPlanesFromSectionBox = (sectionBox: SectionBox): THREE.Plane[] => {
  const bufferedSectionBox = bufferSectionBox(sectionBox, BUFFER)
  const [x1, y1] = bufferedSectionBox.geometry.coordinates[0][0]
  const [x2, y2] = bufferedSectionBox.geometry.coordinates[0][1]
  const [x3, y3] = bufferedSectionBox.geometry.coordinates[0][2]
  const [x4, y4] = bufferedSectionBox.geometry.coordinates[0][3]

  const minZ = bufferedSectionBox.properties.elevation
  const maxZ = bufferedSectionBox.properties.elevation + bufferedSectionBox.properties.height

  const midPoint = new THREE.Vector3((x1 + x2 + x3 + x4) / 4, (y1 + y2 + y3 + y4) / 4, (minZ + maxZ) / 2)

  const plane1 = new THREE.Plane()
  plane1.setFromCoplanarPoints(
    new THREE.Vector3(x1, y1, minZ),
    new THREE.Vector3(x2, y2, minZ),
    new THREE.Vector3(x2, y2, maxZ),
  )
  if (plane1.distanceToPoint(midPoint) < 0) plane1.negate()
  const plane2 = new THREE.Plane()
  plane2.setFromCoplanarPoints(
    new THREE.Vector3(x2, y2, maxZ),
    new THREE.Vector3(x3, y3, maxZ),
    new THREE.Vector3(x3, y3, minZ),
  )
  if (plane2.distanceToPoint(midPoint) < 0) plane2.negate()
  const plane3 = new THREE.Plane()
  plane3.setFromCoplanarPoints(
    new THREE.Vector3(x3, y3, minZ),
    new THREE.Vector3(x4, y4, minZ),
    new THREE.Vector3(x4, y4, maxZ),
  )
  if (plane3.distanceToPoint(midPoint) < 0) plane3.negate()
  const plane4 = new THREE.Plane()
  plane4.setFromCoplanarPoints(
    new THREE.Vector3(x4, y4, maxZ),
    new THREE.Vector3(x1, y1, maxZ),
    new THREE.Vector3(x1, y1, minZ),
  )
  if (plane4.distanceToPoint(midPoint) < 0) plane4.negate()
  const planeZ1 = new THREE.Plane()
  planeZ1.setFromCoplanarPoints(
    new THREE.Vector3(x1, y1, minZ),
    new THREE.Vector3(x2, y2, minZ),
    new THREE.Vector3(x3, y3, minZ),
  )
  if (planeZ1.distanceToPoint(midPoint) < 0) planeZ1.negate()
  const planeZ2 = new THREE.Plane()
  planeZ2.setFromCoplanarPoints(
    new THREE.Vector3(x1, y1, maxZ),
    new THREE.Vector3(x2, y2, maxZ),
    new THREE.Vector3(x3, y3, maxZ),
  )
  if (planeZ2.distanceToPoint(midPoint) < 0) planeZ2.negate()
  return [plane1, plane2, plane3, plane4, planeZ1, planeZ2]
}
