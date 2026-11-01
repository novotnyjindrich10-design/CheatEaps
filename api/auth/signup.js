import { authActionHttp } from '../../src/server/memberHttp.js'

export default {
  fetch(request) {
    return authActionHttp('signup', request)
  },
}
