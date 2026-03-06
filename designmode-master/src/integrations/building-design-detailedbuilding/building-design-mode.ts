import { isFlagActive, LDFlag } from "src/lib/featureToggling"

import { PROJECT_ID } from "src/core/project/project"

/* prettier-ignore */
const allowedDetailedBuildingsProjects = [
  "pro_anzc9njg91", "pro_dlr6973pd1", "pro_p3c88ptg2f", "pro_qub52d99xz", "pro_itncojydpp", "pro_74uc03r04x",
  "pro_zwx8pwp607", "pro_vizhokf3gi", "pro_nusqddjyoj", "pro_s4hxdu7sav", "pro_0nhu7r3e9n", "pro_pehysweex0",
  "pro_z745snbuqd", "pro_28w9d4mzbc", "pro_x2u7cmv4b9", "pro_o4kl2yf5lm", "pro_2m7rc6wbmt", "pro_08l2ej0t56",
  "pro_gelejd6onn", "pro_2softc2ecb", "pro_rgit1988xd", "pro_y66f0rq9sn", "pro_x76lp95o8i", "pro_ilao3244r7",
  "pro_rilxhq6252", "pro_xv00c8ip5o", "pro_5lsyqxvg98", "pro_cqe3yibjjb", "pro_zbfidrmuxd", "pro_3xsxsdvv3i",
  "pro_shke4zxoec", "pro_u0w1lk092n", "pro_ba0lgob2mj", "pro_x3znjag5sa", "pro_wh3oml2axq", "pro_oo0h5f5hn4",
  "pro_9hteiq7v1p", "pro_lffi4ver8c", "pro_hu0oss6uat", "pro_dj5h55g4sp", "pro_v8z7p9ta8d", "pro_xgridcd6xr",
  "pro_hhaehe3wfi", "pro_unujjl1lez", "pro_keote6np58", "pro_wrrykuma6t", "pro_qi0bl6dmch", "pro_xn5fblq69g",
  "pro_u1le51altw", "pro_ffa0c2f4ee", "pro_xvznwu7onj", "pro_sokrsojkxl", "pro_58ak9vznob", "pro_l4is1yfdph",
  "pro_hauhnsk6d4", "pro_3gzojm1cl7", "pro_q4pmpzhosn", "pro_76yok57cr4" // stg.usa projects for end-to-end testing
]

export function getBuildingDesignMode() {
  return allowedDetailedBuildingsProjects.includes(PROJECT_ID) || isFlagActive(LDFlag.DetailedBuildings)
}
