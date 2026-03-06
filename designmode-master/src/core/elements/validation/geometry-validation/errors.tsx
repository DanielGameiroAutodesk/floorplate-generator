import type { InternalPath } from "src/lib/element/path"
import { type I18nStringProvider, type Translator } from "src/i18n"
import type { ComponentChildren } from "preact"

export const validationErrorTexts = {
  "duplicate-element": {
    title: (t) => t(($) => $.geometryValidation.duplicateElement.title),
    subTitle: (t) => t(($) => $.geometryValidation.duplicateElement.subTitle),
    analyticsSubfeature: "",
  },
  "out-of-bounds-element": {
    title: (t) => t(($) => $.geometryValidation.outOfBounds.title),
    subTitle: (t) => t(($) => $.geometryValidation.outOfBounds.subTitle),
    analyticsSubfeature: "",
  },
  "invalid-bbox-element": {
    title: (t) => t(($) => $.geometryValidation.invalidBbox.title),
    subTitle: (t) => t(($) => $.geometryValidation.invalidBbox.subTitle),
    analyticsSubfeature: "",
  },
  "wsm-floor-no-area": {
    title: (t) => t(($) => $.geometryValidation.wsmFloorNoArea.title),
    subTitle: (t) => t(($) => $.geometryValidation.wsmFloorNoArea.subTitle),
    analyticsSubfeature: "Geometry alert: Zero-area floor(s) detected",
  },
  "wsm-bottom-floor-no-area": {
    title: (t) => t(($) => $.geometryValidation.wsmBottomFloorNoArea.title),
    subTitle: (t) => t(($) => $.geometryValidation.wsmBottomFloorNoArea.subTitle),
    analyticsSubfeature: "Geometry alert: Zero-area first floor detected",
  },
  "wsm-non-manifold-building": {
    title: (t) => t(($) => $.geometryValidation.wsmNonManifoldBuilding.title),
    subTitle: (t) =>
      t.icu(($) => $.geometryValidation.wsmNonManifoldBuilding.subTitle, {
        a: (chunks) => (
          <a
            href="https://help.autodeskforma.com/en/articles/6978573-tips-and-tricks-in-3d-sketch#h_ff7e79c306"
            target="_blank"
            rel="noreferrer"
          >
            {chunks}
          </a>
        ),
      }),
    analyticsSubfeature: "Geometry alert: Nonmanifold building detected",
  },
  "wsm-non-manifold-volume": {
    title: (t) => t(($) => $.geometryValidation.wsmNonManifoldVolume.title),
    subTitle: (t) =>
      t.icu(($) => $.geometryValidation.wsmNonManifoldVolume.subTitle, {
        a: (chunks) => (
          <a
            href="https://help.autodeskforma.com/en/articles/6978573-tips-and-tricks-in-3d-sketch#h_ff7e79c306"
            target="_blank"
            rel="noreferrer"
          >
            {chunks}
          </a>
        ),
      }),
    analyticsSubfeature: "Geometry alert: Nonmanifold volume detected",
  },
} satisfies Record<
  string,
  {
    title: I18nStringProvider
    subTitle: (t: Translator) => ComponentChildren
    analyticsSubfeature: string
  }
>

type ValidationErrorType = keyof typeof validationErrorTexts

export type ValidationError = { type: ValidationErrorType; path: InternalPath }
