import { descriptionReviewHttp } from '../src/server/businessApplications.js'

export default {
  fetch(request) {
    return descriptionReviewHttp(request)
  },
}
