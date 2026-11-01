import { adminResendEmailHttp } from '../../../src/server/businessApplications.js'

export default {
  fetch(request) {
    return adminResendEmailHttp(request)
  },
}