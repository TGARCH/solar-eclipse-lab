import React, { Suspense, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei'
import * as THREE from 'three'
import './styles.css'

const AU_KM = 149597870.7
const EARTH_RADIUS_KM = 6371
const DAY = 86400
const PLANETS = [
  { name:'Merkury', radius:2439.7, au:.387, period:87.969, color:'#9f9b91' },
  { name:'Wenus', radius:6051.8, au:.723, period:224.701, color:'#d9ad72' },
  { name:'Ziemia', radius:6371, au:1, period:365.256, color:'#3f7ee8' },
  { name:'Mars', radius:3389.5, au:1.524, period:686.98, color:'#bd5537' },
  { name:'Jowisz', radius:69911, au:5.203, period:4332.59, color:'#d0a078' },
  { name:'Saturn', radius:58232, au:9.537, period:10759.22, color:'#d7c486' },
  { name:'Uran', radius:25362, au:19.191, period:30688.5, color:'#8ed5da' },
  { name:'Neptun', radius:24622, au:30.069, period:60182, color:'#4168d8' }
]
const SUN_RADIUS = 696340
const MOON_RADIUS = 1737.4
const MOON_DISTANCE = 384400

const distanceFor = (au, scale) => scale === 'astronomical' ? 3.25 + Math.log10(au / .387 + 1) * 17.2 : 3.5 + Math.pow(au, .42) * 4.35
const radiusFor = km => .105 + Math.pow(km / EARTH_RADIUS_KM, .48) * .16

function Orbit({ radius }) {
  const points = useMemo(() => Array.from({length:161}, (_,i) => {
    const a = i / 160 * Math.PI * 2
    return [Math.cos(a) * radius, 0, Math.sin(a) * radius]
  }), [radius])
  return <Line points={points} color="#26334b" transparent opacity={.62} lineWidth={1}/>
}

function Planet({ body, distance, running, speed, selected, select, earthCamera }) {
  const orbit = useRef()
  const spin = useRef()
  const radius = radiusFor(body.radius)
  useFrame((_, dt) => {
    if (running) orbit.current.rotation.y += dt * speed * (365.256 / body.period) * .13
    spin.current.rotation.y += dt * .28
  })
  return <group ref={orbit}>
    <group position={[distance, 0, 0]}>
      <mesh ref={spin} castShadow receiveShadow onClick={e => { e.stopPropagation(); select(body.name) }}>
        <sphereGeometry args={[radius, 40, 40]}/>
        <meshStandardMaterial color={body.color} roughness={.78}/>
      </mesh>
      {body.name === 'Saturn' && <mesh rotation={[Math.PI/2,0,0]} castShadow receiveShadow>
        <ringGeometry args={[radius*1.25,radius*1.9,80]}/>
        <meshStandardMaterial color="#c7b27a" side={THREE.DoubleSide} transparent opacity={.72}/>
      </mesh>}
      {body.name === 'Ziemia' && <group rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
        <PerspectiveCamera ref={earthCamera} position={[1.25,.75,1.9]} fov={48}/>
        <mesh position={[radius + .16,0,0]} castShadow receiveShadow>
          <sphereGeometry args={[Math.max(.055,radius*.2724),24,24]}/>
          <meshStandardMaterial color="#b8bdc5" roughness={1}/>
        </mesh>
      </group>}
      {selected === body.name && <Html center position={[0,radius+.38,0]}><div className="tag">{body.name}</div></Html>}
    </group>
  </group>
}

function CameraSwitch({ mode, earthCamera }) {
  useFrame(({ set, camera }) => {
    const target = mode === 'earth' ? earthCamera.current : null
    if (target && camera !== target) set({ camera: target })
  })
  return null
}

function SolarSystem({ running, speed, scale, selected, select, cameraMode }) {
  const earthCamera = useRef()
  const maxOrbit = distanceFor(30.069, scale)
  return <>
    <ambientLight intensity={.08}/>
    <pointLight position={[0,0,0]} intensity={900} distance={maxOrbit*2.3} decay={1.25} color="#fff2cf" castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.0002}/>
    <mesh castShadow={false} onClick={() => select('Słońce')}>
      <sphereGeometry args={[1.15,64,64]}/><meshBasicMaterial color="#ffb52d"/>
    </mesh>
    <pointLight position={[0,0,0]} intensity={38} distance={8} color="#ff9e1c"/>
    {PLANETS.map(body => {
      const distance = distanceFor(body.au, scale)
      return <React.Fragment key={body.name}>
        <Orbit radius={distance}/>
        <Planet body={body} distance={distance} running={running} speed={speed} selected={selected} select={select} earthCamera={body.name === 'Ziemia' ? earthCamera : undefined}/>
      </React.Fragment>
    })}
    <CameraSwitch mode={cameraMode} earthCamera={earthCamera}/>
    {cameraMode === 'global' && <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={maxOrbit*2.2}/>}
  </>
}

