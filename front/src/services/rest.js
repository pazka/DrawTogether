export function getBaseUrl() {
    const url = window.location.href.match(/(https*:\/\/)(\w*)([:/]\d*)/)
    const protocol = url[1]
    const domain = url[2]
    const port = url[3]
    const dynamicUrl = protocol + domain + port

    return (process.env.NODE_ENV !== 'production') ? "http://localhost:9001" : dynamicUrl
}

async function sendFile(fromFile, urlPath) {
    let formData = new FormData();

    formData.append("layerImg", fromFile);
    return fetch(getBaseUrl() + urlPath, {method: "POST", body: formData})
}

export async function sendImg(formFile, roomId, layerId) {
    return sendFile(formFile, `/api/room/${roomId}/${layerId}/upload`)
}