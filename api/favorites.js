import { communityHttp } from '../src/server/community.js'

export default {
  fetch(request) {
    return communityHttp(request)
  },
}
