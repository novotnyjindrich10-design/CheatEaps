import { dealDetailHttp } from '../src/server/memberHttp.js'

export default {
  fetch(request) {
    return dealDetailHttp(request)
  },
}
