import { authActionHttp } from '../../src/server/memberHttp.js'

export default {
  fetch(request) {
    return authActionHttp('update-password', request)
  },
}
