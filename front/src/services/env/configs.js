const configs = Object.freeze({
    DEV: {
        name: "DEV",
        debug: true,
        host: "http://localhost",
        port : 8080
    },
    PROD: {
        name: "PROD",
        debug: false,
        port:80
    }
})

export default configs