import React, { Suspense, useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import SunCalc from 'suncalc'
import IfcViewer from './IfcViewer'
import './styles.css'

const DOCS = {
  PZT:'https://docs.google.com/document/d/17_4ZzpK7R7HkMVMnzdjrfDmoINkTMiyJHhrU-O1Q6DU/edit',
  PAB:'https://docs.google.com/document/d/1d1F1I-s54vIjGQwC2HjpGiYLBOT6VTwsFDr81EIOKR0/edit',
  BIOZ:'https://docs.google.com/document/d/1cikGKfOe-fH-ge4VeoXDEyTQxLKJlOhkAMZQlu7kGoY/edit',
  PT:'https://docs.google.com/document/d/1YwgFZ_Ydto9vjm3DGMSexHQ-RJGVxMDACWaYj_vBfWM/edit',
  BAZA:'https://docs.google.com/spreadsheets/d/16MuYeBk5MTCJI1rqyw40sKphVpcdHUs70Tf0q9v7Kqw/edit'
}
const TABS = [
  {id:'main',label:'Projekt',title:'Dane główne',groups:[
    {name:'Identyfikacja',fields:[
      ['Tytuł opracowania','Budynek usługowy — model roboczy','manual','tytuł','{{tytuł}}'],
      ['Numer projektu','MIK/05/21','ifc','NAZWA','—'],
      ['Faza projektu','PROJEKT BUDOWLANY','ifc','BLOCK_Strona_tytyłowa','{{BLOCK_Strona_tytyłowa}}'],
      ['Data opracowania','01.09.2021','ifc','Data_PB','{{Data_PB}}']]},
    {name:'Lokalizacja i strony',fields:[
      ['Adres inwestycji','Warszawa, Polska','ifc','Adres_inwestycji','{{1_3_Lokalizacja}}'],
      ['Działka','Do uzupełnienia','missing','Nr_działki','{{Nr_działki}}'],
      ['Inwestor','Do uzupełnienia','missing','Inwestor','{{Inwestor}}'],
      ['Projektant architektury','Do uzupełnienia','missing','Architekt','{{Architekt}}']]}]},
  {id:'pzt',label:'PZT',title:'Projekt zagospodarowania terenu',groups:[
    {name:'Teren i stan istniejący',fields:[
      ['Opis stanu istniejącego','Do uzupełnienia','missing','PZT_stan_istniejący','{{PZT_stan_istniejący}}'],
      ['Powierzchnia działki','Do uzupełnienia','missing','Pow_działki','{{PZT_powierzchnie}}'],
      ['Lokalizacja modelu','52°15′N, 21°00′E','ifc','1_3_Lokalizacja','{{1_3_Lokalizacja}}']]},
    {name:'Bilans i infrastruktura',fields:[
      ['Powierzchnia zabudowy','Do wyliczenia z pełnego modelu','derived','Pow_zabudowy','{{PZT_powierzchnie}}'],
      ['Powierzchnia utwardzona','Do uzupełnienia','missing','Pow_utwardzona','{{PZT_powierzchnie}}'],
      ['Powierzchnia biologicznie czynna','Do uzupełnienia','missing','Pow_biol_czynna','{{PZT_powierzchnie}}'],
      ['Media / warunki techniczne','Do uzupełnienia','missing','WT_media','{{Uzbrojenie_terenu}}'],
      ['MPZP / WZ','Do uzupełnienia','missing','__MPZP','{{__MPZP}}']]}]},
  {id:'pab',label:'PAB',title:'Projekt architektoniczno-budowlany',groups:[
    {name:'Parametry z modelu',fields:[
      ['Powierzchnia ogrzewana','13,03 m²','ifc','Pow_użytkowa','{{_Nazwy_pow_bud}}'],
      ['Kubatura ogrzewana','50,61 m³','ifc','Kubatura','{{_BUD_A}}'],
      ['Liczba kondygnacji','2','ifc','Kondygnacje','{{_AL}}'],
      ['Dach','30,22 m²','ifc','Pow_dachu','{{_BUD_A}}']]},
    {name:'Przegrody i rozwiązania',fields:[
      ['Ściany zewnętrzne netto','59,72 m²','ifc','Ściany_zewnętrzne','{{Konstrukcja}}'],
      ['Podłoga / strop','14,45 m²','ifc','Stropy','{{Konstrukcja}}'],
      ['Izolacyjność przegród','Założenia robocze','assumption','Izolacja_termiczna','{{Izolacja_termiczna}}'],
      ['Instalacje wewnętrzne','Do uzupełnienia','missing','Instalacje','{{4_SKŁAD}}'],
      ['Ochrona przeciwpożarowa','Do uzupełnienia','missing','Ochr_poz','{{PAB_poz}}']]}]},
  {id:'pt',label:'PT',title:'Projekt techniczny',groups:[
    {name:'Konstrukcja',fields:[
      ['Układ konstrukcyjny','Do uzupełnienia','missing','PT_Konstrukcja','{{Konstrukcja}}'],
      ['Fundamentowanie','Do uzupełnienia','missing','PT_Fundamenty','{{Fundamenty}}'],
      ['Styki ściana–strop','Brak relacji IFC','assumption','PT_Styki','{{Rozwiązania_konstrukcyjne}}']]},
    {name:'Instalacje i charakterystyka',fields:[
      ['Temperatura obliczeniowa','21°C','ifc','Temp_wewnętrzna','{{Instalacje}}'],
      ['Źródło ciepła','Pompa ciepła — założenie','assumption','Źródło_ciepła','{{Instalacje}}'],
      ['Wentylacja','Rekuperacja 80% — założenie','assumption','Wentylacja','{{Instalacje}}'],
      ['EP — wynik roboczy','174,5 kWh/(m²·rok)','derived','EP','{{Charakterystyka_energetyczna}}']]}]},
  {id:'energy',label:'Energia',title:'Charakterystyka energetyczna',groups:[
    {name:'Wyniki obliczeń — wariant roboczy',fields:[
      ['EP — energia pierwotna','174,5 kWh/(m²·rok)','derived','EP','{{EP}}'],
      ['EK — energia końcowa','69,8 kWh/(m²·rok)','derived','EK','{{EK}}'],
      ['EU — ogrzewanie','158,6 kWh/(m²·rok)','derived','EU_ogrzewanie','{{EU_ogrzewanie}}'],
      ['Projektowa moc cieplna','1,07 kW','derived','Moc_cieplna','{{Moc_cieplna}}']]},
    {name:'Przegrody termiczne',fields:[
      ['Ściana zewnętrzna U','0,18 W/(m²K)','assumption','U_ściana','{{U_ściana}}'],
      ['Dach U','0,15 W/(m²K)','assumption','U_dach','{{U_dach}}'],
      ['Podłoga U','0,25 W/(m²K)','assumption','U_podłoga','{{U_podłoga}}'],
      ['Okno Uw','0,90 W/(m²K)','assumption','Uw_okno','{{Uw_okno}}'],
      ['Drzwi Ud','1,30 W/(m²K)','assumption','Ud_drzwi','{{Ud_drzwi}}']]},
    {name:'Dane modelu i instalacje',fields:[
      ['Powierzchnia ogrzewana','13,03 m²','ifc','Af','{{Pow_ogrzewana}}'],
      ['Kubatura ogrzewana','50,61 m³','ifc','Ve','{{Kubatura_ogrzewana}}'],
      ['Temperatura wewnętrzna','21°C','ifc','Theta_int','{{Temp_wewnętrzna}}'],
      ['Źródło ogrzewania','Pompa ciepła — założenie','assumption','System_ogrzewania','{{Źródło_ciepła}}'],
      ['Sprawność odzysku ciepła','80% — założenie','assumption','Rekuperacja','{{Rekuperacja}}'],
      ['Mostki cieplne','Dodatek 5% — założenie','assumption','Mostki_cieplne','{{Mostki_cieplne}}']]}]},
  {id:'bioz',label:'BIOZ',title:'Informacja BIOZ',groups:[
    {name:'Zakres informacji',fields:[
      ['Kolejność robót','Do uzupełnienia','missing','BIOZ_kolejność','{{Kolejność_robót}}'],
      ['Istniejące obiekty','Do uzupełnienia','missing','BIOZ_obiekty','{{Istniejące_obiekty}}'],
      ['Elementy zagrożenia','Do uzupełnienia','missing','BIOZ_zagrożenia','{{Elementy_zagrożenia}}'],
      ['Roboty niebezpieczne','Do uzupełnienia','missing','BIOZ_roboty','{{Roboty_niebezpieczne}}'],
      ['Instruktaż pracowników','Do uzupełnienia','missing','BIOZ_instruktaż','{{Instruktaż}}'],
      ['Środki bezpieczeństwa','Do uzupełnienia','missing','BIOZ_środki','{{Środki_techniczne}}']]}]}
]
const labels={ifc:'IFC',derived:'WYLICZONE',manual:'RĘCZNE',assumption:'ZAŁOŻENIE',missing:'BRAK'}

function ProjectStructure(){
 const rows=[
  {type:'ZLECENIE',name:'Zlecenie 01 · Projekt budowlany',meta:'Aktywne · zakres PZT + PAB + PT',level:0,status:'active'},
  {type:'ETAP',name:'Etap I',meta:'Model roboczy · 2021',level:1,status:'active'},
  {type:'BUDYNEK',name:'Budynek A · usługowy',meta:'IFC · 2 kondygnacje · 13,03 m²',level:2,status:'ifc'},
  {type:'DZIAŁKA',name:'Działka — do przypisania',meta:'Brak numeru ewidencyjnego',level:2,status:'missing'},
  {type:'DOKUMENTY',name:'Dokumenty źródłowe',meta:'Mapa · MPZP · przyłącza · geotechnika',level:1,status:'missing'},
  {type:'PUBLIKACJE',name:'PZT · PAB · PT · BIOZ',meta:'Brak zatwierdzonego wydania',level:1,status:'draft'}]
 return <div className="structure-view">
  <div className="identity-card"><span>IDENTYFIKATOR INWESTYCJI</span><strong>PRJ-MIK-05-21</strong><small>IfcProject.GlobalId + numer projektu</small><i>Pewne dopasowanie</i></div>
  <div className="structure-actions"><button>＋ Zlecenie</button><button>＋ Etap</button><button>＋ Obiekt</button><button>＋ Działka</button></div>
  <span className="data-title">STRUKTURA BIEŻĄCEGO PROJEKTU</span>
  <div className="structure-tree">{rows.map((r,i)=><div key={r.type+i} className={'tree-row '+r.status} style={{'--level':r.level}}><i/><div><span>{r.type}</span><b>{r.name}</b><small>{r.meta}</small></div><em>›</em></div>)}</div>
  <div className="import-match"><div><span>KOLEJNY IMPORT IFC</span><b>Najpierw wyszukaj istniejący projekt</b></div><ol><li>Project ID</li><li>IfcProject.GlobalId</li><li>Numer + adres + działki</li></ol><p>Zmiany geometrii zostaną porównane. Dane ręczne i zatwierdzone nie będą nadpisywane.</p></div>
 </div>
}

function Field({f}){return <div className="mapping-field"><div><span>{f[0]}</span><b className={f[2]}>{f[1]}</b></div><i className={f[2]}>{labels[f[2]]}</i><small>BAZA → {f[3]}</small><code>{f[4]}</code></div>}
function App(){
 const [selectedIfc,setSelectedIfc]=useState(null),[ifcState,setIfcState]=useState({status:'Oczekiwanie na model',error:null,meshes:0}),[tab,setTab]=useState('main'),[sectionPlane,setSectionPlane]=useState({mode:'off',position:3.2}),[viewMode,setViewMode]=useState('model'),[siteRotation,setSiteRotation]=useState(0),[gps,setGps]=useState({lat:'52.250000',lon:'21.000000'}),[geoLayers,setGeoLayers]=useState({ortho:true,egib:true,utilities:false,mpzp:false}),[parcel,setParcel]=useState(null),[geoLoading,setGeoLoading]=useState(false),[geoReload,setGeoReload]=useState(0),[mapSize,setMapSize]=useState(250),[solar,setSolar]=useState({date:'03-21',hour:12,all:false})
 const handleIfcState=useCallback(u=>setIfcState(p=>({...p,...u})),[])
 const sunPosition=useMemo(()=>{const offset=solar.date==='03-21'?'+01:00':'+02:00',date=new Date(`2026-${solar.date}T${String(solar.hour).padStart(2,'0')}:00:00${offset}`);return SunCalc.getPosition(date,Number(gps.lat)||52.25,Number(gps.lon)||21)},[solar.date,solar.hour,gps.lat,gps.lon])
 const current=TABS.find(t=>t.id===tab)
 const all=useMemo(()=>TABS.flatMap(t=>t.groups.flatMap(g=>g.fields)),[])
 const ready=all.filter(f=>!['missing'].includes(f[2])).length
 const loadGeoportal=async()=>{setGeoLoading(true);setGeoReload(v=>v+1);try{const response=await fetch(`/api/geoportal?type=parcel&lat=${encodeURIComponent(gps.lat)}&lon=${encodeURIComponent(gps.lon)}&size=${mapSize}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'Błąd Geoportalu');setParcel(data)}catch(error){setParcel({error:error.message})}finally{setGeoLoading(false)}}
 const exportRecord=()=>{const data=Object.fromEntries(all.filter(f=>f[2]!=='missing').map(f=>[f[3],f[1]]));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({sheet:'BAZA',data},null,2)],{type:'application/json'}));a.download='ifc-baza-mapowanie.json';a.click();URL.revokeObjectURL(a.href)}
 return <main className="bim-mode data-hub"><header><div><span className="eyebrow">OPEN BIM · IFC4 · DANE PROJEKTOWE</span><h1>IFC <em>Data Hub</em></h1></div><div className="project-meta"><span>TEST3.IFC</span><b>{ready}/{all.length} pól gotowych</b></div></header>
 <section className="stage"><Canvas shadows dpr={[1,1.75]} camera={{position:[11,8,14],fov:46}} gl={{antialias:true,stencil:true,toneMapping:THREE.ACESFilmicToneMapping}} onCreated={({gl})=>{gl.localClippingEnabled=true}}><color attach="background" args={['#f4f6f7']}/><Suspense fallback={null}><IfcViewer selectedId={selectedIfc?.id} onSelect={setSelectedIfc} onState={handleIfcState} sectionPlane={sectionPlane} viewMode={viewMode} siteRotation={siteRotation} gps={gps} geoLayers={geoLayers} geoReload={geoReload} parcel={parcel} solar={solar} mapSize={mapSize}/></Suspense></Canvas>
 <div className="status"><i className={!ifcState.error?'live':''}/>{ifcState.status}</div>
 <div className="view-switch"><button className={viewMode==='model'?'on':''} onClick={()=>setViewMode('model')}>Model IFC</button><button className={viewMode==='site'?'on':''} onClick={()=>{setViewMode('site');setSectionPlane(p=>({...p,mode:'off'}))}}>Zagospodarowanie</button></div>
 {viewMode==='site'?<div className="site-tool"><span>PUNKT ODNIESIENIA · 0,0,0</span><div className="gps-fields"><label><b>Szerokość GPS</b><input value={gps.lat} onChange={e=>setGps(p=>({...p,lat:e.target.value}))}/></label><label><b>Długość GPS</b><input value={gps.lon} onChange={e=>setGps(p=>({...p,lon:e.target.value}))}/></label></div><small>Wpisany punkt = oś modelu IFC 0,0,0 · scena i mapa pracują w metrach · jednostka IFC jest wykrywana automatycznie.</small><label className="map-size-field"><b>Rozmiar mapy</b><select value={mapSize} onChange={e=>{setMapSize(Number(e.target.value));setGeoReload(v=>v+1)}}>{[100,250,500,1000].map(v=><option key={v} value={v}>{v} × {v} m</option>)}</select></label><button className="geo-fetch" onClick={loadGeoportal}>{geoLoading?'Pobieranie…':'Pobierz dane Geoportalu'}</button><div className="layer-toggles">{[['ortho','Ortofoto'],['egib','Granica działki'],['utilities','Sieci'],['mpzp','MPZP']].map(([key,label])=><button key={key} className={geoLayers[key]?'on':''} onClick={()=>setGeoLayers(p=>({...p,[key]:!p[key]}))}>{label}</button>)}</div><div className="solar-analysis"><span>ANALIZA ZACIENIANIA · 7:00–17:00</span><div className="date-switch"><button className={solar.date==='03-21'?'on':''} onClick={()=>setSolar(p=>({...p,date:'03-21'}))}>21 marca</button><button className={solar.date==='09-21'?'on':''} onClick={()=>setSolar(p=>({...p,date:'09-21'}))}>21 września</button></div><label><b>Godzina lokalna</b><input type="range" min="7" max="17" step="1" value={solar.hour} onChange={e=>setSolar(p=>({...p,hour:Number(e.target.value),all:false}))}/><output>{String(solar.hour).padStart(2,'0')}:00</output></label><div className="sun-metrics"><div><span>Wysokość</span><b>{THREE.MathUtils.radToDeg(sunPosition.altitude).toFixed(1)}°</b></div><div><span>Azymut</span><b>{((THREE.MathUtils.radToDeg(sunPosition.azimuth)+180)%360).toFixed(1)}°</b></div><div><span>Czas</span><b>{solar.date==='03-21'?'CET · UTC+1':'CEST · UTC+2'}</b></div></div><button className={solar.all?'all-shadows on':'all-shadows'} onClick={()=>setSolar(p=>({...p,all:!p.all}))}>{solar.all?'Wyłącz sumę cieni':'Pokaż cienie 7–17'}</button></div>{parcel&&<div className={'parcel-result '+(parcel.error?'error':'')}><b>{parcel.error?'Błąd pobierania':parcel.id||'Działka odnaleziona'}</b>{!parcel.error&&<><span>Nr {parcel.parcel||'—'} · obręb {parcel.region||'—'}</span><small>{[parcel.commune,parcel.county,parcel.voivodeship].filter(Boolean).join(' · ')}</small></>}</div>}<label className="rotation-field"><b>Obrót mapy i PZT</b><input type="range" min="-180" max="180" step="1" value={siteRotation} onChange={e=>setSiteRotation(Number(e.target.value))}/><output>{siteRotation}°</output></label><button className="north-reset" onClick={()=>setSiteRotation(0)}>Ustaw północ · 0°</button></div>:<div className="section-tool"><span>PRZEKRÓJ MODELU</span><div><button className={sectionPlane.mode==='off'?'on':''} onClick={()=>setSectionPlane(p=>({...p,mode:'off'}))}>Wył.</button><button className={sectionPlane.mode==='horizontal'?'on':''} onClick={()=>setSectionPlane({mode:'horizontal',position:3.2})}>Poziomy</button><button className={sectionPlane.mode==='vertical-x'?'on':''} onClick={()=>setSectionPlane({mode:'vertical-x',position:0})}>Pionowy X</button><button className={sectionPlane.mode==='vertical-z'?'on':''} onClick={()=>setSectionPlane({mode:'vertical-z',position:0})}>Pionowy Z</button></div>{sectionPlane.mode!=='off'&&<label><b>Położenie płaszczyzny</b><input type="range" min={sectionPlane.mode==='horizontal'?0:-4.5} max={sectionPlane.mode==='horizontal'?7.2:4.5} step="0.05" value={sectionPlane.position} onChange={e=>setSectionPlane(p=>({...p,position:Number(e.target.value)}))}/><output>{sectionPlane.position.toFixed(2)} m</output></label>}</div>}
 <aside className="panel workflow-panel"><div className="workflow-head"><div><span className="section-kicker">STRUKTURA DANYCH I EKSPORTU</span><h2>{tab==='export'?'Eksport do bazy':tab==='structure'?'Struktura inwestycji':current.title}</h2></div><span className="sheet-target">BAZA</span></div>
 <nav className="workflow-tabs">{TABS.map(t=><button key={t.id} className={tab===t.id?'on':''} onClick={()=>setTab(t.id)}>{t.label}</button>)}<button className={tab==='structure'?'on':''} onClick={()=>setTab('structure')}>Struktura</button><button className={tab==='export'?'on':''} onClick={()=>setTab('export')}>Eksport</button></nav>
 {tab==='structure'?<ProjectStructure/>:tab!=='export'?<div className="workflow-content">{current.groups.map(g=><section className="field-group" key={g.name}><h3>{g.name}</h3>{g.fields.map(f=><Field key={f[0]} f={f}/>)}</section>)}
 <div className={'ifc-selection '+(selectedIfc?'selected':'')}><span className="data-title">WYBRANY ELEMENT MODELU</span>{selectedIfc?<><strong>{selectedIfc.name}</strong><span>{selectedIfc.type} · #{selectedIfc.id}</span><code>{selectedIfc.globalId}</code></>:<p>Kliknij element, aby powiązać go z polem dokumentacji.</p>}</div></div>:
 <div className="export-view"><div className="export-score"><span>GOTOWOŚĆ REKORDU BAZA</span><strong>{ready}<small> / {all.length} pól</small></strong><div><i style={{width:(ready/all.length*100)+'%'}}/></div><p>Eksport zawiera dane odczytane z IFC, wartości wyliczone, ręczne i jawne założenia. Brakujące pola pozostają do uzupełnienia.</p></div>
 <button className="export-button" onClick={exportRecord}>Pobierz mapowanie JSON</button><a className="sheet-link" href={DOCS.BAZA} target="_blank" rel="noreferrer">Otwórz arkusz „Baza danych” ↗</a>
 <span className="data-title doc-label">DOKUMENTY DOCELOWE</span><div className="doc-links">{['PZT','PAB','PT','BIOZ'].map(k=><a key={k} href={DOCS[k]} target="_blank" rel="noreferrer"><b>{k}</b><span>Szablon Google Docs</span><em>↗</em></a>)}</div>
 <div className="mapping-note"><b>Zasada mapowania</b><span>Jedno pole ma stały klucz kolumny w arkuszu BAZA oraz znacznik szablonu dokumentu. Dzięki temu ten sam rekord zasila dokumentację bez ponownego przepisywania.</span></div></div>}
 {ifcState.error&&<div className="ifc-error">{ifcState.error}</div>}</aside>
 <div className="legend"><span>Kliknij · wybór elementu</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span><span className="axis-legend"><i className="axis-z"/>Y · pion</span></div></section>
 <footer><span>WEB-IFC / THREE.JS · MODEL → BAZA → DOKUMENTY</span><span>Mapowanie zgodne z PZT · PAB · PT · BIOZ</span></footer></main>
}
createRoot(document.getElementById('root')).render(<App/>)
