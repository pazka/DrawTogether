
export function download(fileName,value){
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(value));
    element.setAttribute('download', fileName);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

export function readFile(file,cb)
{    
    var reader = new FileReader();
    reader.addEventListener('load', function (e) {
        cb(e.target.result);
    });

    reader.readAsText(file);
}