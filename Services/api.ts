
import * as express from 'express'
const router = express.Router()
const roomController = require('../Controllers/roomController')

router.get('/', async function (req, res) {
    let room = await roomController.createNewRoom()
    res.redirect(room.id)
})

router.get('/:roomid', async function (req, res) {
    res.send(await roomController.getRoom(req.params.roomid))
})

router.post('/:id', function (req, res) {
    console.log(`storing ${req.body} into ${req.params.id}`)
})

export default router