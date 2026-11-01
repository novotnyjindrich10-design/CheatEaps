import { adminMeHttp } from '../../src/server/businessApplications.js'

export default {
  fetch(request) {
    return adminMeHttp(request)
  },
}
