import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { Line2 } from "three/addons/lines/Line2.js"
import type { LineMaterialParameters } from "three/addons/lines/LineMaterial.js"
import { Vector2 } from "three"

/**
 * Version of LineMaterial that has working dashes.
 * NOTE! For this to work, you need to call .computeLineDistances() on the line that has this material. The apply() function does this for you.
 *
 * https://discourse.threejs.org/t/dashed-line2-material/10825
 */
export class DashedLineMaterial extends LineMaterial {
  constructor(props: LineMaterialParameters) {
    super({ resolution: new Vector2(window.innerWidth, window.innerHeight), ...props })
    this.defines.USE_DASH = ""
  }

  public apply(line: Line2) {
    line.material = this
    line.computeLineDistances()
  }
}
