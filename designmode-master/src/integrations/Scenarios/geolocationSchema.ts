interface Point3D {
  x: number
  y: number
  z: number
}

interface BoundingBox3D {
  min: Point3D
  max: Point3D
}

interface Matrix44D {
  elements: number[] // length 16, row-major order
}

interface ReferenceObjectId {
  objectId: {
    id: string
  }
}

interface CoordinateReferenceSystem {
  crsEncodingType: 0 | 1 // 0 = ADSKXML, 1 = WKT2
  definition: string
}

interface CRSEncodingSet {
  encodings: Record<string, CoordinateReferenceSystem>
}

interface GeographicCoordinate {
  latitude: number
  longitude: number
  ellipsoidHeight?: number
}

interface CoordinateOperation3DLinearTransform {
  $typeid: "autodesk.aec.geospatial:coordinateOperation_3dLinearTransform-1.0.0"
  $value: {
    transform: Matrix44D
  }
}

interface BaseGeolocation {
  name: string
  primaryCoordinateReferenceSystem: CRSEncodingSet
  linearUnit: string
  extent: BoundingBox3D
  fitPoints?: Point3D[]
  description?: string
}

interface AdvancedGeolocation {
  $typeid: "autodesk.aec.geospatial:advancedGeolocation-2.0.0"
  $value: BaseGeolocation & {
    baseCoordinateReferenceSystem: CRSEncodingSet
    baseVerticalCoordinateReferenceSystem?: CRSEncodingSet
    referencePoint: Point3D
    localReferencePoint: Point3D
    combinedScaleFactor?: number
    scaleFactorEstimationMethod?: 0 | 1 | 2 // 0 = UNITY, 1 = REFERENCE_POINT, 2 = USER_DEFINED
    rotation?: number
    ellipsoidHeight?: number
  }
}

interface BasicGeolocation {
  $typeid: "autodesk.aec.geospatial:basicGeolocation-2.0.0"
  $value: BaseGeolocation & {
    geographicReferencePoint: GeographicCoordinate
    geographicReferencePointCRS: CRSEncodingSet
    rotation?: number
  }
}

interface DerivedGeolocation {
  $typeid: "autodesk.aec.geospatial:derivedGeolocation-2.0.0"
  $value: BaseGeolocation & {
    baseGeolocation: ReferenceObjectId
    derivingOperation: CoordinateOperation3DLinearTransform
  }
}

interface EngineeringGeolocation {
  $typeid: "autodesk.aec.geospatial:engineeringGeolocation-2.0.0"
  $value: BaseGeolocation & {
    uniqueID: string
  }
}

export type Geolocation = AdvancedGeolocation | BasicGeolocation | DerivedGeolocation | EngineeringGeolocation
