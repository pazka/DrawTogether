
import * as express from 'express'
const router = express.Router()
const roomController = require('../Controllers/roomController')


router.get('/all', async function (req, res) {
    res.send(await roomController.getAllRooms())
})

router.get('/:roomid', async function (req, res) {
    res.send(await roomController.getRoom(req.params.roomid))
})
export default router