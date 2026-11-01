import { adminListApplicationsHttp } from '../../src/server/businessApplications.js'

export default {
  fetch(request) {
    return adminListApplicationsHttp(request)
  },
}