function ShadowVolume({ start, end, r0, r1, color, opacity }) {
  const length = end - start
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(r0, r1, length, 64, 1, true)
    g.rotateZ(Math.PI/2)
    return g
  }, [length,r0,r1])
  return <mesh geometry={geometry} position={[(start+end)/2,0,0]}>
    <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>
}

function EclipseScene({ type, phase, cameraMode }) {
  const earthGroup = useRef()
  const attachedCamera = useRef()
  const solar = type === 'solar'
  const sunX = -42
  const earthX = solar ? 8 : 0
  const moonX = solar ? THREE.MathUtils.lerp(1.9, 6.75, phase) : THREE.MathUtils.lerp(4.5, 8, phase)
  const moonY = Math.sin((phase-.5)*Math.PI) * 1.25
  const sunR = 4.25, earthR = 1, moonR = .2724
  const occX = solar ? moonX : earthX
  const occR = solar ? moonR : earthR
  const targetX = solar ? earthX : moonX
  const d = occX - sunX
  const umbraLength = d * occR / (sunR - occR)
  const behind = Math.max(.01, targetX-occX)
  const umbraAtTarget = Math.max(.01, occR - behind * (sunR-occR)/d)
  const penumbraAtTarget = occR + behind * (sunR+occR)/d
  useFrame((_,dt) => { if (earthGroup.current) earthGroup.current.rotation.x += dt*.045 })
  return <>
    <ambientLight intensity={.035}/>
    <pointLight position={[sunX,0,0]} intensity={4200} distance={100} decay={1.15} color="#fff2d2" castShadow shadow-mapSize={[2048,2048]} shadow-camera-near={.1} shadow-camera-far={80} shadow-bias={-.00012}/>
    <mesh position={[sunX,0,0]}><sphereGeometry args={[sunR,64,64]}/><meshBasicMaterial color="#ffb32c"/></mesh>
    <group ref={earthGroup} position={[earthX,0,0]} rotation={[0,0,THREE.MathUtils.degToRad(23.44)]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[earthR,64,64]}/>
        <meshStandardMaterial color="#2867bb" roughness={.86}/>
      </mesh>
      <PerspectiveCamera ref={attachedCamera} position={[2.8,1.45,4.5]} fov={44}/>
    </group>
    <mesh position={[moonX,moonY,0]} castShadow receiveShadow>
      <sphereGeometry args={[moonR,40,40]}/><meshStandardMaterial color="#aeb4bd" roughness={1}/>
    </mesh>
    {Math.abs(moonY) < .72 && <>
      <ShadowVolume start={occX} end={occX+umbraLength} r0={occR} r1={.001} color="#080b12" opacity={.46}/>
      <ShadowVolume start={occX} end={targetX+.4} r0={occR} r1={penumbraAtTarget} color="#536078" opacity={.105}/>
      <mesh position={[targetX-.002,0,0]} rotation={[0,Math.PI/2,0]}>
        <circleGeometry args={[umbraAtTarget,64]}/><meshBasicMaterial color="#020307" transparent opacity={.82} depthWrite={false}/>
      </mesh>
      <mesh position={[targetX-.004,0,0]} rotation={[0,Math.PI/2,0]}>
        <ringGeometry args={[umbraAtTarget,penumbraAtTarget,64]}/><meshBasicMaterial color="#172033" transparent opacity={.46} depthWrite={false}/>
      </mesh>
    </>}
    <Line points={[[sunX,0,0],[targetX,0,0]]} color="#ffcb66" transparent opacity={.2}/>
    <CameraSwitch mode={cameraMode} earthCamera={attachedCamera}/>
    {cameraMode === 'global' && <OrbitControls makeDefault target={[solar?2:0,0,0]} enableDamping minDistance={4} maxDistance={70}/>}
  </>
}

function ScaleLegend({ scale }) {
  return <div className="scale-note">
    <span>SKALA WIDOKU</span>
    <strong>{scale === 'astronomical' ? 'Względna / astronomiczna' : 'Czytelna / skompresowana'}</strong>
    <p>Promienie i okresy zachowują relacje danych NASA. Odległości są {scale === 'astronomical' ? 'mapowane logarytmicznie względem AU' : 'skompresowane funkcją potęgową'}, aby 30,07 AU mieściło się na ekranie.</p>
  </div>
}

