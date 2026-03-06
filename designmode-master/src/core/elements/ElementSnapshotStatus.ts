export const ElementSnapshotStatus = {
  Persisted: "PERSISTED",
  Draft: "DRAFT",
  InRecovery: "IN_RECOVERY",
} as const

export type ElementSnapshotStatusKey = (typeof ElementSnapshotStatus)[keyof typeof ElementSnapshotStatus]
