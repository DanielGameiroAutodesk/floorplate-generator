import * as glob from "glob"
import path from "node:path"
import { createJiti } from "jiti"

const jiti = createJiti(import.meta.url)

// Re-export all .ts files as rules.
const rules = {}
for (const file of glob.sync("*.ts", { absolute: true, cwd: path.dirname(import.meta.url) })) {
  rules[path.basename(file, ".ts")] = await jiti.import(file, { default: true })
}

export default {
  rules,
}
