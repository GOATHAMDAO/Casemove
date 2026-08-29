import { createRoot } from 'react-dom/client';
import { Provider } from "react-redux";
import App from "./App";
import { PersistGate } from 'redux-persist/integration/react'
import returnVar from './store/configureStore'
// Electron loads the renderer from file://. BrowserRouter would turn
// `/signin` into file:///C:/signin on Windows, leaving the main pane blank.
// HashRouter keeps routes inside index.html (…/index.html#/signin).
import { HashRouter as Router } from 'react-router-dom';
import './index.css';
import React from 'react';


const myVar = returnVar();


declare global {
  interface Window {
    electron: {
      store: {
        get: (key: string) => any;
        set: (key: string, val: any) => void;
        // any other methods you've defined...
      },
      ipcRenderer: any
    }

  }
}


const container = document.getElementById('root');
if (container != null) {
const root = createRoot(container);
root.render(
  <React.StrictMode>
  <Router>
      <Provider store={myVar.reduxStore}>
        <PersistGate loading={null} persistor={myVar.persistor}>
        <App />
        </PersistGate>
      </Provider>
  </Router>
   </React.StrictMode>
);
}
