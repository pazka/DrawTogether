export function getBaseUrl() {
    const url = window.location.href.match(/(https?:\/\/)([\w.]*)([:]\d*)?\/(\w*)/)
    const protocol = url[1] ?? ""
    const domain = url[2] ?? ""
    const port = url[3] ?? ""
    const dynamicUrl = protocol + domain + port

    return (process.env.NODE_ENV !== 'production') ? "http://localhost:9001" : dynamicUrl
}

export function getRoomName(){
   return window.location.href.match(/(https?:\/\/)([\w.]*)([:]\d*)?\/(\w*)/)[4]
}

async function sendFile(fromFile, urlPath) {
    let formData = new FormData();

    formData.append("layerImg", fromFile);
    return fetch(getBaseUrl() + urlPath, {method: "POST", body: formData})
}

export async function postData(urlPath = '', data = {}) {
    // Default options are marked with *
    const response = await fetch(getBaseUrl() +urlPath, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json',
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}

export async function sendImg(formFile, roomId, layerId) {
    return sendFile(formFile, `/api/room/${roomId}/${layerId}/upload`)
}