import React, { Suspense, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import IfcViewer from './IfcViewer'
import './styles.css'

const IFC_DATA = {
  source: [
    ['Powierzchnia ogrzewana', '13,03 m²'],
    ['Kubatura ogrzewana', '50,61 m³'],
    ['Ściany zewnętrzne netto', '59,72 m²'],
    ['Dach', '30,22 m²'],
    ['Podłoga / strop', '14,45 m²'],
    ['Okno', '0,25 m²'],
    ['Drzwi', '1,95 m²']
  ],
  thermal: [
    ['Ściany', '0,18 W/(m²K)'],
    ['Dach', '0,15 W/(m²K)'],
    ['Podłoga', '0,25 W/(m²K)'],
    ['Okno Uw', '0,90 W/(m²K)'],
    ['Drzwi Ud', '1,30 W/(m²K)']
  ]
}

function DataRows({ rows }) {
  return <div className="data-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
}

function App() {
  const [selectedIfc,setSelectedIfc] = useState(null)
  const [ifcState,setIfcState] = useState({status:'Oczekiwanie na model',error:null,meshes:0})
  const [section,setSection] = useState('energy')
  const handleIfcState = useCallback(update => setIfcState(previous => ({...previous,...update})), [])
  return <main className="bim-mode">
    <header>
      <div><span className="eyebrow">OPEN BIM · IFC4 · ANALIZA PROJEKTU</span><h1>IFC <em>Building Lab</em></h1></div>
      <div className="project-meta"><span>TEST3.IFC</span><b>Model roboczy</b></div>
    </header>
    <section className="stage">
      <Canvas shadows dpr={[1,1.75]} camera={{position:[11,8,14],fov:46}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}>
        <color attach="background" args={['#0a1118']}/>
        <Suspense fallback={null}><IfcViewer selectedId={selectedIfc?.id} onSelect={setSelectedIfc} onState={handleIfcState}/></Suspense>
      </Canvas>
      <div className="status"><i className={!ifcState.error?'live':''}/>{ifcState.status}</div>
      <aside className="panel">
        <span className="section-kicker">DANE CHARAKTERYSTYCZNE IFC</span>
        <h2>Projekt w liczbach</h2>
        <div className="panel-tabs">
          <button className={section==='energy'?'on':''} onClick={()=>setSection('energy')}>Energia</button>
          <button className={section==='geometry'?'on':''} onClick={()=>setSection('geometry')}>Geometria</button>
          <button className={section==='audit'?'on':''} onClick={()=>setSection('audit')}>Styki</button>
        </div>
        {section==='energy'&&<>
          <div className="energy-hero"><span>EP · WYNIK ROBOCZY</span><strong>174,5</strong><b>kWh/(m²·rok)</b><small>Założenia: pompa ciepła + rekuperacja 80%</small></div>
          <div className="energy-metrics"><div><span>EU ogrzewanie</span><b>158,6</b></div><div><span>EK</span><b>69,8</b></div><div><span>Moc cieplna</span><b>1,07 kW</b></div></div>
          <span className="data-title">ZAŁOŻONE WSPÓŁCZYNNIKI U</span>
          <DataRows rows={IFC_DATA.thermal}/>
          <div className="assumption">Wartości U zapisane testowo w IFC są pomijane. Wyniki są poglądowe i dotyczą wyłącznie wyeksportowanej strefy 13,03 m².</div>
        </>}
        {section==='geometry'&&<>
          <div className="ifc-file"><div><b>IFC4</b><span>Reference View · Y jest osią pionową widoku</span></div><strong>{ifcState.meshes||'—'} siatek</strong></div>
          <DataRows rows={IFC_DATA.source}/>
          <div className="storeys"><span className="data-title">STRUKTURA</span><div><b>Strefa ogrzewana</b><span>21°C</span></div><div><b>Poziom 2</b><span>+4 000 mm</span></div><div><b>Poziom 1</b><span>±0 mm</span></div></div>
        </>}
        {section==='audit'&&<>
          <div className="audit-score"><span>TOPOLOGIA IFC</span><strong>Brak relacji styków</strong><p>Model nie zawiera IfcRelSpaceBoundary ani IfcRelConnectsElements.</p></div>
          <div className="audit-list"><div><i className="warn"/><span><b>Ściana–strop</b>Nakładanie brył prawdopodobne</span></div><div><i className="unknown"/><span><b>Ściana–dach</b>Styk wymaga kontroli geometrycznej</span></div><div><i className="ok"/><span><b>Otwory</b>2 relacje otwór–wypełnienie</span></div></div>
          <div className="assumption">Mostki cieplne są obecnie liczone jako jawny dodatek 5%. Nie są odczytywane z przypadkowych przecięć brył.</div>
        </>}
        <div className={'ifc-selection '+(selectedIfc?'selected':'')}>
          <span className="data-title">WYBRANY ELEMENT</span>
          {selectedIfc?<><strong>{selectedIfc.name}</strong><span>{selectedIfc.type} · #{selectedIfc.id}</span><code>{selectedIfc.globalId}</code></>:<p>Kliknij element, aby odczytać jego dane IFC.</p>}
        </div>
        {ifcState.error&&<div className="ifc-error">{ifcState.error}</div>}
      </aside>
      <div className="legend"><span>Kliknij · dane elementu</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span><span className="axis-legend"><i className="axis-z"/>Y · pion</span></div>
    </section>
    <footer><span>WEB-IFC / THREE.JS · UKŁAD WIDOKU THREE.JS · Y-UP</span><span>Dane energetyczne · wariant roboczy</span></footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>)
