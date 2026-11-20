// Preload (node -r) for test/server.test.js: makes every node-persist write slow (SLOW_PERSIST_MS), so a route
// that answers before its storage write has finished shows up deterministically. node-persist copies its
// methods onto the module at init(), so setItem is wrapped right after init. Node built-ins only.
'use strict'

const path = require('node:path')
const persist = require(require.resolve('node-persist', {paths: [path.join(__dirname, '..')]}))

const delay = Number(process.env.SLOW_PERSIST_MS || 300)
const init = persist.init
persist.init = async function (...args) {
    const ret = await init.apply(this, args)
    const setItem = persist.setItem
    persist.setItem = async (...a) => {
        await new Promise(r => setTimeout(r, delay))
        return setItem(...a)
    }
    return ret
}
