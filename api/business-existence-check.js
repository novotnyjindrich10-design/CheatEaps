import { existenceCheckHttp } from '../src/server/businessApplications.js'

export default {
  fetch(request) {
    return existenceCheckHttp(request)
  },
}
