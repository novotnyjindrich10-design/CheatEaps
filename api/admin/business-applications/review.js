import { adminReviewApplicationHttp } from '../../../src/server/businessApplications.js'

export default {
  fetch(request) {
    return adminReviewApplicationHttp(request)
  },
}
