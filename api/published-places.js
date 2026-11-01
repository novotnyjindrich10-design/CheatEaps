import { listPublishedPlacesHttp } from '../src/server/businessApplications.js'

export default {
  fetch(request) {
    return listPublishedPlacesHttp(request)
  },
}
