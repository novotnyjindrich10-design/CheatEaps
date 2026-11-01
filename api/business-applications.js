import { submitBusinessApplicationHttp } from '../src/server/businessApplications.js'

export default {
  fetch(request) {
    return submitBusinessApplicationHttp(request)
  },
}
