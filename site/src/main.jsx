import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/archivo/wdth.css'
import './estilos.css'
import App from './App.jsx'

// sem StrictMode: a cena 3D é criada uma vez só (o modo estrito montaria dois renderizadores no mesmo canvas)
createRoot(document.getElementById('raiz')).render(<App />)
