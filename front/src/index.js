import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {
    BrowserRouter,
    Route
} from 'react-router-dom';

if(process.env.NODE_ENV === 'production'){
    console.log("Have fun looking at the code !")
    if(window.location.href.split('?')[1] !== "debug"){
        console.log = ()=>{}
        console.group = ()=>{}
        console.groupEnd = ()=>{}
        console.info = ()=>{}
        console.warn = ()=>{}
    }
}

ReactDOM.render(
    <BrowserRouter>
        <div>
            <Route path="/" render={()=><App />}/>
        </div>
    </BrowserRouter >,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