function App() {
  const [view,setView] = useState('system')
  const [scale,setScale] = useState('compressed')
  const [running,setRunning] = useState(true)
  const [speed,setSpeed] = useState(1)
  const [selected,setSelected] = useState('Ziemia')
  const [eclipse,setEclipse] = useState('solar')
  const [phase,setPhase] = useState(.5)
  const [cameraMode,setCameraMode] = useState('global')
  const chosen = PLANETS.find(p=>p.name===selected)
  return <main>
    <header>
      <div><span className="eyebrow">ORBITAL MECHANICS · INTERACTIVE 3D</span><h1>Solar <em>Eclipse Lab</em></h1></div>
      <nav className="tabs" aria-label="Widok">
        <button className={view==='system'?'active':''} onClick={()=>{setView('system');setCameraMode('global')}}>Układ Słoneczny</button>
        <button className={view==='eclipse'?'active':''} onClick={()=>{setView('eclipse');setCameraMode('global')}}>Laboratorium zaćmień</button>
      </nav>
    </header>
    <section className="stage">
      <Canvas shadows dpr={[1,1.75]} camera={{position:view==='system'?[18,14,22]:[17,9,18],fov:46}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}>
        <color attach="background" args={['#03060c']}/><fog attach="fog" args={['#03060c',42,105]}/>
        <Stars radius={95} depth={45} count={2600} factor={3} saturation={0}/>
        <Suspense fallback={null}>{view==='system'
          ? <SolarSystem running={running} speed={speed} scale={scale} selected={selected} select={setSelected} cameraMode={cameraMode}/>
          : <EclipseScene type={eclipse} phase={phase} cameraMode={cameraMode}/>}
        </Suspense>
      </Canvas>
      <div className="status"><i className={running?'live':''}/>{view==='system'?(running?'SYMULACJA AKTYWNA':'PAUZA'):(eclipse==='solar'?'ZAĆMIENIE SŁOŃCA':'ZAĆMIENIE KSIĘŻYCA')}</div>
      <aside className="panel">
        {view==='system' ? <>
          <span className="section-kicker">MODEL DANYCH</span><h2>Proporcje, które można odczytać</h2>
          <div className="segmented"><button className={scale==='compressed'?'on':''} onClick={()=>setScale('compressed')}>Czytelna</button><button className={scale==='astronomical'?'on':''} onClick={()=>setScale('astronomical')}>Astronomiczna</button></div>
          <ScaleLegend scale={scale}/>
          <button className="primary" onClick={()=>setRunning(v=>!v)}>{running?'Zatrzymaj orbity':'Uruchom orbity'}</button>
          <label>Tempo symulacji <b>{speed.toFixed(1)}×</b><input type="range" min=".2" max="5" step=".1" value={speed} onChange={e=>setSpeed(+e.target.value)}/></label>
          <div className="object-card"><small>WYBRANY OBIEKT</small><strong>{selected}</strong>{chosen&&<span>R = {chosen.radius.toLocaleString('pl-PL')} km · a = {chosen.au} AU<br/>Okres: {chosen.period.toLocaleString('pl-PL')} dni</span>}</div>
        </> : <>
          <span className="section-kicker">GEOMETRIA ŚWIATŁA</span><h2>Umbra i penumbra</h2>
          <div className="segmented"><button className={eclipse==='solar'?'on':''} onClick={()=>setEclipse('solar')}>Słońca</button><button className={eclipse==='lunar'?'on':''} onClick={()=>setEclipse('lunar')}>Księżyca</button></div>
          <p>{eclipse==='solar'?'Księżyc blokuje tarczę Słońca. Umbra tworzy małą, ciemną plamę na Ziemi; penumbra wyznacza obszar zaćmienia częściowego.':'Ziemia przechodzi między Słońcem a Księżycem. Księżyc zanurza się kolejno w półcieniu i cieniu Ziemi.'}</p>
          <label>Przejście przez węzeł <b>{Math.round(phase*100)}%</b><input type="range" min="0" max="1" step=".005" value={phase} onChange={e=>setPhase(+e.target.value)}/></label>
          <div className="facts"><div><span>Słońce / Ziemia</span><b>109,1×</b></div><div><span>Księżyc / Ziemia</span><b>0,2724×</b></div><div><span>Ziemia–Księżyc</span><b>384 400 km</b></div><div><span>Słońce–Ziemia</span><b>1 AU</b></div></div>
          <div className="callout">W scenie lokalnej relacje promieni są rzeczywiste. Odległość do Słońca jest jawnie skompresowana; stożki cienia są liczone z geometrii skończonej tarczy Słońca.</div>
        </>}
        <div className="camera-row"><span>KAMERA</span><button className={cameraMode==='global'?'on':''} onClick={()=>setCameraMode('global')}>Globalna</button><button className={cameraMode==='earth'?'on':''} onClick={()=>setCameraMode('earth')}>Ziemia · rig</button></div>
      </aside>
      <div className="legend"><span><i className="umbra"/>Umbra</span><span><i className="penumbra"/>Penumbra</span><span>Przeciągnij · obrót</span><span>Scroll · zoom</span></div>
    </section>
    <footer><span>THREE.JS / R3F · PHYSICALLY BASED SHADOWS</span><span>Dane: średnie promienie i okresy orbitalne · epoka poglądowa</span></footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>)
