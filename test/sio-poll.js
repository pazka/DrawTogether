// Minimal Socket.IO v4 client over HTTP long-polling (engine.io protocol 4), built on fetch.
// Lets the tests drive the real server with two clients without adding socket.io-client.
'use strict'

const SEP = '\x1e'

class PollClient {
    constructor(base) {
        this.base = base
        this.events = []
        this.closed = false
    }

    url() {
        return `${this.base}/socket.io/?EIO=4&transport=polling${this.sid ? `&sid=${this.sid}` : ''}`
    }

    async connect() {
        const open = await (await fetch(this.url())).text()          // "0{sid,pingInterval,...}"
        if (open[0] !== '0') throw new Error('bad engine.io open packet: ' + open)
        this.sid = JSON.parse(open.slice(1)).sid
        await this.post('40')                                         // connect to namespace "/"
        this.loop = this.pollLoop()
        await this.waitFor('connect')
        return this
    }

    async post(body) {
        const r = await fetch(this.url(), {method: 'POST', body, headers: {'content-type': 'text/plain;charset=UTF-8'}})
        if ((await r.text()) !== 'ok') throw new Error('engine.io POST refused')
    }

    async pollLoop() {
        while (!this.closed) {
            let text
            try {
                text = await (await fetch(this.url())).text()
            } catch (e) {
                return
            }
            for (const p of text.split(SEP)) {
                if (p === '2') await this.post('3').catch(() => {})            // ping -> pong
                else if (p === '1' || p === '6') continue
                else if (p.startsWith('40')) {
                    this.id = JSON.parse(p.slice(2)).sid
                    this.events.push({name: 'connect', args: []})
                } else if (p.startsWith('42')) {
                    const [name, ...args] = JSON.parse(p.slice(2))
                    this.events.push({name, args})
                }
            }
        }
    }

    emit(name, ...args) {
        return this.post('42' + JSON.stringify([name, ...args]))
    }

    /** Resolve with the args of the first not-yet-consumed `name` event. */
    async waitFor(name, timeoutMs = 5000) {
        const until = Date.now() + timeoutMs
        while (Date.now() < until) {
            const i = this.events.findIndex(e => e.name === name)
            if (i >= 0) return this.events.splice(i, 1)[0].args
            await new Promise(r => setTimeout(r, 20))
        }
        throw new Error(`timeout waiting for "${name}"; got ${JSON.stringify(this.events.map(e => e.name))}`)
    }

    async close() {
        this.closed = true
        await this.post('1').catch(() => {})                           // engine.io close
        await this.loop
    }
}

module.exports = {PollClient}
