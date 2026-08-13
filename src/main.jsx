import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react'
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
      ['Adres inwestycji','Mikołów, Fabryczna 11','ifc','Adres_inwestycji','{{1_3_Lokalizacja}}'],
      ['Działka','Do uzupełnienia','missing','Nr_działki','{{Nr_działki}}'],
      ['Inwestor','Do uzupełnienia','missing','Inwestor','{{Inwestor}}'],
      ['Projektant architektury','Do uzupełnienia','missing','Architekt','{{Architekt}}']]}]},
  {id:'pzt',label:'PZT',title:'Projekt zagospodarowania terenu',groups:[
    {name:'Teren i stan istniejący',fields:[
      ['Opis stanu istniejącego','Do uzupełnienia','missing','PZT_stan_istniejący','{{PZT_stan_istniejący}}'],
      ['Powierzchnia działki','Do uzupełnienia','missing','Pow_działki','{{PZT_powierzchnie}}'],
      ['Lokalizacja modelu','50.1711725°N, 18.8873064°E','ifc','1_3_Lokalizacja','{{1_3_Lokalizacja}}']]},
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

const ENERGY_STEPS=[
 {id:'building',label:'1 · Dane budynku'},
 {id:'envelope',label:'2 · Przegrody'},
 {id:'systems',label:'3 · Systemy'},
 {id:'results',label:'4 · Wyniki'},
 {id:'report',label:'5 · Raport'}
]
const ENERGY_FIELDS={
 building:[
  {id:'buildingType',label:'Rodzaj budynku',value:'Budynek usługowy',source:'manual'},
  {id:'scope',label:'Całość / część budynku',value:'Całość budynku',source:'manual'},
  {id:'heatedArea',label:'Powierzchnia ogrzewana Af',value:'13.03',unit:'m²',source:'ifc'},
  {id:'heatedVolume',label:'Kubatura ogrzewana Ve',value:'50.61',unit:'m³',source:'ifc'},
  {id:'indoorTemp',label:'Temperatura obliczeniowa',value:'21',unit:'°C',source:'assumption'},
  {id:'climateStation',label:'Stacja klimatyczna',value:'Katowice',source:'manual'}
 ],
 envelope:[
  {id:'wallArea',label:'Ściany zewnętrzne netto',value:'59.72',unit:'m²',source:'ifc'},
  {id:'wallU',label:'Współczynnik U ścian',value:'0.18',unit:'W/(m²K)',source:'assumption'},
  {id:'roofArea',label:'Dach / stropodach',value:'30.22',unit:'m²',source:'ifc'},
  {id:'roofU',label:'Współczynnik U dachu',value:'0.15',unit:'W/(m²K)',source:'assumption'},
  {id:'floorArea',label:'Podłoga na gruncie / strop',value:'14.45',unit:'m²',source:'ifc'},
  {id:'floorU',label:'Współczynnik U podłogi',value:'0.25',unit:'W/(m²K)',source:'assumption'},
  {id:'windowArea',label:'Powierzchnia okien',value:'',unit:'m²',source:'missing'},
  {id:'windowU',label:'Współczynnik Uw okien',value:'0.90',unit:'W/(m²K)',source:'assumption'},
  {id:'solarG',label:'Współczynnik przepuszczalności g',value:'0.75',source:'assumption'},
  {id:'doorArea',label:'Powierzchnia drzwi zewnętrznych',value:'',unit:'m²',source:'missing'},
  {id:'doorU',label:'Współczynnik Ud drzwi',value:'1.30',unit:'W/(m²K)',source:'assumption'},
  {id:'thermalBridges',label:'Mostki cieplne',value:'Dodatek 5%',source:'assumption'}
 ],
 systems:[
  {id:'heatingSystem',label:'System ogrzewania',value:'Pompa ciepła powietrze/woda',source:'assumption'},
  {id:'energyCarrier',label:'Nośnik energii',value:'Energia elektryczna',source:'manual'},
  {id:'heatingGeneration',label:'Sprawność wytwarzania ηH,g',value:'2.60',source:'assumption'},
  {id:'heatingDistribution',label:'Sprawność dystrybucji ηH,d',value:'1.00',source:'assumption'},
  {id:'heatingControl',label:'Sprawność regulacji ηH,e',value:'0.76',source:'assumption'},
  {id:'ventilationType',label:'Typ wentylacji',value:'Wentylacja mechaniczna',source:'manual'},
  {id:'airFlow',label:'Strumień powietrza',value:'',unit:'m³/h',source:'missing'},
  {id:'heatRecovery',label:'Odzysk ciepła ηOC',value:'80',unit:'%',source:'assumption'},
  {id:'dhwSystem',label:'System przygotowania c.w.u.',value:'Pompa ciepła',source:'assumption'},
  {id:'dhwEfficiency',label:'Sprawność c.w.u. ηW,tot',value:'2.60',source:'assumption'},
  {id:'coolingSystem',label:'Instalacja chłodzenia',value:'Brak',source:'manual'},
  {id:'primaryFactor',label:'Współczynnik nakładu wi',value:'3.00',source:'assumption'}
 ],
 results:[
  {id:'htr',label:'Straty przez przenikanie Htr',value:'',unit:'W/K',source:'result'},
  {id:'hve',label:'Straty wentylacyjne Hve',value:'',unit:'W/K',source:'result'},
  {id:'euHeating',label:'EU - ogrzewanie i wentylacja',value:'',unit:'kWh/(m²·rok)',source:'result'},
  {id:'euDhw',label:'EU - ciepła woda',value:'',unit:'kWh/(m²·rok)',source:'result'},
  {id:'ek',label:'Energia końcowa EK',value:'',unit:'kWh/(m²·rok)',source:'result'},
  {id:'ep',label:'Energia pierwotna EP',value:'',unit:'kWh/(m²·rok)',source:'result'},
  {id:'epMax',label:'Wymaganie WT2021 EPmax',value:'70.00',unit:'kWh/(m²·rok)',source:'manual'},
  {id:'co2',label:'Jednostkowa emisja CO₂',value:'',unit:'t CO₂/(m²·rok)',source:'result'},
  {id:'renewableShare',label:'Udział OZE',value:'',unit:'%',source:'result'}
 ]
}
function EnergyWorkspace({values,onChange}){
 const [step,setStep]=useState('building')
 const fields=ENERGY_FIELDS[step]||[]
 const resolved=Object.values(values).filter(v=>String(v).trim()).length,total=Object.values(ENERGY_FIELDS).flat().length
 const exportEnergy=()=>{const payload={format:'Projektowana charakterystyka energetyczna',version:1,generatedAt:new Date().toISOString(),values};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='dane-charakterystyki-energetycznej.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 return <div className="energy-workspace">
  <div className="energy-intro"><div><span>CEL MODUŁU</span><b>Projektowana charakterystyka energetyczna wg IFC</b><p>IFC dostarcza geometrię i powierzchnie. Założenia projektowe uzupełniasz tutaj. Wyniki zostaną obliczone w kolejnym etapie.</p></div><strong>{resolved}<small> / {total}</small></strong></div>
  <nav className="energy-steps">{ENERGY_STEPS.map(item=><button key={item.id} className={step===item.id?'on':''} onClick={()=>setStep(item.id)}>{item.label}</button>)}</nav>
  {step!=='report'?<div className="energy-fields">{fields.map(field=>{const value=values[field.id]??field.value,editable=!['ifc','result'].includes(field.source);return <label key={field.id} className={'energy-field '+field.source}><span>{field.label}<i>{labels[field.source]||'DANE'}</i></span><div><input value={value} readOnly={!editable} placeholder={field.source==='result'?'Po uruchomieniu obliczeń':'Uzupełnij'} onChange={e=>onChange(field.id,e.target.value)}/>{field.unit&&<em>{field.unit}</em>}</div>{field.source==='ifc'&&<small>Odczyt z modelu IFC</small>}{field.source==='result'&&<small>Wynik obliczeniowy - pole tylko do odczytu</small>}</label>})}</div>:
  <div className="energy-report-card"><div className="report-head"><span>KARTA UPROSZCZONA</span><h3>Projektowana charakterystyka energetyczna</h3><p>{values.buildingType||'Rodzaj budynku do uzupełnienia'} · Af {values.heatedArea||'—'} m² · Ve {values.heatedVolume||'—'} m³</p></div><div className="report-kpis">{[['EU',values.euHeating],['EK',values.ek],['EP',values.ep],['EPmax',values.epMax]].map(([k,v])=><div key={k}><span>{k}</span><b>{v||'—'}</b><small>kWh/(m²·rok)</small></div>)}</div><div className="report-readiness"><b>Gotowość danych: {resolved}/{total}</b><p>Pełny raport będzie obejmował przegrody, stolarkę, systemy ogrzewania, wentylacji i c.w.u., wyniki EU/EK/EP oraz analizę wariantu alternatywnego - zgodnie ze wzorcem BuildDesk.</p></div><div className="report-actions"><button onClick={exportEnergy}>Eksportuj dane raportu</button><button onClick={()=>window.print()}>Drukuj kartę uproszczoną</button></div></div>}
 </div>
}

function Field({f}){return <div className="mapping-field"><div><span>{f[0]}</span><b className={f[2]}>{f[1]}</b></div><i className={f[2]}>{labels[f[2]]}</i><small>BAZA → {f[3]}</small><code>{f[4]}</code></div>}
function App(){
 const [selectedIfc,setSelectedIfc]=useState(null),[ifcState,setIfcState]=useState({status:'Oczekiwanie na model',error:null,meshes:0}),[tab,setTab]=useState('main'),[sectionPlane,setSectionPlane]=useState({mode:'off',position:3.2}),[viewMode,setViewMode]=useState('model'),[siteRotation,setSiteRotation]=useState(0),[gps,setGps]=useState({lat:'50.1711725338',lon:'18.8873064393'}),[geoLayers,setGeoLayers]=useState({ortho:false,egib:true,gesut:false,bdot:false}),[parcel,setParcel]=useState(null),[geoLoading,setGeoLoading]=useState(false),[geoReload,setGeoReload]=useState(0),[mapSize,setMapSize]=useState(250),[solar,setSolar]=useState({date:'03-21',hour:12,all:false}),[topViewSignal,setTopViewSignal]=useState(0),[siteOffset,setSiteOffset]=useState({x:0,y:0}),[energyValues,setEnergyValues]=useState(()=>Object.fromEntries(Object.values(ENERGY_FIELDS).flat().map(f=>[f.id,f.value])))
 const canvasRef=useRef(null)
 const handleIfcState=useCallback(u=>setIfcState(p=>({...p,...u})),[])
 const sunPosition=useMemo(()=>{const offset=solar.date==='03-21'?'+01:00':'+02:00',date=new Date(`2026-${solar.date}T${String(solar.hour).padStart(2,'0')}:00:00${offset}`);return SunCalc.getPosition(date,Number(gps.lat)||52.25,Number(gps.lon)||21)},[solar.date,solar.hour,gps.lat,gps.lon])
 const current=TABS.find(t=>t.id===tab)
 const all=useMemo(()=>TABS.flatMap(t=>t.groups.flatMap(g=>g.fields)),[])
 const ready=all.filter(f=>!['missing'].includes(f[2])).length
 const loadGeoportal=async()=>{setGeoLoading(true);setGeoReload(v=>v+1);try{const response=await fetch(`/api/geoportal?type=parcel&lat=${encodeURIComponent(gps.lat)}&lon=${encodeURIComponent(gps.lon)}&size=${mapSize}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'Błąd Geoportalu');setParcel(data)}catch(error){setParcel({error:error.message})}finally{setGeoLoading(false)}}
 const exportRecord=()=>{const data=Object.fromEntries(all.filter(f=>f[2]!=='missing').map(f=>[f[3],f[1]]));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({sheet:'BAZA',data},null,2)],{type:'application/json'}));a.download='ifc-baza-mapowanie.json';a.click();URL.revokeObjectURL(a.href)}
 const saveViewPng=()=>{const state=canvasRef.current;if(!state)return;state.gl.render(state.scene,state.camera);state.gl.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pzt-cienie-${solar.date}-${String(solar.hour).padStart(2,'0')}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')}
 return <main className="bim-mode data-hub"><header><div><span className="eyebrow">OPEN BIM · IFC4 · DANE PROJEKTOWE</span><h1>IFC <em>Data Hub</em></h1></div><div className="project-meta"><span>TEST3.IFC</span><b>{ready}/{all.length} pól gotowych</b></div></header>
 <section className="stage"><Canvas shadows dpr={[1,1.75]} camera={{position:[11,8,14],fov:46}} gl={{antialias:true,stencil:true,preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping}} onCreated={({gl,scene,camera})=>{gl.localClippingEnabled=true;canvasRef.current={gl,scene,camera}}}><color attach="background" args={['#f4f6f7']}/><Suspense fallback={null}><IfcViewer selectedId={selectedIfc?.id} onSelect={setSelectedIfc} onState={handleIfcState} sectionPlane={sectionPlane} viewMode={viewMode} siteRotation={siteRotation} gps={gps} geoLayers={geoLayers} geoReload={geoReload} parcel={parcel} solar={solar} mapSize={mapSize} topViewSignal={topViewSignal} siteOffset={siteOffset}/></Suspense></Canvas>
 <div className="status"><i className={!ifcState.error?'live':''}/>{ifcState.status}</div>
 <div className="view-switch"><button className={viewMode==='model'?'on':''} onClick={()=>setViewMode('model')}>Model IFC</button><button className={viewMode==='site'?'on':''} onClick={()=>{setViewMode('site');setSectionPlane(p=>({...p,mode:'off'}))}}>Zagospodarowanie</button></div>
 {viewMode==='site'?<div className="site-tool"><span>PUNKT ODNIESIENIA · 0,0,0</span><div className="gps-fields"><label><b>Szerokość GPS</b><input value={gps.lat} onChange={e=>setGps(p=>({...p,lat:e.target.value}))}/></label><label><b>Długość GPS</b><input value={gps.lon} onChange={e=>setGps(p=>({...p,lon:e.target.value}))}/></label></div><small>Wpisany punkt = oś modelu IFC 0,0,0 · scena i mapa pracują w metrach · jednostka IFC jest wykrywana automatycznie.</small><label className="map-size-field"><b>Rozmiar mapy</b><select value={mapSize} onChange={e=>{setMapSize(Number(e.target.value));setGeoReload(v=>v+1)}}>{[100,250,500,1000].map(v=><option key={v} value={v}>{v} × {v} m</option>)}</select></label><button className="geo-fetch" onClick={loadGeoportal}>{geoLoading?'Pobieranie…':'Pobierz dane Geoportalu'}</button><div className="layer-toggles">{[['ortho','Ortofotomapa'],['egib','Granice i budynki'],['gesut','Sieci uzbrojenia'],['bdot','Mapa topograficzna']].map(([key,label])=><button key={key} className={geoLayers[key]?'on':''} onClick={()=>setGeoLayers(p=>({...p,[key]:!p[key]}))}>{label}</button>)}</div><div className="solar-analysis"><span>ANALIZA ZACIENIANIA · 7:00–17:00</span><div className="date-switch"><button className={solar.date==='03-21'?'on':''} onClick={()=>setSolar(p=>({...p,date:'03-21'}))}>21 marca</button><button className={solar.date==='09-21'?'on':''} onClick={()=>setSolar(p=>({...p,date:'09-21'}))}>21 września</button></div><label><b>Godzina lokalna</b><input type="range" min="7" max="17" step="1" value={solar.hour} onChange={e=>setSolar(p=>({...p,hour:Number(e.target.value),all:false}))}/><output>{String(solar.hour).padStart(2,'0')}:00</output></label><div className="sun-metrics"><div><span>Wysokość</span><b>{THREE.MathUtils.radToDeg(sunPosition.altitude).toFixed(1)}°</b></div><div><span>Azymut</span><b>{((THREE.MathUtils.radToDeg(sunPosition.azimuth)+180)%360).toFixed(1)}°</b></div><div><span>Czas</span><b>{solar.date==='03-21'?'CET · UTC+1':'CEST · UTC+2'}</b></div></div><button className={solar.all?'all-shadows on':'all-shadows'} onClick={()=>setSolar(p=>({...p,all:!p.all}))}>{solar.all?'Wyłącz sumę cieni':'Pokaż cienie 7–17'}</button><div className="shadow-view-actions"><button onClick={()=>setTopViewSignal(v=>v+1)}>Widok z góry · N↑</button><button onClick={saveViewPng}>Zapisz widok do PNG</button></div><div className="map-offset-controls"><span>PRZESUNIĘCIE MAPY · UKŁAD WSCHÓD–PÓŁNOC</span><label><b>X · wschód (+)</b><input type="range" min={-mapSize/2} max={mapSize/2} step="0.1" value={siteOffset.x} onChange={e=>setSiteOffset(p=>({...p,x:Number(e.target.value)}))}/><output>{siteOffset.x.toFixed(2)} m</output></label><label><b>Y · północ (+)</b><input type="range" min={-mapSize/2} max={mapSize/2} step="0.1" value={siteOffset.y} onChange={e=>setSiteOffset(p=>({...p,y:Number(e.target.value)}))}/><output>{siteOffset.y.toFixed(2)} m</output></label><button onClick={()=>setSiteOffset({x:0,y:0})}>Wyzeruj przesunięcie</button></div></div>{parcel&&<div className={'parcel-result '+(parcel.error?'error':'')}><b>{parcel.error?'Błąd pobierania':parcel.id||'Działka odnaleziona'}</b>{!parcel.error&&<><span>Nr {parcel.parcel||'—'} · obręb {parcel.region||'—'}</span><small>{[parcel.commune,parcel.county,parcel.voivodeship].filter(Boolean).join(' · ')}</small></>}</div>}<label className="rotation-field"><b>Obrót mapy i PZT</b><input type="range" min="-180" max="180" step="1" value={siteRotation} onChange={e=>setSiteRotation(Number(e.target.value))}/><output>{siteRotation}°</output></label><button className="north-reset" onClick={()=>setSiteRotation(0)}>Ustaw północ · 0°</button></div>:<div className="section-tool"><span>PRZEKRÓJ MODELU</span><div><button className={sectionPlane.mode==='off'?'on':''} onClick={()=>setSectionPlane(p=>({...p,mode:'off'}))}>Wył.</button><button className={sectionPlane.mode==='horizontal'?'on':''} onClick={()=>setSectionPlane({mode:'horizontal',position:3.2})}>Poziomy</button><button className={sectionPlane.mode==='vertical-x'?'on':''} onClick={()=>setSectionPlane({mode:'vertical-x',position:0})}>Pionowy X</button><button className={sectionPlane.mode==='vertical-z'?'on':''} onClick={()=>setSectionPlane({mode:'vertical-z',position:0})}>Pionowy Z</button></div>{sectionPlane.mode!=='off'&&<label><b>Położenie płaszczyzny</b><input type="range" min={sectionPlane.mode==='horizontal'?0:-4.5} max={sectionPlane.mode==='horizontal'?7.2:4.5} step="0.05" value={sectionPlane.position} onChange={e=>setSectionPlane(p=>({...p,position:Number(e.target.value)}))}/><output>{sectionPlane.position.toFixed(2)} m</output></label>}</div>}
 <aside className="panel workflow-panel"><div className="workflow-head"><div><span className="section-kicker">{tab==='energy'?'IFC → ENERGIA → RAPORT':'STRUKTURA DANYCH I EKSPORTU'}</span><h2>{tab==='export'?'Eksport do bazy':tab==='structure'?'Struktura inwestycji':current.title}</h2></div><span className="sheet-target">{tab==='energy'?'ENERGIA':'BAZA'}</span></div>
 <nav className="workflow-tabs">{['main','pzt','energy','pab','pt','bioz'].map(id=>TABS.find(t=>t.id===id)).map(t=><button key={t.id} className={(tab===t.id?'on ':'')+(t.id==='energy'?'energy-focus':'')} onClick={()=>setTab(t.id)}>{t.label}</button>)}<button className={(tab==='structure'?'on ':'')+'secondary'} onClick={()=>setTab('structure')}>Struktura</button><button className={(tab==='export'?'on ':'')+'secondary'} onClick={()=>setTab('export')}>Eksport</button></nav>
 {tab==='structure'?<ProjectStructure/>:tab==='energy'?<EnergyWorkspace values={energyValues} onChange={(id,value)=>setEnergyValues(p=>({...p,[id]:value}))}/>:tab!=='export'?<div className="workflow-content">{current.groups.map(g=><section className="field-group" key={g.name}><h3>{g.name}</h3>{g.fields.map(f=><Field key={f[0]} f={f}/>)}</section>)}
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
