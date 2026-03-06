/** The limit where we don't flatten a body */
export const TRIANGLE_LIMIT_FLATTEN = 75000

/** The limit where we don't even try to convert a mesh to body */
export const TRIANGLE_LIMIT_MESH_TO_BODY = 150000

/** The amount where it's almost certain integrated 3d sketch just will freeze the page.
 * Logs a warning rather than doing anything, but that warning should appear in sentry
 * if we crash
 */
export const TRIANGLE_LIMIT_ABSOLUTE_MAX = 300000

/**
 * Under this limit, we use the volume mesh. If it's above this, we use the GLB
 * for getting more than one mesh.
 */
export const TRIANGLE_THRESHOLD_FOR_USE_GLB = 10 * 1024
