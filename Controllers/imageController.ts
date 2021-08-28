export const validFormats = [
    ".png",".img"
]
export function isFormatValid(format : string){
    if(!format)
        return false 
    
    return validFormats.includes(format.toLowerCase())
}