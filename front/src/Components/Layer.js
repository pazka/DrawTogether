import useRoom from "../Controller/useRoom";

const layerContainer = {
    display : "block",
    minWidth : "50px",
    minHeight : "50px",
    position : "sticky",
    top : "0",
    right : "0",
    
    '& *' : {
        border : 'solid red 1px'
    }
}

const layerItem = {
    display : "block",
    width : "50px",
    height : "50px"
}

export function Layers(){
    let room = useRoom()
    
    return <div style = {layerContainer}>
        <div>
            {room.layers.map((l,i)=><Layer key={i} layer={l}/>)}
        </div>
        <div>
            <button>+ Add Layer</button>
        </div>
        <pre>{JSON.stringify(room,"   ",4)}</pre>
    </div>
}

export function Layer(props){
    const calc = props.layer
    
    return <div style = {layerItem}>
        <p>{calc.name}</p>
        <button>Remove</button>
    </div>
}