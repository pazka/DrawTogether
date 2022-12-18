const configs = Object.freeze({
    DEV: {
        name: "DEV",
        debug: true,
        baseUrl: "http://localhost:8080"
    },
    PROD: {
        name: "PROD",
        debug: false
    }
})

export default configs